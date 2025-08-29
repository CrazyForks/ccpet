import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncCommand } from '../SyncCommand';
import { CCUsageReader } from '../../services/CCUsageReader';
import { SupabaseSyncService } from '../../services/SupabaseSyncService';
import { PetStorage } from '../../services/PetStorage';
import { ConfigService } from '../../services/ConfigService';
import { AnimalType } from '../../core/config';

// Mock dependencies
vi.mock('../../services/CCUsageReader');
vi.mock('../../services/SupabaseSyncService');
vi.mock('../../services/PetStorage');
vi.mock('../../services/ConfigService');

describe('SyncCommand', () => {
  let syncCommand: SyncCommand;
  let mockCCUsageReader: any;
  let mockSupabaseSyncService: any;
  let mockPetStorage: any;
  let mockConfigService: any;
  let originalConsoleLog: any;
  let originalConsoleError: any;
  let originalProcessExit: any;

  const mockPetState = {
    uuid: 'pet-uuid-123',
    energy: 50,
    expression: '(o_o)',
    animalType: AnimalType.CAT,
    birthTime: new Date('2024-01-01T00:00:00Z'),
    lastFeedTime: new Date('2024-01-01T00:00:00Z'),
    totalTokensConsumed: 1000,
    accumulatedTokens: 0,
    totalLifetimeTokens: 5000,
    petName: 'TestPet'
  };

  const mockTokenUsageRecords = [
    {
      usage_date: '2024-01-01',
      input_tokens: 1000,
      output_tokens: 500,
      cache_tokens: 100,
      total_tokens: 1500,
      cost_usd: 0.015,
      model_name: 'claude-3-sonnet'
    }
  ];

  beforeEach(() => {
    syncCommand = new SyncCommand();
    
    // Mock console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalProcessExit = process.exit;
    
    console.log = vi.fn();
    console.error = vi.fn();
    process.exit = vi.fn() as any;

    // Setup mocks
    mockPetStorage = {
      loadState: vi.fn().mockReturnValue(mockPetState)
    };
    (PetStorage as any).mockImplementation(() => mockPetStorage);

    mockCCUsageReader = {
      readTokenUsage: vi.fn().mockResolvedValue(mockTokenUsageRecords)
    };
    (CCUsageReader as any).mockImplementation(() => mockCCUsageReader);

    mockSupabaseSyncService = {
      syncPetRecord: vi.fn().mockResolvedValue('pet-id-123'),
      getRecordsToSync: vi.fn().mockResolvedValue([
        { ...mockTokenUsageRecords[0], pet_id: 'pet-id-123' }
      ]),
      syncTokenUsageRecords: vi.fn().mockResolvedValue({
        success: true,
        status: { total: 1, processed: 1, failed: 0, errors: [] },
        message: 'Successfully synced 1 records'
      }),
      getLastSyncDate: vi.fn().mockResolvedValue(null) // 默认第一次同步
    };
    (SupabaseSyncService as any).mockImplementation(() => mockSupabaseSyncService);

    // Setup ConfigService mock
    mockConfigService = {
      getConfig: vi.fn().mockReturnValue({
        supabase: {
          url: 'https://config.supabase.co',
          apiKey: 'config-api-key',
          autoSync: false,
          syncInterval: 1440
        }
      })
    };
    (ConfigService as any).mockImplementation(() => mockConfigService);

    // Set environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-api-key';
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    vi.clearAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  describe('command metadata', () => {
    it('should have correct name and description', () => {
      expect(syncCommand.name).toBe('sync');
      expect(syncCommand.description).toBe('Sync pet data and token usage to Supabase database');
    });
  });

  describe('execute', () => {
    it('should successfully sync data with default options', async () => {
      await syncCommand.execute([]);

      expect(mockPetStorage.loadState).toHaveBeenCalled();
      // 对于第一次同步，应该从宠物出生日期同步到今天
      const today = new Date().toISOString().split('T')[0];
      const expectedStartDate = '2024-01-01'; // mockPetState.birthTime
      expect(mockCCUsageReader.readTokenUsage).toHaveBeenCalledWith(expectedStartDate, today);
      expect(mockSupabaseSyncService.syncPetRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pet-uuid-123',
          pet_name: 'TestPet',
          animal_type: AnimalType.CAT,
          birth_time: '2024-01-01T00:00:00.000Z'
        })
      );
      expect(mockSupabaseSyncService.getRecordsToSync).toHaveBeenCalled();
      expect(mockSupabaseSyncService.syncTokenUsageRecords).toHaveBeenCalled();
    });

    it('should handle date range options', async () => {
      await syncCommand.execute(['--start-date', '2024-01-01', '--end-date', '2024-01-31']);

      expect(mockCCUsageReader.readTokenUsage).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
    });

    it('should handle verbose mode', async () => {
      await syncCommand.execute(['--verbose']);

      expect(console.log).toHaveBeenCalledWith('🔄 Starting Supabase sync process...');
    });

    it('should handle dry run mode', async () => {
      await syncCommand.execute(['--dry-run']);

      expect(console.log).toHaveBeenCalledWith('🔍 DRY RUN MODE - No data will be synced');
      expect(mockSupabaseSyncService.syncPetRecord).not.toHaveBeenCalled();
      expect(mockSupabaseSyncService.syncTokenUsageRecords).not.toHaveBeenCalled();
    });

    it('should exit with error when Supabase config is missing', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      // Mock ConfigService to return empty config
      mockConfigService.getConfig.mockReturnValue({
        supabase: {}
      });

      await syncCommand.execute([]);

      expect(console.error).toHaveBeenCalledWith('❌ Supabase configuration missing');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should validate date formats', async () => {
      await syncCommand.execute(['--start-date', 'invalid-date']);

      expect(console.error).toHaveBeenCalledWith('❌ Invalid start date format. Use YYYY-MM-DD format.');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle no records to sync', async () => {
      mockSupabaseSyncService.getRecordsToSync.mockResolvedValue([]);

      await syncCommand.execute([]);

      expect(console.log).toHaveBeenCalledWith('✅ All records are already synced');
      expect(mockSupabaseSyncService.syncTokenUsageRecords).not.toHaveBeenCalled();
    });

    it('should handle sync failures', async () => {
      mockSupabaseSyncService.syncTokenUsageRecords.mockResolvedValue({
        success: false,
        status: { total: 1, processed: 0, failed: 1, errors: ['Test error'] },
        message: 'Sync failed'
      });

      await syncCommand.execute([]);

      expect(console.error).toHaveBeenCalledWith('❌ Sync completed with errors: Sync failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle exceptions', async () => {
      mockCCUsageReader.readTokenUsage.mockRejectedValue(new Error('ccusage failed'));

      await syncCommand.execute([]);

      expect(console.error).toHaveBeenCalledWith('❌ Sync failed: ccusage failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('argument parsing', () => {
    it('should show help and exit when --help is provided', async () => {
      const showHelpSpy = vi.spyOn(syncCommand as any, 'showHelp').mockImplementation(() => {});

      await syncCommand.execute(['--help']);

      expect(showHelpSpy).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle custom Supabase configuration', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      await syncCommand.execute([
        '--supabase-url', 'https://custom.supabase.co',
        '--supabase-api-key', 'custom-key'
      ]);

      expect(SupabaseSyncService).toHaveBeenCalledWith({
        config: {
          url: 'https://custom.supabase.co',
          apiKey: 'custom-key'
        }
      });
    });

    it('should use config service when no environment variables or CLI options', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      await syncCommand.execute([]);

      expect(SupabaseSyncService).toHaveBeenCalledWith({
        config: {
          url: 'https://config.supabase.co',
          apiKey: 'config-api-key'
        }
      });
    });

    it('should prioritize environment variables over config service', async () => {
      await syncCommand.execute([]);

      expect(SupabaseSyncService).toHaveBeenCalledWith({
        config: {
          url: 'https://test.supabase.co',
          apiKey: 'test-api-key'
        }
      });
    });

    it('should handle unknown options', async () => {
      await syncCommand.execute(['--unknown-option']);

      expect(console.error).toHaveBeenCalledWith('Unknown option: --unknown-option');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('date validation', () => {
    const validDates = ['2024-01-01', '2024-12-31', '2023-02-28'];
    const invalidDates = ['2024/01/01', '01-01-2024', '2024-1-1', '2024-13-01'];

    validDates.forEach(date => {
      it(`should accept valid date format: ${date}`, async () => {
        await syncCommand.execute(['--start-date', date]);
        
        // With smart sync, endDate is automatically set to today
        const today = new Date().toISOString().split('T')[0];
        expect(mockCCUsageReader.readTokenUsage).toHaveBeenCalledWith(date, today);
      });
    });

    invalidDates.forEach(date => {
      it(`should reject invalid date format: ${date}`, async () => {
        await syncCommand.execute(['--start-date', date]);
        
        expect(console.error).toHaveBeenCalledWith('❌ Invalid start date format. Use YYYY-MM-DD format.');
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('smart date range sync', () => {
    it('should sync from birth date to today for first sync', async () => {
      // Setup for first sync (no existing records)
      mockSupabaseSyncService.getLastSyncDate.mockResolvedValue(null);

      await syncCommand.execute([]);

      const today = new Date().toISOString().split('T')[0];
      const expectedStartDate = '2024-01-01'; // mockPetState.birthTime
      expect(mockCCUsageReader.readTokenUsage).toHaveBeenCalledWith(expectedStartDate, today);
    });

    it('should sync from last sync date to today for subsequent syncs', async () => {
      // Setup for subsequent sync (has existing records)
      mockSupabaseSyncService.getLastSyncDate.mockResolvedValue('2024-01-10');

      await syncCommand.execute([]);

      const today = new Date().toISOString().split('T')[0];
      const expectedStartDate = '2024-01-11'; // Next day after last sync
      expect(mockCCUsageReader.readTokenUsage).toHaveBeenCalledWith(expectedStartDate, today);
    });

    it('should respect user-specified date range over smart sync', async () => {
      await syncCommand.execute(['--start-date', '2024-01-05', '--end-date', '2024-01-15']);

      expect(mockCCUsageReader.readTokenUsage).toHaveBeenCalledWith('2024-01-05', '2024-01-15');
      // Should not call getLastSyncDate when user specifies dates
    });

    it('should fallback to full sync when smart sync fails', async () => {
      // Setup sync service to throw error
      mockSupabaseSyncService.getLastSyncDate.mockRejectedValue(new Error('Database error'));

      await syncCommand.execute([]);

      const today = new Date().toISOString().split('T')[0];
      const expectedStartDate = '2024-01-01'; // fallback to birth date
      expect(mockCCUsageReader.readTokenUsage).toHaveBeenCalledWith(expectedStartDate, today);
    });
  });

  describe('pet record creation', () => {
    it('should create pet record for living pet', async () => {
      await syncCommand.execute([]);

      expect(mockSupabaseSyncService.syncPetRecord).toHaveBeenCalledWith({
        id: 'pet-uuid-123',
        pet_name: 'TestPet',
        animal_type: AnimalType.CAT,
        emoji: '🐱', // 添加emoji字段期望
        birth_time: '2024-01-01T00:00:00.000Z'
      });
    });

    it('should create pet record for dead pet with death time and survival days', async () => {
      const deadPetState = { ...mockPetState, energy: 0 };
      mockPetStorage.loadState.mockReturnValue(deadPetState);

      await syncCommand.execute([]);

      expect(mockSupabaseSyncService.syncPetRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pet-uuid-123',
          pet_name: 'TestPet',
          animal_type: AnimalType.CAT,
          birth_time: '2024-01-01T00:00:00.000Z',
          death_time: expect.any(String),
          survival_days: expect.any(Number)
        })
      );
    });
  });
});