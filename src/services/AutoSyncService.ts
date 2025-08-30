import { ConfigService } from './ConfigService';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface LastSyncRecord {
  lastSyncTime: number;
  syncInProgress: boolean;
}

export class AutoSyncService {
  private configService: ConfigService;
  private lastSyncFile: string;
  private readonly testMode: boolean;

  constructor(configService?: ConfigService, testMode: boolean = false) {
    this.configService = configService || new ConfigService();
    this.testMode = testMode;
    
    // Use different paths for test and production environments
    const configDirName = testMode ? '.claude-pet-test' : '.claude-pet';
    this.lastSyncFile = path.join(os.homedir(), configDirName, 'last-sync.json');
  }

  /**
   * 检查是否需要自动同步，如果需要则在后台执行同步
   * 在每次 Claude Code 回调时调用
   */
  public async checkAndTriggerAutoSync(): Promise<void> {
    try {
      const config = this.configService.getConfig();
      
      // 检查是否启用了自动同步
      if (!config.supabase?.autoSync) {
        return;
      }

      // 检查 Supabase 配置是否完整
      if (!config.supabase.url || !config.supabase.apiKey) {
        console.warn('Auto sync enabled but Supabase configuration is incomplete');
        return;
      }

      const syncIntervalMinutes = config.supabase.syncInterval || 1440; // 默认24小时
      const syncIntervalMs = syncIntervalMinutes * 60 * 1000;
      
      const lastSyncRecord = this.getLastSyncRecord();
      const currentTime = Date.now();
      
      // 检查是否已经有同步进程在运行
      if (lastSyncRecord.syncInProgress) {
        // 检查是否是僵尸进程（超过30分钟的同步进程认为是僵尸进程）
        const syncStartTime = lastSyncRecord.lastSyncTime;
        if (currentTime - syncStartTime > 30 * 60 * 1000) {
          console.warn('Detected stale sync process, resetting sync status');
          this.updateSyncStatus(false, syncStartTime);
        } else {
          // 有正在进行的同步，跳过
          return;
        }
      }
      
      // 检查是否到了同步时间
      if (currentTime - lastSyncRecord.lastSyncTime < syncIntervalMs) {
        return;
      }

      // 触发后台同步
      this.triggerBackgroundSync();
      
    } catch (error) {
      console.warn('Auto sync check failed:', error);
    }
  }

  /**
   * 在后台启动同步进程
   */
  private triggerBackgroundSync(): void {
    try {
      // 标记同步开始
      this.updateSyncStatus(true, Date.now());

      // 在测试模式下不真正执行同步
      if (this.testMode) {
        console.log('[TEST MODE] Would trigger background sync');
        setTimeout(() => {
          this.updateSyncStatus(false, Date.now());
        }, 100);
        return;
      }

      // 构建同步命令
      const ccpetPath = this.getCCPetExecutablePath();
      const args = ['sync'];

      // 启动后台进程
      const syncProcess = spawn(ccpetPath, args, {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // 不等待进程完成，让它在后台运行
      syncProcess.unref();

      // 设置进程完成时的回调
      syncProcess.on('close', (code) => {
        const syncEndTime = Date.now();
        this.updateSyncStatus(false, syncEndTime);
        
        if (code === 0) {
          console.log('Background sync completed successfully');
        } else {
          console.warn(`Background sync failed with code ${code}`);
        }
      });

      syncProcess.on('error', (error) => {
        console.warn('Background sync process error:', error.message);
        this.updateSyncStatus(false, Date.now());
      });

      console.log('Background sync triggered');

    } catch (error) {
      console.warn('Failed to trigger background sync:', error);
      this.updateSyncStatus(false, Date.now());
    }
  }

  /**
   * 获取 ccpet 可执行文件路径
   */
  private getCCPetExecutablePath(): string {
    // 首先尝试全局安装的 ccpet
    try {
      const { execSync } = require('child_process');
      const globalPath = execSync('which ccpet', { encoding: 'utf8' }).trim();
      if (globalPath && fs.existsSync(globalPath)) {
        return globalPath;
      }
    } catch {
      // which 命令失败，继续尝试其他方法
    }

    // 尝试使用 npx 运行
    return 'npx';
  }

  /**
   * 读取上次同步记录
   */
  private getLastSyncRecord(): LastSyncRecord {
    try {
      if (fs.existsSync(this.lastSyncFile)) {
        const data = JSON.parse(fs.readFileSync(this.lastSyncFile, 'utf8'));
        return {
          lastSyncTime: data.lastSyncTime || 0,
          syncInProgress: data.syncInProgress || false
        };
      }
    } catch (error) {
      console.warn('Failed to read last sync record:', error);
    }

    return {
      lastSyncTime: 0,
      syncInProgress: false
    };
  }

  /**
   * 更新同步状态
   */
  private updateSyncStatus(syncInProgress: boolean, lastSyncTime: number): void {
    try {
      // 确保目录存在
      const dir = path.dirname(this.lastSyncFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const record: LastSyncRecord = {
        lastSyncTime,
        syncInProgress
      };

      fs.writeFileSync(this.lastSyncFile, JSON.stringify(record, null, 2));
    } catch (error) {
      console.warn('Failed to update sync status:', error);
    }
  }

  /**
   * 获取上次同步时间（用于显示）
   */
  public getLastSyncTime(): Date | null {
    const record = this.getLastSyncRecord();
    return record.lastSyncTime > 0 ? new Date(record.lastSyncTime) : null;
  }

  /**
   * 检查是否有同步正在进行
   */
  public isSyncInProgress(): boolean {
    const record = this.getLastSyncRecord();
    return record.syncInProgress;
  }

  /**
   * 手动重置同步状态（用于故障恢复）
   */
  public resetSyncStatus(): void {
    this.updateSyncStatus(false, Date.now());
  }
}