import { describe, it, expect, mock } from 'bun:test';
import { PlaceAgainstTask } from './index';
import { Vec3 } from 'vec3';

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

describe('PlaceAgainstTask', () => {
  it('should create with against coordinates and face', () => {
    const bot = createMockBot();
    const task = new PlaceAgainstTask(bot, 10, 63, 10, new Vec3(0, 1, 0), 'dirt');
    expect(task.displayName).toContain('PlaceAgainst');
  });
});
