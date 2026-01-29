import { describe, it, expect } from 'bun:test';
import { BuildTask, BUILD_PATTERNS } from './index';
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

describe('BuildTask', () => {
  it('should create with pattern', () => {
    const bot = createMockBot();
    const task = new BuildTask(bot, {
      origin: new Vec3(0, 64, 0),
      pattern: BUILD_PATTERNS.CUBE_3X3,
      clearArea: true,
      verifyBuild: true,
      gatherRadius: 32,
    });
    expect(task.displayName).toContain('Build');
    expect(task.displayName).toContain('cube_3x3');
  });

  it('should create with platform pattern', () => {
    const bot = createMockBot();
    const task = new BuildTask(bot, {
      origin: new Vec3(0, 64, 0),
      pattern: BUILD_PATTERNS.PLATFORM_5X5,
      clearArea: true,
      verifyBuild: true,
      gatherRadius: 32,
    });
    expect(task.displayName).toContain('platform_5x5');
  });

  it('should start in ANALYZING state', () => {
    const bot = createMockBot();
    const task = new BuildTask(bot, {
      origin: new Vec3(0, 64, 0),
      pattern: BUILD_PATTERNS.CUBE_3X3,
      clearArea: true,
      verifyBuild: true,
      gatherRadius: 32,
    });
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });

  it('should track build progress', () => {
    const bot = createMockBot();
    const task = new BuildTask(bot, {
      origin: new Vec3(0, 64, 0),
      pattern: BUILD_PATTERNS.CUBE_3X3,
      clearArea: true,
      verifyBuild: true,
      gatherRadius: 32,
    });
    task.onStart();
    expect(task.getProgress()).toBe(0);
  });
});
