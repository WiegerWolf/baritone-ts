import { describe, it, expect } from 'bun:test';
import { DefendAreaTask } from './index';
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

describe('DefendAreaTask', () => {
  it('should create with center position', () => {
    const bot = createMockBot();
    const center = new Vec3(100, 64, 100);
    const task = new DefendAreaTask(bot, center);
    expect(task.displayName).toContain('DefendArea');
  });

  it('should create with custom radius', () => {
    const bot = createMockBot();
    const center = new Vec3(0, 64, 0);
    const task = new DefendAreaTask(bot, center, { radius: 32 });
    expect(task.getRadius()).toBe(32);
  });

  it('should start in PATROLLING state', () => {
    const bot = createMockBot();
    const center = new Vec3(0, 64, 0);
    const task = new DefendAreaTask(bot, center);
    task.onStart();
    expect(task.displayName).toContain('PATROLLING');
  });

  it('should track kill count', () => {
    const bot = createMockBot();
    const center = new Vec3(0, 64, 0);
    const task = new DefendAreaTask(bot, center);
    task.onStart();
    expect(task.getKillCount()).toBe(0);
  });

  it('should return defense center', () => {
    const bot = createMockBot();
    const center = new Vec3(50, 64, 50);
    const task = new DefendAreaTask(bot, center);
    const returnedCenter = task.getCenter();
    expect(returnedCenter.x).toBe(50);
    expect(returnedCenter.z).toBe(50);
  });

  it('should compare by center and radius', () => {
    const bot = createMockBot();
    const center1 = new Vec3(100, 64, 100);
    const center2 = new Vec3(100, 64, 100);
    const center3 = new Vec3(200, 64, 200);
    const task1 = new DefendAreaTask(bot, center1, { radius: 16 });
    const task2 = new DefendAreaTask(bot, center2, { radius: 16 });
    const task3 = new DefendAreaTask(bot, center3, { radius: 16 });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });

  it('should create with patrol disabled', () => {
    const bot = createMockBot();
    const center = new Vec3(0, 64, 0);
    const task = new DefendAreaTask(bot, center, { patrolWhenIdle: false });
    expect(task.displayName).toContain('DefendArea');
  });

  it('should create with duration limit', () => {
    const bot = createMockBot();
    const center = new Vec3(0, 64, 0);
    const task = new DefendAreaTask(bot, center, { continuous: false, duration: 60 });
    expect(task.displayName).toContain('DefendArea');
  });
});
