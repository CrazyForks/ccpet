import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../ConfigService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ConfigService Edge Cases', () => {
  let configService: ConfigService;
  let consoleSpy: any;

  beforeEach(() => {
    configService = new ConfigService();
    
    consoleSpy = {
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {})
    };

    // Clear cached config and ensure clean state
    configService['cachedConfig'] = null;
    
    // Clean up test directory to ensure clean state
    const testConfigDir = (configService as any).configDir;
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadConfig error handling', () => {
    it('should handle JSON parse errors gracefully', () => {
      // Write invalid JSON to config file
      const configPath = (configService as any).configFile;
      const configDir = (configService as any).configDir;
      
      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Write truly invalid JSON that will definitely fail parsing
      fs.writeFileSync(configPath, '{ invalid json }');

      const config = (configService as any).loadConfig();

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'Failed to load config, using defaults:',
        expect.stringContaining('JSON')
      );
      
      // Should return default config
      expect(config).toEqual({
        colors: expect.any(Object),
        pet: expect.any(Object),
        display: expect.any(Object),
        supabase: expect.any(Object)
      });
    });

    it('should handle file read errors gracefully', () => {
      // This test would be complex to set up with real file permission errors
      // but we can simulate it by testing with a directory path as config file
      const configPath = (configService as any).configFile;
      const configDir = (configService as any).configDir;
      
      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Create a directory with the config file name to cause read error
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
      fs.mkdirSync(configPath);

      const config = (configService as any).loadConfig();

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'Failed to load config, using defaults:',
        expect.any(String)
      );
      
      // Should return default config
      expect(config).toEqual({
        colors: expect.any(Object),
        pet: expect.any(Object),
        display: expect.any(Object),
        supabase: expect.any(Object)
      });
      
      // Clean up
      fs.rmSync(configPath, { recursive: true });
    });

    it('should create config file when it does not exist', () => {
      const config = (configService as any).loadConfig();

      // Should return default config structure
      expect(config).toEqual({
        colors: expect.any(Object),
        pet: expect.any(Object),
        display: expect.any(Object),
        supabase: expect.any(Object)
      });
      
      // Should have created the config file
      const configPath = (configService as any).configFile;
      expect(fs.existsSync(configPath)).toBe(true);
    });
  });

  describe('ensureConfigDir error handling', () => {
    it('should not create directory if it already exists', () => {
      const configDir = (configService as any).configDir;
      
      // Create the directory first
      fs.mkdirSync(configDir, { recursive: true });
      
      // This should not throw when directory already exists
      expect(() => (configService as any).ensureConfigDir()).not.toThrow();
      
      // Directory should still exist
      expect(fs.existsSync(configDir)).toBe(true);
    });

    it('should create directory when it does not exist', () => {
      const configDir = (configService as any).configDir;
      
      // Ensure directory doesn't exist
      if (fs.existsSync(configDir)) {
        fs.rmSync(configDir, { recursive: true, force: true });
      }
      
      // This should not throw and should create the directory
      expect(() => (configService as any).ensureConfigDir()).not.toThrow();
      
      // Directory should now exist
      expect(fs.existsSync(configDir)).toBe(true);
    });
  });

  describe('saveConfig error handling', () => {
    it('should propagate write errors', () => {
      // Create a directory where the config file should be to cause write error
      const configPath = (configService as any).configFile;
      const configDir = (configService as any).configDir;
      
      // Ensure parent directory exists first
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Create a directory where the config file should be (after ensuring parent exists)
      if (fs.existsSync(configPath)) {
        if (fs.statSync(configPath).isDirectory()) {
          fs.rmSync(configPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(configPath);
        }
      }
      fs.mkdirSync(configPath);

      const testConfig = {
        colors: { petExpression: '#FF0000' },
        pet: { animationEnabled: true },
        display: { maxLines: 2 }
      } as any;

      // Should throw when write fails
      expect(() => (configService as any).saveConfig(testConfig)).toThrow();
      
      // Clean up
      fs.rmSync(configPath, { recursive: true });
    });

    it('should work with custom config paths', () => {
      // Test that saveConfig works with custom paths
      const customPath = path.join(os.tmpdir(), 'custom-claude-pet-test');
      const testConfigService = new ConfigService(customPath);

      const testConfig = {
        colors: { petExpression: '#FF0000' },
        pet: { animationEnabled: true },
        display: { maxLines: 2 }
      } as any;

      // Should work with custom path
      expect(() => (testConfigService as any).saveConfig(testConfig)).not.toThrow();
      
      // Config file should exist
      const configPath = path.join(customPath, 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);
      
      // Clean up
      fs.rmSync(customPath, { recursive: true, force: true });
    });
  });

  describe('mergeWithDefaults', () => {
    it('should handle incomplete config objects', () => {
      const partialConfig = {
        colors: { petExpression: '#FF0000' }
        // Missing pet section
      };

      const merged = configService['mergeWithDefaults'](partialConfig);

      expect(merged.colors.petExpression).toBe('#FF0000');
      expect(merged.pet).toEqual(expect.any(Object));
      expect(merged.pet.animationEnabled).toBeDefined();
    });

    it('should handle empty config objects', () => {
      const emptyConfig = {};

      const merged = configService['mergeWithDefaults'](emptyConfig);

      expect(merged.colors).toEqual(expect.any(Object));
      expect(merged.pet).toEqual(expect.any(Object));
    });

    it('should handle null/undefined values', () => {
      const configWithNulls = {
        colors: {
          petExpression: null,
          energyBar: undefined
        },
        pet: {
          animationEnabled: null
        }
      };

      const merged = configService['mergeWithDefaults'](configWithNulls);

      // Null/undefined values should be preserved (not replaced with defaults)
      expect(merged.colors.petExpression).toBeNull();
      expect(merged.colors.energyBar).toBeUndefined();
      expect(merged.pet.animationEnabled).toBeNull();
    });
  });

  describe('configuration caching', () => {
    it('should return cached config on subsequent calls', () => {
      // First call
      const config1 = configService.loadConfig();
      
      // Second call should return cached version
      const config2 = configService.loadConfig();

      expect(config1).toBe(config2); // Same object reference
    });

    it('should update cache when saveConfig is called', () => {
      const newConfig = {
        colors: { petExpression: '#FF0000' },
        pet: { animationEnabled: false },
        display: { maxLines: 2 }
      };

      (configService as any).saveConfig(newConfig);
      const loadedConfig = configService.getConfig();

      expect(loadedConfig.colors.petExpression).toBe('#FF0000');
      expect(loadedConfig.pet.animationEnabled).toBe(false);
      expect(loadedConfig.display.maxLines).toBe(2);
    });
  });

  describe('path handling', () => {
    it('should handle path operations correctly', () => {
      // Test that ConfigService correctly constructs file paths
      const testPath = '/tmp/test-config-path';
      const testService = new ConfigService(testPath);
      
      expect((testService as any).configDir).toBe(testPath);
      expect((testService as any).configFile).toBe(path.join(testPath, 'config.json'));
    });

    it('should use different paths for test and production', () => {
      // Test that different paths are used based on environment
      const originalNodeEnv = process.env.NODE_ENV;
      const originalVitest = process.env.VITEST;
      
      // Clear both environment variables for production test
      delete process.env.NODE_ENV;
      delete process.env.VITEST;
      const prodService = new ConfigService();
      expect((prodService as any).configDir).toBe(path.join(os.homedir(), '.claude-pet'));
      
      // Set test environment
      process.env.NODE_ENV = 'test';
      const testService = new ConfigService();
      expect((testService as any).configDir).toBe(path.join(os.homedir(), '.claude-pet-test'));
      
      // Restore environment
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
      if (originalVitest) {
        process.env.VITEST = originalVitest;
      }
    });
  });

  describe('config validation', () => {
    it('should handle config with extra properties', () => {
      const configWithExtra = {
        colors: { petExpression: '#FF0000' },
        pet: { animationEnabled: true },
        extraSection: { shouldBeIgnored: true }
      };

      const merged = configService['mergeWithDefaults'](configWithExtra);

      // Extra properties should not interfere
      expect(merged.colors).toBeDefined();
      expect(merged.pet).toBeDefined();
      // Extra properties are not preserved in merged config
      expect(merged).not.toHaveProperty('extraSection');
    });

    it('should handle deeply nested properties', () => {
      const configWithDeep = {
        colors: {
          petExpression: '#FF0000',
          nested: {
            deep: {
              value: 'should not break'
            }
          }
        },
        pet: { animationEnabled: true }
      };

      const merged = configService['mergeWithDefaults'](configWithDeep);

      expect(merged.colors.petExpression).toBe('#FF0000');
      expect(merged.colors.nested).toEqual({ deep: { value: 'should not break' } });
    });
  });

  describe('Supabase configuration', () => {
    it('should include default Supabase configuration', () => {
      const config = configService.getConfig();
      
      expect(config.supabase).toBeDefined();
      expect(config.supabase?.url).toBe('https://rzsupavqzxhyrgcexrpx.supabase.co');
      expect(config.supabase?.apiKey).toBe('sbp_88f3151cc0a24a37dd71617c562e62a79727ef6f');
      expect(config.supabase?.autoSync).toBe(false);
      expect(config.supabase?.syncInterval).toBe(1440);
    });

    it('should allow setting Supabase configuration', () => {
      configService.setSupabaseConfig('url', 'https://custom.supabase.co');
      configService.setSupabaseConfig('apiKey', 'custom-key');
      configService.setSupabaseConfig('autoSync', true);
      configService.setSupabaseConfig('syncInterval', 720);
      
      const config = configService.getConfig();
      
      expect(config.supabase?.url).toBe('https://custom.supabase.co');
      expect(config.supabase?.apiKey).toBe('custom-key');
      expect(config.supabase?.autoSync).toBe(true);
      expect(config.supabase?.syncInterval).toBe(720);
    });

    it('should handle invalid syncInterval values', () => {
      // Create a fresh config service with a unique path to ensure clean state
      const uniqueTestPath = path.join(os.tmpdir(), `ccpet-test-${Date.now()}`);
      const freshConfigService = new ConfigService(uniqueTestPath);
      
      expect(() => {
        freshConfigService.setSupabaseConfig('syncInterval', 'invalid' as any);
      }).toThrow('Invalid syncInterval value');
      
      // The invalid value should not have been set, so config should still have default value
      const config = freshConfigService.getConfig();
      expect(config.supabase?.syncInterval).toBe(1440);
    });
  });
});