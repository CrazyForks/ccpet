import { processColorConfig } from '../utils/colors';
import { ConfigService } from '../services/ConfigService';

// 动物类型枚举
export enum AnimalType {
  CAT = 'cat',
  DOG = 'dog', 
  RABBIT = 'rabbit',
  PANDA = 'panda',
  FOX = 'fox'
}

// 动物配置接口
export interface IAnimalConfig {
  id: AnimalType;
  name: string;
  emoji: string;
}

// Line1 支持的显示元素类型
export type Line1ItemType = 
  | 'expression' 
  | 'energy-bar' 
  | 'energy-value' 
  | 'accumulated-tokens' 
  | 'lifetime-tokens' 
  | 'pet-name'; // 预留给Story 4.2

// Line1 支持的元素常量
export const LINE1_SUPPORTED_ITEMS: readonly Line1ItemType[] = [
  'expression',
  'energy-bar', 
  'energy-value',
  'accumulated-tokens',
  'lifetime-tokens',
  'pet-name'
] as const;

function getColorConfiguration(configService?: ConfigService) {
  try {
    const service = configService || new ConfigService();
    const userConfig = service.getConfig();
    
    return {
      PET_EXPRESSION: userConfig.colors.petExpression || '#FFFF00:bright:bold',
      PET_NAME: userConfig.colors.petName || '#00FFFF:bright',
      ENERGY_BAR: userConfig.colors.energyBar || '#00FF00',
      ENERGY_VALUE: userConfig.colors.energyValue || '#00FFFF',
      ACCUMULATED_TOKENS: userConfig.colors.accumulatedTokens || '#778899',
      LIFETIME_TOKENS: userConfig.colors.lifetimeTokens || '#FF00FF',
      SESSION_INPUT: userConfig.colors.sessionInput || '#00FF00',
      SESSION_OUTPUT: userConfig.colors.sessionOutput || '#FFFF00',
      SESSION_CACHED: userConfig.colors.sessionCached || '#F4A460',
      SESSION_TOTAL: userConfig.colors.sessionTotal || '#FFFFFF',
      CONTEXT_LENGTH: userConfig.colors.contextLength || '#00DDFF',
      CONTEXT_PERCENTAGE: userConfig.colors.contextPercentage || '#0099DD',
      CONTEXT_PERCENTAGE_USABLE: userConfig.colors.contextPercentageUsable || '#90EE90',
      COST: userConfig.colors.cost || '#FFD700',
      RESET: 'RESET' // reset color
    };
  } catch (error) {
    // Fallback to defaults if config loading fails
    return {
      PET_EXPRESSION: '#FFFF00:bright:bold',
      PET_NAME: '#00FFFF:bright',
      ENERGY_BAR: '#00FF00',
      ENERGY_VALUE: '#00FFFF',
      ACCUMULATED_TOKENS: '#778899',
      LIFETIME_TOKENS: '#FF00FF',
      SESSION_INPUT: '#00FF00',
      SESSION_OUTPUT: '#FFFF00',
      SESSION_CACHED: '#F4A460',
      SESSION_TOTAL: '#FFFFFF',
      CONTEXT_LENGTH: '#00DDFF',
      CONTEXT_PERCENTAGE: '#0099DD',
      CONTEXT_PERCENTAGE_USABLE: '#90EE90',
      COST: '#FFD700',
      RESET: 'RESET'
    };
  }
}

function getDefaultColorConfiguration() {
  return {
    PET_EXPRESSION: '#FFFF00:bright:bold',
    PET_NAME: '#00FFFF:bright',
    ENERGY_BAR: '#00FF00',
    ENERGY_VALUE: '#00FFFF',
    ACCUMULATED_TOKENS: '#778899',
    LIFETIME_TOKENS: '#FF00FF',
    SESSION_INPUT: '#00FF00',
    SESSION_OUTPUT: '#FFFF00',
    SESSION_CACHED: '#F4A460',
    SESSION_TOTAL: '#FFFFFF',
    CONTEXT_LENGTH: '#00DDFF',
    CONTEXT_PERCENTAGE: '#0099DD',
    CONTEXT_PERCENTAGE_USABLE: '#90EE90',
    COST: '#FFD700',
    RESET: 'RESET'
  };
}

