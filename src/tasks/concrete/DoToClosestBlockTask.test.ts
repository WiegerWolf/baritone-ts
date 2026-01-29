/**
 * Tests for DoToClosestBlockTask
 *
 * These tests verify that block finding and approach logic work correctly:
 * - WHY: Finding blocks (crafting tables, furnaces) is fundamental to resource management.
 * - INTENT: Validate block search, filtering, unreachable handling, and convenience functions.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  DoToClosestBlockTask,
  doToClosestBlock,
} from './BlockSearchTask';
import { Task } from '../Task';
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
  };
}

// Simple test task that just finishes
class TestBlockTask extends Task {
  private blockPos: Vec3;
  private finished = false;

  constructor(bot: any, pos: Vec3) {
    super(bot);
    this.blockPos = pos;
  }

  get displayName() { return `TestBlockTask(${this.blockPos.x},${this.blockPos.y},${this.blockPos.z})`; }
  onTick() { this.finished = true; return null; }
  isFinished() { return this.finished; }
  isEqual(other: any) {
    return other instanceof TestBlockTask && other.blockPos.equals(this.blockPos);
  }
}

describe('DoToClosestBlockTask', () => {
  describe('creation and initialization', () => {
    it('should create with block types', () => {
      const bot = createMockBot();
      const task = new DoToClosestBlockTask(
        bot,
        (pos) => new TestBlockTask(bot, pos),
        ['crafting_table']
      );
      expect(task.displayName).toContain('DoToClosestBlock');
      expect(task.displayName).toContain('crafting_table');
    });

    it('should show count for multiple block types', () => {
      const bot = createMockBot();
      const task = new DoToClosestBlockTask(
        bot,
        (pos) => new TestBlockTask(bot, pos),
        ['furnace', 'blast_furnace', 'smoker']
      );
      expect(task.displayName).toContain('3 types');
    });

    it('should start not finished', () => {
      const bot = createMockBot();
      const task = new DoToClosestBlockTask(
        bot,
        (pos) => new TestBlockTask(bot, pos),
        ['crafting_table']
      );
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('block finding', () => {
    /**
     * WHY: The task should find the closest matching block and
     * create a subtask to work with it.
     */
    it('should find nearby block', () => {
      const craftingTable = createMockBlock('crafting_table', 5, 64, 5);
      const bot = createMockBot({
        blockAt: (pos: Vec3) => {
          if (pos.x === 5 && pos.y === 64 && pos.z === 5) return craftingTable;
          return { name: 'stone', position: pos, boundingBox: 'block' };
        },
      });

      const task = new DoToClosestBlockTask(
        bot,
        (pos) => new TestBlockTask(bot, pos),
        ['crafting_table']
      );
      task.onStart();
      task.onTick(); // Search

      expect(task.isFinished()).toBe(false);
      expect(task.isFailed()).toBe(false);
    });

    /**
     * WHY: When no block exists, task should wander to search.
     */
    it('should wander when no block found', () => {
      const bot = createMockBot({
        blockAt: () => ({ name: 'stone', boundingBox: 'block' }),
      });

      const task = new DoToClosestBlockTask(
        bot,
        (pos) => new TestBlockTask(bot, pos),
        ['crafting_table']
      );
      task.onStart();
      task.onTick(); // Search -> wandering
      const subtask = task.onTick();

      // Should return wander task
      expect(subtask !== null).toBe(true);
    });

    /**
     * WHY: If wanderOnMissing is disabled, task should fail
     * when no block is found instead of wandering.
     */
    it('should fail when no block found and wander disabled', () => {
      const bot = createMockBot({
        blockAt: () => ({ name: 'stone', boundingBox: 'block' }),
      });

      const task = new DoToClosestBlockTask(
        bot,
        (pos) => new TestBlockTask(bot, pos),
        ['crafting_table'],
        { wanderOnMissing: false }
      );
      task.onStart();
      task.onTick();

      expect(task.isFailed()).toBe(true);
    });
  });

  describe('block filtering', () => {
    /**
     * WHY: Custom filters allow targeting specific blocks
     * (e.g., unlocked chests, functional furnaces).
     */
    it('should respect block filter', () => {
      const furnaceOff = createMockBlock('furnace', 5, 64, 5);
      (furnaceOff as any).metadata = 0; // Not lit
      const furnaceOn = createMockBlock('furnace', 10, 64, 10);
      (furnaceOn as any).metadata = 1; // Lit

      const bot = createMockBot({
        blockAt: (pos: Vec3) => {
          if (pos.x === 5 && pos.y === 64 && pos.z === 5) return furnaceOff;
          if (pos.x === 10 && pos.y === 64 && pos.z === 10) return furnaceOn;
          return { name: 'stone', position: pos, boundingBox: 'block' };
        },
      });

      const task = new DoToClosestBlockTask(
        bot,
        (pos) => new TestBlockTask(bot, pos),
        ['furnace'],
        { blockFilter: (b: any) => b.metadata === 0 } // Only unlit furnaces
      );
      task.onStart();
      task.onTick();

      // Should be targeting furnaceOff, not furnaceOn
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('unreachable handling', () => {
    /**
     * WHY: Some blocks may be unreachable. The task should blacklist
     * them and try other blocks.
     */
    it('should allow marking current as unreachable', () => {
      const bot = createMockBot({
        blockAt: () => createMockBlock('crafting_table', 100, 64, 100),
      });

      const task = new DoToClosestBlockTask(
        bot,
        (pos) => new TestBlockTask(bot, pos),
        ['crafting_table']
      );
      task.onStart();
      task.onTick();

      // Mark as unreachable
      task.markCurrentUnreachable();

      // Should go back to searching
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('convenience function', () => {
    it('doToClosestBlock should create task', () => {
      const bot = createMockBot();
      const task = doToClosestBlock(
        bot,
        (pos) => new TestBlockTask(bot, pos),
        'crafting_table',
        'workbench'
      );
      expect(task).toBeInstanceOf(DoToClosestBlockTask);
    });
  });

  describe('equality', () => {
    it('should be equal if same block types', () => {
      const bot = createMockBot();
      const task1 = new DoToClosestBlockTask(bot, () => null as any, ['furnace']);
      const task2 = new DoToClosestBlockTask(bot, () => null as any, ['furnace']);
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different block types', () => {
      const bot = createMockBot();
      const task1 = new DoToClosestBlockTask(bot, () => null as any, ['furnace']);
      const task2 = new DoToClosestBlockTask(bot, () => null as any, ['crafting_table']);
      expect(task1.isEqual(task2)).toBe(false);
    });
  });
});
