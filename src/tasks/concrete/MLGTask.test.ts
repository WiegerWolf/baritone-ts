/**
 * Tests for MLG Tasks
 *
 * These tests verify:
 * 1. Intent - What each task is supposed to accomplish (WHY)
 * 2. State Machine - Correct state transitions
 * 3. Edge Cases - Error handling and boundary conditions
 */

import { describe, it, expect, mock } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  MLGBucketTask,
  MLGBucketMonitorTask,
  mlgBucket,
  monitorForMLG,
  shouldMLG,
} from './MLGTask';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot: Record<string, any> = {
    entity: {
      position: new Vec3(0, 64, 0),
      velocity: new Vec3(0, 0, 0),
      onGround: true,
      yaw: 0,
      pitch: 0,
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    entities: {},
    game: {
      dimension: 'minecraft:overworld',
    },
    blockAt: () => null,
    lookAt: mock(),
    look: mock(),
    setControlState: mock(),
    clearControlStates: mock(),
    equip: mock(),
    activateBlock: mock(),
    useOn: mock(),
    wake: mock(),
  };

  // Deep merge overrides
  const result: Record<string, any> = { ...baseBot };
  for (const key of Object.keys(overrides)) {
    if (typeof overrides[key] === 'object' && overrides[key] !== null && !Array.isArray(overrides[key])) {
      result[key] = { ...baseBot[key], ...overrides[key] };
    } else {
      result[key] = overrides[key];
    }
  }

  return result;
}

