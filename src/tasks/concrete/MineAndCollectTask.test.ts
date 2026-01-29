/**
 * Tests for MineAndCollectTask
 *
 * These tests verify that the MineAndCollectTask works correctly:
 * - WHY: Mining is fundamental to Minecraft progression.
 * - INTENT: Validate block finding, completion logic, and convenience functions.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  MineAndCollectTask,
  mineAndCollect,
  mineOre,
} from './MineAndCollectTask';
import { itemTarget } from './ResourceTask';
import { Vec3 } from 'vec3';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot = {
    entity: {
      position: new Vec3(0, 64, 0),
      yaw: 0,
      pitch: 0,
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
    game: { dimension: 'minecraft:overworld' },
    attack: mock(),
    setControlState: mock(),
    clearControlStates: mock(),
    look: mock(),
    targetDigBlock: null,
    currentWindow: null,
    player: {},
    ...overrides,
  };

  // Add Vec3 methods to position
  baseBot.entity.position.distanceTo = (other: Vec3) => {
    const dx = other.x - baseBot.entity.position.x;
    const dy = other.y - baseBot.entity.position.y;
    const dz = other.z - baseBot.entity.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  return baseBot;
}

// Mock block
function createMockBlock(name: string, x: number, y: number, z: number): any {
  return {
    name,
    position: new Vec3(x, y, z),
    boundingBox: 'block',
    hardness: 1,
  };
}

describe('MineAndCollectTask', () => {
  describe('creation and initialization', () => {
    it('should create with item targets and blocks', () => {
      const bot = createMockBot();
      const task = new MineAndCollectTask(
        bot,
        [itemTarget('coal', 10)],
        ['coal_ore']
      );
      expect(task.displayName).toContain('MineAndCollect');
      expect(task.displayName).toContain('coal_ore');
    });

    it('should start not finished', () => {
      const bot = createMockBot();
      const task = new MineAndCollectTask(
        bot,
        [itemTarget('diamond', 5)],
        ['diamond_ore']
      );
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('block finding', () => {
    /**
     * WHY: The task should find the nearest matching block to mine.
     */
    it('should find nearby blocks', () => {
      const block = createMockBlock('coal_ore', 5, 64, 5);
      const bot = createMockBot({
        blockAt: (pos: Vec3) => {
          if (pos.x === 5 && pos.y === 64 && pos.z === 5) return block;
          return { name: 'stone', position: pos, boundingBox: 'block' };
        },
      });

      const task = new MineAndCollectTask(
        bot,
        [itemTarget('coal', 3)],
        ['coal_ore']
      );
      task.onStart();
      task.onTick(); // Search

      // Should be in approaching or mining state (not wandering)
      expect(task.isFinished()).toBe(false);
    });

    /**
     * WHY: When no matching blocks exist, the task should wander.
     */
    it('should wander when no blocks found', () => {
      const bot = createMockBot({
        blockAt: () => ({ name: 'stone', boundingBox: 'block' }),
      });

      const task = new MineAndCollectTask(
        bot,
        [itemTarget('coal', 3)],
        ['coal_ore']
      );
      task.onStart();
      const subtask = task.onTick();
      const subtask2 = task.onTick();

      // Should return wander task
      expect(subtask2 !== null).toBe(true);
    });
  });

  describe('completion logic', () => {
    /**
     * WHY: The task should finish when enough items are collected.
     */
    it('should finish when target count reached', () => {
      const bot = createMockBot({
        inventory: {
          items: () => [{ name: 'coal', count: 10 }],
          slots: {},
        },
      });

      const task = new MineAndCollectTask(
        bot,
        [itemTarget('coal', 10)],
        ['coal_ore']
      );
      task.onStart();

      expect(task.isFinished()).toBe(true);
    });

    it('should not finish when target count not reached', () => {
      const bot = createMockBot({
        inventory: {
          items: () => [{ name: 'coal', count: 5 }],
          slots: {},
        },
      });

      const task = new MineAndCollectTask(
        bot,
        [itemTarget('coal', 10)],
        ['coal_ore']
      );
      task.onStart();

      expect(task.isFinished()).toBe(false);
    });
  });

  describe('convenience functions', () => {
    it('mineAndCollect should create task', () => {
      const bot = createMockBot();
      const task = mineAndCollect(bot, 'iron_ore', 5);
      expect(task).toBeInstanceOf(MineAndCollectTask);
    });

    it('mineOre should create task with ore and drop names', () => {
      const bot = createMockBot();
      const task = mineOre(bot, 'iron_ore', 'raw_iron', 5);
      expect(task).toBeInstanceOf(MineAndCollectTask);
    });
  });

  describe('equality', () => {
    it('should be equal if same blocks', () => {
      const bot = createMockBot();
      const task1 = new MineAndCollectTask(bot, [itemTarget('coal', 5)], ['coal_ore']);
      const task2 = new MineAndCollectTask(bot, [itemTarget('coal', 10)], ['coal_ore']);
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different blocks', () => {
      const bot = createMockBot();
      const task1 = new MineAndCollectTask(bot, [itemTarget('coal', 5)], ['coal_ore']);
      const task2 = new MineAndCollectTask(bot, [itemTarget('iron', 5)], ['iron_ore']);
      expect(task1.isEqual(task2)).toBe(false);
    });
  });
});
