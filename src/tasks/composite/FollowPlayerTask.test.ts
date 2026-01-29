import { describe, it, expect } from 'bun:test';
import { FollowPlayerTask } from './index';

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

describe('FollowPlayerTask', () => {
  it('should create with player name', () => {
    const bot = createMockBot();
    const task = new FollowPlayerTask(bot, 'TestPlayer');
    expect(task.displayName).toContain('Follow');
    expect(task.displayName).toContain('TestPlayer');
  });

  it('should create with custom distances', () => {
    const bot = createMockBot();
    const task = new FollowPlayerTask(bot, 'TestPlayer', {
      minDistance: 3,
      maxDistance: 8,
    });
    expect(task.displayName).toContain('Follow');
  });

  it('should start in SEARCHING state', () => {
    const bot = createMockBot();
    const task = new FollowPlayerTask(bot, 'TestPlayer');
    task.onStart();
    expect(task.displayName).toContain('SEARCHING');
  });

  it('should have no target at start', () => {
    const bot = createMockBot();
    const task = new FollowPlayerTask(bot, 'TestPlayer');
    task.onStart();
    expect(task.getTargetPlayer()).toBeNull();
  });

  it('should return infinite distance when no target', () => {
    const bot = createMockBot();
    const task = new FollowPlayerTask(bot, 'TestPlayer');
    task.onStart();
    expect(task.getDistanceToTarget()).toBe(Infinity);
  });

  it('should not be following at start', () => {
    const bot = createMockBot();
    const task = new FollowPlayerTask(bot, 'TestPlayer');
    task.onStart();
    expect(task.isFollowing()).toBe(false);
  });

  it('should compare by player name', () => {
    const bot = createMockBot();
    const task1 = new FollowPlayerTask(bot, 'Player1');
    const task2 = new FollowPlayerTask(bot, 'Player1');
    const task3 = new FollowPlayerTask(bot, 'Player2');
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });

  it('should create with duration', () => {
    const bot = createMockBot();
    const task = new FollowPlayerTask(bot, 'TestPlayer', { duration: 60 });
    expect(task.displayName).toContain('Follow');
  });

  it('should create with mimic enabled', () => {
    const bot = createMockBot();
    const task = new FollowPlayerTask(bot, 'TestPlayer', { mimicActions: true });
    expect(task.displayName).toContain('Follow');
  });
});
