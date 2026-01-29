import { describe, it, expect } from 'bun:test';
import { BrewingTask } from './index';

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

describe('BrewingTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new BrewingTask(bot);
    expect(task.displayName).toContain('Brew');
  });

  it('should create with target effect', () => {
    const bot = createMockBot();
    const task = new BrewingTask(bot, { targetEffect: 'healing' });
    expect(task.displayName).toContain('healing');
  });

  it('should create with count', () => {
    const bot = createMockBot();
    const task = new BrewingTask(bot, { count: 6 });
    expect(task.displayName).toContain('0/6');
  });

  it('should start in FINDING_STAND state', () => {
    const bot = createMockBot();
    const task = new BrewingTask(bot);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });

  it('should track brewed count', () => {
    const bot = createMockBot();
    const task = new BrewingTask(bot);
    task.onStart();
    expect(task.getBrewedCount()).toBe(0);
  });
});
