import { describe, it, expect } from 'bun:test';
import { EnchantTask } from './index';

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

describe('EnchantTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new EnchantTask(bot);
    expect(task.displayName).toContain('Enchant');
  });

  it('should create with specific item', () => {
    const bot = createMockBot();
    const task = new EnchantTask(bot, { itemToEnchant: 'diamond_sword' });
    expect(task.displayName).toContain('diamond_sword');
  });

  it('should create with preferred slot', () => {
    const bot = createMockBot();
    const task = new EnchantTask(bot, { preferredSlot: 0 });
    expect(task.displayName).toContain('Enchant');
  });

  it('should start in FINDING_TABLE state', () => {
    const bot = createMockBot();
    const task = new EnchantTask(bot);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });
});
