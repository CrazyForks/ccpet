import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LeaderboardCommand } from '../LeaderboardCommand';
import { SupabaseSyncService, LeaderboardEntry } from '../../services/SupabaseSyncService';
import { ConfigService } from '../../services/ConfigService';
import { PetStorage } from '../../services/PetStorage';
import * as fs from 'fs';

// Mock dependencies
vi.mock('../../services/SupabaseSyncService');
vi.mock('../../services/ConfigService');
vi.mock('../../services/PetStorage');
vi.mock('../../ui/LeaderboardFormatter');
vi.mock('fs');

describe('LeaderboardCommand', () => {
  let command: LeaderboardCommand;
  let mockSupabaseSyncService: any;
  let mockConfigService: any;
  let mockPetStorage: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    command = new LeaderboardCommand();
    
    // Setup mocks
    mockSupabaseSyncService = {
      queryLeaderboard: vi.fn(),
      queryLeaderboardSimple: vi.fn()
    };
    
    mockConfigService = {
      getConfig: vi.fn().mockReturnValue({
        supabase: {
          url: 'https://test.supabase.co',
          apiKey: 'test-key'
        }
      })
    };
    
    mockPetStorage = {
      loadState: vi.fn()
    };

    vi.mocked(SupabaseSyncService).mockImplementation(() => mockSupabaseSyncService);
    vi.mocked(ConfigService).mockImplementation(() => mockConfigService);
    vi.mocked(PetStorage).mockImplementation(() => mockPetStorage);

    // Setup console and process spies
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseArguments', () => {
    it('should parse valid arguments correctly', async () => {
      const args = ['--period', '7d', '--sort', 'cost', '--limit', '20', '--verbose'];
      
      // Mock LeaderboardFormatter to avoid execution
      const mockFormatter = {
        formatLeaderboard: vi.fn().mockReturnValue('Formatted output')
      };
      
      // We need to test argument parsing indirectly by checking the behavior
      mockSupabaseSyncService.queryLeaderboard.mockResolvedValue([]);
      
      await command.execute(args);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('📊 Starting leaderboard query...');
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Retrieved 0 records from Supabase');
    });

    it('should handle invalid period argument', async () => {
      const args = ['--period', 'invalid'];
      
      await command.execute(args);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Invalid period. Must be one of: today, 7d, 30d, all');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle invalid sort argument', async () => {
      const args = ['--sort', 'invalid'];
      
      await command.execute(args);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Invalid sort option. Must be one of: tokens, cost, survival');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle invalid limit argument', async () => {
      const args = ['--limit', '0'];
      
      await command.execute(args);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Invalid limit. Must be a number between 1 and 100');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should show help and exit when --help is provided', async () => {
      const args = ['--help'];
      
      await command.execute(args);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('ccpet leaderboard - Display pet leaderboard rankings');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Supabase integration', () => {
    it('should try advanced query first, then fallback to simple query', async () => {
      const mockLeaderboardData: LeaderboardEntry[] = [
        {
          rank: 1,
          pet_name: 'Test Pet',
          animal_type: 'cat',
          total_tokens: 1000,
          total_cost: 10.50,
          survival_days: 5,
          is_alive: true
        }
      ];

      // Mock advanced query failure and simple query success
      mockSupabaseSyncService.queryLeaderboard.mockRejectedValue(new Error('Advanced query failed'));
      mockSupabaseSyncService.queryLeaderboardSimple.mockResolvedValue(mockLeaderboardData);

      // Mock formatter
      const mockFormatter = {
        formatLeaderboard: vi.fn().mockReturnValue('Formatted output')
      };
      
      const args = ['--verbose'];
      await command.execute(args);

      expect(mockSupabaseSyncService.queryLeaderboard).toHaveBeenCalled();
      expect(mockSupabaseSyncService.queryLeaderboardSimple).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️  Advanced leaderboard query failed, falling back to simple query');
    });

    it('should fallback to local data when Supabase is unavailable', async () => {
      // Mock Supabase failure
      mockSupabaseSyncService.queryLeaderboard.mockRejectedValue(new Error('Network error'));
      mockSupabaseSyncService.queryLeaderboardSimple.mockRejectedValue(new Error('Network error'));

      // Mock local pet state
      mockPetStorage.loadState.mockReturnValue({
        petName: 'Local Pet',
        animalType: 'dog',
        lifetimeTokens: 5000,
        birthTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        energy: 50
      });

      // Mock fs operations
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const args = ['--verbose'];
      await command.execute(args);

      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️  Supabase connection failed, using local data: Network error');
      expect(mockPetStorage.loadState).toHaveBeenCalled();
    });
  });

  describe('Configuration handling', () => {
    it('should prioritize command line arguments over environment variables', async () => {
      // Set environment variables
      process.env.SUPABASE_URL = 'https://env.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'env-key';

      mockSupabaseSyncService.queryLeaderboard.mockResolvedValue([]);

      const args = ['--supabase-url', 'https://cli.supabase.co', '--supabase-api-key', 'cli-key'];
      await command.execute(args);

      // Verify that SupabaseSyncService was called with CLI arguments
      expect(SupabaseSyncService).toHaveBeenCalledWith({
        config: {
          url: 'https://cli.supabase.co',
          apiKey: 'cli-key'
        }
      });

      // Clean up
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock all data sources to fail
      mockSupabaseSyncService.queryLeaderboard.mockRejectedValue(new Error('Unexpected error'));
      mockSupabaseSyncService.queryLeaderboardSimple.mockRejectedValue(new Error('Unexpected error'));
      mockPetStorage.loadState.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      // Mock fs.existsSync to simulate graveyard directory not existing
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const args = [];
      
      // The command should still succeed with empty leaderboard data since it has robust fallbacks
      await command.execute(args);

      // Should have succeeded and displayed some output (empty leaderboard)
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(processExitSpy).not.toHaveBeenCalledWith(1);
    });

    it('should show stack trace in verbose mode when there are real errors', async () => {
      // Mock LeaderboardFormatter to throw an error
      const mockFormatter = {
        formatLeaderboard: vi.fn().mockImplementation(() => {
          throw new Error('Formatter error');
        })
      };
      
      const { LeaderboardFormatter } = await import('../../ui/LeaderboardFormatter');
      vi.mocked(LeaderboardFormatter).mockImplementation(() => mockFormatter);

      mockSupabaseSyncService.queryLeaderboard.mockRejectedValue(new Error('Supabase error'));
      mockSupabaseSyncService.queryLeaderboardSimple.mockRejectedValue(new Error('Supabase error'));
      mockPetStorage.loadState.mockReturnValue({
        petName: 'Test Pet',
        animalType: 'cat',
        lifetimeTokens: 1000,
        birthTime: new Date(),
        energy: 50
      });

      const args = ['--verbose'];
      await command.execute(args);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Leaderboard command failed'));
      expect(consoleErrorSpy).toHaveBeenCalledWith('Stack trace:', expect.any(String));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});