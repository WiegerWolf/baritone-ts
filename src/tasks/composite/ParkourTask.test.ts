import { describe, it, expect } from 'bun:test';
import { ParkourTask, ParkourMoveType } from './index';
import { Vec3 } from 'vec3';

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

describe('ParkourTask', () => {
  it('should create with target position', () => {
    const bot = createMockBot();
    const target = new Vec3(100, 64, 100);
    const task = new ParkourTask(bot, target);
    expect(task.displayName).toContain('Parkour');
  });

  it('should create with sprint jump enabled', () => {
    const bot = createMockBot();
    const target = new Vec3(50, 64, 50);
    const task = new ParkourTask(bot, target, { allowSprintJump: true });
    expect(task.displayName).toContain('Parkour');
  });

  it('should create with ladder climbing enabled', () => {
    const bot = createMockBot();
    const target = new Vec3(0, 80, 0);
    const task = new ParkourTask(bot, target, { allowLadders: true });
    expect(task.displayName).toContain('Parkour');
  });

  it('should start in ANALYZING state', () => {
    const bot = createMockBot();
    const target = new Vec3(10, 64, 10);
    const task = new ParkourTask(bot, target);
    task.onStart();
    expect(task.displayName).toContain('ANALYZING');
  });

  it('should track current move type', () => {
    const bot = createMockBot();
    const target = new Vec3(10, 64, 10);
    const task = new ParkourTask(bot, target);
    task.onStart();
    expect(task.getCurrentMoveType()).toBeDefined();
  });

  it('should compare by target position', () => {
    const bot = createMockBot();
    const target1 = new Vec3(100, 64, 100);
    const target2 = new Vec3(100, 64, 100);
    const target3 = new Vec3(200, 64, 200);
    const task1 = new ParkourTask(bot, target1);
    const task2 = new ParkourTask(bot, target2);
    const task3 = new ParkourTask(bot, target3);
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
