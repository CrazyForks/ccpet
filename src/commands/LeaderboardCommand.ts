import { SupabaseSyncService, SupabaseConfig, LeaderboardEntry, LeaderboardQueryOptions } from '../services/SupabaseSyncService';
import { ConfigService } from '../services/ConfigService';
import { SUPABASE_CONFIG } from '../core/config';
import { LeaderboardFormatter } from '../ui/LeaderboardFormatter';
import { PetStorage } from '../services/PetStorage';
import * as fs from 'fs';
import * as path from 'path';

// 排行榜命令选项接口
interface LeaderboardCommandOptions {
  period?: 'today' | '7d' | '30d' | 'all';
  sort?: 'tokens' | 'cost' | 'survival';
  limit?: number;
  supabaseUrl?: string;
  supabaseApiKey?: string;
  verbose?: boolean;
}

export class LeaderboardCommand {
  name = 'leaderboard';
  description = 'Display pet leaderboard rankings with cost and survival data';

  async execute(args: string[]): Promise<void> {
    const options = this.parseArguments(args);

    if (options.verbose) {
      console.log('📊 Starting leaderboard query...');
    }

    try {
      // 验证Supabase配置
      const supabaseConfig = this.getSupabaseConfig(options);
      
      let leaderboardData: LeaderboardEntry[] = [];
      let isOfflineMode = false;

      try {
        // 尝试从Supabase获取数据
        if (supabaseConfig.url && supabaseConfig.apiKey) {
          const syncService = new SupabaseSyncService({ config: supabaseConfig });
          leaderboardData = await this.fetchLeaderboardData(syncService, options);
          
          if (options.verbose) {
            console.log(`✅ Retrieved ${leaderboardData.length} records from Supabase`);
          }
        } else {
          throw new Error('Supabase configuration missing');
        }
      } catch (error) {
        // 降级到本地数据
        if (options.verbose) {
          console.log(`⚠️  Supabase connection failed, using local data: ${error instanceof Error ? error.message : String(error)}`);
        }
        leaderboardData = await this.fetchLocalLeaderboardData();
        isOfflineMode = true;
        
        if (options.verbose) {
          console.log(`📂 Using local graveyard data with ${leaderboardData.length} records`);
        }
      }

      // 格式化和显示排行榜
      const formatter = new LeaderboardFormatter();
      const output = formatter.formatLeaderboard(leaderboardData, {
        period: options.period || 'today',
        sort: options.sort || 'tokens',
        limit: options.limit || 10,
        isOfflineMode
      });

      console.log(output);

    } catch (error) {
      console.error(`❌ Leaderboard command failed: ${error instanceof Error ? error.message : String(error)}`);
      if (options.verbose && error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  }

  private parseArguments(args: string[]): LeaderboardCommandOptions {
    const options: LeaderboardCommandOptions = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--period':
          const period = args[++i] as 'today' | '7d' | '30d' | 'all';
          if (!['today', '7d', '30d', 'all'].includes(period)) {
            console.error('❌ Invalid period. Must be one of: today, 7d, 30d, all');
            process.exit(1);
          }
          options.period = period;
          break;
        case '--sort':
          const sort = args[++i] as 'tokens' | 'cost' | 'survival';
          if (!['tokens', 'cost', 'survival'].includes(sort)) {
            console.error('❌ Invalid sort option. Must be one of: tokens, cost, survival');
            process.exit(1);
          }
          options.sort = sort;
          break;
        case '--limit':
          const limit = parseInt(args[++i], 10);
          if (isNaN(limit) || limit < 1 || limit > 100) {
            console.error('❌ Invalid limit. Must be a number between 1 and 100');
            process.exit(1);
          }
          options.limit = limit;
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
            console.error('Run "ccpet leaderboard --help" for usage information.');
            process.exit(1);
          }
      }
    }

    return options;
  }

  private getSupabaseConfig(options: LeaderboardCommandOptions): SupabaseConfig {
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

  private async fetchLeaderboardData(syncService: SupabaseSyncService, options: LeaderboardCommandOptions): Promise<LeaderboardEntry[]> {
    const queryOptions: LeaderboardQueryOptions = {
      period: options.period || 'today',
      sortBy: options.sort || 'tokens',
      limit: options.limit || 10
    };

    try {
      // 尝试使用存储过程查询（如果可用）
      return await syncService.queryLeaderboard(queryOptions);
    } catch (error) {
      if (options.verbose) {
        console.log('⚠️  Advanced leaderboard query failed, falling back to simple query');
      }
      
      // 降级到简化查询
      return await syncService.queryLeaderboardSimple(queryOptions);
    }
  }

  private async fetchLocalLeaderboardData(): Promise<LeaderboardEntry[]> {
    const entries: LeaderboardEntry[] = [];
    
    try {
      // 读取当前宠物状态
      const petStorage = new PetStorage();
      const currentPetState = petStorage.loadState();
      
      if (currentPetState) {
        entries.push({
          rank: 1,
          pet_name: currentPetState.petName,
          animal_type: currentPetState.animalType,
          total_tokens: currentPetState.totalLifetimeTokens || 0,
          total_cost: 0, // 本地模式下没有成本数据
          survival_days: Math.floor((Date.now() - currentPetState.birthTime.getTime()) / (24 * 60 * 60 * 1000)),
          is_alive: currentPetState.energy > 0
        });
      }

      // 读取墓地数据
      const graveyardPath = path.join(process.env.HOME || '~', '.claude-pet', 'graveyard');
      if (fs.existsSync(graveyardPath)) {
        const files = fs.readdirSync(graveyardPath);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const filePath = path.join(graveyardPath, file);
              const graveyardData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              
              entries.push({
                rank: 0, // 将在排序后分配
                pet_name: graveyardData.petName,
                animal_type: graveyardData.animalType,
                total_tokens: graveyardData.totalLifetimeTokens || 0,
                total_cost: 0, // 本地模式下没有成本数据
                survival_days: graveyardData.survivalDays || 0,
                is_alive: false
              });
            } catch (error) {
              // 忽略损坏的墓地文件
              continue;
            }
          }
        }
      }
    } catch (error) {
      console.warn('⚠️  Failed to read local pet data, showing empty leaderboard');
    }

    // 按tokens排序并分配排名
    entries.sort((a, b) => b.total_tokens - a.total_tokens);
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries;
  }

  private showHelp(): void {
    console.log('ccpet leaderboard - Display pet leaderboard rankings');
    console.log('');
    console.log('Usage: ccpet leaderboard [options]');
    console.log('');
    console.log('Options:');
    console.log('  --period <period>            Time period for rankings (default: today)');
    console.log('                               Options: today, 7d, 30d, all');
    console.log('  --sort <field>               Sort by field (default: tokens)');
    console.log('                               Options: tokens, cost, survival');
    console.log('  --limit <number>             Limit number of results (default: 10, max: 100)');
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
    console.log('Examples:');
    console.log('  ccpet leaderboard                      # Show today\'s top 10 by tokens');
    console.log('  ccpet leaderboard --period 7d          # Show 7-day rankings');
    console.log('  ccpet leaderboard --sort cost --limit 20  # Top 20 by cost');
    console.log('  ccpet leaderboard --sort survival --period all  # All-time survival leaders');
    console.log('');
    console.log('Offline Mode:');
    console.log('  - Falls back to local graveyard data when Supabase is unavailable');
    console.log('  - Shows local pet data and graveyard records');
    console.log('  - Cost data unavailable in offline mode');
    console.log('');
    console.log('Note: Requires Supabase configuration for full functionality');
  }
}