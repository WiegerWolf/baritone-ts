import { describe, it, expect } from 'bun:test';
import { GatherResourcesTask } from './index';

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

describe('GatherResourcesTask', () => {
  it('should create with string target', () => {
    const bot = createMockBot();
    const task = new GatherResourcesTask(bot, 'cobblestone', 16);
    expect(task.displayName).toContain('GatherResources');
  });

  it('should create with array of targets', () => {
    const bot = createMockBot();
    const task = new GatherResourcesTask(bot, ['iron_ore', 'coal'], [10, 20]);
    expect(task.displayName).toContain('GatherResources');
  });

  it('should start in ANALYZING state', () => {
    const bot = createMockBot();
    const task = new GatherResourcesTask(bot, 'dirt', 8);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });
});
