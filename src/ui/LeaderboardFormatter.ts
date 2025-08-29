import { LeaderboardEntry } from '../services/SupabaseSyncService';
import { ANIMAL_CONFIGS, AnimalType } from '../core/config';
import Table from 'cli-table3';

interface LeaderboardFormatOptions {
  period: 'today' | '7d' | '30d' | 'all';
  sort: 'tokens' | 'cost' | 'survival';
  limit: number;
  isOfflineMode?: boolean;
}

export class LeaderboardFormatter {
  /**
   * 格式化排行榜输出
   * @param entries 排行榜数据
   * @param options 格式化选项
   * @returns 格式化后的字符串
   */
  public formatLeaderboard(entries: LeaderboardEntry[], options: LeaderboardFormatOptions): string {
    if (entries.length === 0) {
      return this._formatEmptyLeaderboard(options);
    }

    // 根据排序选项对数据进行排序
    const sortedEntries = this._sortEntries(entries, options.sort);
    
    // 限制结果数量
    const limitedEntries = sortedEntries.slice(0, options.limit);

    const output: string[] = [];
    
    // 添加标题头
    output.push(this._formatHeader(options));
    output.push('');

    // 添加表格
    output.push(this._formatTable(limitedEntries, options));
    
    // 添加页脚信息
    if (options.isOfflineMode) {
      output.push('');
      output.push('📡 Offline Mode: Showing local data only (cost data unavailable)');
    }
    
    // 添加倒计时信息（仅在在线模式下）
    if (!options.isOfflineMode) {
      output.push('');
      output.push(this._formatCountdown(options.period));
    }

    return output.join('\n');
  }

  private _sortEntries(entries: LeaderboardEntry[], sortBy: 'tokens' | 'cost' | 'survival'): LeaderboardEntry[] {
    const sorted = [...entries];
    
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

  private _formatHeader(options: LeaderboardFormatOptions): string {
    const periodNames = {
      today: "Today's",
      '7d': '7-Day',
      '30d': '30-Day',
      all: 'All-Time'
    };

    const sortNames = {
      tokens: 'Token Usage',
      cost: 'Cost Spending',
      survival: 'Survival Time'
    };

    const title = `🏆 ${periodNames[options.period]} ${sortNames[options.sort]} Leaderboard`;
    return `${title}\n${'═'.repeat(title.length - 2)}`;
  }

  private _formatTable(entries: LeaderboardEntry[], options: LeaderboardFormatOptions): string {
    const table = new Table({
      head: ['Rank', 'Pet Name', 'Type', 'Tokens', 'Cost', 'Survival', 'Status'],
      style: {
        head: ['cyan'],
        border: ['grey']
      },
      colWidths: [6, 15, 12, 12, 10, 10, 12], // 设置固定列宽
      wordWrap: true
    });

    // 添加数据行
    entries.forEach(entry => {
      const row = this._formatTableRowData(entry, options);
      table.push(row);
    });

    return table.toString();
  }

  private _formatTableRowData(entry: LeaderboardEntry, options: LeaderboardFormatOptions): string[] {
    const rank = `#${entry.rank}`;
    const petName = entry.pet_name;
    
    // 获取动物emoji和名称
    const animalConfig = ANIMAL_CONFIGS[entry.animal_type as AnimalType];
    const animalDisplay = animalConfig ? `${animalConfig.emoji} ${animalConfig.name}` : entry.animal_type;
    
    const tokens = this._formatNumber(entry.total_tokens);
    const cost = options.isOfflineMode ? 'N/A' : `$${entry.total_cost.toFixed(2)}`;
    const survival = `${entry.survival_days}d`;
    const status = entry.is_alive ? '✅ Alive' : '💀 Dead';
    
    return [rank, petName, animalDisplay, tokens, cost, survival, status];
  }

  private _formatNumber(num: number): string {
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(1)}B`;
    } else if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    } else {
      return num.toString();
    }
  }

  private _formatEmptyLeaderboard(options: LeaderboardFormatOptions): string {
    const output: string[] = [];
    
    output.push(this._formatHeader(options));
    output.push('');
    output.push('📭 No data available for the selected time period.');
    
    if (options.isOfflineMode) {
      output.push('');
      output.push('💡 Suggestions:');
      output.push('  • Check if you have any pets created');
      output.push('  • Configure Supabase connection for full functionality');
      output.push('  • Try running "ccpet sync" to upload data');
    } else {
      output.push('');
      output.push('💡 Suggestions:');
      output.push('  • Try a different time period (--period all)');
      output.push('  • Check if data sync is working with "ccpet sync"');
      output.push('  • Create some pets to see them in the leaderboard');
    }
    
    return output.join('\n');
  }

  private _formatCountdown(period: 'today' | '7d' | '30d' | 'all'): string {
    if (period === 'all') {
      return '⏰ All-time rankings (no reset)';
    }

    const now = new Date();
    let resetTime: Date;
    let resetLabel: string;

    switch (period) {
      case 'today':
        resetTime = new Date(now);
        resetTime.setHours(24, 0, 0, 0); // 明天午夜
        resetLabel = 'daily rankings reset';
        break;
      case '7d':
        resetTime = new Date(now);
        const daysUntilNextMonday = (7 - now.getDay() + 1) % 7 || 7;
        resetTime.setDate(now.getDate() + daysUntilNextMonday);
        resetTime.setHours(0, 0, 0, 0);
        resetLabel = 'weekly rankings reset';
        break;
      case '30d':
        resetTime = new Date(now.getFullYear(), now.getMonth() + 1, 1); // 下个月第一天
        resetLabel = 'monthly rankings reset';
        break;
      default:
        return '';
    }

    const timeDiff = resetTime.getTime() - now.getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `⏰ ${days}d ${remainingHours}h until ${resetLabel}`;
    } else if (hours > 0) {
      return `⏰ ${hours}h ${minutes}m until ${resetLabel}`;
    } else {
      return `⏰ ${minutes}m until ${resetLabel}`;
    }
  }
}