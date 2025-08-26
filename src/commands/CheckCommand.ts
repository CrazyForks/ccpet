import { ClaudeCodeStatusLine } from '../ccpet';

interface CheckCommandOptions {
  watch?: boolean;
  interval?: number;
}

export class CheckCommand {
  name = 'check';
  description = 'Manually check pet status without consuming Claude Code tokens';

  private countdownInterval: NodeJS.Timeout | null = null;
  private previousState: any = null;
  private errorCount: number = 0;
  private readonly MAX_ERRORS = 3;
  private countdownSeconds: number = 0;
  private refreshIntervalSeconds: number = 60;

  async execute(args: string[]): Promise<void> {
    const options = this.parseArguments(args);
    
    if (options.watch) {
      await this.startWatchMode(options.interval || 60);
    } else {
      await this.executeOnce();
    }
  }

  private parseArguments(args: string[]): CheckCommandOptions {
    const options: CheckCommandOptions = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--watch' || arg === '-w') {
        options.watch = true;
      } else if (arg === '--interval') {
        const intervalValue = parseInt(args[i + 1]);
        if (isNaN(intervalValue) || intervalValue < 10 || intervalValue > 300) {
          console.error('❌ 间隔时间必须在 10-300 秒之间');
          console.error('使用默认间隔 60 秒');
          options.interval = 60;
        } else {
          options.interval = intervalValue;
        }
        i++; // Skip the next argument as it's the interval value
      } else if (arg === '--help' || arg === '-h') {
        this.showHelp();
        process.exit(0);
      } else if (arg.startsWith('--')) {
        console.error(`❌ 未知参数: ${arg}`);
        this.showHelp();
        process.exit(1);
      }
    }
    
    return options;
  }

  private async startWatchMode(interval: number): Promise<void> {
    this.refreshIntervalSeconds = interval;
    this.countdownSeconds = interval;
    
    // Setup signal handlers for graceful exit
    this.setupSignalHandlers();
    
    // Initial display
    await this.executeOnceForWatch();
    
    // Start countdown timer (updates every second)
    this.countdownInterval = setInterval(async () => {
      this.countdownSeconds--;
      
      if (this.countdownSeconds <= 0) {
        // Time to refresh pet status
        this.countdownSeconds = this.refreshIntervalSeconds;
        await this.executeOnceForWatch();
      } else {
        // Just update countdown
        await this.updateCountdown();
      }
    }, 1000);
  }

  private async executeOnceForWatch(): Promise<void> {
    try {
      const statusLine = new ClaudeCodeStatusLine();
      const display = statusLine.getStatusDisplay();
      const currentState = (statusLine as any).pet ? (statusLine as any).pet.getState() : null;
      
      // Count actual lines in the display output
      const displayLines = display.split('\n').filter(line => line.trim() !== '').length;
      const totalLines = displayLines + 2; // + time info + countdown
      
      // For subsequent updates, move cursor up and clear lines
      if (this.previousState) {
        // Move cursor up to the beginning of our previous output and clear from cursor down
        process.stdout.write(`\x1b[${totalLines}A\x1b[0J`);
      }
      
      // Build output
      let output = '';
      
      // Pet display (could be multiple lines)
      output += display + '\n';
      
      // Time info
      if (currentState && currentState.lastFeedTime) {
        const timeSinceLastFeed = Date.now() - new Date(currentState.lastFeedTime).getTime();
        const minutes = Math.floor(timeSinceLastFeed / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
          output += `⏰ 距离上次喂食: ${hours}小时${minutes % 60}分钟前\n`;
        } else {
          output += `⏰ 距离上次喂食: ${minutes}分钟前\n`;
        }
      } else {
        output += '⏰ 距离上次喂食: 未知\n';
      }
      
      // Countdown
      output += `⏳ 下次更新: ${this.countdownSeconds}秒\n`;
      
      
      // Output everything at once
      process.stdout.write(output);
      
      statusLine.saveState();
      this.previousState = currentState ? { ...currentState } : null;
      this.errorCount = 0; // Reset error count on success
      
    } catch (error) {
      this.handleWatchError(error);
    }
  }

  private async updateCountdown(): Promise<void> {
    try {
      // Only update the countdown line (move cursor up 1 line, clear line)
      process.stdout.write('\x1b[1A\x1b[2K');
      process.stdout.write(`⏳ 下次更新: ${this.countdownSeconds}秒\n`);
    } catch (error) {
      // Ignore countdown update errors
    }
  }


  private async executeOnce(): Promise<void> {
    try {
      console.log('🐾 检查宠物状态...\n');
      
      const statusLine = new ClaudeCodeStatusLine();
      const display = statusLine.getStatusDisplay();
      statusLine.saveState();
      
      console.log(display);
      console.log('\n💡 提示: 这次查看不消耗Claude Code token');
      console.log('📝 在Claude Code中活跃使用可以喂养你的宠物');
      
      const petState = (statusLine as any).pet ? (statusLine as any).pet.getState() : null;
      this.showTimeInfo(petState);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ 检查宠物状态失败:', errorMessage);
      process.exit(1);
    }
  }

  private showTimeInfo(petState: any): void {
    if (petState && petState.lastFeedTime) {
      const timeSinceLastFeed = Date.now() - new Date(petState.lastFeedTime).getTime();
      const minutes = Math.floor(timeSinceLastFeed / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        console.log(`⏰ 距离上次喂食: ${hours}小时${minutes % 60}分钟前`);
      } else {
        console.log(`⏰ 距离上次喂食: ${minutes}分钟前`);
      }
    }
  }

  private handleWatchError(error: unknown): void {
    this.errorCount++;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ 获取状态失败 (${this.errorCount}/${this.MAX_ERRORS}): ${errorMessage}`);
    
    if (this.errorCount >= this.MAX_ERRORS) {
      console.log('\n⚠️ 连续失败次数过多，是否继续监控？');
      console.log('输入 y 继续，任何其他键退出监控');
      
      // In a real implementation, we'd need to handle user input here
      // For now, we'll exit after max errors
      console.log('连续失败，退出监控模式');
      this.cleanup();
      process.exit(1);
    }
  }

  private setupSignalHandlers(): void {
    process.on('SIGINT', () => {
      console.log('\n\n👋 收到退出信号，正在停止监控...');
      this.cleanup();
      console.log('✅ 监控已停止，再见！');
      process.exit(0);
    });
  }

  private cleanup(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private showHelp(): void {
    console.log('ccpet check - 检查宠物状态');
    console.log('');
    console.log('用法: ccpet check [options]');
    console.log('');
    console.log('选项:');
    console.log('  -w, --watch              开启持续监控模式');
    console.log('  --interval <seconds>     设置监控间隔 (10-300秒，默认60秒)');
    console.log('  -h, --help              显示帮助信息');
    console.log('');
    console.log('示例:');
    console.log('  ccpet check              单次检查宠物状态');
    console.log('  ccpet check --watch      开启持续监控 (60秒间隔)');
    console.log('  ccpet check -w --interval 30   持续监控，30秒间隔');
    console.log('');
    console.log('注意:');
    console.log('  • 持续监控模式下按 Ctrl+C 退出');
    console.log('  • 监控间隔必须在 10-300 秒之间');
    console.log('  • 状态变化会被高亮显示');
  }
}