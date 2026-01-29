import { describe, it, expect } from 'bun:test';
import { ThrowEnderEyeTask } from './index';

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

describe('ThrowEnderEyeTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    bot.entity.yaw = 0;
    const task = new ThrowEnderEyeTask(bot);
    expect(task.displayName).toContain('ThrowEnderEye');
  });

  it('should start in PREPARING state', () => {
    const bot = createMockBot();
    bot.entity.yaw = 0;
    const task = new ThrowEnderEyeTask(bot);
    task.onStart();
    expect(task.displayName).toContain('PREPARING');
  });

  it('should have no result at start', () => {
    const bot = createMockBot();
    bot.entity.yaw = 0;
    const task = new ThrowEnderEyeTask(bot);
    task.onStart();
    expect(task.getResult()).toBeNull();
  });

  it('should have no direction at start', () => {
    const bot = createMockBot();
    bot.entity.yaw = 0;
    const task = new ThrowEnderEyeTask(bot);
    task.onStart();
    expect(task.getDirection()).toBeNull();
  });

  it('should have empty eye positions at start', () => {
    const bot = createMockBot();
    bot.entity.yaw = 0;
    const task = new ThrowEnderEyeTask(bot);
    task.onStart();
    expect(task.getEyePositions()).toEqual([]);
  });

  it('should create with custom pitch', () => {
    const bot = createMockBot();
    bot.entity.yaw = 0;
    const task = new ThrowEnderEyeTask(bot, { throwPitch: -45 });
    expect(task.displayName).toContain('ThrowEnderEye');
  });

  it('should compare as equal', () => {
    const bot = createMockBot();
    bot.entity.yaw = 0;
    const task1 = new ThrowEnderEyeTask(bot);
    const task2 = new ThrowEnderEyeTask(bot);
    expect(task1.isEqual(task2)).toBe(true);
  });
});
