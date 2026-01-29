import { describe, it, expect } from 'bun:test';
import { WaterBucketTask } from './index';

function createMockBot(): any {
  return {
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
        distanceTo: () => 5,
        offset: () => ({ x: 1, y: 64, z: 1 }),
        clone: () => ({ x: 0, y: 64, z: 0 }),
        minus: () => ({ x: 0, y: 0, z: 0, scaled: () => ({ x: 0, y: 0, z: 0 }) }),
        plus: () => ({ x: 0, y: 64, z: 0 }),
      },
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: () => null,
    entities: {},
    time: { timeOfDay: 6000 },
    health: 20,
    food: 20,
    heldItem: null,
  };
}

describe('WaterBucketTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    bot.entity.velocity = { y: 0 };
    const task = new WaterBucketTask(bot);
    expect(task.displayName).toContain('WaterBucket');
  });

  it('should start in MONITORING state', () => {
    const bot = createMockBot();
    bot.entity.velocity = { y: 0 };
    const task = new WaterBucketTask(bot);
    task.onStart();
    expect(task.displayName).toContain('MONITORING');
  });

  it('should have no landing position at start', () => {
    const bot = createMockBot();
    bot.entity.velocity = { y: 0 };
    const task = new WaterBucketTask(bot);
    task.onStart();
    expect(task.getLandingPosition()).toBeNull();
  });

  it('should not have placed water at start', () => {
    const bot = createMockBot();
    bot.entity.velocity = { y: 0 };
    const task = new WaterBucketTask(bot);
    task.onStart();
    expect(task.wasWaterPlaced()).toBe(false);
  });

  it('should support manual trigger', () => {
    const bot = createMockBot();
    bot.entity.velocity = { y: 0 };
    const task = new WaterBucketTask(bot);
    task.onStart();
    task.triggerMLG();
    expect(task.displayName).toContain('FALLING');
  });

  it('should compare as equal', () => {
    const bot = createMockBot();
    bot.entity.velocity = { y: 0 };
    const task1 = new WaterBucketTask(bot);
    const task2 = new WaterBucketTask(bot);
    expect(task1.isEqual(task2)).toBe(true);
  });
});
