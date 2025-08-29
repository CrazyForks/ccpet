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
      // 获取已存在的记录日期
      const existingDates = await this._getExistingUsageDates(petId);
      const existingDatesSet = new Set(existingDates);

      // 过滤出需要同步的记录
      return records
        .filter(record => !existingDatesSet.has(record.usage_date))
        .map(record => ({ ...record, pet_id: petId }));
    } catch (error) {
      throw new SupabaseSyncError(
        `Failed to check existing records for pet ${petId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
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
   * 获取已存在的使用日期
   * @param petId 宠物ID
   * @returns 已存在的使用日期数组
   */
  private async _getExistingUsageDates(petId: string): Promise<string[]> {
    const url = `${this.baseUrl}/rest/v1/token_usage?pet_id=eq.${petId}&select=usage_date`;

    const { statusCode, body } = await this.deps.httpsRequest!({
      method: 'GET',
      headers: this.headers,
      url
    } as any, '');

    if (statusCode !== 200) {
      throw new SupabaseHTTPError(`Failed to query existing usage dates: ${statusCode}`, statusCode, body);
    }

    const records = JSON.parse(body);
    return records.map((record: any) => record.usage_date);
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