/**
 * CollectFoodTask Tests
 *
 * WHY this task matters:
 * CollectFoodTask - Autonomous food collection through hunting, harvesting,
 * and cooking. Essential for survival without manual intervention.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

import {
  CollectFoodTask,
  FoodCollectionState,
  collectFood,
  collectFoodUntilFull,
} from './CollectFoodTask';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot = {
    entity: {
      position: new Vec3(0, 64, 0),
      metadata: {},
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: () => null,
    entities: {},
    time: { timeOfDay: 6000, age: 0 },
    health: 20,
    food: 20,
    heldItem: null,
    game: { dimension: 'minecraft:overworld' },
    pathfinder: {
      setGoal: mock(),
      goto: mock(),
      isMoving: () => false,
    },
    setControlState: mock(),
    clearControlStates: mock(),
    look: mock(),
    ...overrides,
  };

  return baseBot;
}

// Mock item for testing
function createMockItem(name: string, count: number): any {
  return { name, count };
}

describe('CollectFoodTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('CollectFoodTask creation', () => {
    /**
     * WHY: Food collection is essential for autonomous survival.
     * The task should be configurable for different hunger needs.
     */
    it('should create task with units needed', () => {
      const task = new CollectFoodTask(bot, { unitsNeeded: 30 });
      expect(task.displayName).toContain('CollectFood');
      expect(task.displayName).toContain('30');
    });

    it('should use default config', () => {
      const task = new CollectFoodTask(bot);
      expect(task.displayName).toContain('20'); // Default
    });

    it('should create with static factory', () => {
      const task = CollectFoodTask.forUnits(bot, 50);
      expect(task.displayName).toContain('50');
    });
  });

  describe('Food potential calculation', () => {
    /**
     * WHY: Food potential includes both ready-to-eat food AND raw food
     * that can be cooked. This enables smarter food gathering decisions.
     */
    it('should start in searching state', () => {
      const task = new CollectFoodTask(bot);
      task.onStart();
      expect(task.getState()).toBe(FoodCollectionState.SEARCHING);
    });

    it('should calculate zero potential with empty inventory', () => {
      const task = new CollectFoodTask(bot);
      task.onStart();
      expect(task.getFoodPotential()).toBe(0);
    });

    it('should calculate potential with cooked food', () => {
      (bot.inventory as any).items = () => [
        createMockItem('cooked_beef', 5), // 5 * 8 = 40
      ];

      const task = new CollectFoodTask(bot);
      task.onStart();
      expect(task.getFoodPotential()).toBe(40);
    });

    it('should calculate potential with raw food (cookable)', () => {
      (bot.inventory as any).items = () => [
        createMockItem('beef', 5), // 5 * 8 (cooked value) = 40
      ];

      const task = new CollectFoodTask(bot);
      task.onStart();
      expect(task.getFoodPotential()).toBe(40);
    });

    it('should calculate potential with wheat (for bread)', () => {
      (bot.inventory as any).items = () => [
        createMockItem('wheat', 9), // 9 / 3 = 3 bread * 5 = 15
      ];

      const task = new CollectFoodTask(bot);
      task.onStart();
      expect(task.getFoodPotential()).toBe(15);
    });
  });

  describe('CollectFoodTask completion', () => {
    it('should be finished when food potential meets target', () => {
      (bot.inventory as any).items = () => [
        createMockItem('cooked_beef', 10), // 80 hunger
      ];

      const task = new CollectFoodTask(bot, { unitsNeeded: 20 });
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });

    it('should not be finished when below target', () => {
      (bot.inventory as any).items = () => [
        createMockItem('cooked_beef', 1), // 8 hunger
      ];

      const task = new CollectFoodTask(bot, { unitsNeeded: 20 });
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('CollectFoodTask equality', () => {
    it('should be equal if same units needed', () => {
      const task1 = new CollectFoodTask(bot, { unitsNeeded: 20 });
      const task2 = new CollectFoodTask(bot, { unitsNeeded: 20 });
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different units', () => {
      const task1 = new CollectFoodTask(bot, { unitsNeeded: 20 });
      const task2 = new CollectFoodTask(bot, { unitsNeeded: 30 });
      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    it('collectFood should create task', () => {
      const task = collectFood(bot, 30);
      expect(task).toBeInstanceOf(CollectFoodTask);
    });

    it('collectFoodUntilFull should calculate needed amount', () => {
      (bot as any).food = 10; // Half full
      const task = collectFoodUntilFull(bot);
      expect(task).toBeInstanceOf(CollectFoodTask);
    });
  });
});
