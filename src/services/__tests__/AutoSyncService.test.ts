import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoSyncService } from '../AutoSyncService';
import { ConfigService } from '../ConfigService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock file system
vi.mock('fs');
vi.mock('os');

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

describe('AutoSyncService', () => {
  let autoSyncService: AutoSyncService;
  let configService: ConfigService;
  let mockProcess: any;
  let mockSpawn: any;
  const testConfigPath = '/test/config/path';
  const testLastSyncFile = '/test/config/path/.claude-pet-test/last-sync.json';

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import spawn after mocking
    const { spawn } = await import('child_process');
    mockSpawn = vi.mocked(spawn);
    
    // Mock os.homedir
    vi.mocked(os.homedir).mockReturnValue('/test/config/path');
    
    // Mock file system operations
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
    
    // Create mock config service
    configService = {
      getConfig: vi.fn().mockReturnValue({
        supabase: {
          autoSync: true,
          syncInterval: 60, // 1 hour
          url: 'https://test.supabase.co',
          apiKey: 'test-api-key'
        }
      })
    } as any;

    // Create mock process
    mockProcess = {
      unref: vi.fn(),
      on: vi.fn(),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() }
    };
    
    mockSpawn.mockReturnValue(mockProcess);
    
    autoSyncService = new AutoSyncService(configService, true); // Test mode
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkAndTriggerAutoSync', () => {
    it('should not sync when autoSync is disabled', async () => {
      vi.mocked(configService.getConfig).mockReturnValue({
        supabase: { autoSync: false }
      });

      await autoSyncService.checkAndTriggerAutoSync();
      
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should not sync when Supabase is not configured', async () => {
      vi.mocked(configService.getConfig).mockReturnValue({
        supabase: { 
          autoSync: true,
          url: undefined,
          apiKey: undefined
        }
      });

      await autoSyncService.checkAndTriggerAutoSync();
      
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should not sync when interval has not passed', async () => {
      const recentTime = Date.now() - (30 * 60 * 1000); // 30 minutes ago
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        lastSyncTime: recentTime,
        syncInProgress: false
      }));
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await autoSyncService.checkAndTriggerAutoSync();
      
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should not sync when sync is already in progress', async () => {
      const recentTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        lastSyncTime: recentTime,
        syncInProgress: true
      }));
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await autoSyncService.checkAndTriggerAutoSync();
      
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should trigger sync when conditions are met in test mode', async () => {
      const oldTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        lastSyncTime: oldTime,
        syncInProgress: false
      }));
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
      
      await autoSyncService.checkAndTriggerAutoSync();
      
      expect(consoleSpy).toHaveBeenCalledWith('[TEST MODE] Would trigger background sync');
      expect(mockSpawn).not.toHaveBeenCalled(); // Test mode doesn't actually spawn
      
      consoleSpy.mockRestore();
    });

    it('should reset stale sync status', async () => {
      const staleTime = Date.now() - (40 * 60 * 1000); // 40 minutes ago
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        lastSyncTime: staleTime,
        syncInProgress: true
      }));
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const appendFileSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation();
      
      await autoSyncService.checkAndTriggerAutoSync();
      
      expect(appendFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('sync.log'),
        expect.stringMatching(/WARN.*Detected stale sync process.*resetting sync status/)
      );
      
      appendFileSpy.mockRestore();
    });

    it('should handle file read errors gracefully', async () => {
      // Make file exist first, then make readFileSync throw
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });

      const appendFileSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation();
      
      await autoSyncService.checkAndTriggerAutoSync();
      
      // Should not throw error and should log the error
      expect(appendFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('sync.log'),
        expect.stringMatching(/ERROR.*Failed to read last sync record/)
      );
      
      appendFileSpy.mockRestore();
    });
  });

  describe('getLastSyncTime', () => {
    it('should return null when no sync record exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = autoSyncService.getLastSyncTime();
      
      expect(result).toBeNull();
    });

    it('should return sync time when record exists', () => {
      const testTime = Date.now() - (60 * 60 * 1000);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        lastSyncTime: testTime,
        syncInProgress: false
      }));
      
      const result = autoSyncService.getLastSyncTime();
      
      expect(result).toEqual(new Date(testTime));
    });
  });

  describe('isSyncInProgress', () => {
    it('should return false when no record exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = autoSyncService.isSyncInProgress();
      
      expect(result).toBe(false);
    });

    it('should return correct sync status', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        lastSyncTime: Date.now(),
        syncInProgress: true
      }));
      
      const result = autoSyncService.isSyncInProgress();
      
      expect(result).toBe(true);
    });
  });

  describe('resetSyncStatus', () => {
    it('should reset sync status to false', () => {
      autoSyncService.resetSyncStatus();
      
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.stringContaining('last-sync.json'),
        expect.stringContaining('"syncInProgress": false')
      );
    });

    it('should create directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      autoSyncService.resetSyncStatus();
      
      expect(vi.mocked(fs.mkdirSync)).toHaveBeenCalledWith(
        expect.stringContaining('.claude-pet-test'),
        { recursive: true }
      );
    });
  });

  describe('error handling', () => {
    it('should handle config service errors', async () => {
      vi.mocked(configService.getConfig).mockImplementation(() => {
        throw new Error('Config error');
      });

      const appendFileSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation();
      
      await autoSyncService.checkAndTriggerAutoSync();
      
      expect(appendFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('sync.log'),
        expect.stringMatching(/ERROR.*Auto sync check failed/)
      );
      
      appendFileSpy.mockRestore();
    });

    it('should handle write errors gracefully', () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write error');
      });

      const appendFileSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation();
      
      autoSyncService.resetSyncStatus();
      
      expect(appendFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('sync.log'),
        expect.stringMatching(/ERROR.*Failed to update sync status/)
      );
      
      appendFileSpy.mockRestore();
    });
  });
});