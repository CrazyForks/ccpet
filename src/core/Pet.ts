import { PET_CONFIG, AnimalType, ANIMAL_CONFIGS, generateRandomPetName } from './config';
import { v4 as uuidv4 } from 'uuid';

export interface IPetState {
  uuid: string; // 宠物唯一标识符，用于supabase等数据库
  energy: number;
  expression: string;
  animalType: AnimalType; // 动物类型字段
  emoji?: string; // 宠物表情符号
  birthTime: Date; // 宠物诞生时间
  lastFeedTime: Date;
  totalTokensConsumed: number;
  accumulatedTokens: number; // 当前累积的token数（用于下次能量增加）
  totalLifetimeTokens: number; // 宠物诞生以来消耗的总token数（用于排名和升级）
  lastDecayTime?: Date; // 上次计算衰减的时间
  sessionTotalInputTokens?: number; // 当前会话总输入token
  sessionTotalOutputTokens?: number; // 当前会话总输出token
  sessionTotalCachedTokens?: number; // 当前会话总缓存token
  contextLength?: number; // 当前上下文长度（token数）
  contextPercentage?: number; // 上下文使用百分比（基于200k限制）
  contextPercentageUsable?: number; // 可用上下文使用百分比（基于160k限制）
  sessionTotalCostUsd?: number; // 当前会话总费用（美元）
  petName: string; // 宠物名称
}

interface IPetDependencies {
  config: typeof PET_CONFIG;
}

type PetObserver = (state: IPetState) => void;

export class Pet {
  private state: IPetState;
  private deps: IPetDependencies;
  private observers: PetObserver[] = [];

  constructor(initialState: IPetState, dependencies: IPetDependencies) {
    // Initialize state with backward compatibility for missing petName, uuid, and emoji
    this.state = {
      ...initialState,
      uuid: initialState.uuid || uuidv4(),
      petName: initialState.petName || generateRandomPetName(),
      emoji: initialState.emoji || ANIMAL_CONFIGS[initialState.animalType]?.emoji || ANIMAL_CONFIGS[AnimalType.CAT].emoji
    };
    this.deps = dependencies;
    this._updateExpression(); // Ensure expression matches energy level
  }

  public getState(): IPetState {
    return { ...this.state };
  }