describe('MLG Tasks', () => {
  describe('MLGBucketTask', () => {
    describe('creation and initialization', () => {
      it('should create with default config', () => {
        const bot = createMockBot();
        const task = new MLGBucketTask(bot);
        expect(task.displayName).toBe('MLGBucket');
      });

      it('should create with custom config', () => {
        const bot = createMockBot();
        const task = new MLGBucketTask(bot, {
          minFallDistance: 8,
          placeHeight: 3,
          pickupWater: false,
        });
        expect(task.displayName).toBe('MLGBucket');
      });

      it('should start not finished', () => {
        const bot = createMockBot();
        const task = new MLGBucketTask(bot);
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('water bucket detection', () => {
      it('should fail if no water bucket in inventory', () => {
        const bot = createMockBot({
          inventory: { items: () => [] },
          entity: {
            position: new Vec3(0, 100, 0),
            velocity: new Vec3(0, -1, 0),
            onGround: false,
          },
          game: { dimension: 'minecraft:overworld' },
        });
        const task = new MLGBucketTask(bot);
        task.onStart();
        // Simulate several ticks of falling
        task.onTick();
        task.onTick();
        expect(task.isFailed()).toBe(true);
      });

      it('should not fail immediately with water bucket', () => {
        const bot = createMockBot({
          inventory: { items: () => [{ name: 'water_bucket', count: 1 }] },
          entity: {
            position: new Vec3(0, 100, 0),
            velocity: new Vec3(0, 0, 0),
            onGround: true,
          },
          game: { dimension: 'minecraft:overworld' },
        });
        const task = new MLGBucketTask(bot);
        task.onStart();
        task.onTick();
        expect(task.isFailed()).toBe(false);
      });
    });

    describe('dimension handling', () => {
      it('should fail in nether (water evaporates)', () => {
        const bot = createMockBot({
          inventory: { items: () => [{ name: 'water_bucket', count: 1 }] },
          entity: {
            position: new Vec3(0, 100, 0),
            velocity: new Vec3(0, -1, 0),
            onGround: false,
          },
          game: { dimension: 'minecraft:the_nether' },
        });
        const task = new MLGBucketTask(bot);
        task.onStart();
        task.onTick();
        expect(task.isFailed()).toBe(true);
      });
    });

    describe('equality', () => {
      it('should be equal to another MLG bucket task', () => {
        const bot = createMockBot();
        const task1 = new MLGBucketTask(bot);
        const task2 = new MLGBucketTask(bot);
        expect(task1.isEqual(task2)).toBe(true);
      });
    });
  });

  describe('MLGBucketMonitorTask', () => {
    describe('creation', () => {
      it('should create monitor task', () => {
        const bot = createMockBot();
        const task = new MLGBucketMonitorTask(bot);
        expect(task.displayName).toBe('MLGBucketMonitor');
      });

      it('should start not finished', () => {
        const bot = createMockBot({
          entity: {
            position: new Vec3(0, 64, 0),
            velocity: new Vec3(0, 0, 0),
            onGround: true,
          },
        });
        const task = new MLGBucketMonitorTask(bot);
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('fall detection', () => {
      it('should not trigger when on ground', () => {
        const bot = createMockBot({
          entity: {
            position: new Vec3(0, 64, 0),
            velocity: new Vec3(0, 0, 0),
            onGround: true,
          },
          inventory: { items: () => [{ name: 'water_bucket', count: 1 }] },
        });
        const task = new MLGBucketMonitorTask(bot);
        task.onStart();
        const result = task.onTick();
        expect(result).toBeNull();
      });
    });

    describe('equality', () => {
      it('should be equal to another MLG monitor task', () => {
        const bot = createMockBot();
        const task1 = new MLGBucketMonitorTask(bot);
        const task2 = new MLGBucketMonitorTask(bot);
        expect(task1.isEqual(task2)).toBe(true);
      });
    });
  });

  describe('convenience functions', () => {
    it('mlgBucket should create MLGBucketTask', () => {
      const bot = createMockBot();
      const task = mlgBucket(bot);
      expect(task).toBeInstanceOf(MLGBucketTask);
    });

    it('monitorForMLG should create MLGBucketMonitorTask', () => {
      const bot = createMockBot();
      const task = monitorForMLG(bot, 6);
      expect(task).toBeInstanceOf(MLGBucketMonitorTask);
    });

    it('shouldMLG should return false when not falling', () => {
      const bot = createMockBot({
        entity: {
          position: new Vec3(0, 64, 0),
          velocity: new Vec3(0, 0, 0),
        },
        inventory: { items: () => [{ name: 'water_bucket', count: 1 }] },
      });
      expect(shouldMLG(bot)).toBe(false);
    });

    it('shouldMLG should return false without water bucket', () => {
      const bot = createMockBot({
        entity: {
          position: new Vec3(0, 100, 0),
          velocity: new Vec3(0, -1, 0),
        },
        inventory: { items: () => [] },
      });
      expect(shouldMLG(bot)).toBe(false);
    });

    it('shouldMLG should return false in nether', () => {
      const bot = createMockBot({
        entity: {
          position: new Vec3(0, 100, 0),
          velocity: new Vec3(0, -1, 0),
        },
        inventory: { items: () => [{ name: 'water_bucket', count: 1 }] },
        game: { dimension: 'minecraft:the_nether' },
      });
      expect(shouldMLG(bot)).toBe(false);
    });
  });
});

describe('MLGBucketTask intent', () => {
  it('exists to prevent death from fall damage', () => {
    // WHY: Fall damage is a major cause of death. MLG bucket saves lives.
    // The technique requires precise timing that's hard for humans.
    const bot = createMockBot();
    const task = mlgBucket(bot);

    // The task is named after the technique
    expect(task.displayName).toContain('MLG');
  });

  it('only works in overworld and end (water evaporates in nether)', () => {
    // WHY: Physical game mechanics require dimension awareness
    const netherBot = createMockBot({
      game: { dimension: 'minecraft:the_nether' },
      inventory: { items: () => [{ name: 'water_bucket', count: 1 }] },
      entity: {
        position: new Vec3(0, 100, 0),
        velocity: new Vec3(0, -1, 0),
        onGround: false,
      },
    });

    const task = new MLGBucketTask(netherBot);
    task.onStart();
    task.onTick();

    // Should recognize it can't work in nether
    expect(task.isFailed()).toBe(true);
  });
});
