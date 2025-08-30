import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock ConfigService instance for dependency injection
const mockConfigService = {
  getConfig: vi.fn(() => ({
    pet: {
      animationEnabled: true,
      decayRate: 0.0231,
      emojiEnabled: false
    },
    colors: {
      petExpression: '#FFFF00:bright:bold',
      energyBar: '#00FF00',
      energyValue: '#00FFFF',
      accumulatedTokens: '#778899',
      lifetimeTokens: '#FF00FF',
      sessionInput: '#00FF00',
      sessionOutput: '#FFFF00',
      sessionCached: '#F4A460',
      sessionTotal: '#FFFFFF',
      contextLength: '#00DDFF',
      contextPercentage: '#0099DD',
      contextPercentageUsable: '#90EE90',
      cost: '#FFD700'
    },
    display: {
      maxLines: 3,
      line2: {
        enabled: true,
        items: ['input', 'output', 'cached', 'total']
      },
      line3: {
        enabled: true,
        items: ['context-length', 'context-percentage', 'context-percentage-usable', 'cost']
      }
    }
  })),
  setColorConfig: vi.fn(),
  setPetConfig: vi.fn(),
  setDisplayConfig: vi.fn(),
  resetConfig: vi.fn(),
  listConfig: vi.fn(),
  getConfigPath: vi.fn()
} as any;

// Mock the colors utility to return mock ANSI codes
vi.mock('../utils/colors', () => ({
  processColorConfig: vi.fn((colors) => {
    // Return processed colors with mock ANSI codes
    const processed = {};
    Object.keys(colors).forEach(key => {
      processed[key] = `\x1b[0m`; // Basic reset code for all colors
    });
    return processed;
  })
}));

import { ClaudeCodeStatusLine } from '../ccpet';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock filesystem and os modules
vi.mock('fs');
vi.mock('os');
vi.mock('path');

// Mock JSONL processing utility
vi.mock('../utils/jsonl', () => ({
  getTokenMetrics: vi.fn(() => Promise.resolve({
    inputTokens: 100,
    outputTokens: 50,
    cachedTokens: 0,
    totalTokens: 150,
    sessionTotalInputTokens: 100,
    sessionTotalOutputTokens: 50,
    sessionTotalCachedTokens: 0,
    contextLength: 4096
  }))
}));


