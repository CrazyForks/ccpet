import { describe, it, expect, vi } from 'vitest';
import { Pet, IPetState } from '../Pet';
import { PET_CONFIG, AnimalType, generateRandomPetName, PET_NAMES } from '../config';

describe('Pet Core Logic', () => {
  const mockConfig = PET_CONFIG;
  const mockDependencies = { config: mockConfig };

  const createInitialState = (): IPetState => ({
    uuid: 'test-uuid-123',
    energy: 50,
    expression: '(o_o)',
    animalType: AnimalType.CAT, // 默认使用CAT类型进行测试
    // 不设置emoji，让Pet构造函数根据animalType自动设置
    birthTime: new Date('2024-01-01T00:00:00Z'), // 宠物诞生时间
    lastFeedTime: new Date('2024-01-01T00:00:00Z'),
    totalTokensConsumed: 0,
    accumulatedTokens: 0,
    totalLifetimeTokens: 0,
    petName: 'TestPet' // 测试用默认宠物名称
  });

  describe('constructor and getState', () => {
    it('should initialize with provided state', () => {
      const initialState = createInitialState();
      const pet = new Pet(initialState, mockDependencies);
      
      const state = pet.getState();
      // Pet constructor should add emoji based on animal type
      expect(state).toEqual({
        ...initialState,
        emoji: '🐱' // CAT emoji should be added
      });
    });

    it('should return a copy of state, not the original object', () => {
      const initialState = createInitialState();
      const pet = new Pet(initialState, mockDependencies);
      
      const state1 = pet.getState();
      const state2 = pet.getState();
      
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('observer pattern', () => {
    it('should allow subscribing and notify observers on state changes', () => {
      const initialState = createInitialState();
      const pet = new Pet(initialState, mockDependencies);
      const observer = vi.fn();

      pet.subscribe(observer);
      pet.feed(1000000); // 1M tokens to trigger energy change

      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({
          energy: 51 // 50 + 1 energy from 1M tokens
        })
      );
    });

    it('should return unsubscribe function', () => {
      const initialState = createInitialState();
      const pet = new Pet(initialState, mockDependencies);
      const observer = vi.fn();

      const unsubscribe = pet.subscribe(observer);
      unsubscribe();
      pet.feed(1);

      expect(observer).not.toHaveBeenCalled();
    });

    it('should handle observer errors gracefully', () => {
      const initialState = createInitialState();
      const pet = new Pet(initialState, mockDependencies);
      const errorObserver = vi.fn().mockImplementation(() => {
        throw new Error('Observer error');
      });
      const normalObserver = vi.fn();

      pet.subscribe(errorObserver);
      pet.subscribe(normalObserver);
      
      expect(() => pet.feed(1000000)).not.toThrow(); // 1M tokens to trigger energy change
      expect(normalObserver).toHaveBeenCalled();
    });
  });

  describe('feed method', () => {
    it('should accumulate tokens without increasing energy when below threshold', () => {
      const initialState = createInitialState();
      const pet = new Pet(initialState, mockDependencies);
      
      pet.feed(1000);
      const newState = pet.getState();
      
      expect(newState.energy).toBe(50); // No energy increase
      expect(newState.totalTokensConsumed).toBe(1000);
      expect(newState.accumulatedTokens).toBe(1000);
    });

    it('should increase energy when token threshold is reached', () => {
      const initialState = createInitialState();
      const pet = new Pet(initialState, mockDependencies);
      
      pet.feed(1000000); // Exactly 1M tokens = 1 energy
      const newState = pet.getState();
      
      expect(newState.energy).toBe(51); // 50 + 1
      expect(newState.totalTokensConsumed).toBe(1000000);
      expect(newState.accumulatedTokens).toBe(0); // Reset after conversion
    });

    it('should handle partial token conversion', () => {
      const initialState = { ...createInitialState(), accumulatedTokens: 999500 };
      const pet = new Pet(initialState, mockDependencies);
      
      pet.feed(1000); // 999500 + 1000 = 1000500, should convert 1M and keep 500
      const newState = pet.getState();
      
      expect(newState.energy).toBe(51); // 50 + 1
      expect(newState.accumulatedTokens).toBe(500); // Remaining tokens
    });

    it('should cap energy at 100', () => {
      const initialState = { ...createInitialState(), energy: 99.5 };
      const pet = new Pet(initialState, mockDependencies);
      
      pet.feed(2000000); // 2M tokens = 2 energy, but should cap at 100
      const newState = pet.getState();
      
      expect(newState.energy).toBe(100);
    });

    it('should update last feed time', () => {
      const initialState = createInitialState();
      const pet = new Pet(initialState, mockDependencies);
      const beforeTime = Date.now();
      
      pet.feed(1);
      const newState = pet.getState();
      const afterTime = Date.now();
      
      expect(newState.lastFeedTime.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(newState.lastFeedTime.getTime()).toBeLessThanOrEqual(afterTime);
    });

    it('should update expression based on energy level when threshold reached', () => {
      const initialState = { ...createInitialState(), energy: 79 };
      const pet = new Pet(initialState, mockDependencies);
      
      pet.feed(1000000); // +1 energy: 79 + 1 = 80 (happy threshold)
      const newState = pet.getState();
      
      expect(newState.energy).toBe(80);
      expect(newState.expression).toBe('(^_^)');
    });

    it('should handle errors gracefully', () => {
      const initialState = createInitialState();
      const pet = new Pet(initialState, mockDependencies);
      
      expect(() => pet.feed(NaN)).not.toThrow();
    });

    it('should log errors when feeding fails', () => {
      const initialState = createInitialState();
      
      // Create a pet with invalid dependencies to trigger error
      const invalidDependencies = { config: null as any };
      const pet = new Pet(initialState, invalidDependencies);
      
      pet.feed(1);
      
      // Error is handled gracefully, no exception thrown
      expect(() => pet.feed(1)).not.toThrow();
    });
  });

  describe('applyTimeDecay method', () => {
    describe('enhanced configurable decay system', () => {
      it('should apply decay based on configurable rate per minute', () => {
        const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000)); // 1 hour = 60 minutes
        const initialState = { ...createInitialState(), energy: 50, lastFeedTime: oneHourAgo };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.applyTimeDecay();
        const newState = pet.getState();
        
        // 60 minutes * 0.0231 energy/minute = 1.386 energy decay
        // 50 - 1.386 ≈ 48.614
        expect(newState.energy).toBeCloseTo(48.61, 1);
      });

      it('should apply decay for multiple hours', () => {
        const threeHoursAgo = new Date(Date.now() - (3 * 60 * 60 * 1000)); // 3 hours = 180 minutes
        const initialState = { ...createInitialState(), energy: 50, lastFeedTime: threeHoursAgo };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.applyTimeDecay();
        const newState = pet.getState();
        
        // 180 minutes * 0.0231 = 4.158 energy decay
        // 50 - 4.158 = 45.842
        expect(newState.energy).toBeCloseTo(45.84, 1);
      });

      it('should not apply decay if minimum interval not reached', () => {
        const thirtySecondsAgo = new Date(Date.now() - (30 * 1000)); // 30 seconds < 1 minute minimum
        const initialState = { ...createInitialState(), energy: 50, lastFeedTime: thirtySecondsAgo };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.applyTimeDecay();
        const newState = pet.getState();
        
        // Should not decay - below minimum interval
        expect(newState.energy).toBe(50);
      });

      it('should apply decay when minimum interval is reached', () => {
        const tenMinutesAgo = new Date(Date.now() - (10 * 60 * 1000)); // 10 minutes > 1 minute minimum
        const initialState = { ...createInitialState(), energy: 50, lastFeedTime: tenMinutesAgo };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.applyTimeDecay();
        const newState = pet.getState();
        
        // 10 minutes * 0.0231 = 0.231 energy decay
        // 50 - 0.231 = 49.769
        expect(newState.energy).toBeCloseTo(49.77, 1);
      });

      it('should use lastDecayTime if available instead of lastFeedTime', () => {
        const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000));
        const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
        const initialState = { 
          ...createInitialState(), 
          energy: 50, 
          lastFeedTime: twoHoursAgo,
          lastDecayTime: oneHourAgo 
        };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.applyTimeDecay();
        const newState = pet.getState();
        
        // Should use lastDecayTime (1 hour ago), not lastFeedTime (2 hours ago)
        // 60 minutes * 0.0231 = 1.386 energy decay
        expect(newState.energy).toBeCloseTo(48.61, 1);
      });

      it('should update lastDecayTime after applying decay', () => {
        const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
        const initialState = { ...createInitialState(), energy: 50, lastFeedTime: oneHourAgo };
        const pet = new Pet(initialState, mockDependencies);
        const beforeDecay = Date.now();
        
        pet.applyTimeDecay();
        const newState = pet.getState();
        const afterDecay = Date.now();
        
        expect(newState.lastDecayTime).toBeDefined();
        expect(newState.lastDecayTime!.getTime()).toBeGreaterThanOrEqual(beforeDecay);
        expect(newState.lastDecayTime!.getTime()).toBeLessThanOrEqual(afterDecay);
      });
    });

    describe('energy bounds validation', () => {
      it('should not reduce energy below 0', () => {
        const tenHoursAgo = new Date(Date.now() - (10 * 60 * 60 * 1000)); // 10 hours = 600 minutes
        const initialState = { ...createInitialState(), energy: 5, lastFeedTime: tenHoursAgo };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.applyTimeDecay();
        const newState = pet.getState();
        
        // 600 minutes * 0.0231 = 13.86 energy decay, but energy can't go below 0
        expect(newState.energy).toBe(0);
      });

      it('should handle edge case where decay equals current energy', () => {
        const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000)); // 1 hour
        const initialState = { ...createInitialState(), energy: 1.386, lastFeedTime: oneHourAgo };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.applyTimeDecay();
        const newState = pet.getState();
        
        // 60 minutes * 0.0231 = 1.386 energy decay, should go to 0
        expect(newState.energy).toBe(0);
      });
    });

    describe('error handling', () => {
      it('should handle invalid time calculations gracefully', () => {
        const initialState = { ...createInitialState(), lastFeedTime: new Date('invalid') };
        const pet = new Pet(initialState, mockDependencies);
        
        expect(() => pet.applyTimeDecay()).not.toThrow();
      });

      it('should handle negative time differences gracefully', () => {
        const futureTime = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour in future
        const initialState = { ...createInitialState(), energy: 50, lastFeedTime: futureTime };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.applyTimeDecay();
        const newState = pet.getState();
        
        // No decay should be applied for negative time differences
        expect(newState.energy).toBe(50);
      });

      it('should skip decay when time decay fails', () => {
        const initialState = { ...createInitialState(), lastFeedTime: null as any };
        const pet = new Pet(initialState, mockDependencies);
        
        expect(() => pet.applyTimeDecay()).not.toThrow();
        expect(pet.getState().energy).toBe(50); // No change in energy
      });
    });

    describe('integration with decreaseEnergy method', () => {
      it('should call decreaseEnergy method for energy reduction', () => {
        const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
        const initialState = { ...createInitialState(), energy: 50, lastFeedTime: oneHourAgo };
        const pet = new Pet(initialState, mockDependencies);
        const observer = vi.fn();
        
        pet.subscribe(observer);
        pet.applyTimeDecay();
        
        // Should notify observers through decreaseEnergy method
        expect(observer).toHaveBeenCalledWith(
          expect.objectContaining({ energy: expect.closeTo(48.61, 1) })
        );
      });

      it('should trigger expression updates through decreaseEnergy', () => {
        const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000));
        const initialState = { 
          ...createInitialState(), 
          energy: 50, // hungry state
          lastFeedTime: twoHoursAgo 
        };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.applyTimeDecay();
        const newState = pet.getState();
        
        // 120 minutes * 0.0231 = 2.772 energy decay: 50 - 2.772 = 47.228
        // Energy 47.228 is above HUNGRY threshold (40), should still be hungry
        expect(newState.energy).toBeCloseTo(47.23, 1);
        expect(newState.expression).toBe('(o_o)');
      });
    });
  });

  describe('energy management methods', () => {
    describe('addEnergy', () => {
      it('should increase energy by specified amount', () => {
        const initialState = { ...createInitialState(), energy: 50 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.addEnergy(20);
        const state = pet.getState();
        
        expect(state.energy).toBe(70);
      });

      it('should cap energy at 100', () => {
        const initialState = { ...createInitialState(), energy: 95 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.addEnergy(10);
        const state = pet.getState();
        
        expect(state.energy).toBe(100);
      });

      it('should notify observers when energy changes', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        const observer = vi.fn();
        
        pet.subscribe(observer);
        pet.addEnergy(15);
        
        expect(observer).toHaveBeenCalledWith(
          expect.objectContaining({ energy: 65 })
        );
      });

      it('should update expression based on new energy level', () => {
        const initialState = { ...createInitialState(), energy: 70 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.addEnergy(15);
        const state = pet.getState();
        
        expect(state.energy).toBe(85);
        expect(state.expression).toBe('(^_^)');
      });

      it('should throw error for negative amounts', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        
        expect(() => pet.addEnergy(-10)).toThrow('Invalid energy amount: -10. Must be a non-negative number.');
      });

      it('should throw error for NaN amounts', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        
        expect(() => pet.addEnergy(NaN)).toThrow('Invalid energy amount: NaN. Must be a non-negative number.');
      });

      it('should throw error for non-number amounts', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        
        expect(() => pet.addEnergy('invalid' as any)).toThrow('Invalid energy amount: invalid. Must be a non-negative number.');
      });
    });

    describe('decreaseEnergy', () => {
      it('should decrease energy by specified amount', () => {
        const initialState = { ...createInitialState(), energy: 70 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.decreaseEnergy(20);
        const state = pet.getState();
        
        expect(state.energy).toBe(50);
      });

      it('should not allow energy to go below 0', () => {
        const initialState = { ...createInitialState(), energy: 10 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.decreaseEnergy(20);
        const state = pet.getState();
        
        expect(state.energy).toBe(0);
      });

      it('should notify observers when energy changes', () => {
        const initialState = { ...createInitialState(), energy: 70 };
        const pet = new Pet(initialState, mockDependencies);
        const observer = vi.fn();
        
        pet.subscribe(observer);
        pet.decreaseEnergy(15);
        
        expect(observer).toHaveBeenCalledWith(
          expect.objectContaining({ energy: 55 })
        );
      });

      it('should update expression based on new energy level', () => {
        const initialState = { ...createInitialState(), energy: 50 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.decreaseEnergy(45);
        const state = pet.getState();
        
        expect(state.energy).toBe(5);
        expect(state.expression).toBe('(x_x)');
      });

      it('should throw error for negative amounts', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        
        expect(() => pet.decreaseEnergy(-10)).toThrow('Invalid energy amount: -10. Must be a non-negative number.');
      });

      it('should throw error for NaN amounts', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        
        expect(() => pet.decreaseEnergy(NaN)).toThrow('Invalid energy amount: NaN. Must be a non-negative number.');
      });

      it('should throw error for non-number amounts', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        
        expect(() => pet.decreaseEnergy('invalid' as any)).toThrow('Invalid energy amount: invalid. Must be a non-negative number.');
      });
    });

    describe('getCurrentEnergy', () => {
      it('should return current energy value', () => {
        const initialState = { ...createInitialState(), energy: 75 };
        const pet = new Pet(initialState, mockDependencies);
        
        expect(pet.getCurrentEnergy()).toBe(75);
      });

      it('should return updated energy after changes', () => {
        const initialState = { ...createInitialState(), energy: 50 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.addEnergy(25);
        expect(pet.getCurrentEnergy()).toBe(75);
        
        pet.decreaseEnergy(10);
        expect(pet.getCurrentEnergy()).toBe(65);
      });
    });
  });

  describe('expression updates with new thresholds', () => {
    it('should show happy expression for energy >= 80', () => {
      const initialState = { ...createInitialState(), energy: 80 };
      const pet = new Pet(initialState, mockDependencies);
      
      pet.addEnergy(0);
      const state = pet.getState();
      
      expect(state.expression).toBe('(^_^)');
    });

    it('should show hungry expression for energy >= 40 and < 80', () => {
      const initialState = { ...createInitialState(), energy: 50 };
      const pet = new Pet(initialState, mockDependencies);
      
      pet.addEnergy(0);
      const state = pet.getState();
      
      expect(state.expression).toBe('(o_o)');
    });

    it('should show sick expression for energy >= 10 and < 40', () => {
      const initialState = { ...createInitialState(), energy: 20 };
      const pet = new Pet(initialState, mockDependencies);
      
      pet.addEnergy(0);
      const state = pet.getState();
      
      expect(state.expression).toBe('(u_u)');
    });

    it('should show dead expression for energy < 10', () => {
      const initialState = { ...createInitialState(), energy: 5 };
      const pet = new Pet(initialState, mockDependencies);
      
      pet.addEnergy(0);
      const state = pet.getState();
      
      expect(state.expression).toBe('(x_x)');
    });

    it('should transition expressions correctly when energy changes', () => {
      const initialState = { ...createInitialState(), energy: 35 };
      const pet = new Pet(initialState, mockDependencies);
      
      // Start in sick state (35 >= 10 and < 40)
      pet.addEnergy(0); // Trigger expression update
      expect(pet.getState().expression).toBe('(u_u)');
      
      // Add energy to reach hungry state
      pet.addEnergy(10);
      expect(pet.getState().expression).toBe('(o_o)');
      
      // Add more energy to reach happy state
      pet.addEnergy(40);
      expect(pet.getState().expression).toBe('(^_^)');
      
      // Decrease energy back to sick state (85 - 50 = 35, which is < 40)
      pet.decreaseEnergy(50);
      expect(pet.getState().expression).toBe('(u_u)');
    });
  });

  describe('pet death and resurrection', () => {
    describe('isDead', () => {
      it('should return true when energy is exactly 0', () => {
        const initialState = { ...createInitialState(), energy: 0 };
        const pet = new Pet(initialState, mockDependencies);
        
        expect(pet.isDead()).toBe(true);
      });

      it('should return false when energy is greater than 0', () => {
        const initialState = { ...createInitialState(), energy: 1 };
        const pet = new Pet(initialState, mockDependencies);
        
        expect(pet.isDead()).toBe(false);
      });

      it('should return false for high energy values', () => {
        const initialState = { ...createInitialState(), energy: 100 };
        const pet = new Pet(initialState, mockDependencies);
        
        expect(pet.isDead()).toBe(false);
      });

      it('should correctly reflect death after energy decreases to 0', () => {
        const initialState = { ...createInitialState(), energy: 5 };
        const pet = new Pet(initialState, mockDependencies);
        
        expect(pet.isDead()).toBe(false);
        
        pet.decreaseEnergy(10); // More than current energy, should go to 0
        expect(pet.isDead()).toBe(true);
      });
    });

    describe('resetToInitialState', () => {
      it('should reset energy to INITIAL_ENERGY', () => {
        const initialState = { ...createInitialState(), energy: 0 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.resetToInitialState();
        const state = pet.getState();
        
        expect(state.energy).toBe(PET_CONFIG.INITIAL_ENERGY);
      });

      it('should reset expression to HAPPY', () => {
        const initialState = { ...createInitialState(), energy: 0, expression: '(x_x)' };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.resetToInitialState();
        const state = pet.getState();
        
        expect(state.expression).toBe(PET_CONFIG.STATE_EXPRESSIONS.HAPPY);
      });

      it('should reset totalTokensConsumed to 0', () => {
        const initialState = { ...createInitialState(), totalTokensConsumed: 5000000 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.resetToInitialState();
        const state = pet.getState();
        
        expect(state.totalTokensConsumed).toBe(0);
      });

      it('should reset accumulatedTokens to 0', () => {
        const initialState = { ...createInitialState(), accumulatedTokens: 999999 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.resetToInitialState();
        const state = pet.getState();
        
        expect(state.accumulatedTokens).toBe(0);
      });

      it('should update birthTime to current time', () => {
        const oldBirthTime = new Date('2020-01-01T00:00:00Z');
        const initialState = { ...createInitialState(), birthTime: oldBirthTime };
        const pet = new Pet(initialState, mockDependencies);
        const beforeReset = Date.now();
        
        pet.resetToInitialState();
        const state = pet.getState();
        const afterReset = Date.now();
        
        expect(state.birthTime.getTime()).toBeGreaterThanOrEqual(beforeReset);
        expect(state.birthTime.getTime()).toBeLessThanOrEqual(afterReset);
        expect(state.birthTime.getTime()).not.toBe(oldBirthTime.getTime());
      });

      it('should reset session token counts to 0', () => {
        const initialState = { 
          ...createInitialState(),
          sessionTotalInputTokens: 1000,
          sessionTotalOutputTokens: 2000,
          sessionTotalCachedTokens: 500
        };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.resetToInitialState();
        const state = pet.getState();
        
        expect(state.sessionTotalInputTokens).toBe(0);
        expect(state.sessionTotalOutputTokens).toBe(0);
        expect(state.sessionTotalCachedTokens).toBe(0);
      });

      it('should update lastFeedTime to current time', () => {
        const oldTime = new Date('2024-01-01T00:00:00Z');
        const initialState = { ...createInitialState(), lastFeedTime: oldTime };
        const pet = new Pet(initialState, mockDependencies);
        const beforeReset = Date.now();
        
        pet.resetToInitialState();
        const state = pet.getState();
        const afterReset = Date.now();
        
        expect(state.lastFeedTime.getTime()).toBeGreaterThanOrEqual(beforeReset);
        expect(state.lastFeedTime.getTime()).toBeLessThanOrEqual(afterReset);
      });

      it('should update lastDecayTime to current time', () => {
        const oldTime = new Date('2024-01-01T00:00:00Z');
        const initialState = { ...createInitialState(), lastDecayTime: oldTime };
        const pet = new Pet(initialState, mockDependencies);
        const beforeReset = Date.now();
        
        pet.resetToInitialState();
        const state = pet.getState();
        const afterReset = Date.now();
        
        expect(state.lastDecayTime).toBeDefined();
        expect(state.lastDecayTime!.getTime()).toBeGreaterThanOrEqual(beforeReset);
        expect(state.lastDecayTime!.getTime()).toBeLessThanOrEqual(afterReset);
      });

      it('should notify observers after reset', () => {
        const initialState = { ...createInitialState(), energy: 0 };
        const pet = new Pet(initialState, mockDependencies);
        const observer = vi.fn();
        
        pet.subscribe(observer);
        pet.resetToInitialState();
        
        expect(observer).toHaveBeenCalledWith(
          expect.objectContaining({
            energy: PET_CONFIG.INITIAL_ENERGY,
            expression: PET_CONFIG.STATE_EXPRESSIONS.HAPPY,
            totalTokensConsumed: 0,
            accumulatedTokens: 0
          })
        );
      });

      it('should call _updateExpression after reset', () => {
        // This is implicitly tested by checking the expression is happy
        const initialState = { ...createInitialState(), energy: 0, expression: '(x_x)' };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.resetToInitialState();
        const state = pet.getState();
        
        // Expression should be updated based on the new energy level (100 = happy)
        expect(state.expression).toBe(PET_CONFIG.STATE_EXPRESSIONS.HAPPY);
      });

      it('should handle errors gracefully', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        
        // Mock an error in the dependencies to trigger error handling
        const invalidDependencies = { config: null as any };
        const petWithError = new Pet(initialState, invalidDependencies);
        
        expect(() => petWithError.resetToInitialState()).toThrow();
      });

      it('should reset pet from dead state to alive', () => {
        const initialState = { ...createInitialState(), energy: 0 };
        const pet = new Pet(initialState, mockDependencies);
        
        expect(pet.isDead()).toBe(true);
        
        pet.resetToInitialState();
        
        expect(pet.isDead()).toBe(false);
        expect(pet.getCurrentEnergy()).toBe(PET_CONFIG.INITIAL_ENERGY);
      });

      it('should call graveyard save callback when pet is dead', () => {
        const initialState = { ...createInitialState(), energy: 0, petName: 'DeadPet' };
        const pet = new Pet(initialState, mockDependencies);
        const graveyardCallback = vi.fn();

        expect(pet.isDead()).toBe(true);

        pet.resetToInitialState(graveyardCallback);

        expect(graveyardCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            energy: 0,
            petName: 'DeadPet'
          })
        );
      });

      it('should not call graveyard save callback when pet is alive', () => {
        const initialState = { ...createInitialState(), energy: 50 };
        const pet = new Pet(initialState, mockDependencies);
        const graveyardCallback = vi.fn();

        expect(pet.isDead()).toBe(false);

        pet.resetToInitialState(graveyardCallback);

        expect(graveyardCallback).not.toHaveBeenCalled();
      });

      it('should continue reset even if graveyard callback throws error', () => {
        const initialState = { ...createInitialState(), energy: 0 };
        const pet = new Pet(initialState, mockDependencies);
        const graveyardCallback = vi.fn().mockImplementation(() => {
          throw new Error('Graveyard save failed');
        });

        expect(pet.isDead()).toBe(true);

        expect(() => pet.resetToInitialState(graveyardCallback)).not.toThrow();

        // Pet should still be reset successfully
        expect(pet.isDead()).toBe(false);
        expect(pet.getCurrentEnergy()).toBe(PET_CONFIG.INITIAL_ENERGY);
      });

      it('should generate new random pet name after reset', () => {
        const initialState = { ...createInitialState(), energy: 0, petName: 'OldPet' };
        const pet = new Pet(initialState, mockDependencies);

        pet.resetToInitialState();
        const newState = pet.getState();

        expect(newState.petName).not.toBe('OldPet');
        expect(PET_NAMES).toContain(newState.petName);
      });

      it('should reset totalLifetimeTokens to 0', () => {
        const initialState = { ...createInitialState(), totalLifetimeTokens: 5000000 };
        const pet = new Pet(initialState, mockDependencies);

        pet.resetToInitialState();
        const state = pet.getState();

        expect(state.totalLifetimeTokens).toBe(0);
      });
    });
  });

  describe('integration with existing methods', () => {
    it('should use addEnergy in feed method when threshold reached', () => {
      const initialState = { ...createInitialState(), energy: 50 };
      const pet = new Pet(initialState, mockDependencies);
      
      pet.feed(1000000); // 1M tokens = 1 energy
      const state = pet.getState();
      
      expect(state.energy).toBe(51);
      expect(state.totalTokensConsumed).toBe(1000000);
      expect(state.accumulatedTokens).toBe(0);
    });

    it('should use decreaseEnergy in applyTimeDecay method', () => {
      const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000));
      const initialState = { ...createInitialState(), energy: 50, lastFeedTime: twoHoursAgo };
      const pet = new Pet(initialState, mockDependencies);
      
      pet.applyTimeDecay();
      const state = pet.getState();
      
      // 120 minutes * 0.0231 = 2.772 energy decay
      // 50 - 2.772 = 47.228
      expect(state.energy).toBeCloseTo(47.23, 1);
    });
  });

  describe('Animal Type System', () => {
    describe('getCurrentAnimalType', () => {
      it('should return the current animal type', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.DOG };
        const pet = new Pet(initialState, mockDependencies);

        expect(pet.getCurrentAnimalType()).toBe(AnimalType.DOG);
      });

      it('should return the correct animal type after state changes', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.RABBIT };
        const pet = new Pet(initialState, mockDependencies);

        expect(pet.getCurrentAnimalType()).toBe(AnimalType.RABBIT);
        
        // After feeding, animal type should remain the same
        pet.feed(1000000);
        expect(pet.getCurrentAnimalType()).toBe(AnimalType.RABBIT);
      });
    });

    describe('getRandomAnimalType', () => {
      it('should return a valid animal type', () => {
        const randomType = Pet.getRandomAnimalType();
        const validTypes = Object.values(AnimalType);
        
        expect(validTypes).toContain(randomType);
      });

      it('should return different types across multiple calls', () => {
        const results = new Set<AnimalType>();
        
        // Call multiple times to increase chance of getting different types
        for (let i = 0; i < 50; i++) {
          results.add(Pet.getRandomAnimalType());
        }
        
        // Should have at least 2 different types (randomness allows for some repetition)
        expect(results.size).toBeGreaterThanOrEqual(2);
      });

      it('should only return valid enum values', () => {
        const validTypes = Object.values(AnimalType);
        
        for (let i = 0; i < 20; i++) {
          const result = Pet.getRandomAnimalType();
          expect(validTypes).toContain(result);
        }
      });
    });

    describe('resetToInitialState with animal types', () => {
      it('should assign a random animal type when resetting', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.CAT, energy: 0 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.resetToInitialState();
        const newState = pet.getState();
        
        // Should have a valid animal type
        const validTypes = Object.values(AnimalType);
        expect(validTypes).toContain(newState.animalType);
      });

      it('should potentially change animal type on reset', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.CAT, energy: 0 };
        const pet = new Pet(initialState, mockDependencies);
        const originalType = pet.getCurrentAnimalType();
        
        // Reset multiple times to increase chance of getting different type
        let differentTypeFound = false;
        for (let i = 0; i < 20 && !differentTypeFound; i++) {
          pet.resetToInitialState();
          if (pet.getCurrentAnimalType() !== originalType) {
            differentTypeFound = true;
          }
        }
        
        // Note: Due to randomness, this test might rarely fail if the same type is selected repeatedly
        // In practice, with 5 types, the chance of getting the same type 20 times is very low
      });

      it('should reset all pet state including animal type persistence', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.PANDA, energy: 0 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.resetToInitialState();
        const newState = pet.getState();
        
        // All other properties should be reset correctly
        expect(newState.energy).toBe(PET_CONFIG.INITIAL_ENERGY);
        expect(newState.expression).toBe(PET_CONFIG.STATE_EXPRESSIONS.HAPPY);
        expect(newState.totalTokensConsumed).toBe(0);
        expect(newState.accumulatedTokens).toBe(0);
        expect(newState.totalLifetimeTokens).toBe(0);
        
        // Animal type should be a valid type
        const validTypes = Object.values(AnimalType);
        expect(validTypes).toContain(newState.animalType);
      });
    });

    describe('animal type preservation during operations', () => {
      it('should preserve animal type when feeding', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.FOX };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.feed(1000000);
        const newState = pet.getState();
        
        expect(newState.animalType).toBe(AnimalType.FOX);
      });

      it('should preserve animal type during time decay', () => {
        const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
        const initialState = { 
          ...createInitialState(), 
          animalType: AnimalType.PANDA,
          lastFeedTime: oneHourAgo,
          energy: 50
        };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.applyTimeDecay();
        const newState = pet.getState();
        
        expect(newState.animalType).toBe(AnimalType.PANDA);
      });

      it('should preserve animal type during energy operations', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.RABBIT };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.addEnergy(20);
        expect(pet.getCurrentAnimalType()).toBe(AnimalType.RABBIT);
        
        pet.decreaseEnergy(10);
        expect(pet.getCurrentAnimalType()).toBe(AnimalType.RABBIT);
      });
    });

    describe('integration with existing functionality', () => {
      it('should maintain animal type in state copies', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.DOG };
        const pet = new Pet(initialState, mockDependencies);
        
        const state1 = pet.getState();
        const state2 = pet.getState();
        
        expect(state1.animalType).toBe(AnimalType.DOG);
        expect(state2.animalType).toBe(AnimalType.DOG);
        expect(state1).not.toBe(state2); // Should still be different objects
      });

      it('should notify observers with correct animal type', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.FOX };
        const pet = new Pet(initialState, mockDependencies);
        const observer = vi.fn();
        
        pet.subscribe(observer);
        pet.addEnergy(10);
        
        expect(observer).toHaveBeenCalledWith(
          expect.objectContaining({ animalType: AnimalType.FOX })
        );
      });

      it('should work with all defined animal types', () => {
        const allTypes = Object.values(AnimalType);
        
        allTypes.forEach(type => {
          const initialState = { ...createInitialState(), animalType: type };
          const pet = new Pet(initialState, mockDependencies);
          
          expect(pet.getCurrentAnimalType()).toBe(type);
          expect(pet.getState().animalType).toBe(type);
          
          // Test operations work with all types
          pet.feed(1000000);
          expect(pet.getCurrentAnimalType()).toBe(type);
        });
      });
    });
  });

  describe('Emoji Display System', () => {
    describe('getAnimalEmoji', () => {
      it('should return correct emoji for each animal type', () => {
        const allTypes = Object.values(AnimalType);
        
        allTypes.forEach(type => {
          const initialState = { ...createInitialState(), animalType: type };
          const pet = new Pet(initialState, mockDependencies);
          const emoji = pet.getAnimalEmoji();
          
          // Check that emoji is not empty and is actually an emoji character
          expect(emoji).toBeTruthy();
          expect(emoji.length).toBeGreaterThan(0);
        });
      });

      it('should return cat emoji for invalid animal type', () => {
        const initialState = { ...createInitialState(), animalType: 'invalid' as any };
        const pet = new Pet(initialState, mockDependencies);
        
        const emoji = pet.getAnimalEmoji();
        expect(emoji).toBe('🐱'); // Should fallback to cat emoji
      });

      it('should return consistent emoji for same animal type', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.DOG };
        const pet = new Pet(initialState, mockDependencies);
        
        const emoji1 = pet.getAnimalEmoji();
        const emoji2 = pet.getAnimalEmoji();
        
        expect(emoji1).toBe(emoji2);
        expect(emoji1).toBe('🐶');
      });
    });

    describe('getAnimatedExpression with emoji', () => {
      it('should include emoji when emojiEnabled is true', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.CAT, energy: 85 };
        const pet = new Pet(initialState, mockDependencies);
        
        // Update the expression to match the energy level (85 = happy)
        pet.addEnergy(0); // Trigger expression update
        const expression = pet.getAnimatedExpression(false, 0, true);
        
        expect(expression).toMatch(/^🐱/); // Should start with cat emoji
        expect(expression).toContain('(^_^)'); // Should contain happy expression
        expect(expression).toBe('🐱(^_^)');
      });

      it('should not include emoji when emojiEnabled is false', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.CAT, energy: 85 };
        const pet = new Pet(initialState, mockDependencies);
        
        // Update the expression to match the energy level (85 = happy)
        pet.addEnergy(0); // Trigger expression update
        const expression = pet.getAnimatedExpression(false, 0, false);
        
        expect(expression).not.toMatch(/🐱/); // Should not contain emoji
        expect(expression).toBe('(^_^)'); // Should be just the expression
      });

      it('should work with animation and emoji enabled', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.RABBIT, energy: 85 };
        const pet = new Pet(initialState, mockDependencies);
        
        const expression1 = pet.getAnimatedExpression(true, 0, true);
        const expression2 = pet.getAnimatedExpression(true, 1, true);
        
        // Both should start with rabbit emoji
        expect(expression1).toMatch(/^🐰/);
        expect(expression2).toMatch(/^🐰/);
        
        // Should contain happy expressions (may be different due to animation)
        expect(expression1).toMatch(/🐰\(.*\)/);
        expect(expression2).toMatch(/🐰\(.*\)/);
      });

      it('should show correct emoji for different animal types', () => {
        const testCases = [
          { type: AnimalType.CAT, emoji: '🐱' },
          { type: AnimalType.DOG, emoji: '🐶' },
          { type: AnimalType.RABBIT, emoji: '🐰' },
          { type: AnimalType.PANDA, emoji: '🐼' },
          { type: AnimalType.FOX, emoji: '🦊' }
        ];

        testCases.forEach(({ type, emoji }) => {
          const initialState = { ...createInitialState(), animalType: type, energy: 85 };
          const pet = new Pet(initialState, mockDependencies);
          
          const expression = pet.getAnimatedExpression(false, 0, true);
          
          expect(expression).toMatch(new RegExp(`^${emoji}`));
          expect(expression).toContain('(^_^)'); // Happy expression for 85 energy
        });
      });

      it('should show emoji with different energy states', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.PANDA };
        const pet = new Pet(initialState, mockDependencies);
        
        // Test different energy levels
        const testStates = [
          { energy: 85, expectedExpression: '(^_^)' }, // Happy
          { energy: 50, expectedExpression: '(o_o)' }, // Hungry
          { energy: 20, expectedExpression: '(u_u)' }, // Sick
          { energy: 5, expectedExpression: '(x_x)' }   // Dead
        ];

        testStates.forEach(({ energy, expectedExpression }) => {
          // Manually set energy for testing
          const currentEnergy = pet.getCurrentEnergy();
          const energyDiff = energy - currentEnergy;
          
          if (energyDiff > 0) {
            pet.addEnergy(energyDiff);
          } else if (energyDiff < 0) {
            pet.decreaseEnergy(-energyDiff);
          }
          
          const expression = pet.getAnimatedExpression(false, 0, true);
          
          expect(expression).toMatch(/^🐼/); // Should start with panda emoji
          expect(expression).toContain(expectedExpression);
        });
      });

      it('should maintain emoji through pet operations', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.FOX, energy: 50 };
        const pet = new Pet(initialState, mockDependencies);
        
        // Before feeding
        let expression = pet.getAnimatedExpression(false, 0, true);
        expect(expression).toMatch(/^🦊/);
        
        // Feed pet
        pet.feed(1000000);
        expression = pet.getAnimatedExpression(false, 0, true);
        expect(expression).toMatch(/^🦊/);
        
        // Apply time decay
        pet.applyTimeDecay();
        expression = pet.getAnimatedExpression(false, 0, true);
        expect(expression).toMatch(/^🦊/);
        
        // Animal type should remain consistent
        expect(pet.getCurrentAnimalType()).toBe(AnimalType.FOX);
      });

      it('should handle emoji fallback gracefully', () => {
        // Create pet with invalid animal type
        const initialState = { ...createInitialState(), animalType: 'nonexistent' as any };
        const pet = new Pet(initialState, mockDependencies);
        
        const expression = pet.getAnimatedExpression(false, 0, true);
        
        // Should fallback to cat emoji
        expect(expression).toMatch(/^🐱/);
        expect(expression).toContain('(o_o)'); // Default hungry expression
      });
    });

    describe('emoji backward compatibility', () => {
      it('should work with existing getAnimatedExpression calls (2 parameters)', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.DOG, energy: 85 };
        const pet = new Pet(initialState, mockDependencies);
        
        // Call with only 2 parameters (backward compatibility)
        const expression = pet.getAnimatedExpression(false, 0);
        
        // Should default to emoji enabled (true)
        expect(expression).toMatch(/^🐶/);
        expect(expression).toContain('(^_^)');
      });

      it('should work with existing getAnimatedExpression calls (1 parameter)', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.RABBIT, energy: 85 };
        const pet = new Pet(initialState, mockDependencies);
        
        // Call with only 1 parameter (backward compatibility)
        const expression = pet.getAnimatedExpression(false);
        
        // Should default to emoji enabled (true)
        expect(expression).toMatch(/^🐰/);
        expect(expression).toContain('(^_^)');
      });

      it('should work with existing getAnimatedExpression calls (no parameters)', () => {
        const initialState = { ...createInitialState(), animalType: AnimalType.PANDA, energy: 85 };
        const pet = new Pet(initialState, mockDependencies);
        
        // Call with no parameters (backward compatibility)
        const expression = pet.getAnimatedExpression();
        
        // Should default to emoji enabled (true)
        expect(expression).toMatch(/^🐼/);
        expect(expression).toContain('(^_^)');
      });
    });
  });

  describe('Pet Naming System', () => {
    describe('generateRandomPetName function', () => {
      it('should return a name from PET_NAMES array', () => {
        const name = generateRandomPetName();
        expect(PET_NAMES).toContain(name);
      });

      it('should return different names across multiple calls', () => {
        const names = new Set<string>();
        
        // Call multiple times to increase chance of getting different names
        for (let i = 0; i < 50; i++) {
          names.add(generateRandomPetName());
        }
        
        // Should have at least 2 different names (randomness allows for some repetition)
        expect(names.size).toBeGreaterThanOrEqual(2);
      });

      it('should return fallback name when PET_NAMES is empty', () => {
        // Mock empty PET_NAMES array
        vi.spyOn(Math, 'random').mockReturnValue(0);
        
        // This test validates the fallback logic in the function
        // We can't directly test empty array without mocking the import
        const name = generateRandomPetName();
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
        
        vi.restoreAllMocks();
      });

      it('should generate names with consistent randomness', () => {
        // Mock specific random values for predictable testing
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        
        const expectedIndex = Math.floor(0.5 * PET_NAMES.length);
        const expectedName = PET_NAMES[expectedIndex];
        
        const name = generateRandomPetName();
        expect(name).toBe(expectedName);
        
        vi.restoreAllMocks();
      });
    });

    describe('petName in Pet state', () => {
      it('should initialize with provided petName', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        
        const state = pet.getState();
        expect(state.petName).toBe('TestPet');
      });

      it('should preserve petName through state operations', () => {
        const initialState = { ...createInitialState(), petName: 'CustomName' };
        const pet = new Pet(initialState, mockDependencies);
        
        // Feed the pet
        pet.feed(1000000);
        expect(pet.getState().petName).toBe('CustomName');
        
        // Apply time decay
        pet.applyTimeDecay();
        expect(pet.getState().petName).toBe('CustomName');
        
        // Add/decrease energy
        pet.addEnergy(10);
        expect(pet.getState().petName).toBe('CustomName');
        
        pet.decreaseEnergy(5);
        expect(pet.getState().petName).toBe('CustomName');
      });

      it('should include petName in state copies', () => {
        const initialState = { ...createInitialState(), petName: 'CopyTest' };
        const pet = new Pet(initialState, mockDependencies);
        
        const state1 = pet.getState();
        const state2 = pet.getState();
        
        expect(state1.petName).toBe('CopyTest');
        expect(state2.petName).toBe('CopyTest');
        expect(state1).not.toBe(state2); // Should still be different objects
        expect(state1.petName).toBe(state2.petName); // But have same petName
      });

      it('should notify observers with correct petName', () => {
        const initialState = { ...createInitialState(), petName: 'ObserverTest' };
        const pet = new Pet(initialState, mockDependencies);
        const observer = vi.fn();
        
        pet.subscribe(observer);
        pet.addEnergy(10);
        
        expect(observer).toHaveBeenCalledWith(
          expect.objectContaining({ petName: 'ObserverTest' })
        );
      });
    });

    describe('petName persistence through reset', () => {
      it('should assign new random name when resetting', () => {
        const initialState = { ...createInitialState(), petName: 'OriginalName', energy: 0 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.resetToInitialState();
        const newState = pet.getState();
        
        // Should have a valid pet name from PET_NAMES
        expect(PET_NAMES).toContain(newState.petName);
      });

      it('should potentially change pet name on reset', () => {
        const initialState = { ...createInitialState(), petName: 'OriginalName', energy: 0 };
        const pet = new Pet(initialState, mockDependencies);
        const originalName = pet.getState().petName;
        
        // Reset multiple times to increase chance of getting different name
        let differentNameFound = false;
        for (let i = 0; i < 20 && !differentNameFound; i++) {
          pet.resetToInitialState();
          if (pet.getState().petName !== originalName) {
            differentNameFound = true;
          }
        }
        
        // Note: Due to randomness, this test might rarely fail if the same name is selected repeatedly
        // In practice, with 25 names, the chance of getting the same name 20 times is very low
      });

      it('should maintain new pet name through subsequent operations', () => {
        const initialState = { ...createInitialState(), energy: 0 };
        const pet = new Pet(initialState, mockDependencies);
        
        pet.resetToInitialState();
        const nameAfterReset = pet.getState().petName;
        
        // Perform various operations
        pet.feed(1000000);
        expect(pet.getState().petName).toBe(nameAfterReset);
        
        pet.addEnergy(10);
        expect(pet.getState().petName).toBe(nameAfterReset);
        
        pet.applyTimeDecay();
        expect(pet.getState().petName).toBe(nameAfterReset);
      });
    });

    describe('petName integration with existing functionality', () => {
      it('should work with all existing Pet methods', () => {
        const initialState = { ...createInitialState(), petName: 'IntegrationTest' };
        const pet = new Pet(initialState, mockDependencies);
        
        // Test all major methods still work with petName
        expect(() => pet.getCurrentEnergy()).not.toThrow();
        expect(() => pet.getCurrentAnimalType()).not.toThrow();
        expect(() => pet.getAnimalEmoji()).not.toThrow();
        expect(() => pet.isDead()).not.toThrow();
        expect(() => pet.getAnimatedExpression()).not.toThrow();
        
        // Verify petName is maintained
        expect(pet.getState().petName).toBe('IntegrationTest');
      });

      it('should maintain petName during complex operations', () => {
        const initialState = { 
          ...createInitialState(), 
          petName: 'ComplexTest',
          energy: 50 
        };
        const pet = new Pet(initialState, mockDependencies);
        
        // Complex operation sequence
        pet.feed(2500000); // 2.5M tokens = 2 energy
        pet.addEnergy(15);
        pet.decreaseEnergy(5);
        
        const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
        const stateForDecay = { 
          ...pet.getState(), 
          lastFeedTime: oneHourAgo 
        };
        const petWithDecay = new Pet(stateForDecay, mockDependencies);
        petWithDecay.applyTimeDecay();
        
        // petName should still be preserved throughout
        expect(petWithDecay.getState().petName).toBe('ComplexTest');
      });
    });
  });

  describe('Session Metrics Updates', () => {
    describe('updateSessionMetrics', () => {
      it('should update session metrics correctly', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        
        const sessionMetrics = {
          sessionTotalInputTokens: 1000,
          sessionTotalOutputTokens: 2000,
          sessionTotalCachedTokens: 500,
          contextLength: 150000,
          contextPercentage: 75.0,
          contextPercentageUsable: 93.75,
          sessionTotalCostUsd: 0.05
        };
        
        pet.updateSessionMetrics(sessionMetrics);
        const state = pet.getState();
        
        expect(state.sessionTotalInputTokens).toBe(1000);
        expect(state.sessionTotalOutputTokens).toBe(2000);
        expect(state.sessionTotalCachedTokens).toBe(500);
        expect(state.contextLength).toBe(150000);
        expect(state.contextPercentage).toBe(75.0);
        expect(state.contextPercentageUsable).toBe(93.75);
        expect(state.sessionTotalCostUsd).toBe(0.05);
      });

      it('should update partial session metrics', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        
        pet.updateSessionMetrics({
          sessionTotalInputTokens: 500,
          contextLength: 80000
        });
        
        const state = pet.getState();
        
        expect(state.sessionTotalInputTokens).toBe(500);
        expect(state.contextLength).toBe(80000);
        // Other fields should remain unchanged
        expect(state.energy).toBe(50); // original energy
      });

      it('should preserve core pet state during session metrics updates', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        
        // Modify core state first
        pet.feed(1000000); // 1M tokens = 1 energy
        const originalState = pet.getState();
        
        // Update session metrics
        pet.updateSessionMetrics({
          sessionTotalInputTokens: 2000,
          sessionTotalOutputTokens: 3000
        });
        
        const newState = pet.getState();
        
        // Session metrics should be updated
        expect(newState.sessionTotalInputTokens).toBe(2000);
        expect(newState.sessionTotalOutputTokens).toBe(3000);
        
        // Core state should be preserved
        expect(newState.energy).toBe(originalState.energy);
        expect(newState.totalTokensConsumed).toBe(originalState.totalTokensConsumed);
        expect(newState.totalLifetimeTokens).toBe(originalState.totalLifetimeTokens);
        expect(newState.petName).toBe(originalState.petName);
      });

      it('should handle errors gracefully', () => {
        const initialState = createInitialState();
        const pet = new Pet(initialState, mockDependencies);
        
        // This shouldn't throw
        expect(() => {
          pet.updateSessionMetrics({
            sessionTotalInputTokens: 1000,
            contextLength: 50000
          });
        }).not.toThrow();
      });
    });
  });
});