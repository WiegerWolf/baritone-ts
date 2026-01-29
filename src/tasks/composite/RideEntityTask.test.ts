import { describe, it, expect } from 'bun:test';
import { RideEntityTask, RideableEntity } from './index';
import { Vec3 } from 'vec3';

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

describe('RideEntityTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new RideEntityTask(bot);
    expect(task.displayName).toContain('RideEntity');
  });

  it('should create with specific entity type', () => {
    const bot = createMockBot();
    const task = new RideEntityTask(bot, { entityType: RideableEntity.HORSE });
    expect(task.displayName).toContain('horse');
  });

  it('should create with destination', () => {
    const bot = createMockBot();
    const destination = new Vec3(100, 64, 100);
    const task = new RideEntityTask(bot, { destination });
    expect(task.displayName).toContain('to 100,100');
  });

  it('should start in FINDING_MOUNT state', () => {
    const bot = createMockBot();
    const task = new RideEntityTask(bot);
    task.onStart();
    expect(task.displayName).toContain('FINDING_MOUNT');
  });

  it('should have no mount at start', () => {
    const bot = createMockBot();
    const task = new RideEntityTask(bot);
    task.onStart();
    expect(task.getMount()).toBeNull();
  });

  it('should not be riding at start', () => {
    const bot = createMockBot();
    const task = new RideEntityTask(bot);
    task.onStart();
    expect(task.isCurrentlyRiding()).toBe(false);
  });

  it('should compare by entity type', () => {
    const bot = createMockBot();
    const task1 = new RideEntityTask(bot, { entityType: RideableEntity.HORSE });
    const task2 = new RideEntityTask(bot, { entityType: RideableEntity.HORSE });
    const task3 = new RideEntityTask(bot, { entityType: RideableEntity.PIG });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
