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
  private syncLogFile: string;
  private readonly testMode: boolean;

  constructor(configService?: ConfigService, testMode: boolean = false) {
    this.configService = configService || new ConfigService();
    this.testMode = testMode;
    
    // Use different paths for test and production environments
    const configDirName = testMode ? '.claude-pet-test' : '.claude-pet';
    const configDir = path.join(os.homedir(), configDirName);
    this.lastSyncFile = path.join(configDir, 'last-sync.json');
    this.syncLogFile = path.join(configDir, 'sync.log');
  }

  /**
   * 写入同步日志
   */
  private writeSyncLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}\n`;
      
      // 确保目录存在
      const logDir = path.dirname(this.syncLogFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      // 追加写入日志文件
      fs.appendFileSync(this.syncLogFile, logEntry);
    } catch (error) {
      // 写入日志失败时静默处理，避免影响主要功能
    }
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
        // 检查是否是僵尸进程（超过5分钟的同步进程认为是僵尸进程）
        const syncStartTime = lastSyncRecord.lastSyncTime;
        const timeoutMs = 5 * 60 * 1000; // 5分钟超时
        if (currentTime - syncStartTime > timeoutMs) {
          this.writeSyncLog(`Detected stale sync process (${Math.round((currentTime - syncStartTime) / 1000)}s), resetting sync status`, 'warn');
          this.updateSyncStatus(false, currentTime);
        } else {
          // 有正在进行的同步，跳过
          this.writeSyncLog(`Sync already in progress (started ${Math.round((currentTime - syncStartTime) / 1000)}s ago)`, 'info');
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
      this.writeSyncLog(`Auto sync check failed: ${error}`, 'error');
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
          this.writeSyncLog('Background sync completed successfully', 'info');
        } else {
          this.writeSyncLog(`Background sync failed with code ${code}`, 'error');
        }
      });

      syncProcess.on('error', (error) => {
        this.writeSyncLog(`Background sync process error: ${error.message}`, 'error');
        this.updateSyncStatus(false, Date.now());
      });

      this.writeSyncLog('Background sync triggered', 'info');

    } catch (error) {
      this.writeSyncLog(`Failed to trigger background sync: ${error}`, 'error');
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
      this.writeSyncLog(`Failed to read last sync record: ${error}`, 'error');
    }

    return {
      lastSyncTime: 0,
      syncInProgress: false
    };
  }

  /**
   * 强制重置同步状态（当同步状态卡住时使用）
   */
  public resetSyncStatus(): void {
    try {
      const record = this.getLastSyncRecord();
      const currentTime = Date.now();
      
      if (record.syncInProgress) {
        const stuckDuration = Math.round((currentTime - record.lastSyncTime) / 1000);
        this.writeSyncLog(`Manually resetting stuck sync status (was stuck for ${stuckDuration}s)`, 'warn');
      } else {
        this.writeSyncLog('Sync status manually reset (was already false)', 'info');
      }
      
      this.updateSyncStatus(false, currentTime);
    } catch (error) {
      this.writeSyncLog(`Failed to reset sync status: ${error}`, 'error');
    }
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
      this.writeSyncLog(`Sync status updated: syncInProgress=${syncInProgress}`, 'info');
    } catch (error) {
      this.writeSyncLog(`Failed to update sync status: ${error}`, 'error');
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

}