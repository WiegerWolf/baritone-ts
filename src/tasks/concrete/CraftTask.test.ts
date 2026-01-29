import { describe, it, expect, mock } from 'bun:test';
import { CraftTask } from './index';

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

describe('CraftTask', () => {
  it('should create with item name', () => {
    const bot = createMockBot();
    const task = new CraftTask(bot, 'crafting_table');
    expect(task.displayName).toContain('Craft');
  });

  it('should accept count parameter', () => {
    const bot = createMockBot();
    const task = new CraftTask(bot, 'stick', 4);
    expect(task.displayName).toContain('stick');
  });
});
