import { describe, it, expect } from 'bun:test';
import { MineLayerTask, MinePattern } from './index';

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

describe('MineLayerTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new MineLayerTask(bot);
    expect(task.displayName).toContain('MineLayer');
    expect(task.displayName).toContain('Y:-59');
  });

  it('should create with custom Y level', () => {
    const bot = createMockBot();
    const task = new MineLayerTask(bot, { yLevel: 11 });
    expect(task.displayName).toContain('Y:11');
  });

  it('should start with zero blocks mined', () => {
    const bot = createMockBot();
    const task = new MineLayerTask(bot);
    task.onStart();
    expect(task.getBlocksMined()).toBe(0);
  });

  it('should have empty ores found at start', () => {
    const bot = createMockBot();
    const task = new MineLayerTask(bot);
    task.onStart();
    expect(task.getOresFound().size).toBe(0);
  });

  it('should track progress', () => {
    const bot = createMockBot();
    const task = new MineLayerTask(bot, { width: 10, length: 10 });
    task.onStart();
    expect(task.getProgress()).toBe(0);
  });

  it('should create with strip pattern', () => {
    const bot = createMockBot();
    const task = new MineLayerTask(bot, { pattern: MinePattern.STRIP });
    expect(task.displayName).toContain('MineLayer');
  });

  it('should create with spiral pattern', () => {
    const bot = createMockBot();
    const task = new MineLayerTask(bot, { pattern: MinePattern.SPIRAL });
    expect(task.displayName).toContain('MineLayer');
  });

  it('should create with grid pattern', () => {
    const bot = createMockBot();
    const task = new MineLayerTask(bot, { pattern: MinePattern.GRID });
    expect(task.displayName).toContain('MineLayer');
  });

  it('should compare dimensions for equality', () => {
    const bot = createMockBot();
    const task1 = new MineLayerTask(bot, { yLevel: -59, width: 16, length: 32 });
    const task2 = new MineLayerTask(bot, { yLevel: -59, width: 16, length: 32 });
    const task3 = new MineLayerTask(bot, { yLevel: 11, width: 16, length: 32 });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });

  it('should configure torch interval', () => {
    const bot = createMockBot();
    const task = new MineLayerTask(bot, { torchInterval: 4 });
    expect(task.displayName).toContain('MineLayer');
  });
});
