import { describe, it, expect } from 'bun:test';
import { BoatTask } from './index';

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

describe('BoatTask', () => {
  it('should create with target coordinates', () => {
    const bot = createMockBot();
    const task = new BoatTask(bot, 100, 200);
    expect(task.displayName).toContain('Boat');
    expect(task.displayName).toContain('100');
    expect(task.displayName).toContain('200');
  });

  it('should create with exit on arrival option', () => {
    const bot = createMockBot();
    const task = new BoatTask(bot, 50, 50, { exitOnArrival: true });
    expect(task.displayName).toContain('Boat');
  });

  it('should create with place boat option', () => {
    const bot = createMockBot();
    const task = new BoatTask(bot, 50, 50, { placeBoatIfNeeded: true });
    expect(task.displayName).toContain('Boat');
  });

  it('should start in FINDING_BOAT state', () => {
    const bot = createMockBot();
    const task = new BoatTask(bot, 100, 100);
    task.onStart();
    expect(task.displayName).toContain('FINDING_BOAT');
  });

  it('should track in-boat status', () => {
    const bot = createMockBot();
    const task = new BoatTask(bot, 100, 100);
    task.onStart();
    expect(task.isCurrentlyInBoat()).toBe(false);
  });

  it('should compare by target coordinates', () => {
    const bot = createMockBot();
    const task1 = new BoatTask(bot, 100, 200);
    const task2 = new BoatTask(bot, 100, 200);
    const task3 = new BoatTask(bot, 300, 400);
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
