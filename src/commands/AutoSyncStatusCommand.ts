import { ConfigService } from '../services/ConfigService';
import { AutoSyncService } from '../services/AutoSyncService';

export class AutoSyncStatusCommand {
  name = 'autosync';
  description = 'Check auto sync status and manage auto sync settings';

  async execute(args: string[]): Promise<void> {
    if (args.length > 0) {
      const subCommand = args[0];
      
      switch (subCommand) {
        case 'status':
          await this.showStatus();
          break;
        case 'reset':
          await this.resetStatus();
          break;
        case 'enable':
          await this.enableAutoSync();
          break;
        case 'disable':
          await this.disableAutoSync();
          break;
        case 'interval':
          await this.setInterval(args[1]);
          break;
        case '--help':
        case '-h':
          this.showHelp();
          break;
        default:
          console.error(`Unknown subcommand: ${subCommand}`);
          console.error('Run "ccpet autosync --help" for usage information.');
          process.exit(1);
      }
    } else {
      await this.showStatus();
    }
  }

  private async showStatus(): Promise<void> {
    const configService = new ConfigService();
    const autoSyncService = new AutoSyncService(configService);
    const config = configService.getConfig();

    console.log('🔄 Auto Sync Status\n');

    // 显示配置状态
    const autoSyncEnabled = config.supabase?.autoSync || false;
    const syncInterval = config.supabase?.syncInterval || 1440;
    const supabaseConfigured = !!(config.supabase?.url && config.supabase?.apiKey);

    console.log(`Auto Sync: ${autoSyncEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`Sync Interval: ${syncInterval} minutes (${Math.round(syncInterval / 60 * 10) / 10} hours)`);
    console.log(`Supabase Config: ${supabaseConfigured ? '✅ Configured' : '❌ Not configured'}`);

    if (!supabaseConfigured) {
      console.log('\n⚠️  Supabase configuration incomplete. Auto sync will not work.');
      console.log('Configure with:');
      console.log('  ccpet config set supabase.url <your-supabase-url>');
      console.log('  ccpet config set supabase.apiKey <your-api-key>');
      return;
    }

    // 显示运行状态
    const lastSyncTime = autoSyncService.getLastSyncTime();
    const syncInProgress = autoSyncService.isSyncInProgress();

    console.log(`\nSync Status: ${syncInProgress ? '🔄 In Progress' : '✅ Ready'}`);
    
    if (lastSyncTime) {
      const timeSinceLastSync = Date.now() - lastSyncTime.getTime();
      const hoursSinceSync = Math.round(timeSinceLastSync / (60 * 60 * 1000) * 10) / 10;
      const nextSyncDue = timeSinceLastSync >= (syncInterval * 60 * 1000);
      
      console.log(`Last Sync: ${lastSyncTime.toLocaleString()} (${hoursSinceSync} hours ago)`);
      console.log(`Next Sync: ${nextSyncDue ? '🟡 Due now' : '🟢 Scheduled'}`);
      
      if (nextSyncDue && autoSyncEnabled) {
        console.log('\n💡 Auto sync is due. It will trigger on your next Claude Code interaction.');
      }
    } else {
      console.log(`Last Sync: Never`);
      if (autoSyncEnabled) {
        console.log('\n💡 First auto sync will trigger on your next Claude Code interaction.');
      }
    }

    if (!autoSyncEnabled) {
      console.log('\n💡 Enable auto sync with: ccpet autosync enable');
    }
  }

  private async resetStatus(): Promise<void> {
    const configService = new ConfigService();
    const autoSyncService = new AutoSyncService(configService);
    
    autoSyncService.resetSyncStatus();
    console.log('✅ Auto sync status has been reset.');
  }

  private async enableAutoSync(): Promise<void> {
    const configService = new ConfigService();
    configService.setSupabaseConfig('autoSync', true);
    console.log('✅ Auto sync enabled.');
    console.log('Auto sync will check and run on your next Claude Code interaction.');
  }

  private async disableAutoSync(): Promise<void> {
    const configService = new ConfigService();
    configService.setSupabaseConfig('autoSync', false);
    console.log('✅ Auto sync disabled.');
  }

  private async setInterval(intervalStr?: string): Promise<void> {
    if (!intervalStr) {
      console.error('❌ Please specify the sync interval in minutes.');
      console.error('Example: ccpet autosync interval 720  # 12 hours');
      process.exit(1);
    }

    const interval = parseInt(intervalStr, 10);
    if (isNaN(interval) || interval <= 0) {
      console.error('❌ Invalid interval. Please specify a positive number of minutes.');
      process.exit(1);
    }

    const configService = new ConfigService();
    configService.setSupabaseConfig('syncInterval', interval);
    
    const hours = Math.round(interval / 60 * 10) / 10;
    console.log(`✅ Auto sync interval set to ${interval} minutes (${hours} hours).`);
  }

  private showHelp(): void {
    console.log('ccpet autosync - Manage automatic sync settings and status');
    console.log('');
    console.log('Usage: ccpet autosync [command]');
    console.log('');
    console.log('Commands:');
    console.log('  status          Show auto sync status (default)');
    console.log('  enable          Enable auto sync');
    console.log('  disable         Disable auto sync');
    console.log('  interval <min>  Set sync interval in minutes');
    console.log('  reset           Reset sync status (clear in-progress flag)');
    console.log('  --help, -h      Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  ccpet autosync                  # Show current status');
    console.log('  ccpet autosync enable           # Enable auto sync');
    console.log('  ccpet autosync interval 720     # Set 12-hour interval');
    console.log('  ccpet autosync disable          # Disable auto sync');
    console.log('  ccpet autosync reset            # Reset stuck sync status');
    console.log('');
    console.log('Auto Sync Behavior:');
    console.log('  - Checks sync need on every Claude Code interaction');
    console.log('  - Runs sync in background if interval has passed');
    console.log('  - Prevents multiple simultaneous sync processes');
    console.log('  - Requires Supabase configuration (url and apiKey)');
  }
}