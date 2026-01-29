import { describe, it, expect } from 'bun:test';
import { TradingTask } from './index';

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

describe('TradingTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new TradingTask(bot);
    expect(task.displayName).toContain('Trading');
  });

  it('should create with specific profession', () => {
    const bot = createMockBot();
    const task = new TradingTask(bot, { professions: ['librarian'] });
    expect(task.displayName).toContain('Trading');
  });

  it('should create with wanted items', () => {
    const bot = createMockBot();
    const task = new TradingTask(bot, { wantedItems: ['emerald'] });
    expect(task.displayName).toContain('Trading');
  });

  it('should start in FINDING_VILLAGER state', () => {
    const bot = createMockBot();
    const task = new TradingTask(bot);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });

  it('should track trade count', () => {
    const bot = createMockBot();
    const task = new TradingTask(bot);
    task.onStart();
    expect(task.getTradeCount()).toBe(0);
  });
});
