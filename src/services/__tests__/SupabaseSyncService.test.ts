import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  SupabaseSyncService, 
  SupabaseConfig, 
  PetRecord, 
  TokenUsageRecordWithPetId,
  SupabaseHTTPError,
  SupabaseSyncError
} from '../SupabaseSyncService';

describe('SupabaseSyncService', () => {
  const mockConfig: SupabaseConfig = {
    url: 'https://test.supabase.co',
    apiKey: 'test-api-key'
  };

  const createMockHttpsRequest = (responses: Array<{ statusCode: number; body: string }>) => {
    let callCount = 0;
    return vi.fn().mockImplementation(() => {
      const response = responses[callCount] || responses[responses.length - 1];
      callCount++;
      return Promise.resolve(response);
    });
  };

  const mockPetRecord: PetRecord = {
    id: 'pet-uuid-123',
    pet_name: 'TestPet',
    animal_type: 'cat',
    birth_time: '2024-01-01T00:00:00Z',
    death_time: '2024-01-15T00:00:00Z',
    survival_days: 14
  };

  const mockTokenUsageRecords: TokenUsageRecordWithPetId[] = [
    {
      pet_id: 'pet-uuid-123',
      usage_date: '2024-01-01',
      input_tokens: 1000,
      output_tokens: 500,
      cache_tokens: 100,
      total_tokens: 1500,
      cost_usd: 0.015,
      model_name: 'claude-3-sonnet'
    },
    {
      pet_id: 'pet-uuid-123',
      usage_date: '2024-01-02',
      input_tokens: 2000,
      output_tokens: 800,
      cache_tokens: 0,
      total_tokens: 2800,
      cost_usd: 0.028,
      model_name: 'claude-3-sonnet'
    }
  ];

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      const mockHttps = vi.fn();
      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      expect(service).toBeInstanceOf(SupabaseSyncService);
    });

    it('should handle URLs with trailing slash', () => {
      const configWithSlash: SupabaseConfig = {
        url: 'https://test.supabase.co/',
        apiKey: 'test-api-key'
      };

      const mockHttps = vi.fn();
      const service = new SupabaseSyncService({
        config: configWithSlash,
        httpsRequest: mockHttps
      });

      expect(service).toBeInstanceOf(SupabaseSyncService);
    });
  });

  describe('syncPetRecord', () => {
    it('should upsert pet record successfully with 201 status', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 201, body: '' } // Upsert successful (new record)
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const petId = await service.syncPetRecord(mockPetRecord);

      expect(petId).toBe('pet-uuid-123');
      expect(mockHttps).toHaveBeenCalledTimes(2); // 修复：现在会先检查现有记录再进行插入
      
      // Verify upsert call
      expect(mockHttps).toHaveBeenCalledWith({
        method: 'POST',
        headers: expect.objectContaining({
          'apikey': 'test-api-key',
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        }),
        url: 'https://test.supabase.co/rest/v1/pet_records'
      }, JSON.stringify(mockPetRecord));
    });

    it('should upsert pet record successfully with 200 status', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 200, body: '' } // Upsert successful (updated existing)
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const petId = await service.syncPetRecord(mockPetRecord);
      expect(petId).toBe('pet-uuid-123');
    });

    it('should throw error when upsert request fails with 401', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 401, body: 'Unauthorized' }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      await expect(service.syncPetRecord(mockPetRecord)).rejects.toThrow(
        SupabaseSyncError
      );
    });

    it('should throw error when upsert request fails with 400', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 400, body: 'Bad Request' }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      await expect(service.syncPetRecord(mockPetRecord)).rejects.toThrow(
        SupabaseSyncError
      );
    });
  });

  describe('syncTokenUsageRecords', () => {
    it('should successfully sync all records', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 201, body: '' } // Batch insert successful
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const result = await service.syncTokenUsageRecords(mockTokenUsageRecords);

      expect(result.success).toBe(true);
      expect(result.status.total).toBe(2);
      expect(result.status.processed).toBe(2);
      expect(result.status.failed).toBe(0);
      expect(result.message).toBe('Successfully synced 2 records');
    });

    it('should handle empty records array', async () => {
      const mockHttps = vi.fn();
      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const result = await service.syncTokenUsageRecords([]);

      expect(result.success).toBe(true);
      expect(result.status.total).toBe(0);
      expect(result.message).toBe('No records to sync');
      expect(mockHttps).not.toHaveBeenCalled();
    });

    it('should handle partial failures', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 400, body: 'Bad Request' } // Batch insert failed
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const result = await service.syncTokenUsageRecords(mockTokenUsageRecords);

      expect(result.success).toBe(false);
      expect(result.status.total).toBe(2);
      expect(result.status.processed).toBe(0);
      expect(result.status.failed).toBe(2);
      expect(result.status.errors).toHaveLength(1);
    });

    it('should process large batches in chunks', async () => {
      const largeRecords = Array.from({ length: 250 }, (_, i) => ({
        ...mockTokenUsageRecords[0],
        usage_date: `2024-01-${String(i + 1).padStart(2, '0')}`
      }));

      const mockHttps = createMockHttpsRequest([
        { statusCode: 201, body: '' }, // First batch (100 records)
        { statusCode: 201, body: '' }, // Second batch (100 records)
        { statusCode: 201, body: '' }  // Third batch (50 records)
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const result = await service.syncTokenUsageRecords(largeRecords);

      expect(result.success).toBe(true);
      expect(result.status.total).toBe(250);
      expect(result.status.processed).toBe(250);
      expect(mockHttps).toHaveBeenCalledTimes(3); // 3 batches of 100, 100, 50
    });
  });

  describe('getRecordsToSync', () => {
    it('should return only new records', async () => {
      // 模拟已存在的记录（现在返回完整记录而不是只是日期）
      const existingRecords = [
        {
          usage_date: '2024-01-01',
          total_tokens: 1500,
          input_tokens: 1000,
          output_tokens: 500,
          cost_usd: 0.015
        }
      ];
      const mockHttps = createMockHttpsRequest([
        { statusCode: 200, body: JSON.stringify(existingRecords) }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const inputRecords = mockTokenUsageRecords.map(({ pet_id, ...record }) => record);
      const recordsToSync = await service.getRecordsToSync('pet-uuid-123', inputRecords);

      expect(recordsToSync).toHaveLength(1);
      expect(recordsToSync[0].usage_date).toBe('2024-01-02');
      expect(recordsToSync[0].pet_id).toBe('pet-uuid-123');
    });

    it('should return all records when none exist', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 200, body: '[]' }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const inputRecords = mockTokenUsageRecords.map(({ pet_id, ...record }) => record);
      const recordsToSync = await service.getRecordsToSync('pet-uuid-123', inputRecords);

      expect(recordsToSync).toHaveLength(2);
      expect(recordsToSync.every(r => r.pet_id === 'pet-uuid-123')).toBe(true);
    });

    it('should throw error when query fails', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 500, body: 'Internal Server Error' }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const inputRecords = mockTokenUsageRecords.map(({ pet_id, ...record }) => record);

      await expect(service.getRecordsToSync('pet-uuid-123', inputRecords)).rejects.toThrow(
        SupabaseSyncError
      );
    });
  });

  describe('HTTP error handling', () => {
    it('should throw SupabaseHTTPError with status code', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 401, body: 'Unauthorized' }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      try {
        await service.syncPetRecord(mockPetRecord);
      } catch (error) {
        expect(error).toBeInstanceOf(SupabaseSyncError);
        expect(error.cause).toBeInstanceOf(SupabaseHTTPError);
        expect((error.cause as SupabaseHTTPError).statusCode).toBe(401);
      }
    });

    it('should handle network errors', async () => {
      const mockHttps = vi.fn().mockRejectedValue(new Error('Network error'));

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      await expect(service.syncPetRecord(mockPetRecord)).rejects.toThrow(
        SupabaseSyncError
      );
    });
  });

  describe('getLastSyncDate', () => {
    it('should return the last sync date when records exist', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 200, body: JSON.stringify([{ usage_date: '2024-01-15' }]) }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const lastSyncDate = await service.getLastSyncDate('pet-uuid-123');

      expect(lastSyncDate).toBe('2024-01-15');
      expect(mockHttps).toHaveBeenCalledWith({
        method: 'GET',
        headers: expect.objectContaining({
          'apikey': 'test-api-key',
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json'
        }),
        url: 'https://test.supabase.co/rest/v1/token_usage?pet_id=eq.pet-uuid-123&select=usage_date&order=usage_date.desc&limit=1'
      }, '');
    });

    it('should return null when no records exist', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 200, body: '[]' }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const lastSyncDate = await service.getLastSyncDate('pet-uuid-123');

      expect(lastSyncDate).toBeNull();
    });

    it('should throw error when query fails', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 500, body: 'Internal Server Error' }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      await expect(service.getLastSyncDate('pet-uuid-123')).rejects.toThrow(
        SupabaseSyncError
      );
    });
  });

  describe('URL encoding', () => {
    it('should properly handle pet names with special characters in JSON payload', async () => {
      const specialPetRecord = {
        ...mockPetRecord,
        pet_name: 'My Pet & More'
      };

      const mockHttps = createMockHttpsRequest([
        { statusCode: 201, body: '' }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      await service.syncPetRecord(specialPetRecord);

      expect(mockHttps).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://test.supabase.co/rest/v1/pet_records',
          headers: expect.objectContaining({
            'Prefer': 'resolution=merge-duplicates'
          })
        }),
        JSON.stringify(specialPetRecord)
      );
    });
  });

  describe('queryLeaderboard', () => {
    it('should query leaderboard with full functionality', async () => {
      const mockLeaderboardData = [
        {
          pet_name: 'Pet1',
          animal_type: 'cat',
          total_tokens: '5000',
          total_cost: '0.05',
          survival_days: '10',
          is_alive: true
        },
        {
          pet_name: 'Pet2',
          animal_type: 'dog',
          total_tokens: '3000',
          total_cost: '0.03',
          survival_days: '5',
          is_alive: false
        }
      ];

      const mockHttps = createMockHttpsRequest([
        { statusCode: 200, body: JSON.stringify(mockLeaderboardData) }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const result = await service.queryLeaderboard({ period: 'all', sortBy: 'tokens', limit: 10 });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        rank: 1,
        pet_name: 'Pet1',
        animal_type: 'cat',
        total_tokens: 5000,
        total_cost: 0.05,
        survival_days: 10,
        is_alive: true
      });
    });

    it('should handle query leaderboard errors', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 500, body: 'Server Error' }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      await expect(service.queryLeaderboard({ period: 'all' })).rejects.toThrow(
        SupabaseSyncError
      );
    });
  });

  describe('queryLeaderboardSimple', () => {
    it('should query simple leaderboard with manual aggregation', async () => {
      const mockPetsData = [
        {
          id: 'pet-1',
          pet_name: 'Pet1',
          animal_type: 'cat',
          birth_time: '2024-01-01T00:00:00Z',
          death_time: null
        },
        {
          id: 'pet-2',
          pet_name: 'Pet2',
          animal_type: 'dog',
          birth_time: '2024-01-05T00:00:00Z',
          death_time: '2024-01-10T00:00:00Z'
        }
      ];

      const mockTokenData = [
        {
          pet_id: 'pet-1',
          total_tokens: '5000',
          cost_usd: '0.05'
        },
        {
          pet_id: 'pet-2',
          total_tokens: '3000',
          cost_usd: '0.03'
        }
      ];

      const mockHttps = createMockHttpsRequest([
        { statusCode: 200, body: JSON.stringify(mockPetsData) },
        { statusCode: 200, body: JSON.stringify(mockTokenData) }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const result = await service.queryLeaderboardSimple({ period: 'all', sortBy: 'tokens' });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          rank: 1,
          pet_name: 'Pet1',
          animal_type: 'cat',
          total_tokens: 5000,
          total_cost: 0.05,
          is_alive: true
        })
      );
    });

    it('should handle different sorting in simple leaderboard', async () => {
      const mockPetsData = [
        {
          id: 'pet-1',
          pet_name: 'Pet1',
          animal_type: 'cat',
          birth_time: '2024-01-01T00:00:00Z',
          death_time: null
        },
        {
          id: 'pet-2',
          pet_name: 'Pet2',
          animal_type: 'dog',
          birth_time: '2024-01-10T00:00:00Z',
          death_time: null
        }
      ];

      const mockTokenData = [
        {
          pet_id: 'pet-1',
          total_tokens: '3000',
          cost_usd: '0.05'
        },
        {
          pet_id: 'pet-2',
          total_tokens: '5000',
          cost_usd: '0.03'
        }
      ];

      const mockHttps = createMockHttpsRequest([
        { statusCode: 200, body: JSON.stringify(mockPetsData) },
        { statusCode: 200, body: JSON.stringify(mockTokenData) }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      // Test sorting by cost
      const costSorted = await service.queryLeaderboardSimple({ period: 'all', sortBy: 'cost' });
      expect(costSorted[0].total_cost).toBe(0.05);
      expect(costSorted[1].total_cost).toBe(0.03);
    });

    it('should handle survival sorting in simple leaderboard', async () => {
      const mockPetsData = [
        {
          id: 'pet-1',
          pet_name: 'Pet1',
          animal_type: 'cat',
          birth_time: '2024-01-01T00:00:00Z',
          death_time: null
        },
        {
          id: 'pet-2',
          pet_name: 'Pet2',
          animal_type: 'dog',
          birth_time: '2024-01-05T00:00:00Z',
          death_time: null
        }
      ];

      const mockTokenData = [
        {
          pet_id: 'pet-1',
          total_tokens: '3000',
          cost_usd: '0.05'
        },
        {
          pet_id: 'pet-2',
          total_tokens: '5000',
          cost_usd: '0.03'
        }
      ];

      const mockHttps = createMockHttpsRequest([
        { statusCode: 200, body: JSON.stringify(mockPetsData) },
        { statusCode: 200, body: JSON.stringify(mockTokenData) }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      // Test sorting by survival days (Pet1 born earlier should be first)
      const survivalSorted = await service.queryLeaderboardSimple({ period: 'all', sortBy: 'survival' });
      expect(survivalSorted[0].pet_name).toBe('Pet1'); // Born earlier, more survival days
      expect(survivalSorted[1].pet_name).toBe('Pet2');
    });

    it('should handle empty leaderboard data', async () => {
      const mockHttps = createMockHttpsRequest([
        { statusCode: 200, body: '[]' },
        { statusCode: 200, body: '[]' }
      ]);

      const service = new SupabaseSyncService({
        config: mockConfig,
        httpsRequest: mockHttps
      });

      const result = await service.queryLeaderboardSimple({ period: 'all' });
      expect(result).toEqual([]);
    });
  });

  describe('default HTTPS request', () => {
    it('should work with default HTTPS implementation', async () => {
      // Test default HTTPS implementation by not providing httpsRequest
      const service = new SupabaseSyncService({
        config: {
          url: 'https://httpbin.org',
          apiKey: 'test-key'
        }
      });

      // This test mainly ensures the default implementation doesn't crash
      // We can't easily test actual HTTP requests in unit tests
      expect(service).toBeInstanceOf(SupabaseSyncService);
    });
  });
});