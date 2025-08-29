import { describe, it, expect } from 'vitest';
import { LeaderboardFormatter } from '../LeaderboardFormatter';
import { LeaderboardEntry } from '../../services/SupabaseSyncService';

describe('LeaderboardFormatter', () => {
  let formatter: LeaderboardFormatter;

  beforeEach(() => {
    formatter = new LeaderboardFormatter();
  });

  describe('formatLeaderboard', () => {
    it('should format leaderboard with single entry correctly', () => {
      const entries: LeaderboardEntry[] = [
        {
          rank: 1,
          pet_name: 'Fluffy',
          animal_type: 'cat',
          total_tokens: 1500000,
          total_cost: 12.50,
          survival_days: 7,
          is_alive: true
        }
      ];

      const options = {
        period: 'today' as const,
        sort: 'tokens' as const,
        limit: 10,
        isOfflineMode: false
      };

      const result = formatter.formatLeaderboard(entries, options);

      expect(result).toContain('🏆 Today\'s Token Usage Leaderboard');
      expect(result).toContain('Fluffy');
      expect(result).toContain('🐱 猫');
      expect(result).toContain('1.5M'); // Formatted tokens
      expect(result).toContain('$12.50');
      expect(result).toContain('7d');
      expect(result).toContain('✅ Alive');
    });

    it('should format leaderboard with multiple entries', () => {
      const entries: LeaderboardEntry[] = [
        {
          rank: 1,
          pet_name: 'Alpha',
          animal_type: 'dog',
          total_tokens: 2000000,
          total_cost: 20.00,
          survival_days: 10,
          is_alive: true
        },
        {
          rank: 2,
          pet_name: 'Beta',
          animal_type: 'cat',
          total_tokens: 1000000,
          total_cost: 15.75,
          survival_days: 8,
          is_alive: false
        }
      ];

      const options = {
        period: '7d' as const,
        sort: 'tokens' as const,
        limit: 10,
        isOfflineMode: false
      };

      const result = formatter.formatLeaderboard(entries, options);

      expect(result).toContain('🏆 7-Day Token Usage Leaderboard');
      expect(result).toContain('#1');
      expect(result).toContain('#2');
      expect(result).toContain('Alpha');
      expect(result).toContain('Beta');
      expect(result).toContain('🐶 狗');
      expect(result).toContain('🐱 猫');
      expect(result).toContain('✅ Alive');
      expect(result).toContain('💀 Dead');
    });

    it('should format numbers correctly', () => {
      const entries: LeaderboardEntry[] = [
        {
          rank: 1,
          pet_name: 'BigSpender',
          animal_type: 'panda',
          total_tokens: 1234567890,
          total_cost: 999.99,
          survival_days: 365,
          is_alive: true
        }
      ];

      const options = {
        period: 'all' as const,
        sort: 'cost' as const,
        limit: 10,
        isOfflineMode: false
      };

      const result = formatter.formatLeaderboard(entries, options);

      expect(result).toContain('1.2B'); // Billion tokens formatted
      expect(result).toContain('$999.99');
      expect(result).toContain('365d');
      expect(result).toContain('🐼 熊猫');
    });

    it('should handle offline mode correctly', () => {
      const entries: LeaderboardEntry[] = [
        {
          rank: 1,
          pet_name: 'OfflinePet',
          animal_type: 'fox',
          total_tokens: 500000,
          total_cost: 0,
          survival_days: 3,
          is_alive: true
        }
      ];

      const options = {
        period: 'today' as const,
        sort: 'tokens' as const,
        limit: 10,
        isOfflineMode: true
      };

      const result = formatter.formatLeaderboard(entries, options);

      expect(result).toContain('N/A'); // Cost should be N/A in offline mode
      expect(result).toContain('📡 Offline Mode: Showing local data only');
      expect(result).not.toContain('until'); // No countdown in offline mode
    });

    it('should handle empty leaderboard gracefully', () => {
      const entries: LeaderboardEntry[] = [];

      const options = {
        period: 'today' as const,
        sort: 'tokens' as const,
        limit: 10,
        isOfflineMode: false
      };

      const result = formatter.formatLeaderboard(entries, options);

      expect(result).toContain('📭 No data available');
      expect(result).toContain('💡 Suggestions:');
      expect(result).toContain('Try a different time period');
    });

    it('should handle empty leaderboard in offline mode', () => {
      const entries: LeaderboardEntry[] = [];

      const options = {
        period: 'today' as const,
        sort: 'tokens' as const,
        limit: 10,
        isOfflineMode: true
      };

      const result = formatter.formatLeaderboard(entries, options);

      expect(result).toContain('📭 No data available');
      expect(result).toContain('💡 Suggestions:');
      expect(result).toContain('Configure Supabase connection');
    });

    it('should format different sort types correctly', () => {
      const entries: LeaderboardEntry[] = [
        {
          rank: 1,
          pet_name: 'Survivor',
          animal_type: 'rabbit',
          total_tokens: 1000,
          total_cost: 5.00,
          survival_days: 100,
          is_alive: true
        }
      ];

      const costOptions = {
        period: '30d' as const,
        sort: 'cost' as const,
        limit: 10,
        isOfflineMode: false
      };

      const survivalOptions = {
        period: 'all' as const,
        sort: 'survival' as const,
        limit: 10,
        isOfflineMode: false
      };

      const costResult = formatter.formatLeaderboard(entries, costOptions);
      const survivalResult = formatter.formatLeaderboard(entries, survivalOptions);

      expect(costResult).toContain('30-Day Cost Spending Leaderboard');
      expect(survivalResult).toContain('All-Time Survival Time Leaderboard');
    });

    it('should handle different time periods correctly', () => {
      const entries: LeaderboardEntry[] = [
        {
          rank: 1,
          pet_name: 'TestPet',
          animal_type: 'cat',
          total_tokens: 1000,
          total_cost: 5.00,
          survival_days: 10,
          is_alive: true
        }
      ];

      const todayOptions = {
        period: 'today' as const,
        sort: 'tokens' as const,
        limit: 10,
        isOfflineMode: false
      };

      const allTimeOptions = {
        period: 'all' as const,
        sort: 'tokens' as const,
        limit: 10,
        isOfflineMode: false
      };

      const todayResult = formatter.formatLeaderboard(entries, todayOptions);
      const allTimeResult = formatter.formatLeaderboard(entries, allTimeOptions);

      expect(todayResult).toContain('Today\'s Token Usage');
      expect(todayResult).toContain('until daily rankings reset');
      
      expect(allTimeResult).toContain('All-Time Token Usage');
      expect(allTimeResult).toContain('All-time rankings (no reset)');
    });
  });

  describe('number formatting', () => {
    it('should format large numbers with appropriate suffixes', () => {
      const testCases = [
        { input: 999, expected: '999' },
        { input: 1500, expected: '1.5K' },
        { input: 1500000, expected: '1.5M' },
        { input: 2500000000, expected: '2.5B' }
      ];

      testCases.forEach(({ input, expected }) => {
        const entry: LeaderboardEntry = {
          rank: 1,
          pet_name: 'Test',
          animal_type: 'cat',
          total_tokens: input,
          total_cost: 0,
          survival_days: 1,
          is_alive: true
        };

        const result = formatter.formatLeaderboard([entry], {
          period: 'today',
          sort: 'tokens',
          limit: 1,
          isOfflineMode: false
        });

        expect(result).toContain(expected);
      });
    });
  });

  describe('animal type formatting', () => {
    it('should handle all supported animal types', () => {
      const animalTypes = ['cat', 'dog', 'rabbit', 'panda', 'fox'];
      const expectedEmojis = ['🐱', '🐶', '🐰', '🐼', '🦊'];

      animalTypes.forEach((animalType, index) => {
        const entry: LeaderboardEntry = {
          rank: 1,
          pet_name: 'TestPet',
          animal_type: animalType,
          total_tokens: 1000,
          total_cost: 5.00,
          survival_days: 1,
          is_alive: true
        };

        const result = formatter.formatLeaderboard([entry], {
          period: 'today',
          sort: 'tokens',
          limit: 1,
          isOfflineMode: false
        });

        expect(result).toContain(expectedEmojis[index]);
      });
    });

    it('should handle unknown animal types gracefully', () => {
      const entry: LeaderboardEntry = {
        rank: 1,
        pet_name: 'UnknownPet',
        animal_type: 'unknown',
        total_tokens: 1000,
        total_cost: 5.00,
        survival_days: 1,
        is_alive: true
      };

      const result = formatter.formatLeaderboard([entry], {
        period: 'today',
        sort: 'tokens',
        limit: 1,
        isOfflineMode: false
      });

      expect(result).toContain('unknown'); // Should fall back to raw animal type
    });
  });
});