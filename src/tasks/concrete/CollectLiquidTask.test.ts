/**
 * Tests for Liquid Collection Tasks
 *
 * These tests verify that liquid collection tasks work correctly:
 * - WHY: These tasks handle resource collection mechanics.
 * - INTENT: Validate state machines, edge cases, and helper functions.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  LiquidType,
  CollectBucketLiquidTask,
  CollectWaterBucketTask,
  CollectLavaBucketTask,
  collectWater,
  collectLava,
} from './CollectLiquidTask';
import { Vec3 } from 'vec3';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot = {
    entity: {
      position: new Vec3(0, 64, 0),
      velocity: new Vec3(0, 0, 0),
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
    setControlState: mock(),
    clearControlStates: mock(),
    look: mock(),
    lookAt: mock(),
    equip: mock(),
    activateBlock: mock(),
    wake: mock(),
    isSleeping: false,
    ...overrides,
  };

  // Add Vec3 methods to position
  baseBot.entity.position.distanceTo = (other: Vec3) => {
    const dx = other.x - baseBot.entity.position.x;
    const dy = other.y - baseBot.entity.position.y;
    const dz = other.z - baseBot.entity.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  baseBot.entity.position.floored = () => new Vec3(
    Math.floor(baseBot.entity.position.x),
    Math.floor(baseBot.entity.position.y),
    Math.floor(baseBot.entity.position.z)
  );
  baseBot.entity.position.minus = (other: Vec3) => new Vec3(
    baseBot.entity.position.x - other.x,
    baseBot.entity.position.y - other.y,
    baseBot.entity.position.z - other.z
  );

  return baseBot;
}

describe('Liquid Collection Tasks', () => {
  describe('CollectBucketLiquidTask', () => {
    it('should create water collection task', () => {
      const bot = createMockBot();
      const task = new CollectBucketLiquidTask(bot, LiquidType.WATER, 1);
      expect(task.displayName).toContain('water');
    });

    it('should create lava collection task', () => {
      const bot = createMockBot();
      const task = new CollectBucketLiquidTask(bot, LiquidType.LAVA, 1);
      expect(task.displayName).toContain('lava');
    });

    /**
     * WHY: Task should fail without buckets to collect liquid.
     */
    it('should require empty bucket', () => {
      const bot = createMockBot({
        inventory: { items: () => [] },
      });
      const task = new CollectWaterBucketTask(bot, 1);
      task.onStart();
      task.onTick();
      task.onTick();
      expect(task.isFailed()).toBe(true);
    });

    it('should finish when already have filled bucket', () => {
      const bot = createMockBot({
        inventory: {
          items: () => [{ name: 'water_bucket', count: 1 }],
        },
      });
      const task = new CollectWaterBucketTask(bot, 1);
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('CollectWaterBucketTask', () => {
    it('should create task for water', () => {
      const bot = createMockBot();
      const task = new CollectWaterBucketTask(bot, 2);
      expect(task.displayName).toContain('water');
    });
  });

  describe('CollectLavaBucketTask', () => {
    it('should create task for lava', () => {
      const bot = createMockBot();
      const task = new CollectLavaBucketTask(bot, 1);
      expect(task.displayName).toContain('lava');
    });
  });

  describe('helper functions', () => {
    it('collectWater should create task', () => {
      const bot = createMockBot();
      const task = collectWater(bot, 3);
      expect(task).toBeInstanceOf(CollectWaterBucketTask);
    });

    it('collectLava should create task', () => {
      const bot = createMockBot();
      const task = collectLava(bot, 2);
      expect(task).toBeInstanceOf(CollectLavaBucketTask);
    });
  });

  describe('LiquidType enum', () => {
    it('should have water and lava', () => {
      expect(LiquidType.WATER).toBe('water');
      expect(LiquidType.LAVA).toBe('lava');
    });
  });
});

describe('Task equality', () => {
  it('liquid tasks should be equal if same type and count', () => {
    const bot = createMockBot();
    const task1 = new CollectWaterBucketTask(bot, 2);
    const task2 = new CollectWaterBucketTask(bot, 2);
    expect(task1.isEqual(task2)).toBe(true);
  });
});
