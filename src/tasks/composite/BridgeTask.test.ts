import { describe, it, expect } from 'bun:test';
import { BridgeTask, BridgeDirection } from './index';

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

describe('BridgeTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new BridgeTask(bot);
    expect(task.displayName).toContain('Bridge');
  });

  it('should create with direction and distance', () => {
    const bot = createMockBot();
    const task = new BridgeTask(bot, {
      direction: BridgeDirection.NORTH,
      distance: 20,
    });
    expect(task.displayName).toContain('north');
    expect(task.displayName).toContain('0/20');
  });

  it('should start with zero blocks placed', () => {
    const bot = createMockBot();
    const task = new BridgeTask(bot);
    task.onStart();
    expect(task.getBlocksPlaced()).toBe(0);
  });

  it('should have no selected material at start', () => {
    const bot = createMockBot();
    const task = new BridgeTask(bot);
    task.onStart();
    expect(task.getSelectedMaterial()).toBeNull();
  });

  it('should compare direction and distance for equality', () => {
    const bot = createMockBot();
    const task1 = new BridgeTask(bot, { direction: BridgeDirection.EAST, distance: 10 });
    const task2 = new BridgeTask(bot, { direction: BridgeDirection.EAST, distance: 10 });
    const task3 = new BridgeTask(bot, { direction: BridgeDirection.WEST, distance: 10 });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });

  it('should create with railings option', () => {
    const bot = createMockBot();
    const task = new BridgeTask(bot, { placeRailings: true });
    expect(task.displayName).toContain('Bridge');
  });
});
