import { describe, it, expect } from 'bun:test';
import { SleepTask } from './index';

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

describe('SleepTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new SleepTask(bot);
    expect(task.displayName).toContain('Sleep');
  });

  it('should create with only at night option', () => {
    const bot = createMockBot();
    const task = new SleepTask(bot, { onlyAtNight: true });
    expect(task.displayName).toContain('Sleep');
  });

  it('should create with place bed option', () => {
    const bot = createMockBot();
    const task = new SleepTask(bot, { placeBedIfNeeded: true });
    expect(task.displayName).toContain('Sleep');
  });

  it('should start in CHECKING_TIME state', () => {
    const bot = createMockBot();
    const task = new SleepTask(bot);
    task.onStart();
    expect(task.displayName).toContain('CHECKING_TIME');
  });

  it('should track sleeping status', () => {
    const bot = createMockBot();
    const task = new SleepTask(bot);
    task.onStart();
    expect(task.isCurrentlySleeping()).toBe(false);
  });

  it('should compare by config', () => {
    const bot = createMockBot();
    const task1 = new SleepTask(bot, { onlyAtNight: true });
    const task2 = new SleepTask(bot, { onlyAtNight: true });
    const task3 = new SleepTask(bot, { onlyAtNight: false });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