// 宠物名称列表
export const PET_NAMES: readonly string[] = [
  'Fluffy', 'Whiskers', 'Shadow', 'Luna', 'Max',
  'Bella', 'Charlie', 'Lucy', 'Cooper', 'Ruby',
  'Milo', 'Lily', 'Buddy', 'Chloe', 'Rocky',
  '小白', '毛毛', '球球', '豆豆', '花花',
  '咪咪', '旺财', '小黑', '雪儿', '糖糖'
] as const;

// 生成随机宠物名称的实用函数
export function generateRandomPetName(): string {
  if (PET_NAMES.length === 0) {
    return 'Pet'; // 降级策略：如果名称列表为空，返回默认名称
  }
  
  const randomIndex = Math.floor(Math.random() * PET_NAMES.length);
  return PET_NAMES[randomIndex];
}

// 动物类型配置
export const ANIMAL_CONFIGS: Record<AnimalType, IAnimalConfig> = {
  [AnimalType.CAT]: { id: AnimalType.CAT, name: '猫', emoji: '🐱' },
  [AnimalType.DOG]: { id: AnimalType.DOG, name: '狗', emoji: '🐶' },
  [AnimalType.RABBIT]: { id: AnimalType.RABBIT, name: '兔子', emoji: '🐰' },
  [AnimalType.PANDA]: { id: AnimalType.PANDA, name: '熊猫', emoji: '🐼' },
  [AnimalType.FOX]: { id: AnimalType.FOX, name: '狐狸', emoji: '🦊' }
};

export const PET_CONFIG = {
  INITIAL_ENERGY: 100,
  HAPPY_EXPRESSION_THRESHOLD: 80,
  HAPPY_EXPRESSION: '(^_^)',
  ENERGY_BAR_LENGTH: 10,
  STATUS_BAR_PRIORITY: 100,
  FILLED_BAR_CHAR: '●',
  EMPTY_BAR_CHAR: '○',
  STATE_THRESHOLDS: {
    HAPPY: 80,
    HUNGRY: 40,
    SICK: 10,
    DEAD: 0
  },
  STATE_EXPRESSIONS: {
    HAPPY: '(^_^)',
    HUNGRY: '(o_o)',
    SICK: '(u_u)',
    DEAD: '(x_x)'
  },
  // 动画表情序列
  ANIMATED_EXPRESSIONS: {
    HAPPY: ['(^_^)', '(^o^)', '(^_^)', '(^v^)'],
    HUNGRY: ['(o_o)', '(O_O)', '(o_o)', '(-_-)'],
    SICK: ['(u_u)', '(T_T)', '(u_u)', '(>_<)'],
    DEAD: ['(x_x)', '(X_X)', '(x_x)', '(+_+)']
  },
  TIME_DECAY: {
    DECAY_CHECK_INTERVAL: 60000, // 1 minute in milliseconds
    DECAY_RATE: 0.0231, // energy points to decrease per minute (~3 day 100→0 rate)
    MINIMUM_DECAY_INTERVAL: 60000 // minimum 1 minute before first decay can occur
  },
  FEEDING: {
    TOKENS_PER_ENERGY: 1000000 // 100万token = 1点能量
  },
  ANIMAL: {
    DEFAULT_TYPE: AnimalType.CAT // 默认动物类型用于向后兼容
  },
  // Processed colors - using defaults initially, will be updated by getProcessedColors()
  COLORS: processColorConfig(getDefaultColorConfiguration() as Record<string, string>)
} as const;

export const LOGGER_CONFIG = {
  COMPONENT_NAME: 'StatusPetExtension'
} as const;

// 动态获取处理过的颜色配置（用于运行时获取用户配置的颜色）
export function getProcessedColors(configService?: ConfigService) {
  return processColorConfig(getColorConfiguration(configService) as Record<string, string>);
}

// 默认line1配置
export const DEFAULT_LINE1_CONFIG = {
  enabled: true,
  items: ['expression', 'energy-bar', 'energy-value', 'accumulated-tokens', 'lifetime-tokens'] as Line1ItemType[]
} as const;

// 验证line1配置项
export function validateLine1Items(items: string[]): Line1ItemType[] {
  return items.filter((item): item is Line1ItemType => 
    LINE1_SUPPORTED_ITEMS.includes(item as Line1ItemType)
  );
}

// Supabase同步配置
export const SUPABASE_CONFIG = {
  DEFAULT_URL: process.env.SUPABASE_URL || '',
  DEFAULT_API_KEY: process.env.SUPABASE_ANON_KEY || '',
  BATCH_SIZE: 100,
  DEFAULT_SYNC_INTERVAL: 24 * 60 * 60 * 1000, // 24小时
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000
} as const;

