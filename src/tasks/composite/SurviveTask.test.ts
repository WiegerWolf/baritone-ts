import { describe, it, expect } from 'bun:test';
import { SurviveTask } from './index';

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

describe('SurviveTask', () => {
  it('should create with default goals', () => {
    const bot = createMockBot();
    const task = new SurviveTask(bot);
    expect(task.displayName).toContain('Survive');
  });

  it('should create with custom goals', () => {
    const bot = createMockBot();
    const task = new SurviveTask(bot, {
      minFoodLevel: 18,
      targetToolTier: 'diamond',
    });
    expect(task.displayName).toContain('Survive');
  });

  it('should never finish (continuous survival)', () => {
    const bot = createMockBot();
    const task = new SurviveTask(bot);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });

  it('should start in ASSESSING state', () => {
    const bot = createMockBot();
    const task = new SurviveTask(bot);
    task.onStart();
    expect(task.displayName).toContain('ASSESSING');
  });
});
