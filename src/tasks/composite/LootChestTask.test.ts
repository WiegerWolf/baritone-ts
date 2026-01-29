import { describe, it, expect } from 'bun:test';
import { LootChestTask } from './index';

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

describe('LootChestTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new LootChestTask(bot);
    expect(task.displayName).toContain('LootChest');
  });

  it('should create with target items', () => {
    const bot = createMockBot();
    const task = new LootChestTask(bot, { targetItems: ['diamond', 'emerald'] });
    expect(task.displayName).toContain('LootChest');
  });

  it('should create with custom search radius', () => {
    const bot = createMockBot();
    const task = new LootChestTask(bot, { searchRadius: 64 });
    expect(task.displayName).toContain('LootChest');
  });

  it('should start in SEARCHING state', () => {
    const bot = createMockBot();
    const task = new LootChestTask(bot);
    task.onStart();
    expect(task.displayName).toContain('SEARCHING');
  });

  it('should track containers looted', () => {
    const bot = createMockBot();
    const task = new LootChestTask(bot);
    task.onStart();
    expect(task.getContainersLooted()).toBe(0);
  });

  it('should track items collected', () => {
    const bot = createMockBot();
    const task = new LootChestTask(bot);
    task.onStart();
    expect(task.getItemsCollected()).toBe(0);
  });

  it('should compare by target items', () => {
    const bot = createMockBot();
    const task1 = new LootChestTask(bot, { targetItems: ['diamond'] });
    const task2 = new LootChestTask(bot, { targetItems: ['diamond'] });
    const task3 = new LootChestTask(bot, { targetItems: ['emerald'] });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });

  it('should support clearing looted tracking', () => {
    const bot = createMockBot();
    const task = new LootChestTask(bot);
    task.clearLootedTracking();
    expect(task.getContainersLooted()).toBe(0);
  });
});
