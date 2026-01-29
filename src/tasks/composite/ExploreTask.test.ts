import { describe, it, expect } from 'bun:test';
import { ExploreTask, ExplorePattern } from './index';

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

describe('ExploreTask', () => {
  it('should create with spiral pattern', () => {
    const bot = createMockBot();
    const task = new ExploreTask(bot, { pattern: ExplorePattern.SPIRAL });
    expect(task.displayName).toContain('Explore');
    expect(task.displayName).toContain('SPIRAL');
  });

  it('should create with random pattern', () => {
    const bot = createMockBot();
    const task = new ExploreTask(bot, { pattern: ExplorePattern.RANDOM });
    expect(task.displayName).toContain('RANDOM');
  });

  it('should track explored chunks', () => {
    const bot = createMockBot();
    const task = new ExploreTask(bot);
    task.onStart();
    expect(task.getExploredCount()).toBe(1); // Starting chunk
  });
});
