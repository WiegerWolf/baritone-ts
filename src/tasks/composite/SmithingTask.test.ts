import { describe, it, expect } from 'bun:test';
import { SmithingTask, SmithingType } from './index';

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

describe('SmithingTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new SmithingTask(bot);
    expect(task.displayName).toContain('Smithing');
  });

  it('should create with target items', () => {
    const bot = createMockBot();
    const task = new SmithingTask(bot, { targetItems: ['diamond_sword'] });
    expect(task.displayName).toContain('Smithing');
  });

  it('should start in FINDING_TABLE state', () => {
    const bot = createMockBot();
    const task = new SmithingTask(bot);
    task.onStart();
    expect(task.displayName).toContain('FINDING_TABLE');
  });

  it('should track upgrades completed', () => {
    const bot = createMockBot();
    const task = new SmithingTask(bot);
    task.onStart();
    expect(task.getUpgradesCompleted()).toBe(0);
  });

  it('should compare by target items', () => {
    const bot = createMockBot();
    const task1 = new SmithingTask(bot, { targetItems: ['diamond_sword'] });
    const task2 = new SmithingTask(bot, { targetItems: ['diamond_sword'] });
    const task3 = new SmithingTask(bot, { targetItems: ['diamond_pickaxe'] });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
