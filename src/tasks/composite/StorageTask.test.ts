import { describe, it, expect } from 'bun:test';
import { StorageTask, StorageOperation } from './index';

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

describe('StorageTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new StorageTask(bot);
    expect(task.displayName).toContain('Storage');
  });

  it('should create with deposit operation', () => {
    const bot = createMockBot();
    const task = new StorageTask(bot, { operation: StorageOperation.DEPOSIT });
    expect(task.displayName).toContain('DEPOSIT');
  });

  it('should create with withdraw operation', () => {
    const bot = createMockBot();
    const task = new StorageTask(bot, { operation: StorageOperation.WITHDRAW });
    expect(task.displayName).toContain('WITHDRAW');
  });

  it('should create with organize operation', () => {
    const bot = createMockBot();
    const task = new StorageTask(bot, { operation: StorageOperation.ORGANIZE });
    expect(task.displayName).toContain('ORGANIZE');
  });

  it('should start in FINDING_CONTAINER state', () => {
    const bot = createMockBot();
    const task = new StorageTask(bot);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });

  it('should track transferred count', () => {
    const bot = createMockBot();
    const task = new StorageTask(bot);
    task.onStart();
    expect(task.getTransferredCount()).toBe(0);
  });

  it('should accept target items', () => {
    const bot = createMockBot();
    const task = new StorageTask(bot, {
      operation: StorageOperation.DEPOSIT,
      targetItems: ['cobblestone', 'dirt'],
    });
    expect(task.displayName).toContain('DEPOSIT');
  });
});
