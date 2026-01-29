import { describe, it, expect } from 'bun:test';
import { CollectWoodTask } from './index';

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

describe('CollectWoodTask', () => {
  it('should create with default count', () => {
    const bot = createMockBot();
    const task = new CollectWoodTask(bot, 5);
    expect(task.displayName).toContain('CollectWood');
    expect(task.displayName).toContain('0/5');
  });

  it('should start in SEARCHING state', () => {
    const bot = createMockBot();
    const task = new CollectWoodTask(bot);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });
});
