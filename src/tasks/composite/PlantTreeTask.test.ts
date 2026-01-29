import { describe, it, expect } from 'bun:test';
import { PlantTreeTask } from './index';

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

describe('PlantTreeTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new PlantTreeTask(bot);
    expect(task.displayName).toContain('PlantTree');
  });

  it('should create with count', () => {
    const bot = createMockBot();
    const task = new PlantTreeTask(bot, { count: 10 });
    expect(task.displayName).toContain('0/10');
  });

  it('should start with zero trees planted', () => {
    const bot = createMockBot();
    const task = new PlantTreeTask(bot);
    task.onStart();
    expect(task.getTreesPlanted()).toBe(0);
  });

  it('should have empty planted positions at start', () => {
    const bot = createMockBot();
    const task = new PlantTreeTask(bot);
    task.onStart();
    expect(task.getPlantedPositions()).toEqual([]);
  });

  it('should create with specific sapling type', () => {
    const bot = createMockBot();
    const task = new PlantTreeTask(bot, { saplingType: 'oak_sapling' });
    expect(task.displayName).toContain('PlantTree');
  });

  it('should compare sapling type and count for equality', () => {
    const bot = createMockBot();
    const task1 = new PlantTreeTask(bot, { saplingType: 'oak_sapling', count: 5 });
    const task2 = new PlantTreeTask(bot, { saplingType: 'oak_sapling', count: 5 });
    const task3 = new PlantTreeTask(bot, { saplingType: 'spruce_sapling', count: 5 });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