  public subscribe(observer: PetObserver): () => void {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  public feed(tokens: number): void {
    try {
      // 累积新的token
      const newAccumulatedTokens = this.state.accumulatedTokens + tokens;
      
      // 计算能获得多少完整的能量点
      const { TOKENS_PER_ENERGY } = this.deps.config.FEEDING;
      const energyToAdd = Math.floor(newAccumulatedTokens / TOKENS_PER_ENERGY);
      
      // 计算剩余的累积token (未达到下一个能量点的部分)
      const remainingTokens = newAccumulatedTokens % TOKENS_PER_ENERGY;
      
      // 更新状态
      this.state = {
        ...this.state,
        accumulatedTokens: remainingTokens, // 保留未能转换为能量的token
        lastFeedTime: new Date(),
        totalTokensConsumed: this.state.totalTokensConsumed + tokens,
        totalLifetimeTokens: this.state.totalLifetimeTokens + tokens
      };
      // 如果有完整的能量点要增加
      if (energyToAdd > 0) {
        this.addEnergy(energyToAdd);
      }
    } catch (error) {
      console.error('Pet feeding failed:', error);
    }
  }

  public applyTimeDecay(): void {
    try {
      const now = new Date();
      const { TIME_DECAY } = this.deps.config;
      
      // Use lastDecayTime to calculate decay, if not exists use lastFeedTime
      const lastTime = this.state.lastDecayTime || this.state.lastFeedTime;
      const minutesSinceLastDecay = 
        (now.getTime() - lastTime.getTime()) / (1000 * 60);
      
      if (minutesSinceLastDecay > 0) {
        // Enhanced configurable decay system - use TIME_DECAY settings if available
        // Fallback to original 3-day decay system for backward compatibility
        const ENERGY_DECAY_PER_MINUTE = TIME_DECAY ? 
          (TIME_DECAY.DECAY_RATE / (TIME_DECAY.DECAY_CHECK_INTERVAL / (1000 * 60))) : // New: configurable rate per minute
          (100 / (3 * 24 * 60)); // Original: 3 days from 100 to 0, ≈ 0.0231 per minute
        
        const energyDecay = minutesSinceLastDecay * ENERGY_DECAY_PER_MINUTE;
        
        // Apply minimum decay interval check if configured
        const minimumMinutes = TIME_DECAY ? 
          (TIME_DECAY.MINIMUM_DECAY_INTERVAL / (1000 * 60)) : 
          0; // Original had no minimum interval
        
        if (energyDecay > 0 && minutesSinceLastDecay >= minimumMinutes) {
          this.decreaseEnergy(energyDecay);
          
          // Update lastDecayTime but keep lastFeedTime unchanged
          this.state = {
            ...this.state,
            lastDecayTime: now
          };
        }
      }
    } catch (error) {
      console.error('Pet time decay failed:', error);
      // Graceful fallback - skip decay for current execution
    }
  }

  public addEnergy(amount: number): void {
    try {
      if (typeof amount !== 'number' || amount < 0 || isNaN(amount)) {
        throw new Error(`Invalid energy amount: ${amount}. Must be a non-negative number.`);
      }

      const now = new Date();
      this.state = {
        ...this.state,
        energy: Math.min(100, this.state.energy + amount),
        lastFeedTime: now,
        lastDecayTime: now
      };
      this._updateExpression();
      this._notify();
    } catch (error) {
      console.error('Pet addEnergy failed:', error);
      throw error;
    }
  }

  public decreaseEnergy(amount: number): void {
    try {
      if (typeof amount !== 'number' || amount < 0 || isNaN(amount)) {
        throw new Error(`Invalid energy amount: ${amount}. Must be a non-negative number.`);
      }

      this.state = {
        ...this.state,
        energy: Math.max(0, this.state.energy - amount)
      };
      this._updateExpression();
      this._notify();
    } catch (error) {
      console.error('Pet decreaseEnergy failed:', error);
      throw error;
    }
  }

  public getCurrentEnergy(): number {
    return this.state.energy;
  }

  public getCurrentAnimalType(): AnimalType {
    return this.state.animalType;
  }

  public static getRandomAnimalType(): AnimalType {
    const animalTypes = Object.values(AnimalType);
    const randomIndex = Math.floor(Math.random() * animalTypes.length);
    return animalTypes[randomIndex];
  }

  public getAnimalEmoji(): string {
    // Prefer stored emoji, fallback to config-based emoji
    return this.state.emoji || ANIMAL_CONFIGS[this.state.animalType]?.emoji || ANIMAL_CONFIGS[AnimalType.CAT].emoji;
  }

  public isDead(): boolean {
    return this.state.energy === 0;
  }

  public resetToInitialState(onGraveyardSave?: (currentState: IPetState) => void): void {
    try {
      // Step 1: Preserve current state history before reset
      if (onGraveyardSave && this.isDead()) {
        try {
          onGraveyardSave({ ...this.state });
        } catch (graveyardError) {
          console.error('Graveyard callback failed, but continuing with reset:', graveyardError);
        }
      }

      // Step 2: Initialize new pet state
      const now = new Date();
      const newAnimalType = Pet.getRandomAnimalType();
      
      this.state = {
        uuid: uuidv4(),
        energy: this.deps.config.INITIAL_ENERGY,
        expression: this.deps.config.STATE_EXPRESSIONS.HAPPY,
        animalType: newAnimalType,
        emoji: ANIMAL_CONFIGS[newAnimalType]?.emoji || ANIMAL_CONFIGS[AnimalType.CAT].emoji,
        birthTime: now,
        lastFeedTime: now,
        totalTokensConsumed: 0,
        accumulatedTokens: 0,
        totalLifetimeTokens: 0,
        lastDecayTime: now,
        sessionTotalInputTokens: 0,
        sessionTotalOutputTokens: 0,
        sessionTotalCachedTokens: 0,
        petName: generateRandomPetName()
      };
      
      console.log(`Pet reborn as ${newAnimalType} type with name: ${this.state.petName}`);
      this._updateExpression();
      this._notify();
    } catch (error) {
      console.error('Pet resetToInitialState failed:', error);
      throw error;
    }
  }

  private _updateExpression(): void {
    // Guard against null/undefined config (for error testing)
    if (!this.deps?.config) {
      return;
    }
    
    const { STATE_THRESHOLDS, STATE_EXPRESSIONS } = this.deps.config;
    
    if (this.state.energy >= STATE_THRESHOLDS.HAPPY) {
      this.state.expression = STATE_EXPRESSIONS.HAPPY;
    } else if (this.state.energy >= STATE_THRESHOLDS.HUNGRY) {
      this.state.expression = STATE_EXPRESSIONS.HUNGRY;
    } else if (this.state.energy >= STATE_THRESHOLDS.SICK) {
      this.state.expression = STATE_EXPRESSIONS.SICK;
    } else {
      this.state.expression = STATE_EXPRESSIONS.DEAD;
    }
  }

  // 获取当前状态对应的动画表情（如果支持动画的话）
  public getAnimatedExpression(animationEnabled: boolean = false, frameIndex: number = 0, emojiEnabled: boolean = true): string {
    const { STATE_THRESHOLDS, ANIMATED_EXPRESSIONS } = this.deps.config;
    
    let baseExpression: string;
    
    if (!animationEnabled || !ANIMATED_EXPRESSIONS) {
      baseExpression = this.state.expression;
    } else {
      let animationArray: readonly string[];
      
      if (this.state.energy >= STATE_THRESHOLDS.HAPPY) {
        animationArray = ANIMATED_EXPRESSIONS.HAPPY;
      } else if (this.state.energy >= STATE_THRESHOLDS.HUNGRY) {
        animationArray = ANIMATED_EXPRESSIONS.HUNGRY;
      } else if (this.state.energy >= STATE_THRESHOLDS.SICK) {
        animationArray = ANIMATED_EXPRESSIONS.SICK;
      } else {
        animationArray = ANIMATED_EXPRESSIONS.DEAD;
      }
      
      // 使用帧索引循环显示动画序列
      const index = frameIndex % animationArray.length;
      baseExpression = animationArray[index];
    }
    
    // 如果emoji被启用，添加动物emoji前缀
    if (emojiEnabled) {
      const animalEmoji = this.getAnimalEmoji();
      return `${animalEmoji}${baseExpression}`;
    } else {
      return baseExpression;
    }
  }

  public updateSessionMetrics(sessionMetrics: {
    sessionTotalInputTokens?: number;
    sessionTotalOutputTokens?: number;
    sessionTotalCachedTokens?: number;
    contextLength?: number;
    contextPercentage?: number;
    contextPercentageUsable?: number;
    sessionTotalCostUsd?: number;
  }): void {
    try {
      this.state = {
        ...this.state,
        ...sessionMetrics
      };
      // No need to notify observers as this is session-level data
    } catch (error) {
      console.error('Pet updateSessionMetrics failed:', error);
    }
  }

  private _notify(): void {
    this.observers.forEach(observer => {
      try {
        observer(this.getState());
      } catch (error) {
        console.error('Observer notification failed:', error);
      }
    });
  }
}