describe('ClaudeCodeStatusLine', () => {
  const mockHomedir = '/mock/home';
  const mockPetDir = '/mock/home/.claude-pet';
  const mockStateFile = '/mock/home/.claude-pet/pet-state.json';

  const mockClaudeCodeInput = {
    hook_event_name: 'user-prompt-submit',
    session_id: 'test-session',
    transcript_path: '/mock/transcript.jsonl',
    cwd: '/mock/cwd',
    model: {
      id: 'claude-3-5-sonnet-20241022',
      display_name: 'Claude 3.5 Sonnet'
    },
    workspace: {
      current_dir: '/mock/current',
      project_dir: '/mock/project'
    },
    version: '1.0.0',
    output_style: {
      name: 'default'
    },
    cost: {
      total_cost_usd: 0.01,
      total_duration_ms: 1000,
      total_api_duration_ms: 800,
      total_lines_added: 10,
      total_lines_removed: 5
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock os.homedir
    vi.mocked(os.homedir).mockReturnValue(mockHomedir);
    
    // Mock path.join
    vi.mocked(path.join)
      .mockImplementation((...args) => args.join('/'));
    
    // Mock fs methods
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to create ClaudeCodeStatusLine with mocked dependencies
  const createStatusLine = (testMode: boolean = true) => {
    return new ClaudeCodeStatusLine(testMode, mockConfigService);
  };

  describe('constructor', () => {
    it('should initialize with new pet state when no saved state exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const statusLine = createStatusLine();
      
      expect(statusLine).toBeInstanceOf(ClaudeCodeStatusLine);
    });

    it('should load saved state when it exists', () => {
      const savedState = {
        energy: 50,
        expression: '(o_o)',
        lastFeedTime: '2025-08-21T10:00:00.000Z',
        totalTokensConsumed: 10,
        accumulatedTokens: 0
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(savedState));
      
      const statusLine = createStatusLine();
      
      expect(fs.readFileSync).toHaveBeenCalledWith(mockStateFile, 'utf8');
      expect(statusLine).toBeInstanceOf(ClaudeCodeStatusLine);
    });

    it('should handle storage errors gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });
      
      expect(() => createStatusLine()).not.toThrow();
    });
  });

  describe('getStatusDisplay', () => {
    it('should return formatted pet display', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const statusLine = createStatusLine();
      const display = statusLine.getStatusDisplay();
      
      expect(display).toMatch(/\(.*\) ●●●●●●●●●● 100\.00 \(0\) 💖0/); // No emoji for ccpet tests
    });

    it('should return display for saved state', () => {
      // Use future time to avoid any time decay
      const futureTime = new Date(Date.now() + 60000); // 1 minute later
      const savedState = {
        energy: 50,
        expression: '(o_o)',
        lastFeedTime: futureTime.toISOString(),
        totalTokensConsumed: 10,
        accumulatedTokens: 0
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(savedState));
      
      const statusLine = createStatusLine();
      const display = statusLine.getStatusDisplay();
      
      expect(display).toBe('(o_o) ●●●●●○○○○○ 50.00 (0) 💖10');
    });
  });

  describe('processTokensAndGetStatusDisplay', () => {
    it('should process tokens from Claude Code input and increase pet energy', async () => {
      // Arrange - Start with low energy pet
      const initialState = {
        energy: 30,
        expression: '(o_o)',
        lastFeedTime: new Date().toISOString(),
        totalTokensConsumed: 0,
        accumulatedTokens: 0
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(initialState));
      
      const statusLine = createStatusLine();
      
      // Act - Process tokens (150 total tokens, not enough for 1M threshold)
      const display = await statusLine.processTokensAndGetStatusDisplay(mockClaudeCodeInput);
      
      // Assert - Energy should stay at 30, but accumulated tokens should be 150
      expect(display).toBe('(u_u) ●●●○○○○○○○ 30.00 (150) 💖150\nInput: 100 Output: 50 Cached: 0 Total: 150\nCtx: 4.1K Ctx: 2.0% Ctx(u): 2.6% Cost: $0.01'); // 30% energy
    });

    it('should handle token processing errors gracefully', async () => {
      const { getTokenMetrics } = await import('../utils/jsonl');
      vi.mocked(getTokenMetrics).mockRejectedValueOnce(new Error('JSONL processing error'));
      
      // Use future time to avoid time decay
      const futureTime = new Date(Date.now() + 60000); // 1 minute later
      const initialState = {
        energy: 100,
        expression: '(^_^)',
        lastFeedTime: futureTime.toISOString(),
        totalTokensConsumed: 0,
        accumulatedTokens: 0
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(initialState));
      
      const statusLine = createStatusLine();
      
      // Act & Assert - Should not throw and return current state
      await expect(statusLine.processTokensAndGetStatusDisplay(mockClaudeCodeInput))
        .resolves.toBe('(^_^) ●●●●●●●●●● 100.00 (0) 💖0');
    });

    it('should not feed pet when no tokens are detected', async () => {
      const { getTokenMetrics } = await import('../utils/jsonl');
      vi.mocked(getTokenMetrics).mockResolvedValueOnce({
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
        sessionTotalInputTokens: 0,
        sessionTotalOutputTokens: 0,
        sessionTotalCachedTokens: 0,
        contextLength: 0
      });

      const initialState = {
        energy: 50,
        expression: '(o_o)',
        lastFeedTime: new Date().toISOString(),
        totalTokensConsumed: 0,
        accumulatedTokens: 0
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(initialState));
      
      const statusLine = createStatusLine();
      
      // Act
      const display = await statusLine.processTokensAndGetStatusDisplay(mockClaudeCodeInput);
      
      // Assert - No energy change, no accumulated tokens
      expect(display).toBe('(o_o) ●●●●●○○○○○ 50.00 (0) 💖0\nInput: 0 Output: 0 Cached: 0 Total: 0\nCtx: 0 Ctx: 0.0% Ctx(u): 0.0% Cost: $0.01'); // Still 50% energy
    });

    it('should cap energy at 100 when adding tokens', async () => {
      const { getTokenMetrics } = await import('../utils/jsonl');
      vi.mocked(getTokenMetrics).mockResolvedValueOnce({
        inputTokens: 1000000,
        outputTokens: 1000000,
        cachedTokens: 0,
        totalTokens: 2000000, // This would add 2 energy (2M tokens = 2 energy)
        sessionTotalInputTokens: 1000000,
        sessionTotalOutputTokens: 1000000,
        sessionTotalCachedTokens: 0,
        contextLength: 8192
      });

      const initialState = {
        energy: 95,
        expression: '(^_^)',
        lastFeedTime: new Date().toISOString(),
        totalTokensConsumed: 0,
        accumulatedTokens: 0
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(initialState));
      
      const statusLine = createStatusLine();
      
      // Act
      const display = await statusLine.processTokensAndGetStatusDisplay(mockClaudeCodeInput);
      
      // Assert - Energy should increase to 97 (95 + 2 from 2M tokens), accumulated tokens should be 0
      expect(display).toBe('(^_^) ●●●●●●●●●● 97.00 (0) 💖2.00M\nInput: 1.00M Output: 1.00M Cached: 0 Total: 2.00M\nCtx: 8.2K Ctx: 4.1% Ctx(u): 5.1% Cost: $0.01'); // 97% energy
    });
  });

  describe('saveState', () => {
    it('should save pet state', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const statusLine = createStatusLine();
      statusLine.saveState();
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockStateFile,
        expect.stringContaining('"energy": 100'),
        'utf8'
      );
    });

    it('should handle save errors gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write error');
      });
      
      const statusLine = createStatusLine();
      
      expect(() => statusLine.saveState()).not.toThrow();
    });
  });

  describe('pet resurrection functionality', () => {
    describe('adoptNewPet', () => {
      it('should reset pet when pet is dead', () => {
        const deadState = {
          energy: 0,
          expression: '(x_x)',
          lastFeedTime: new Date().toISOString(),
          totalTokensConsumed: 5000000,
          accumulatedTokens: 999999
        };
        
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(deadState));
        
        const statusLine = createStatusLine();
        
        expect(statusLine.isPetDead()).toBe(true);
        
        statusLine.adoptNewPet();
        
        expect(statusLine.isPetDead()).toBe(false);
        // Verify state was saved after reset
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          mockStateFile,
          expect.stringContaining('"energy": 100'),
          'utf8'
        );
      });

      it('should not reset pet when pet is alive', () => {
        const aliveState = {
          energy: 50,
          expression: '(o_o)',
          lastFeedTime: new Date().toISOString(),
          totalTokensConsumed: 1000000,
          accumulatedTokens: 500000
        };
        
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(aliveState));
        
        const statusLine = createStatusLine();
        
        expect(statusLine.isPetDead()).toBe(false);
        
        statusLine.adoptNewPet();
        
        expect(statusLine.isPetDead()).toBe(false);
        // State should remain unchanged
        const display = statusLine.getStatusDisplay();
        expect(display).toBe('(o_o) ●●●●●○○○○○ 50.00 (500.0K) 💖1.00M'); // Still at 50% energy
      });

      it('should save state after successful adoption', () => {
        const deadState = {
          energy: 0,
          expression: '(x_x)',
          lastFeedTime: new Date().toISOString(),
          totalTokensConsumed: 10000000,
          accumulatedTokens: 0
        };
        
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(deadState));
        
        const statusLine = createStatusLine();
        
        // Clear previous calls to writeFileSync
        vi.mocked(fs.writeFileSync).mockClear();
        
        statusLine.adoptNewPet();
        
        // Should call saveState after reset
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          mockStateFile,
          expect.stringContaining('"energy": 100'),
          'utf8'
        );
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          mockStateFile,
          expect.stringContaining('"totalTokensConsumed": 0'),
          'utf8'
        );
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          mockStateFile,
          expect.stringContaining('"accumulatedTokens": 0'),
          'utf8'
        );
      });

      it('should handle VSCode notification if available', () => {
        // Mock window.vscode for VSCode environment
        const mockVscode = {
          postMessage: vi.fn(),
          commands: {
            registerCommand: vi.fn()
          }
        };
        
        // @ts-ignore - mocking global window
        global.window = { vscode: mockVscode };
        
        const deadState = {
          energy: 0,
          expression: '(x_x)',
          lastFeedTime: new Date().toISOString(),
          totalTokensConsumed: 0,
          accumulatedTokens: 0
        };
        
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(deadState));
        
        const statusLine = createStatusLine();
        statusLine.adoptNewPet();
        
        expect(mockVscode.postMessage).toHaveBeenCalledWith({
          command: 'showInformationMessage',
          text: expect.stringContaining('Successfully adopted a new pet named')
        });
        
        // Clean up global mock
        // @ts-ignore
        delete global.window;
      });

    });

    describe('isPetDead', () => {
      it('should return true when pet energy is 0', () => {
        const deadState = {
          energy: 0,
          expression: '(x_x)',
          lastFeedTime: new Date().toISOString(),
          totalTokensConsumed: 0,
          accumulatedTokens: 0
        };
        
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(deadState));
        
        const statusLine = createStatusLine();
        
        expect(statusLine.isPetDead()).toBe(true);
      });

      it('should return false when pet energy is greater than 0', () => {
        const aliveState = {
          energy: 1,
          expression: '(u_u)',
          lastFeedTime: new Date().toISOString(),
          totalTokensConsumed: 0,
          accumulatedTokens: 0
        };
        
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(aliveState));
        
        const statusLine = createStatusLine();
        
        expect(statusLine.isPetDead()).toBe(false);
      });

      it('should return false for healthy pet', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        
        const statusLine = createStatusLine();
        
        expect(statusLine.isPetDead()).toBe(false);
      });
    });
  });

  describe('JSONL integration', () => {
    it('should call getTokenMetrics with correct transcript path', async () => {
      const { getTokenMetrics } = await import('../utils/jsonl');
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const statusLine = createStatusLine();
      
      await statusLine.processTokensAndGetStatusDisplay(mockClaudeCodeInput);
      
      expect(getTokenMetrics).toHaveBeenCalledWith('/mock/transcript.jsonl', false);
    });

    it('should detect resumed conversations using total_cost_usd=0', async () => {
      const { getTokenMetrics } = await import('../utils/jsonl');
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const statusLine = createStatusLine();
      
      // Create a mock input that indicates a resumed conversation
      const resumedInput = {
        ...mockClaudeCodeInput,
        cost: {
          ...mockClaudeCodeInput.cost,
          total_cost_usd: 0 // This indicates a resumed conversation
        }
      };
      
      await statusLine.processTokensAndGetStatusDisplay(resumedInput);
      
      // Should be called with isResumedConversation=true
      expect(getTokenMetrics).toHaveBeenCalledWith('/mock/transcript.jsonl', true);
    });

    it('should convert tokens to energy using correct ratio', async () => {
      const { getTokenMetrics } = await import('../utils/jsonl');
      vi.mocked(getTokenMetrics).mockResolvedValueOnce({
        inputTokens: 50,
        outputTokens: 50,
        cachedTokens: 0,
        totalTokens: 100, // Should accumulate 100 tokens, not enough for energy
        sessionTotalInputTokens: 50,
        sessionTotalOutputTokens: 50,
        sessionTotalCachedTokens: 0,
        contextLength: 2048
      });

      // Use future time to avoid time decay
      const futureTime = new Date(Date.now() + 60000); // 1 minute later
      const initialState = {
        energy: 40,
        expression: '(o_o)',
        lastFeedTime: futureTime.toISOString(),
        totalTokensConsumed: 0,
        accumulatedTokens: 0
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(initialState));
      
      const statusLine = createStatusLine();
      
      // Act
      const display = await statusLine.processTokensAndGetStatusDisplay(mockClaudeCodeInput);
      
      // Assert - Energy should stay at 40, accumulated tokens should be 100
      expect(display).toBe('(o_o) ●●●●○○○○○○ 40.00 (100) 💖100\nInput: 50 Output: 50 Cached: 0 Total: 100\nCtx: 2.0K Ctx: 1.0% Ctx(u): 1.3% Cost: $0.01'); // 40% energy
    });
  });
});