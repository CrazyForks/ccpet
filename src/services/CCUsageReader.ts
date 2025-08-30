import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ccusage CLI输出接口定义
export interface CCUsageOutput {
  date: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_tokens?: number;
  total_tokens: number;
  cost_usd: number;
}

// 转换后的数据库格式
export interface TokenUsageRecord {
  usage_date: string; // YYYY-MM-DD format
  input_tokens: number;
  output_tokens: number;
  cache_tokens: number;
  total_tokens: number;
  cost_usd: number;
  model_name: string;
}

// 数据验证错误类
export class CCUsageValidationError extends Error {
  constructor(message: string, public readonly data?: any) {
    super(message);
    this.name = 'CCUsageValidationError';
  }
}

// 依赖注入接口
interface ICCUsageReaderDependencies {
  execCommand?: (command: string) => Promise<{ stdout: string; stderr: string }>;
}

export class CCUsageReader {
  private deps: ICCUsageReaderDependencies;

  constructor(dependencies: ICCUsageReaderDependencies = {}) {
    this.deps = {
      execCommand: dependencies.execCommand || this._defaultExecCommand,
    };
  }

  /**
   * 读取ccusage CLI输出并解析为结构化数据
   * @param startDate 开始日期 (YYYY-MM-DD)
   * @param endDate 结束日期 (YYYY-MM-DD)
   * @returns 解析后的token使用记录数组
   */
  public async readTokenUsage(startDate?: string, endDate?: string): Promise<TokenUsageRecord[]> {
    try {
      const command = this._buildCCUsageCommand(startDate, endDate);
      const { stdout, stderr } = await this.deps.execCommand!(command);

      // 检查stderr，但忽略NPX安装信息
      if (stderr && stderr.trim() !== '') {
        const cleanStderr = stderr.trim();
        // 忽略npx安装输出
        if (!cleanStderr.match(/^npx:\s+(installed|cached)\s+\d+\s+in\s+[\d.]+s?$/)) {
          throw new CCUsageValidationError(`ccusage command stderr: ${stderr}`);
        }
      }

      const rawData = this._parseJsonOutput(stdout);
      const validatedData = this._validateData(rawData);
      return this._transformToTokenUsageRecords(validatedData);
    } catch (error) {
      if (error instanceof CCUsageValidationError) {
        throw error;
      }
      throw new CCUsageValidationError(
        `Failed to read ccusage data: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 验证ccusage数据完整性
   * @param data 原始ccusage数据
   * @returns 验证后的数据
   */
  private _validateData(data: any[]): CCUsageOutput[] {
    if (!Array.isArray(data)) {
      throw new CCUsageValidationError('ccusage output is not an array');
    }

    return data.map((item, index) => {
      this._validateSingleRecord(item, index);
      return this._sanitizeRecord(item);
    });
  }

  /**
   * 验证单条记录
   * @param item 单条记录
   * @param index 记录索引
   */
  private _validateSingleRecord(item: any, index: number): void {
    const requiredFields = ['date', 'inputTokens', 'outputTokens', 'totalTokens', 'totalCost'];
    const missingFields = requiredFields.filter(field => !(field in item));

    if (missingFields.length > 0) {
      throw new CCUsageValidationError(
        `Record at index ${index} missing required fields: ${missingFields.join(', ')}`,
        item
      );
    }

    // 验证日期格式
    if (!this._isValidDateFormat(item.date)) {
      throw new CCUsageValidationError(
        `Record at index ${index} has invalid date format: ${item.date}`,
        item
      );
    }

    // 验证数值字段
    const numericFields = ['inputTokens', 'outputTokens', 'totalTokens', 'totalCost'];
    for (const field of numericFields) {
      if (typeof item[field] !== 'number' || item[field] < 0) {
        throw new CCUsageValidationError(
          `Record at index ${index} has invalid ${field}: ${item[field]}`,
          item
        );
      }
    }

    // 验证缓存token字段（可选）
    if ('cacheCreationTokens' in item && item.cacheCreationTokens !== null && item.cacheCreationTokens !== undefined) {
      if (typeof item.cacheCreationTokens !== 'number' || item.cacheCreationTokens < 0) {
        throw new CCUsageValidationError(
          `Record at index ${index} has invalid cacheCreationTokens: ${item.cacheCreationTokens}`,
          item
        );
      }
    }

    if ('cacheReadTokens' in item && item.cacheReadTokens !== null && item.cacheReadTokens !== undefined) {
      if (typeof item.cacheReadTokens !== 'number' || item.cacheReadTokens < 0) {
        throw new CCUsageValidationError(
          `Record at index ${index} has invalid cacheReadTokens: ${item.cacheReadTokens}`,
          item
        );
      }
    }
  }

  /**
   * 清理和规范化记录数据
   * @param item 原始记录
   * @returns 清理后的记录
   */
  private _sanitizeRecord(item: any): CCUsageOutput {
    // 计算总缓存tokens
    const cacheTokens = (item.cacheCreationTokens || 0) + (item.cacheReadTokens || 0);
    
    // 从modelsUsed数组获取第一个模型，或使用默认值
    const model = Array.isArray(item.modelsUsed) && item.modelsUsed.length > 0 
      ? item.modelsUsed[0] 
      : 'claude-sonnet-4-20250514';

    return {
      date: typeof item.date === 'string' ? item.date.trim() : item.date,
      model: typeof model === 'string' ? model.trim() : model,
      input_tokens: Math.floor(item.inputTokens),
      output_tokens: Math.floor(item.outputTokens),
      cache_tokens: Math.floor(cacheTokens),
      total_tokens: Math.floor(item.totalTokens),
      cost_usd: parseFloat(item.totalCost.toFixed(4)),
    };
  }

  /**
   * 转换ccusage格式到数据库表格式
   * @param data 验证后的ccusage数据
   * @returns 数据库格式的记录
   */
  private _transformToTokenUsageRecords(data: CCUsageOutput[]): TokenUsageRecord[] {
    return data.map(item => ({
      usage_date: item.date, // ccusage已提供YYYY-MM-DD格式
      input_tokens: item.input_tokens,
      output_tokens: item.output_tokens,
      cache_tokens: item.cache_tokens || 0,
      total_tokens: item.total_tokens,
      cost_usd: item.cost_usd,
      model_name: item.model,
    }));
  }

  /**
   * 构建ccusage命令
   * @param startDate 开始日期 (YYYY-MM-DD)
   * @param endDate 结束日期 (YYYY-MM-DD)
   * @returns 完整的ccusage命令
   */
  private _buildCCUsageCommand(startDate?: string, endDate?: string): string {
    let command = 'npx ccusage@latest daily --json';

    if (startDate) {
      // 转换YYYY-MM-DD格式到YYYYMMDD格式
      const sinceDate = startDate.replace(/-/g, '');
      command += ` --since ${sinceDate}`;
    }

    if (endDate) {
      // 转换YYYY-MM-DD格式到YYYYMMDD格式
      const untilDate = endDate.replace(/-/g, '');
      command += ` --until ${untilDate}`;
    }

    return command;
  }

  /**
   * 解析JSON输出
   * @param stdout ccusage命令输出
   * @returns 解析后的JSON数据
   */
  private _parseJsonOutput(stdout: string): any[] {
    const trimmedOutput = stdout.trim();
    
    if (!trimmedOutput) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmedOutput);
      
      // ccusage返回 { daily: [...] } 格式，我们需要提取daily数组
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.daily)) {
        return parsed.daily;
      }
      
      // 如果是数组格式，直接返回（向后兼容）
      if (Array.isArray(parsed)) {
        return parsed;
      }
      
      throw new CCUsageValidationError('ccusage output format is not recognized');
    } catch (error) {
      if (error instanceof CCUsageValidationError) {
        throw error;
      }
      throw new CCUsageValidationError(
        `Failed to parse ccusage JSON output: ${error instanceof Error ? error.message : String(error)}`,
        { stdout: trimmedOutput }
      );
    }
  }

  /**
   * 验证日期格式 (YYYY-MM-DD)
   * @param dateStr 日期字符串
   * @returns 是否为有效日期格式
   */
  private _isValidDateFormat(dateStr: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      return false;
    }

    const date = new Date(dateStr + 'T00:00:00.000Z');
    return date.toISOString().startsWith(dateStr);
  }

  /**
   * 默认命令执行函数
   * @param command 要执行的命令
   * @returns 命令输出
   */
  private async _defaultExecCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    return await execAsync(command);
  }
}