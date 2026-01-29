import { describe, it, expect } from 'bun:test';
import { EscapeDangerTask, DangerType } from './index';

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

describe('EscapeDangerTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new EscapeDangerTask(bot);
    expect(task.displayName).toContain('EscapeDanger');
  });

  it('should start in ASSESSING state', () => {
    const bot = createMockBot();
    const task = new EscapeDangerTask(bot);
    task.onStart();
    expect(task.displayName).toContain('ASSESSING');
  });

  it('should have no danger at start', () => {
    const bot = createMockBot();
    const task = new EscapeDangerTask(bot);
    task.onStart();
    expect(task.getCurrentDanger()).toBe(DangerType.NONE);
  });

  it('should have no safe spot at start', () => {
    const bot = createMockBot();
    const task = new EscapeDangerTask(bot);
    task.onStart();
    expect(task.getSafeSpot()).toBeNull();
  });

  it('should create with lava-only config', () => {
    const bot = createMockBot();
    const task = new EscapeDangerTask(bot, {
      checkLava: true,
      checkFire: false,
      checkDrowning: false,
    });
    expect(task.displayName).toContain('EscapeDanger');
  });

  it('should compare as equal', () => {
    const bot = createMockBot();
    const task1 = new EscapeDangerTask(bot);
    const task2 = new EscapeDangerTask(bot);
    expect(task1.isEqual(task2)).toBe(true);
  });
});
