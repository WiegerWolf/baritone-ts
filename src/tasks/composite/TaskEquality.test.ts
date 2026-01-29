import { describe, it, expect } from 'bun:test';
import { CollectWoodTask, GetToolTask } from './index';

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

describe('Task equality', () => {
  it('CollectWoodTask should compare by count', () => {
    const bot = createMockBot();
    const task1 = new CollectWoodTask(bot, 5);
    const task2 = new CollectWoodTask(bot, 5);
    const task3 = new CollectWoodTask(bot, 10);

    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });

  it('GetToolTask should compare by type and tier', () => {
    const bot = createMockBot();
    const task1 = new GetToolTask(bot, 'pickaxe', 'stone');
    const task2 = new GetToolTask(bot, 'pickaxe', 'stone');
    const task3 = new GetToolTask(bot, 'pickaxe', 'iron');

    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
