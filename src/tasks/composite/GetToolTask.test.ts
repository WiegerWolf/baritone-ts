import { describe, it, expect } from 'bun:test';
import { GetToolTask } from './index';

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

describe('GetToolTask', () => {
  it('should create for pickaxe', () => {
    const bot = createMockBot();
    const task = new GetToolTask(bot, 'pickaxe');
    expect(task.displayName).toBe('GetTool(pickaxe)');
  });

  it('should create for axe with minimum tier', () => {
    const bot = createMockBot();
    const task = new GetToolTask(bot, 'axe', 'stone');
    expect(task.displayName).toBe('GetTool(axe)');
  });

  it('should start in CHECKING_INVENTORY state', () => {
    const bot = createMockBot();
    const task = new GetToolTask(bot, 'sword');
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });
});
