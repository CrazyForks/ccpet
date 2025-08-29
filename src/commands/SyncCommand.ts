import { CCUsageReader } from '../services/CCUsageReader';
import { SupabaseSyncService, SupabaseConfig, PetRecord } from '../services/SupabaseSyncService';
import { PetStorage } from '../services/PetStorage';
import { ConfigService } from '../services/ConfigService';
import { SUPABASE_CONFIG } from '../core/config';
import { AnimalType, ANIMAL_CONFIGS } from '../core/config';
import * as fs from 'fs';
import * as path from 'path';

interface SyncCommandOptions {
  startDate?: string;
  endDate?: string;
  dryRun?: boolean;
  verbose?: boolean;
  supabaseUrl?: string;
  supabaseApiKey?: string;
}

export class SyncCommand {
  name = 'sync';
  description = 'Sync pet data and token usage to Supabase database';

  async execute(args: string[]): Promise<void> {
    const options = this.parseArguments(args);

    if (options.verbose) {
      console.log('🔄 Starting Supabase sync process...');
    }

    try {
      // 验证Supabase配置
      const supabaseConfig = this.getSupabaseConfig(options);
      if (!supabaseConfig.url || !supabaseConfig.apiKey) {
        console.error('❌ Supabase configuration missing');
        console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
        console.error('or use --supabase-url and --supabase-api-key options');
        process.exit(1);
      }

      // 加载宠物数据
      const petStorage = new PetStorage();
      const currentPetState = petStorage.loadState();
      
      if (!currentPetState) {
        console.error('❌ No pet data found. Please create a pet first.');
        process.exit(1);
      }
      
      if (options.verbose) {
        console.log(`📂 Loaded pet data: ${currentPetState.petName} (${currentPetState.animalType})`);
      }

      // 初始化Supabase同步服务（需要提前初始化用于查询数据）
      const syncService = new SupabaseSyncService({ config: supabaseConfig });

      // 智能确定同步日期范围
      const { startDate, endDate } = await this.determineSyncDateRange(options, currentPetState, syncService);
      
      if (options.verbose) {
        console.log(`📅 Sync date range: ${startDate} to ${endDate}`);
      }

      // 读取ccusage数据
      const ccusageReader = new CCUsageReader();
      const tokenUsageRecords = await ccusageReader.readTokenUsage(startDate, endDate);
      
      if (options.verbose) {
        console.log(`📊 Found ${tokenUsageRecords.length} token usage records`);
      }

      if (options.dryRun) {
        console.log('🔍 DRY RUN MODE - No data will be synced');
        console.log(`Pet: ${currentPetState.petName} (${ANIMAL_CONFIGS[currentPetState.animalType as AnimalType].name})`);
        console.log(`Records to sync: ${tokenUsageRecords.length}`);
        if (tokenUsageRecords.length > 0) {
          console.log('Sample records:');
          tokenUsageRecords.slice(0, 3).forEach(record => {
            console.log(`  ${record.usage_date}: ${record.total_tokens} tokens ($${record.cost_usd})`);
          });
        }
        return;
      }


      // 同步宠物记录
      if (options.verbose) {
        console.log('🐾 Syncing pet record...');
      }

      const petRecord: PetRecord = {
        id: currentPetState.uuid, // 使用本地宠物的UUID作为主键
        pet_name: currentPetState.petName,
        animal_type: currentPetState.animalType,
        emoji: currentPetState.emoji || ANIMAL_CONFIGS[currentPetState.animalType as AnimalType]?.emoji,
        birth_time: currentPetState.birthTime.toISOString(),
        // 如果宠物已死亡，计算死亡时间和存活天数
        ...(currentPetState.energy === 0 ? {
          death_time: new Date().toISOString(),
          survival_days: Math.floor((Date.now() - currentPetState.birthTime.getTime()) / (24 * 60 * 60 * 1000))
        } : {})
      };

      const petId = await syncService.syncPetRecord(petRecord);
      if (options.verbose) {
        console.log(`✅ Pet record synced with ID: ${petId}`);
      }

      // 检查需要同步的记录
      const recordsToSync = await syncService.getRecordsToSync(petId, tokenUsageRecords);
      
      if (recordsToSync.length === 0) {
        console.log('✅ All records are already synced');
        return;
      }

      if (options.verbose) {
        console.log(`📤 Syncing ${recordsToSync.length} new token usage records...`);
      }

      // 同步token使用记录
      const syncResult = await syncService.syncTokenUsageRecords(recordsToSync);

      if (syncResult.success) {
        console.log(`✅ Successfully synced ${syncResult.status.processed} records`);
      } else {
        console.error(`❌ Sync completed with errors: ${syncResult.message}`);
        if (syncResult.status.errors.length > 0) {
          console.error('Errors:');
          syncResult.status.errors.forEach(error => {
            console.error(`  ${error}`);
          });
        }
        process.exit(1);
      }

    } catch (error) {
      console.error(`❌ Sync failed: ${error instanceof Error ? error.message : String(error)}`);
      if (options.verbose && error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  }

  private parseArguments(args: string[]): SyncCommandOptions {
    const options: SyncCommandOptions = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--start-date':
          options.startDate = args[++i];
          break;
        case '--end-date':
          options.endDate = args[++i];
          break;
        case '--dry-run':
          options.dryRun = true;
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--supabase-url':
          options.supabaseUrl = args[++i];
          break;
        case '--supabase-api-key':
          options.supabaseApiKey = args[++i];
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
        default:
          if (arg.startsWith('--')) {
            console.error(`Unknown option: ${arg}`);
            console.error('Run "ccpet sync --help" for usage information.');
            process.exit(1);
          }
      }
    }

    // 验证日期格式
    if (options.startDate && !this.isValidDateFormat(options.startDate)) {
      console.error('❌ Invalid start date format. Use YYYY-MM-DD format.');
      process.exit(1);
    }

    if (options.endDate && !this.isValidDateFormat(options.endDate)) {
      console.error('❌ Invalid end date format. Use YYYY-MM-DD format.');
      process.exit(1);
    }

    return options;
  }

