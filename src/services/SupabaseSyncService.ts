import * as https from 'https';
import { URL } from 'url';
import { TokenUsageRecord } from './CCUsageReader';

// Supabase配置接口
export interface SupabaseConfig {
  url: string;
  apiKey: string;
}

// 宠物记录数据库格式
export interface PetRecord {
  id: string; // 使用本地宠物的UUID作为主键
  pet_name: string;
  animal_type: string;
  emoji?: string; // 宠物表情符号
  birth_time: string; // ISO string
  death_time?: string; // ISO string
  survival_days?: number;
}

// Token使用记录数据库格式（扩展添加pet_id）
export interface TokenUsageRecordWithPetId extends TokenUsageRecord {
  pet_id: string;
}

// 同步状态
export interface SyncStatus {
  total: number;
  processed: number;
  failed: number;
  errors: string[];
}

// 同步结果
export interface SyncResult {
  success: boolean;
  status: SyncStatus;
  message: string;
}

// 排行榜查询选项
export interface LeaderboardQueryOptions {
  period: 'today' | '7d' | '30d' | 'all';
  sortBy: 'tokens' | 'cost' | 'survival';
  limit: number;
}

// 排行榜条目接口
export interface LeaderboardEntry {
  rank: number;
  pet_name: string;
  animal_type: string;
  total_tokens: number;
  total_cost: number;
  survival_days: number;
  is_alive: boolean;
}

// HTTP请求错误类
export class SupabaseHTTPError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: any
  ) {
    super(message);
    this.name = 'SupabaseHTTPError';
  }
}

// 同步错误类
export class SupabaseSyncError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'SupabaseSyncError';
    this.cause = cause;
  }
}

// 依赖注入接口
interface ISupabaseSyncServiceDependencies {
  httpsRequest?: (options: https.RequestOptions, data?: string) => Promise<{ statusCode: number; body: string }>;
  config: SupabaseConfig;
}

export class SupabaseSyncService {
  private deps: ISupabaseSyncServiceDependencies;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(dependencies: ISupabaseSyncServiceDependencies) {
    this.deps = {
      httpsRequest: dependencies.httpsRequest || this._defaultHttpsRequest,
      ...dependencies
    };

    this.baseUrl = this.deps.config.url.endsWith('/') 
      ? this.deps.config.url.slice(0, -1) 
      : this.deps.config.url;

    this.headers = {
      'Content-Type': 'application/json',
      'apikey': this.deps.config.apiKey,
      'Authorization': `Bearer ${this.deps.config.apiKey}`,
      'Prefer': 'return=minimal'
    };
  }

