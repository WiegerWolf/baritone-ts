import { describe, it, expect } from 'bun:test';
import { CompostTask } from './index';

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

describe('CompostTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new CompostTask(bot);
    expect(task.displayName).toContain('Compost');
  });

  it('should create with target bone meal', () => {
    const bot = createMockBot();
    const task = new CompostTask(bot, { targetBonemeal: 32 });
    expect(task.displayName).toContain('0/32');
  });

  it('should start with zero bone meal collected', () => {
    const bot = createMockBot();
    const task = new CompostTask(bot);
    task.onStart();
    expect(task.getBonemealCollected()).toBe(0);
  });

  it('should start with zero materials used', () => {
    const bot = createMockBot();
    const task = new CompostTask(bot);
    task.onStart();
    expect(task.getMaterialsUsed()).toBe(0);
  });

  it('should compare target bone meal for equality', () => {
    const bot = createMockBot();
    const task1 = new CompostTask(bot, { targetBonemeal: 16 });
    const task2 = new CompostTask(bot, { targetBonemeal: 16 });
    const task3 = new CompostTask(bot, { targetBonemeal: 32 });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
