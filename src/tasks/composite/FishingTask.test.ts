import { describe, it, expect } from 'bun:test';
import { FishingTask } from './index';

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

describe('FishingTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new FishingTask(bot);
    expect(task.displayName).toContain('Fishing');
  });

  it('should create with target count', () => {
    const bot = createMockBot();
    const task = new FishingTask(bot, { targetCount: 20 });
    expect(task.displayName).toContain('0/20');
  });

  it('should start in FINDING_WATER state', () => {
    const bot = createMockBot();
    const task = new FishingTask(bot);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });

  it('should track caught count', () => {
    const bot = createMockBot();
    const task = new FishingTask(bot);
    task.onStart();
    expect(task.getCaughtCount()).toBe(0);
  });

  it('should compare by target count', () => {
    const bot = createMockBot();
    const task1 = new FishingTask(bot, { targetCount: 10 });
    const task2 = new FishingTask(bot, { targetCount: 10 });
    const task3 = new FishingTask(bot, { targetCount: 20 });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