  /**
   * 同步宠物记录到Supabase
   * @param petRecord 宠物记录
   * @returns 同步后的宠物记录ID
   */
  public async syncPetRecord(petRecord: PetRecord): Promise<string> {
    try {
      // 检查是否需要更新宠物记录
      const existingRecord = await this._getPetRecord(petRecord.id);
      if (existingRecord && !this._needsPetUpdate(existingRecord, petRecord)) {
        return petRecord.id; // 跳过不必要的更新
      }

      // 使用宠物UUID进行upsert操作（插入或更新）
      await this._upsertPetRecord(petRecord);
      return petRecord.id;
    } catch (error) {
      throw new SupabaseSyncError(
        `Failed to sync pet record for ${petRecord.pet_name} (UUID: ${petRecord.id}): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 批量同步Token使用记录
   * @param records Token使用记录数组
   * @returns 同步结果
   */
  public async syncTokenUsageRecords(records: TokenUsageRecordWithPetId[]): Promise<SyncResult> {
    const status: SyncStatus = {
      total: records.length,
      processed: 0,
      failed: 0,
      errors: []
    };

    if (records.length === 0) {
      return {
        success: true,
        status,
        message: 'No records to sync'
      };
    }

    try {
      // 批量处理记录，避免单次请求过大
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await this._syncTokenUsageBatch(batch, status);
      }

      const success = status.failed === 0;
      return {
        success,
        status,
        message: success 
          ? `Successfully synced ${status.processed} records` 
          : `Synced ${status.processed} records with ${status.failed} failures`
      };
    } catch (error) {
      status.errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        status,
        message: `Sync failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 执行增量同步检查
   * @param petId 宠物ID
   * @param records Token使用记录
   * @returns 需要同步的记录
   */
  public async getRecordsToSync(petId: string, records: TokenUsageRecord[]): Promise<TokenUsageRecordWithPetId[]> {
    try {
      // 获取已存在的记录（包含详细信息用于精确比较）
      const existingRecords = await this._getExistingUsageRecords(petId, records);
      const existingRecordsMap = new Map<string, TokenUsageRecord>();
      
      // 为现有记录创建索引
      existingRecords.forEach(record => {
        const key = this._createRecordKey(record);
        existingRecordsMap.set(key, record);
      });
      
      // 过滤出需要同步的记录（使用精确比较）
      return records
        .filter(record => {
          const key = this._createRecordKey(record);
          return !existingRecordsMap.has(key);
        })
        .map(record => ({ ...record, pet_id: petId }));
    } catch (error) {
      throw new SupabaseSyncError(
        `Failed to check existing records for pet ${petId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 获取宠物记录
   * @param petId 宠物ID
   * @returns 宠物记录或null
   */
  private async _getPetRecord(petId: string): Promise<PetRecord | null> {
    try {
      const url = `${this.baseUrl}/rest/v1/pet_records?id=eq.${petId}&limit=1`;
      const { statusCode, body } = await this.deps.httpsRequest!({
        method: 'GET',
        headers: this.headers,
        url
      } as any, '');
      
      if (statusCode !== 200) {
        return null;
      }
      
      const records = JSON.parse(body);
      return records.length > 0 ? records[0] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 检查宠物记录是否需要更新
   * @param existing 现有记录
   * @param newRecord 新记录
   * @returns 是否需要更新
   */
  private _needsPetUpdate(existing: PetRecord, newRecord: PetRecord): boolean {
    // 检查关键字段是否有变化
    return (
      existing.pet_name !== newRecord.pet_name ||
      existing.animal_type !== newRecord.animal_type ||
      existing.emoji !== newRecord.emoji ||
      existing.birth_time !== newRecord.birth_time ||
      existing.death_time !== newRecord.death_time ||
      existing.survival_days !== newRecord.survival_days
    );
  }

  /**
   * 使用宠物UUID进行upsert操作（插入或更新）
   * @param petRecord 宠物记录
   */
  private async _upsertPetRecord(petRecord: PetRecord): Promise<void> {
    const url = `${this.baseUrl}/rest/v1/pet_records`;
    const payload = JSON.stringify(petRecord);
    
    const { statusCode, body } = await this.deps.httpsRequest!({
      method: 'POST',
      headers: {
        ...this.headers,
        'Prefer': 'resolution=merge-duplicates'
      },
      url
    } as any, payload);
    
    if (statusCode !== 201 && statusCode !== 200) {
      throw new SupabaseHTTPError(`Failed to upsert pet record: ${statusCode}`, statusCode, body);
    }
  }




  /**
   * 获取已存在的记录（用于精确比较）
   * @param petId 宠物ID
   * @param newRecords 新记录数组（用于过滤日期范围）
   * @returns 已存在的记录数组
   */
  private async _getExistingUsageRecords(petId: string, newRecords: TokenUsageRecord[]): Promise<TokenUsageRecord[]> {
    if (newRecords.length === 0) {
      return [];
    }

    // 获取日期范围以优化查询
    const dates = newRecords.map(r => r.usage_date).sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const url = `${this.baseUrl}/rest/v1/token_usage?pet_id=eq.${petId}&usage_date=gte.${startDate}&usage_date=lte.${endDate}&select=usage_date,total_tokens,input_tokens,output_tokens,cost_usd`;

    const { statusCode, body } = await this.deps.httpsRequest!({
      method: 'GET',
      headers: this.headers,
      url
    } as any, '');

    if (statusCode !== 200) {
      throw new SupabaseHTTPError(`Failed to query existing usage records: ${statusCode}`, statusCode, body);
    }

    return JSON.parse(body);
  }

  /**
   * 为记录创建唯一键（用于精确比较）
   * @param record 记录
   * @returns 唯一键
   */
  private _createRecordKey(record: TokenUsageRecord): string {
    return `${record.usage_date}-${record.total_tokens}-${record.input_tokens || 0}-${record.output_tokens || 0}-${(record.cost_usd || 0).toFixed(6)}`;
  }

  /**
   * 获取指定宠物的最后同步日期
   * @param petId 宠物ID
   * @returns 最后同步的日期，如果没有记录则返回null
   */
  public async getLastSyncDate(petId: string): Promise<string | null> {
    try {
      const url = `${this.baseUrl}/rest/v1/token_usage?pet_id=eq.${petId}&select=usage_date&order=usage_date.desc&limit=1`;

      const { statusCode, body } = await this.deps.httpsRequest!({
        method: 'GET',
        headers: this.headers,
        url
      } as any, '');

      if (statusCode !== 200) {
        throw new SupabaseHTTPError(`Failed to query last sync date: ${statusCode}`, statusCode, body);
      }

      const records = JSON.parse(body);
      return records.length > 0 ? records[0].usage_date : null;
    } catch (error) {
      throw new SupabaseSyncError(
        `Failed to get last sync date for pet ${petId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 查询排行榜数据
   * @param options 查询选项
   * @returns 排行榜条目数组
   */
  public async queryLeaderboard(options: LeaderboardQueryOptions): Promise<LeaderboardEntry[]> {
    try {
      const dateFilter = this._buildDateFilter(options.period);
      
      const url = `${this.baseUrl}/rest/v1/rpc/get_leaderboard`;
      const payload = JSON.stringify({
        date_filter: dateFilter,
        sort_by: options.sortBy,
        limit_count: options.limit
      });

      const { statusCode, body } = await this.deps.httpsRequest!({
        method: 'POST',
        headers: this.headers,
        url
      } as any, payload);

      if (statusCode !== 200) {
        throw new SupabaseHTTPError(`Failed to query leaderboard: ${statusCode}`, statusCode, body);
      }

      const rawData = JSON.parse(body);
      return this._processLeaderboardData(rawData);
    } catch (error) {
      throw new SupabaseSyncError(
        `Failed to query leaderboard: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 使用简化查询获取排行榜数据（如果存储过程不可用）
   * @param options 查询选项
   * @returns 排行榜条目数组
   */
  public async queryLeaderboardSimple(options: LeaderboardQueryOptions): Promise<LeaderboardEntry[]> {
    try {
      // 分步查询：先查询宠物记录，再查询聚合的token使用数据
      const petsData = await this._queryPetRecords();
      const tokenData = await this._queryAggregatedTokenUsage(options.period);
      
      // 合并数据
      const leaderboardData = this._mergeLeaderboardData(petsData, tokenData);
      
      // 排序和限制
      const sortedData = this._sortLeaderboardData(leaderboardData, options.sortBy);
      return sortedData.slice(0, options.limit);
    } catch (error) {
      throw new SupabaseSyncError(
        `Failed to query leaderboard (simple): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 同步Token使用记录批次
   * @param batch 批次记录
   * @param status 同步状态
   */
  private async _syncTokenUsageBatch(batch: TokenUsageRecordWithPetId[], status: SyncStatus): Promise<void> {
    const url = `${this.baseUrl}/rest/v1/token_usage`;
    const data = JSON.stringify(batch);

    try {
      const { statusCode, body } = await this.deps.httpsRequest!({
        method: 'POST',
        headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates' },
        url
      } as any, data);

      if (statusCode === 201) {
        status.processed += batch.length;
      } else {
        status.failed += batch.length;
        status.errors.push(`Batch sync failed with status ${statusCode}: ${body}`);
      }
    } catch (error) {
      status.failed += batch.length;
      status.errors.push(`Batch sync error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 构建日期过滤器
   * @param period 时间段
   * @returns 日期过滤条件
   */
  private _buildDateFilter(period: 'today' | '7d' | '30d' | 'all'): string {
    const now = new Date();
    let startDate: string;

    switch (period) {
      case 'today':
        // 对于今天，使用等于今天的日期，而不是大于等于
        startDate = now.toISOString().split('T')[0];
        return `eq.${startDate}`;
        break;
      case '7d':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case '30d':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      case 'all':
        return 'all';
      default:
        startDate = now.toISOString().split('T')[0];
    }

    return `gte.${startDate}`;
  }


  /**
   * 查询所有宠物记录
   * @returns 宠物记录数组
   */
  private async _queryPetRecords(): Promise<any[]> {
    const url = `${this.baseUrl}/rest/v1/pet_records?select=*`;

    const { statusCode, body } = await this.deps.httpsRequest!({
      method: 'GET',
      headers: this.headers,
      url
    } as any, '');

    if (statusCode !== 200) {
      throw new SupabaseHTTPError(`Failed to query pet records: ${statusCode}`, statusCode, body);
    }

    return JSON.parse(body);
  }

  /**
   * 查询聚合的Token使用数据
   * @param period 时间段
   * @returns 聚合后的token使用数据
   */
  private async _queryAggregatedTokenUsage(period: 'today' | '7d' | '30d' | 'all'): Promise<any[]> {
    let url = `${this.baseUrl}/rest/v1/token_usage?select=pet_id,total_tokens,cost_usd`;

    // 添加日期过滤
    if (period !== 'all') {
      const dateFilter = this._buildDateFilter(period);
      url += `&usage_date=${dateFilter}`;
    }

    const { statusCode, body } = await this.deps.httpsRequest!({
      method: 'GET',
      headers: this.headers,
      url
    } as any, '');

    if (statusCode !== 200) {
      throw new SupabaseHTTPError(`Failed to query aggregated token usage: ${statusCode}`, statusCode, body);
    }

    const rawData = JSON.parse(body);
    
    // 对于"today"，如果没有数据就返回空数组，不回退到历史数据
    
    // 在应用端进行聚合
    const aggregated = new Map<string, { sum_tokens: number, sum_cost: number }>();
    
    rawData.forEach((item: any) => {
      const petId = item.pet_id;
      if (!aggregated.has(petId)) {
        aggregated.set(petId, { sum_tokens: 0, sum_cost: 0 });
      }
      const current = aggregated.get(petId)!;
      current.sum_tokens += parseInt(item.total_tokens) || 0;
      current.sum_cost += parseFloat(item.cost_usd) || 0;
    });

    // 转换为数组格式
    return Array.from(aggregated.entries()).map(([petId, data]) => ({
      pet_id: petId,
      sum: data.sum_tokens,
      sum_1: data.sum_cost
    }));
  }

  /**
   * 合并宠物数据和token使用数据
   * @param petsData 宠物数据
   * @param tokenData token使用数据
   * @returns 合并后的排行榜数据
   */
  private _mergeLeaderboardData(petsData: any[], tokenData: any[]): LeaderboardEntry[] {
    const tokenMap = new Map<string, any>();
    tokenData.forEach(item => {
      tokenMap.set(item.pet_id, item);
    });

    return petsData.map((pet, index) => {
      const tokenInfo = tokenMap.get(pet.id) || { sum: 0, sum_1: 0 };
      const now = new Date();
      const birthTime = new Date(pet.birth_time);
      const deathTime = pet.death_time ? new Date(pet.death_time) : null;
      
      // 计算存活天数
      const endTime = deathTime || now;
      const survivalDays = Math.floor((endTime.getTime() - birthTime.getTime()) / (24 * 60 * 60 * 1000));

      return {
        rank: index + 1, // 临时排名，将在排序后重新分配
        pet_name: pet.pet_name,
        animal_type: pet.animal_type,
        total_tokens: parseInt(tokenInfo.sum) || 0,
        total_cost: parseFloat(tokenInfo.sum_1) || 0,
        survival_days: survivalDays,
        is_alive: !deathTime
      };
    });
  }

  /**
   * 排序排行榜数据
   * @param data 排行榜数据
   * @param sortBy 排序字段
   * @returns 排序后的数据
   */
  private _sortLeaderboardData(data: LeaderboardEntry[], sortBy: 'tokens' | 'cost' | 'survival'): LeaderboardEntry[] {
    const sorted = [...data];
    
    switch (sortBy) {
      case 'tokens':
        sorted.sort((a, b) => b.total_tokens - a.total_tokens);
        break;
      case 'cost':
        sorted.sort((a, b) => b.total_cost - a.total_cost);
        break;
      case 'survival':
        sorted.sort((a, b) => b.survival_days - a.survival_days);
        break;
    }

    // 重新分配排名
    sorted.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return sorted;
  }

  /**
   * 处理排行榜数据（用于存储过程返回的数据）
   * @param rawData 原始数据
   * @returns 处理后的排行榜数据
   */
  private _processLeaderboardData(rawData: any[]): LeaderboardEntry[] {
    return rawData.map((item, index) => ({
      rank: index + 1,
      pet_name: item.pet_name,
      animal_type: item.animal_type,
      total_tokens: parseInt(item.total_tokens) || 0,
      total_cost: parseFloat(item.total_cost) || 0,
      survival_days: parseInt(item.survival_days) || 0,
      is_alive: item.is_alive || false
    }));
  }

  /**
   * 默认HTTPS请求实现
   * @param options 请求选项
   * @param data 请求数据
   * @returns 响应结果
   */
  private async _defaultHttpsRequest(options: https.RequestOptions & { url?: string }, data?: string): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      let requestOptions: https.RequestOptions;

      if (options.url) {
        // 如果直接提供了完整URL
        const parsedUrl = new URL(options.url);
        requestOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: options.method,
          headers: options.headers
        };
      } else {
        // 使用传统的hostname/path方式
        requestOptions = options;
      }

      const req = https.request(requestOptions, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body
          });
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(data);
      }

      req.end();
    });
  }

}