  private getSupabaseConfig(options: SyncCommandOptions): SupabaseConfig {
    // 优先级：命令行参数 > 环境变量 > 用户配置 > 默认配置
    const configService = new ConfigService();
    const userConfig = configService.getConfig();
    
    return {
      url: options.supabaseUrl || 
           process.env.SUPABASE_URL || 
           userConfig.supabase?.url || 
           SUPABASE_CONFIG.DEFAULT_URL,
      apiKey: options.supabaseApiKey || 
              process.env.SUPABASE_ANON_KEY || 
              userConfig.supabase?.apiKey || 
              SUPABASE_CONFIG.DEFAULT_API_KEY
    };
  }

  private isValidDateFormat(dateStr: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      return false;
    }

    try {
      const date = new Date(dateStr + 'T00:00:00.000Z');
      return !isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
    } catch {
      return false;
    }
  }

  private showHelp(): void {
    console.log('ccpet sync - Sync pet data and token usage to Supabase');
    console.log('');
    console.log('Usage: ccpet sync [options]');
    console.log('');
    console.log('Options:');
    console.log('  --start-date <YYYY-MM-DD>    Start date for token usage sync');
    console.log('  --end-date <YYYY-MM-DD>      End date for token usage sync');
    console.log('  --dry-run                    Preview sync without making changes');
    console.log('  --verbose, -v                Show detailed output');
    console.log('  --supabase-url <url>         Supabase project URL');
    console.log('  --supabase-api-key <key>     Supabase anonymous API key');
    console.log('  --help, -h                   Show this help message');
    console.log('');
    console.log('Configuration Priority (highest to lowest):');
    console.log('  1. Command line options (--supabase-url, --supabase-api-key)');
    console.log('  2. Environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)');
    console.log('  3. User configuration (ccpet config set supabase.url <value>)');
    console.log('  4. Default configuration from .mcp.json');
    console.log('');
    console.log('Configuration Commands:');
    console.log('  ccpet config set supabase.url <url>           # Set Supabase URL');
    console.log('  ccpet config set supabase.apiKey <key>        # Set API key');
    console.log('  ccpet config set supabase.autoSync true       # Enable auto sync');
    console.log('  ccpet config set supabase.syncInterval 720    # Sync every 12 hours');
    console.log('');
    console.log('Examples:');
    console.log('  ccpet sync                           # Sync all available data');
    console.log('  ccpet sync --dry-run                 # Preview sync without changes');
    console.log('  ccpet sync --verbose                 # Show detailed sync progress');
    console.log('  ccpet sync --start-date 2024-01-01   # Sync data from specific date');
    console.log('  ccpet sync --start-date 2024-01-01 --end-date 2024-01-31');
    console.log('');
    console.log('Smart Sync Logic:');
    console.log('  - First sync: From pet birth date to current date');
    console.log('  - Later syncs: From last synced date to current date');
    console.log('');
    console.log('Note: ccusage CLI tool must be installed and available in PATH');
  }

  /**
   * 智能确定同步日期范围
   * @param options 命令选项
   * @param petState 宠物状态
   * @param syncService Supabase同步服务
   * @returns 开始和结束日期
   */
  private async determineSyncDateRange(
    options: SyncCommandOptions,
    petState: any,
    syncService: SupabaseSyncService
  ): Promise<{ startDate: string; endDate: string }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // 如果用户明确指定了日期范围，优先使用用户指定的
    if (options.startDate || options.endDate) {
      return {
        startDate: options.startDate || this.getPetBirthDate(petState),
        endDate: options.endDate || today
      };
    }

    try {
      // 检查是否是第一次同步（通过查询数据库中是否有该宠物的记录）
      const isFirstSync = await this.isFirstSync(petState.uuid, syncService);

      if (isFirstSync) {
        // 第一次同步：从宠物出生日期同步到当前日期
        const petBirthDate = this.getPetBirthDate(petState);
        return {
          startDate: petBirthDate,
          endDate: today
        };
      } else {
        // 后续同步：从最后一条记录的日期的下一天开始同步到当前日期
        const lastSyncDate = await this.getLastSyncDate(petState.uuid, syncService);
        const nextDay = this.getNextDay(lastSyncDate);
        
        return {
          startDate: nextDay,
          endDate: today
        };
      }
    } catch (error) {
      // 出错时回退到从宠物出生日期开始同步
      console.warn('⚠️  Failed to determine smart sync range, falling back to full sync');
      return {
        startDate: this.getPetBirthDate(petState),
        endDate: today
      };
    }
  }

  /**
   * 获取宠物出生日期（基于pet-state.json文件的创建时间或宠物的birthTime）
   * @param petState 宠物状态
   * @returns 出生日期 (YYYY-MM-DD)
   */
  private getPetBirthDate(petState: any): string {
    try {
      // 优先使用宠物的birthTime
      if (petState.birthTime) {
        return new Date(petState.birthTime).toISOString().split('T')[0];
      }

      // 回退到pet-state.json文件的创建时间
      const petStateFilePath = path.join(process.env.HOME || '~', '.claude-pet', 'pet-state.json');
      if (fs.existsSync(petStateFilePath)) {
        const stats = fs.statSync(petStateFilePath);
        return stats.birthtime.toISOString().split('T')[0];
      }
    } catch (error) {
      // 如果都获取不到，使用今天的日期
      console.warn('⚠️  Could not determine pet birth date, using today');
    }
    
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 检查是否为第一次同步
   * @param petId 宠物ID
   * @param syncService 同步服务
   * @returns 是否为第一次同步
   */
  private async isFirstSync(petId: string, syncService: SupabaseSyncService): Promise<boolean> {
    try {
      const lastSyncDate = await syncService.getLastSyncDate(petId);
      return lastSyncDate === null; // 如果没有记录，则是第一次同步
    } catch (error) {
      // 如果查询失败，假设是第一次同步
      return true;
    }
  }

  /**
   * 获取最后一次同步的日期
   * @param petId 宠物ID
   * @param syncService 同步服务
   * @returns 最后同步的日期
   */
  private async getLastSyncDate(petId: string, syncService: SupabaseSyncService): Promise<string> {
    try {
      const lastDate = await syncService.getLastSyncDate(petId);
      if (lastDate) {
        return lastDate;
      }
    } catch (error) {
      console.warn('⚠️  Failed to get last sync date, using fallback');
    }
    
    // 如果获取失败，回退到7天前作为安全margin
    const fallback = new Date();
    fallback.setDate(fallback.getDate() - 7);
    return fallback.toISOString().split('T')[0];
  }

  /**
   * 获取指定日期的下一天
   * @param dateStr 日期字符串 (YYYY-MM-DD)
   * @returns 下一天的日期 (YYYY-MM-DD)
   */
  private getNextDay(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().split('T')[0];
  }
}