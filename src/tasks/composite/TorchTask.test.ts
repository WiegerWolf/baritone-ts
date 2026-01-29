import { describe, it, expect } from 'bun:test';
import { TorchTask, TorchMode } from './index';

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

describe('TorchTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new TorchTask(bot);
    expect(task.displayName).toContain('Torch');
  });

  it('should create with dark spots mode', () => {
    const bot = createMockBot();
    const task = new TorchTask(bot, { mode: TorchMode.DARK_SPOTS });
    expect(task.displayName).toContain('dark_spots');
  });

  it('should create with grid mode', () => {
    const bot = createMockBot();
    const task = new TorchTask(bot, { mode: TorchMode.GRID });
    expect(task.displayName).toContain('grid');
  });

  it('should create with walls mode', () => {
    const bot = createMockBot();
    const task = new TorchTask(bot, { mode: TorchMode.WALLS });
    expect(task.displayName).toContain('walls');
  });

  it('should start with zero torches placed', () => {
    const bot = createMockBot();
    const task = new TorchTask(bot);
    task.onStart();
    expect(task.getTorchesPlaced()).toBe(0);
  });

  it('should track remaining spots', () => {
    const bot = createMockBot();
    const task = new TorchTask(bot);
    task.onStart();
    expect(task.getRemainingSpots()).toBe(0);
  });

  it('should compare mode and radius for equality', () => {
    const bot = createMockBot();
    const task1 = new TorchTask(bot, { mode: TorchMode.GRID, radius: 16 });
    const task2 = new TorchTask(bot, { mode: TorchMode.GRID, radius: 16 });
    const task3 = new TorchTask(bot, { mode: TorchMode.FLOOD, radius: 16 });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
