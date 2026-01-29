import { describe, it, expect, mock } from 'bun:test';
import { GoToNearTask } from './index';

function createMockBot(): any {
  return {
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
        distanceTo: () => 5,
        offset: (x: number, y: number, z: number) => ({ x, y: 64 + y, z }),
        clone: () => ({ x: 0, y: 64, z: 0 }),
      },
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: () => null,
    entities: {},
    time: { timeOfDay: 6000, age: 0 },
    health: 20,
    food: 20,
    heldItem: null,
    pathfinder: {
      setGoal: mock(),
      goto: mock(),
      isMoving: () => false,
    },
    dig: mock(),
    placeBlock: mock(),
    equip: mock(),
    attack: mock(),
    activateItem: mock(),
    deactivateItem: mock(),
    activateBlock: mock(),
    activateEntity: mock(),
    toss: mock(),
    clickWindow: mock(),
    look: mock(),
    craft: mock(),
  };
}

describe('GoToNearTask', () => {
  it('should create with radius', () => {
    const bot = createMockBot();
    const task = new GoToNearTask(bot, 10, 64, 10, 5);
    expect(task.displayName).toContain('GoToNear');
  });

  it('should accept custom radius', () => {
    const bot = createMockBot();
    const task = new GoToNearTask(bot, 10, 64, 10, 8);
    expect(task.displayName).toContain('8');
  });
});
