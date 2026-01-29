import { describe, it, expect } from 'bun:test';
import { MineOresTask } from './index';

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

describe('MineOresTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new MineOresTask(bot);
    expect(task.displayName).toContain('MineOres');
  });

  it('should create with specific ores', () => {
    const bot = createMockBot();
    const task = new MineOresTask(bot, { targetOres: ['diamond', 'iron'] });
    expect(task.displayName).toContain('MineOres');
  });

  it('should create with target count', () => {
    const bot = createMockBot();
    const task = new MineOresTask(bot, { targetCount: 10 });
    expect(task.displayName).toContain('0/10');
  });
});
