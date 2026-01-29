import { describe, it, expect } from 'bun:test';
import { FleeTask, FleeTrigger } from './index';

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

describe('FleeTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new FleeTask(bot);
    expect(task.displayName).toContain('Flee');
  });

  it('should create with safe distance', () => {
    const bot = createMockBot();
    const task = new FleeTask(bot, { safeDistance: 50 });
    expect(task.displayName).toContain('Flee');
  });

  it('should create with health threshold', () => {
    const bot = createMockBot();
    const task = new FleeTask(bot, { healthThreshold: 10 });
    expect(task.displayName).toContain('Flee');
  });

  it('should start in ASSESSING state', () => {
    const bot = createMockBot();
    const task = new FleeTask(bot);
    task.onStart();
    expect(task.displayName).toContain('ASSESSING');
  });

  it('should have no threats at start', () => {
    const bot = createMockBot();
    const task = new FleeTask(bot);
    task.onStart();
    expect(task.getThreatCount()).toBe(0);
  });

  it('should return empty threats array at start', () => {
    const bot = createMockBot();
    const task = new FleeTask(bot);
    task.onStart();
    expect(task.getThreats()).toEqual([]);
  });

  it('should support manual trigger', () => {
    const bot = createMockBot();
    const task = new FleeTask(bot);
    task.onStart();
    task.triggerFlee();
    expect(task.getTrigger()).toBe(FleeTrigger.MANUAL);
  });

  it('should compare by safe distance and health threshold', () => {
    const bot = createMockBot();
    const task1 = new FleeTask(bot, { safeDistance: 32, healthThreshold: 6 });
    const task2 = new FleeTask(bot, { safeDistance: 32, healthThreshold: 6 });
    const task3 = new FleeTask(bot, { safeDistance: 50, healthThreshold: 6 });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
