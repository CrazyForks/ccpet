import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validateLine1Items } from '../core/config';

export interface UserConfig {
  colors: {
    petExpression?: string;
    petName?: string;
    energyBar?: string;
    energyValue?: string;
    accumulatedTokens?: string;
    lifetimeTokens?: string;
    sessionInput?: string;
    sessionOutput?: string;
    sessionCached?: string;
    sessionTotal?: string;
    contextLength?: string;
    contextPercentage?: string;
    contextPercentageUsable?: string;
    cost?: string;
  };
  pet: {
    animationEnabled?: boolean;
    decayRate?: number;
    emojiEnabled?: boolean;
  };
  display: {
    maxLines?: number; // 1-3, default 2
    line1?: {
      enabled?: boolean;
      items?: string[]; // e.g., ['expression', 'energy-bar', 'energy-value', 'accumulated-tokens', 'lifetime-tokens', 'pet-name']
    };
    line2?: {
      enabled?: boolean;
      items?: string[]; // e.g., ['input', 'output', 'cached', 'total']
    };
    line3?: {
      enabled?: boolean;
      items?: string[]; // e.g., ['total'] or custom items
    };
  };
  supabase?: {
    url?: string;
    apiKey?: string;
    autoSync?: boolean;
    syncInterval?: number; // minutes, default 1440 (24 hours)
  };
}

