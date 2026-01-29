import { describe, it, expect, mock } from 'bun:test';
import { SmeltTask, isFuel, getFuelBurnTime } from './index';

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

describe('SmeltTask', () => {
  it('should create with input and output item', () => {
    const bot = createMockBot();
    const task = new SmeltTask(bot, 'iron_ore', 'iron_ingot', 3);
    expect(task.displayName).toContain('Smelt');
  });

  it('should start not finished', () => {
    const bot = createMockBot();
    const task = new SmeltTask(bot, 'raw_iron', 'iron_ingot', 1);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });
});

describe('Fuel utilities', () => {
  it('should identify coal as fuel', () => {
    expect(isFuel('coal')).toBe(true);
  });

  it('should identify charcoal as fuel', () => {
    expect(isFuel('charcoal')).toBe(true);
  });

  it('should identify logs as fuel', () => {
    expect(isFuel('oak_log')).toBe(true);
    expect(isFuel('spruce_log')).toBe(true);
  });

  it('should identify planks as fuel', () => {
    expect(isFuel('oak_planks')).toBe(true);
  });

  it('should not identify stone as fuel', () => {
    expect(isFuel('stone')).toBe(false);
  });

  it('should return correct burn time for coal', () => {
    expect(getFuelBurnTime('coal')).toBe(1600);
  });

  it('should return correct burn time for planks', () => {
    expect(getFuelBurnTime('oak_planks')).toBe(300);
  });
});
