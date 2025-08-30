import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoSyncStatusCommand } from '../AutoSyncStatusCommand';
import { ConfigService } from '../../services/ConfigService';
import { AutoSyncService } from '../../services/AutoSyncService';

// Mock dependencies
vi.mock('../../services/ConfigService');
vi.mock('../../services/AutoSyncService');

describe('AutoSyncStatusCommand', () => {
  let command: AutoSyncStatusCommand;
  let mockConfigService: any;
  let mockAutoSyncService: any;
  let consoleSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock ConfigService
    mockConfigService = {
      getConfig: vi.fn(),
      setSupabaseConfig: vi.fn()
    };
    vi.mocked(ConfigService).mockImplementation(() => mockConfigService);

    // Mock AutoSyncService
    mockAutoSyncService = {
      getLastSyncTime: vi.fn(),
      isSyncInProgress: vi.fn(),
      resetSyncStatus: vi.fn()
    };
    vi.mocked(AutoSyncService).mockImplementation(() => mockAutoSyncService);

    // Mock console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(),
      error: vi.spyOn(console, 'error').mockImplementation()
    };

    // Mock process.exit
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    command = new AutoSyncStatusCommand();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('execute', () => {
    it('should show status by default when no args provided', async () => {
      mockConfigService.getConfig.mockReturnValue({
        supabase: {
          autoSync: true,
          syncInterval: 720,
          url: 'https://test.supabase.co',
          apiKey: 'test-key'
        }
      });
      mockAutoSyncService.getLastSyncTime.mockReturnValue(new Date('2024-01-01T12:00:00Z'));
      mockAutoSyncService.isSyncInProgress.mockReturnValue(false);

      await command.execute([]);

      expect(consoleSpy.log).toHaveBeenCalledWith('🔄 Auto Sync Status\n');
      expect(consoleSpy.log).toHaveBeenCalledWith('Auto Sync: ✅ Enabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('Sync Interval: 720 minutes (12 hours)');
    });

    it('should handle status subcommand', async () => {
      mockConfigService.getConfig.mockReturnValue({
        supabase: { autoSync: false, syncInterval: 1440 }
      });
      mockAutoSyncService.getLastSyncTime.mockReturnValue(null);
      mockAutoSyncService.isSyncInProgress.mockReturnValue(false);

      await command.execute(['status']);

      expect(consoleSpy.log).toHaveBeenCalledWith('Auto Sync: ❌ Disabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('Sync Interval: 1440 minutes (24 hours)');
    });

    it('should handle reset subcommand', async () => {
      await command.execute(['reset']);

      expect(mockAutoSyncService.resetSyncStatus).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('✅ Auto sync status has been reset.');
    });

    it('should handle enable subcommand', async () => {
      await command.execute(['enable']);

      expect(mockConfigService.setSupabaseConfig).toHaveBeenCalledWith('autoSync', true);
      expect(consoleSpy.log).toHaveBeenCalledWith('✅ Auto sync enabled.');
    });

    it('should handle disable subcommand', async () => {
      await command.execute(['disable']);

      expect(mockConfigService.setSupabaseConfig).toHaveBeenCalledWith('autoSync', false);
      expect(consoleSpy.log).toHaveBeenCalledWith('✅ Auto sync disabled.');
    });

    it('should handle interval subcommand with valid value', async () => {
      await command.execute(['interval', '480']);

      expect(mockConfigService.setSupabaseConfig).toHaveBeenCalledWith('syncInterval', 480);
      expect(consoleSpy.log).toHaveBeenCalledWith('✅ Auto sync interval set to 480 minutes (8 hours).');
    });

    it('should handle interval subcommand without value', async () => {
      await expect(async () => {
        await command.execute(['interval']);
      }).rejects.toThrow('process.exit called');

      expect(consoleSpy.error).toHaveBeenCalledWith('❌ Please specify the sync interval in minutes.');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle interval subcommand with invalid value', async () => {
      await expect(async () => {
        await command.execute(['interval', 'invalid']);
      }).rejects.toThrow('process.exit called');

      expect(consoleSpy.error).toHaveBeenCalledWith('❌ Invalid interval. Please specify a positive number of minutes.');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle interval subcommand with negative value', async () => {
      await expect(async () => {
        await command.execute(['interval', '-10']);
      }).rejects.toThrow('process.exit called');

      expect(consoleSpy.error).toHaveBeenCalledWith('❌ Invalid interval. Please specify a positive number of minutes.');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle help subcommand', async () => {
      await command.execute(['--help']);

      expect(consoleSpy.log).toHaveBeenCalledWith('ccpet autosync - Manage automatic sync settings and status');
    });

    it('should handle -h flag', async () => {
      await command.execute(['-h']);

      expect(consoleSpy.log).toHaveBeenCalledWith('ccpet autosync - Manage automatic sync settings and status');
    });

    it('should handle unknown subcommand', async () => {
      await expect(async () => {
        await command.execute(['unknown']);
      }).rejects.toThrow('process.exit called');

      expect(consoleSpy.error).toHaveBeenCalledWith('Unknown subcommand: unknown');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('showStatus', () => {
    it('should show status when auto sync disabled but Supabase configured', async () => {
      mockConfigService.getConfig.mockReturnValue({
        supabase: { 
          autoSync: false, 
          syncInterval: 1440,
          url: 'https://test.supabase.co',
          apiKey: 'test-key'
        }
      });
      mockAutoSyncService.getLastSyncTime.mockReturnValue(null);
      mockAutoSyncService.isSyncInProgress.mockReturnValue(false);

      await command.execute(['status']);

      expect(consoleSpy.log).toHaveBeenCalledWith('Auto Sync: ❌ Disabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n💡 Enable auto sync with: ccpet autosync enable');
    });

    it('should show warning when Supabase not configured', async () => {
      mockConfigService.getConfig.mockReturnValue({
        supabase: { 
          autoSync: true, 
          syncInterval: 720,
          url: undefined,
          apiKey: undefined
        }
      });

      await command.execute(['status']);

      expect(consoleSpy.log).toHaveBeenCalledWith('Supabase Config: ❌ Not configured');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n⚠️  Supabase configuration incomplete. Auto sync will not work.');
    });

    it('should show sync in progress status', async () => {
      mockConfigService.getConfig.mockReturnValue({
        supabase: {
          autoSync: true,
          syncInterval: 720,
          url: 'https://test.supabase.co',
          apiKey: 'test-key'
        }
      });
      mockAutoSyncService.getLastSyncTime.mockReturnValue(new Date('2024-01-01T12:00:00Z'));
      mockAutoSyncService.isSyncInProgress.mockReturnValue(true);

      await command.execute(['status']);

      expect(consoleSpy.log).toHaveBeenCalledWith('\nSync Status: 🔄 In Progress');
    });

    it('should show next sync due status', async () => {
      mockConfigService.getConfig.mockReturnValue({
        supabase: {
          autoSync: true,
          syncInterval: 60, // 1 hour
          url: 'https://test.supabase.co',
          apiKey: 'test-key'
        }
      });
      
      // Mock last sync time to be 2 hours ago
      const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000));
      mockAutoSyncService.getLastSyncTime.mockReturnValue(twoHoursAgo);
      mockAutoSyncService.isSyncInProgress.mockReturnValue(false);

      await command.execute(['status']);

      expect(consoleSpy.log).toHaveBeenCalledWith('Next Sync: 🟡 Due now');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n💡 Auto sync is due. It will trigger on your next Claude Code interaction.');
    });

    it('should show first sync message when never synced', async () => {
      mockConfigService.getConfig.mockReturnValue({
        supabase: {
          autoSync: true,
          syncInterval: 720,
          url: 'https://test.supabase.co',
          apiKey: 'test-key'
        }
      });
      mockAutoSyncService.getLastSyncTime.mockReturnValue(null);
      mockAutoSyncService.isSyncInProgress.mockReturnValue(false);

      await command.execute(['status']);

      expect(consoleSpy.log).toHaveBeenCalledWith('Last Sync: Never');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n💡 First auto sync will trigger on your next Claude Code interaction.');
    });

    it('should handle default syncInterval when not configured', async () => {
      mockConfigService.getConfig.mockReturnValue({
        supabase: {
          autoSync: true,
          // syncInterval not specified - should default to 1440
          url: 'https://test.supabase.co',
          apiKey: 'test-key'
        }
      });
      mockAutoSyncService.getLastSyncTime.mockReturnValue(null);
      mockAutoSyncService.isSyncInProgress.mockReturnValue(false);

      await command.execute(['status']);

      expect(consoleSpy.log).toHaveBeenCalledWith('Sync Interval: 1440 minutes (24 hours)');
    });

    it('should handle fractional hours display correctly', async () => {
      mockConfigService.getConfig.mockReturnValue({
        supabase: {
          autoSync: true,
          syncInterval: 90, // 1.5 hours
          url: 'https://test.supabase.co',
          apiKey: 'test-key'
        }
      });
      mockAutoSyncService.getLastSyncTime.mockReturnValue(null);
      mockAutoSyncService.isSyncInProgress.mockReturnValue(false);

      await command.execute(['status']);

      expect(consoleSpy.log).toHaveBeenCalledWith('Sync Interval: 90 minutes (1.5 hours)');
    });
  });

  describe('command properties', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('autosync');
      expect(command.description).toBe('Check auto sync status and manage auto sync settings');
    });
  });
});