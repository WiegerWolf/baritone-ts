import { describe, it, expect } from 'bun:test';
import { ScaffoldTask, ScaffoldMode } from './index';

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

describe('ScaffoldTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new ScaffoldTask(bot);
    expect(task.displayName).toContain('Scaffold');
  });

  it('should create in ascend mode', () => {
    const bot = createMockBot();
    const task = new ScaffoldTask(bot, { mode: ScaffoldMode.ASCEND });
    expect(task.displayName).toContain('ascend');
  });

  it('should create in descend mode', () => {
    const bot = createMockBot();
    const task = new ScaffoldTask(bot, { mode: ScaffoldMode.DESCEND });
    expect(task.displayName).toContain('descend');
  });

  it('should create with target Y', () => {
    const bot = createMockBot();
    const task = new ScaffoldTask(bot, {
      mode: ScaffoldMode.TO_Y,
      targetY: 100,
    });
    expect(task.displayName).toContain('to_y');
  });

  it('should start with zero blocks used', () => {
    const bot = createMockBot();
    const task = new ScaffoldTask(bot);
    task.onStart();
    expect(task.getBlocksUsed()).toBe(0);
  });

  it('should track height change', () => {
    const bot = createMockBot();
    const task = new ScaffoldTask(bot);
    task.onStart();
    expect(task.getHeightChange()).toBe(0);
  });

  it('should compare mode and target for equality', () => {
    const bot = createMockBot();
    const task1 = new ScaffoldTask(bot, { mode: ScaffoldMode.TO_Y, targetY: 100 });
    const task2 = new ScaffoldTask(bot, { mode: ScaffoldMode.TO_Y, targetY: 100 });
    const task3 = new ScaffoldTask(bot, { mode: ScaffoldMode.TO_Y, targetY: 200 });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