const DEFAULT_CONFIG: UserConfig = {
  colors: {
    petExpression: '#FFFF00:bright:bold',
    petName: '#00FFFF:bright',
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
  pet: {
    animationEnabled: true,
    decayRate: 0.0231,
    emojiEnabled: true
  },
  display: {
    maxLines: 3,
    line1: {
      enabled: true,
      items: ['expression', 'energy-bar', 'energy-value', 'accumulated-tokens', 'lifetime-tokens']
    },
    line2: {
      enabled: true,
      items: ['input', 'output', 'cached', 'total']
    },
    line3: {
      enabled: true,
      items: ['context-length', 'context-percentage', 'context-percentage-usable', 'cost']
    }
  },
  supabase: {
    url: 'https://rzsupavqzxhyrgcexrpx.supabase.co',
    apiKey: 'sbp_88f3151cc0a24a37dd71617c562e62a79727ef6f',
    autoSync: false,
    syncInterval: 1440 // 24 hours
  }
};

export class ConfigService {
  private readonly configDir: string;
  private readonly configFile: string;
  private cachedConfig: UserConfig | null = null;

  constructor(testConfigPath?: string) {
    if (testConfigPath) {
      this.configDir = testConfigPath;
      this.configFile = path.join(testConfigPath, 'config.json');
    } else {
      // Use different paths for test and production environments
      const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
      const configDirName = isTest ? '.claude-pet-test' : '.claude-pet';
      this.configDir = path.join(os.homedir(), configDirName);
      this.configFile = path.join(this.configDir, 'config.json');
    }
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  private loadConfig(): UserConfig {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    this.ensureConfigDir();

    if (!fs.existsSync(this.configFile)) {
      // Create default config if it doesn't exist
      const defaultConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      this.saveConfig(defaultConfig);
      this.cachedConfig = defaultConfig;
      return defaultConfig;
    }

    try {
      const configData = fs.readFileSync(this.configFile, 'utf8');
      const userConfig = JSON.parse(configData);
      
      // Merge with defaults to ensure all properties exist
      this.cachedConfig = this.mergeWithDefaults(userConfig);
      return this.cachedConfig;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Failed to load config, using defaults:', errorMessage);
      const defaultConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      this.cachedConfig = defaultConfig;
      return defaultConfig;
    }
  }

  private mergeWithDefaults(userConfig: Partial<UserConfig>): UserConfig {
    return {
      colors: {
        ...DEFAULT_CONFIG.colors,
        ...userConfig.colors
      },
      pet: {
        ...DEFAULT_CONFIG.pet,
        ...userConfig.pet
      },
      display: {
        ...DEFAULT_CONFIG.display,
        ...userConfig.display,
        line1: {
          ...DEFAULT_CONFIG.display.line1,
          ...userConfig.display?.line1
        },
        line2: {
          ...DEFAULT_CONFIG.display.line2,
          ...userConfig.display?.line2
        },
        line3: {
          ...DEFAULT_CONFIG.display.line3,
          ...userConfig.display?.line3
        }
      },
      supabase: {
        ...DEFAULT_CONFIG.supabase,
        ...userConfig.supabase
      }
    };
  }

  private saveConfig(config: UserConfig): void {
    this.ensureConfigDir();
    fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf8');
    // Deep clone to avoid mutating the original config
    this.cachedConfig = JSON.parse(JSON.stringify(config));
  }

  getConfig(): UserConfig {
    return this.loadConfig();
  }

  setColorConfig(key: keyof UserConfig['colors'], value: string): void {
    const config = this.loadConfig();
    config.colors[key] = value;
    this.saveConfig(config);
  }

  setPetConfig(key: keyof UserConfig['pet'], value: boolean | number): void {
    const config = this.loadConfig();
    (config.pet as any)[key] = value;
    this.saveConfig(config);
  }

  setDisplayConfig(key: string, value: any): void {
    const config = this.loadConfig();
    
    if (key === 'maxLines') {
      config.display.maxLines = Math.min(3, Math.max(1, Number(value)));
    } else if (key === 'line1.enabled') {
      config.display.line1!.enabled = Boolean(value);
    } else if (key === 'line1.items') {
      const items = Array.isArray(value) ? value : value.split(',').map((s: string) => s.trim());
      const validatedItems = validateLine1Items(items);
      
      // Warn about invalid items
      const invalidItems = items.filter((item: string) => !validatedItems.includes(item as any));
      if (invalidItems.length > 0) {
        console.warn(`Invalid line1 items ignored: ${invalidItems.join(', ')}`);
      }
      
      // Use default if no valid items
      config.display.line1!.items = validatedItems.length > 0 ? validatedItems : ['expression', 'energy-bar', 'energy-value', 'accumulated-tokens', 'lifetime-tokens'];
    } else if (key === 'line2.enabled') {
      config.display.line2!.enabled = Boolean(value);
    } else if (key === 'line2.items') {
      config.display.line2!.items = Array.isArray(value) ? value : value.split(',').map((s: string) => s.trim());
    } else if (key === 'line3.enabled') {
      config.display.line3!.enabled = Boolean(value);
    } else if (key === 'line3.items') {
      config.display.line3!.items = Array.isArray(value) ? value : value.split(',').map((s: string) => s.trim());
    }
    
    this.saveConfig(config);
  }

  setSupabaseConfig(key: string, value: string | boolean | number): void {
    const config = this.getConfig();
    
    if (!config.supabase) {
      config.supabase = {};
    }

    if (key === 'url') {
      config.supabase.url = value as string;
    } else if (key === 'apiKey') {
      config.supabase.apiKey = value as string;
    } else if (key === 'autoSync') {
      config.supabase.autoSync = value as boolean;
    } else if (key === 'syncInterval') {
      const numValue = Number(value);
      if (!isNaN(numValue) && numValue > 0) {
        config.supabase.syncInterval = numValue;
      } else {
        throw new Error(`Invalid syncInterval value: ${value}. Must be a positive number.`);
      }
    } else {
      throw new Error(`Unknown Supabase configuration key: ${key}`);
    }
    
    this.saveConfig(config);
  }

  resetConfig(): void {
    this.saveConfig(DEFAULT_CONFIG);
  }

  listConfig(): string {
    const config = this.getConfig();
    return JSON.stringify(config, null, 2);
  }

  getConfigPath(): string {
    return this.configFile;
  }
}