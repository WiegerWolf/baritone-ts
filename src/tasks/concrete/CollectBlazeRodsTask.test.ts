/**
 * CollectBlazeRodsTask Tests
 *
 * WHY this task matters:
 * CollectBlazeRodsTask - Complex multi-step resource collection:
 * - Travel to Nether
 * - Find Nether Fortress
 * - Kill blazes safely
 * Essential for End game progression.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

import {
  CollectBlazeRodsTask,
  BlazeCollectionState,
  collectBlazeRods,
  collectBlazeRodsForSpeedrun,
} from './CollectBlazeRodsTask';

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

describe('CollectBlazeRodsTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('CollectBlazeRodsTask creation', () => {
    /**
     * WHY: Blaze rods are essential for End progression.
     * Typical speedrun needs 7 rods for Eyes of Ender.
     */
    it('should create task with count', () => {
      const task = new CollectBlazeRodsTask(bot, { count: 10 });
      expect(task.displayName).toContain('CollectBlazeRods');
      expect(task.displayName).toContain('10');
    });

    it('should use default count of 7', () => {
      const task = new CollectBlazeRodsTask(bot);
      expect(task.displayName).toContain('7');
    });

    it('should create with static factory', () => {
      const task = CollectBlazeRodsTask.forCount(bot, 5);
      expect(task.displayName).toContain('5');
    });
  });

  describe('CollectBlazeRodsTask state machine', () => {
    /**
     * WHY: Blaze rod collection requires multiple steps:
     * 1. Go to Nether
     * 2. Find fortress
     * 3. Find spawner
     * 4. Kill blazes
     */
    it('should start by going to Nether', () => {
      const task = new CollectBlazeRodsTask(bot);
      task.onStart();
      expect(task.getState()).toBe(BlazeCollectionState.GOING_TO_NETHER);
    });

    it('should have no spawner initially', () => {
      const task = new CollectBlazeRodsTask(bot);
      task.onStart();
      expect(task.getFoundSpawner()).toBeNull();
    });
  });

  describe('CollectBlazeRodsTask completion', () => {
    it('should be finished when have enough rods', () => {
      (bot.inventory as any).items = () => [
        createMockItem('blaze_rod', 10),
      ];

      const task = new CollectBlazeRodsTask(bot, { count: 7 });
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });

    it('should not be finished when below target', () => {
      (bot.inventory as any).items = () => [
        createMockItem('blaze_rod', 3),
      ];

      const task = new CollectBlazeRodsTask(bot, { count: 7 });
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('CollectBlazeRodsTask equality', () => {
    it('should be equal if same count', () => {
      const task1 = new CollectBlazeRodsTask(bot, { count: 7 });
      const task2 = new CollectBlazeRodsTask(bot, { count: 7 });
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different count', () => {
      const task1 = new CollectBlazeRodsTask(bot, { count: 7 });
      const task2 = new CollectBlazeRodsTask(bot, { count: 10 });
      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    it('collectBlazeRods should create task', () => {
      const task = collectBlazeRods(bot, 5);
      expect(task).toBeInstanceOf(CollectBlazeRodsTask);
    });

    it('collectBlazeRodsForSpeedrun should create task with 7', () => {
      const task = collectBlazeRodsForSpeedrun(bot);
      expect(task).toBeInstanceOf(CollectBlazeRodsTask);
    });
  });
});
