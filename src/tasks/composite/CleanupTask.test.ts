import { describe, it, expect } from 'bun:test';
import { CleanupTask, CleanupMode } from './index';

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

describe('CleanupTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new CleanupTask(bot);
    expect(task.displayName).toContain('Cleanup');
  });

  it('should create with debris mode', () => {
    const bot = createMockBot();
    const task = new CleanupTask(bot, { mode: CleanupMode.CLEAR_DEBRIS });
    expect(task.displayName).toContain('CLEAR_DEBRIS');
  });

  it('should create with flatten mode', () => {
    const bot = createMockBot();
    const task = new CleanupTask(bot, { mode: CleanupMode.FLATTEN, targetY: 64 });
    expect(task.displayName).toContain('FLATTEN');
  });

  it('should create with custom radius', () => {
    const bot = createMockBot();
    const task = new CleanupTask(bot, { radius: 32 });
    expect(task.displayName).toContain('Cleanup');
  });

  it('should start in SCANNING state', () => {
    const bot = createMockBot();
    const task = new CleanupTask(bot);
    task.onStart();
    expect(task.displayName).toContain('SCANNING');
  });

  it('should track blocks cleaned', () => {
    const bot = createMockBot();
    const task = new CleanupTask(bot);
    task.onStart();
    expect(task.getBlocksCleaned()).toBe(0);
  });

  it('should track items collected', () => {
    const bot = createMockBot();
    const task = new CleanupTask(bot);
    task.onStart();
    expect(task.getItemsCollected()).toBe(0);
  });

  it('should compare by mode and radius', () => {
    const bot = createMockBot();
    const task1 = new CleanupTask(bot, { mode: CleanupMode.CLEAR_DEBRIS, radius: 16 });
    const task2 = new CleanupTask(bot, { mode: CleanupMode.CLEAR_DEBRIS, radius: 16 });
    const task3 = new CleanupTask(bot, { mode: CleanupMode.CLEAR_VEGETATION, radius: 16 });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
