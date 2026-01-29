import { describe, it, expect } from 'bun:test';
import { HuntTask } from './index';

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

describe('HuntTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new HuntTask(bot);
    expect(task.displayName).toContain('Hunt');
  });

  it('should create with target kill count', () => {
    const bot = createMockBot();
    const task = new HuntTask(bot, { targetKills: 10 });
    expect(task.displayName).toContain('0/10');
  });

  it('should create with specific animals', () => {
    const bot = createMockBot();
    const task = new HuntTask(bot, { targetAnimals: ['cow', 'pig'] });
    expect(task.displayName).toContain('Hunt');
  });

  it('should start in SEARCHING state', () => {
    const bot = createMockBot();
    const task = new HuntTask(bot);
    task.onStart();
    expect(task.displayName).toContain('SEARCHING');
  });

  it('should track kill count', () => {
    const bot = createMockBot();
    const task = new HuntTask(bot);
    task.onStart();
    expect(task.getKillCount()).toBe(0);
  });

  it('should have no current target at start', () => {
    const bot = createMockBot();
    const task = new HuntTask(bot);
    task.onStart();
    expect(task.getCurrentTarget()).toBeNull();
  });

  it('should compare by target kills and animals', () => {
    const bot = createMockBot();
    const task1 = new HuntTask(bot, { targetKills: 5, targetAnimals: ['cow'] });
    const task2 = new HuntTask(bot, { targetKills: 5, targetAnimals: ['cow'] });
    const task3 = new HuntTask(bot, { targetKills: 10, targetAnimals: ['cow'] });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
