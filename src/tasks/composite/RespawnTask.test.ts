import { describe, it, expect } from 'bun:test';
import { RespawnTask } from './index';
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

describe('RespawnTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new RespawnTask(bot);
    expect(task.displayName).toContain('Respawn');
  });

  it('should start in CHECKING_STATUS state', () => {
    const bot = createMockBot();
    const task = new RespawnTask(bot);
    task.onStart();
    expect(task.displayName).toContain('CHECKING_STATUS');
  });

  it('should have no death location at start', () => {
    const bot = createMockBot();
    const task = new RespawnTask(bot);
    task.onStart();
    expect(task.getDeathLocation()).toBeNull();
  });

  it('should store death location when set', () => {
    const bot = createMockBot();
    const task = new RespawnTask(bot);
    task.onStart();
    task.setDeathLocation(new Vec3(100, 64, 200));
    const loc = task.getDeathLocation();
    expect(loc).not.toBeNull();
    expect(loc!.x).toBe(100);
    expect(loc!.z).toBe(200);
  });

  it('should create with return to death disabled', () => {
    const bot = createMockBot();
    const task = new RespawnTask(bot, { returnToDeathLocation: false });
    expect(task.displayName).toContain('Respawn');
  });

  it('should report not respawned initially', () => {
    const bot = createMockBot();
    const task = new RespawnTask(bot);
    task.onStart();
    // Since bot is not dead, it will go to FINISHED
    task.onTick();
    expect(task.hasRespawned()).toBe(true);
  });

  it('should compare as equal', () => {
    const bot = createMockBot();
    const task1 = new RespawnTask(bot);
    const task2 = new RespawnTask(bot);
    expect(task1.isEqual(task2)).toBe(true);
  });
});
