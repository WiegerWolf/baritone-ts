import { describe, it, expect, mock } from 'bun:test';
import { GoToBlockTask, MineBlockTask, CraftTask } from './index';

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

describe('Task equality', () => {
  it('GoToBlockTask should compare by position', () => {
    const bot = createMockBot();
    const task1 = new GoToBlockTask(bot, 10, 64, 10);
    const task2 = new GoToBlockTask(bot, 10, 64, 10);
    const task3 = new GoToBlockTask(bot, 20, 64, 20);

    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });

  it('MineBlockTask should compare by position', () => {
    const bot = createMockBot();
    const task1 = new MineBlockTask(bot, 10, 64, 10);
    const task2 = new MineBlockTask(bot, 10, 64, 10);
    const task3 = new MineBlockTask(bot, 11, 64, 10);

    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });

  it('CraftTask should compare by item and count', () => {
    const bot = createMockBot();
    const task1 = new CraftTask(bot, 'stick', 4);
    const task2 = new CraftTask(bot, 'stick', 4);
    const task3 = new CraftTask(bot, 'stick', 8);

    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
