import { describe, it, expect, vi } from 'vitest';
import { CCUsageReader, CCUsageValidationError } from '../CCUsageReader';

describe('CCUsageReader', () => {
  const createMockExecCommand = (stdout: string, stderr: string = '') => {
    return vi.fn().mockResolvedValue({ stdout, stderr });
  };

  const mockCCUsageData = {
    daily: [
      {
        date: '2024-01-15',
        modelsUsed: ['claude-3-sonnet-20240229'],
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationTokens: 50,
        cacheReadTokens: 50,
        totalTokens: 1500,
        totalCost: 0.015
      },
      {
        date: '2024-01-16',
        modelsUsed: ['claude-3-sonnet-20240229'],
        inputTokens: 2000,
        outputTokens: 800,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 2800,
        totalCost: 0.028
      }
    ]
  };

  describe('readTokenUsage', () => {
    it('should successfully read and parse ccusage data', async () => {
      const mockExec = createMockExecCommand(JSON.stringify(mockCCUsageData));
      const reader = new CCUsageReader({ execCommand: mockExec });

      const result = await reader.readTokenUsage('2024-01-15', '2024-01-16');

      expect(mockExec).toHaveBeenCalledWith('npx ccusage@latest daily --json --since 20240115 --until 20240116');
      expect(result).toHaveLength(2);
      
      expect(result[0]).toEqual({
        usage_date: '2024-01-15',
        input_tokens: 1000,
        output_tokens: 500,
        cache_tokens: 100,
        total_tokens: 1500,
        cost_usd: 0.015,
        model_name: 'claude-3-sonnet-20240229'
      });

      expect(result[1]).toEqual({
        usage_date: '2024-01-16',
        input_tokens: 2000,
        output_tokens: 800,
        cache_tokens: 0, // Default when not provided
        total_tokens: 2800,
        cost_usd: 0.028,
        model_name: 'claude-3-sonnet-20240229'
      });
    });

    it('should handle empty ccusage output', async () => {
      const mockExec = createMockExecCommand('[]');
      const reader = new CCUsageReader({ execCommand: mockExec });

      const result = await reader.readTokenUsage();

      expect(result).toHaveLength(0);
    });

    it('should handle command without date parameters', async () => {
      const mockExec = createMockExecCommand('{"daily":[]}');
      const reader = new CCUsageReader({ execCommand: mockExec });

      await reader.readTokenUsage();

      expect(mockExec).toHaveBeenCalledWith('npx ccusage@latest daily --json');
    });

    it('should throw error when ccusage command has stderr output', async () => {
      const mockExec = createMockExecCommand('[]', 'ccusage: command not found');
      const reader = new CCUsageReader({ execCommand: mockExec });

      await expect(reader.readTokenUsage()).rejects.toThrow(
        CCUsageValidationError
      );
    });

    it('should throw error for invalid JSON output', async () => {
      const mockExec = createMockExecCommand('invalid json');
      const reader = new CCUsageReader({ execCommand: mockExec });

      await expect(reader.readTokenUsage()).rejects.toThrow(
        CCUsageValidationError
      );
    });

    it('should throw error when command execution fails', async () => {
      const mockExec = vi.fn().mockRejectedValue(new Error('Command failed'));
      const reader = new CCUsageReader({ execCommand: mockExec });

      await expect(reader.readTokenUsage()).rejects.toThrow(
        CCUsageValidationError
      );
    });
  });

  describe('data validation', () => {
    it('should throw error for non-array output', async () => {
      const mockExec = createMockExecCommand('{"not": "array"}');
      const reader = new CCUsageReader({ execCommand: mockExec });

      await expect(reader.readTokenUsage()).rejects.toThrow(
        'ccusage output format is not recognized'
      );
    });

    it('should throw error for missing required fields', async () => {
      const invalidData = { daily: [{ date: '2024-01-15' }] }; // Missing other required fields
      const mockExec = createMockExecCommand(JSON.stringify(invalidData));
      const reader = new CCUsageReader({ execCommand: mockExec });

      await expect(reader.readTokenUsage()).rejects.toThrow(
        'Record at index 0 missing required fields'
      );
    });

    it('should throw error for invalid date format', async () => {
      const invalidData = { daily: [{ 
        ...mockCCUsageData.daily[0], 
        date: 'invalid-date' 
      }] };
      const mockExec = createMockExecCommand(JSON.stringify(invalidData));
      const reader = new CCUsageReader({ execCommand: mockExec });

      await expect(reader.readTokenUsage()).rejects.toThrow(
        'Record at index 0 has invalid date format'
      );
    });

    it('should throw error for negative token values', async () => {
      const invalidData = { daily: [{ 
        ...mockCCUsageData.daily[0], 
        inputTokens: -100 
      }] };
      const mockExec = createMockExecCommand(JSON.stringify(invalidData));
      const reader = new CCUsageReader({ execCommand: mockExec });

      await expect(reader.readTokenUsage()).rejects.toThrow(
        'Record at index 0 has invalid inputTokens'
      );
    });

    it('should throw error for invalid cache_tokens when provided', async () => {
      const invalidData = { daily: [{ 
        ...mockCCUsageData.daily[0], 
        cacheCreationTokens: 'invalid' 
      }] };
      const mockExec = createMockExecCommand(JSON.stringify(invalidData));
      const reader = new CCUsageReader({ execCommand: mockExec });

      await expect(reader.readTokenUsage()).rejects.toThrow(
        'Record at index 0 has invalid cacheCreationTokens'
      );
    });
  });

  describe('data sanitization', () => {
    it('should trim whitespace from string fields after validation', async () => {
      const dataWithValidDateButWhitespace = { daily: [{
        date: '2024-01-15',
        modelsUsed: ['  claude-3-sonnet-20240229  '],
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        totalCost: 0.015
      }] };
      const mockExec = createMockExecCommand(JSON.stringify(dataWithValidDateButWhitespace));
      const reader = new CCUsageReader({ execCommand: mockExec });

      const result = await reader.readTokenUsage();

      expect(result[0].usage_date).toBe('2024-01-15');
      expect(result[0].model_name).toBe('claude-3-sonnet-20240229');
    });

    it('should floor numeric token values', async () => {
      const dataWithDecimals = { daily: [{
        date: '2024-01-15',
        modelsUsed: ['claude-3-sonnet-20240229'],
        inputTokens: 1000.7,
        outputTokens: 500.3,
        cacheCreationTokens: 50.4,
        cacheReadTokens: 50.5,
        totalTokens: 1500.8,
        totalCost: 0.0158742
      }] };
      const mockExec = createMockExecCommand(JSON.stringify(dataWithDecimals));
      const reader = new CCUsageReader({ execCommand: mockExec });

      const result = await reader.readTokenUsage();

      expect(result[0].input_tokens).toBe(1000);
      expect(result[0].output_tokens).toBe(500);
      expect(result[0].cache_tokens).toBe(100); // 50 + 50
      expect(result[0].total_tokens).toBe(1500);
      expect(result[0].cost_usd).toBe(0.0159); // Rounded to 4 decimal places
    });

    it('should set cache_tokens to 0 when not provided', async () => {
      const dataWithoutCache = { daily: [{
        date: '2024-01-15',
        modelsUsed: ['claude-3-sonnet-20240229'],
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        totalCost: 0.015
        // cache tokens not provided
      }] };
      const mockExec = createMockExecCommand(JSON.stringify(dataWithoutCache));
      const reader = new CCUsageReader({ execCommand: mockExec });

      const result = await reader.readTokenUsage();

      expect(result[0].cache_tokens).toBe(0);
    });
  });

  describe('date validation', () => {
    it('should accept valid date formats', async () => {
      const validDates = ['2024-01-01', '2024-12-31', '2023-02-28'];
      
      for (const date of validDates) {
        const data = { daily: [{ ...mockCCUsageData.daily[0], date }] };
        const mockExec = createMockExecCommand(JSON.stringify(data));
        const reader = new CCUsageReader({ execCommand: mockExec });

        const result = await reader.readTokenUsage();
        expect(result[0].usage_date).toBe(date);
      }
    });

    it('should reject invalid date formats', async () => {
      const invalidDates = ['2024/01/01', '01-01-2024', '2024-1-1', '2024-13-01', '2024-01-32'];
      
      for (const date of invalidDates) {
        const data = [{ ...mockCCUsageData[0], date }];
        const mockExec = createMockExecCommand(JSON.stringify(data));
        const reader = new CCUsageReader({ execCommand: mockExec });

        await expect(reader.readTokenUsage()).rejects.toThrow(
          CCUsageValidationError
        );
      }
    });
  });
});