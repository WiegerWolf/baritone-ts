import { describe, it, expect } from 'bun:test';
import { FarmTask, FarmMode } from './index';

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

describe('FarmTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new FarmTask(bot);
    expect(task.displayName).toContain('Farm');
  });

  it('should create with harvest mode', () => {
    const bot = createMockBot();
    const task = new FarmTask(bot, { mode: FarmMode.HARVEST_ONLY });
    expect(task.displayName).toContain('Farm');
  });

  it('should create with specific crops', () => {
    const bot = createMockBot();
    const task = new FarmTask(bot, { targetCrops: ['wheat', 'carrot'] });
    expect(task.displayName).toContain('Farm');
  });
});
