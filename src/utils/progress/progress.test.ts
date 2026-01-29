/**
 * Tests for progress checker utilities
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Vec3 } from 'vec3';
import { DistanceProgressChecker, createApproachChecker, createMovementChecker } from './DistanceProgressChecker';
import { LinearProgressChecker } from './LinearProgressChecker';

function createMockBot(age: number = 0): any {
  return {
    time: { age },
  };
}

describe('LinearProgressChecker', () => {
  test('should not be failed initially', () => {
    const bot = createMockBot();
    const checker = new LinearProgressChecker(bot, 1.0, 0.5);
    expect(checker.failed()).toBe(false);
  });

  test('should initialize on first setProgress call', () => {
    const bot = createMockBot();
    const checker = new LinearProgressChecker(bot, 1.0, 0.5);
    checker.setProgress(10);
    expect(checker.failed()).toBe(false);
  });

  test('should not fail when progress exceeds threshold', () => {
    const bot = createMockBot();
    const checker = new LinearProgressChecker(bot, 1.0, 0.5);

    checker.setProgress(0);
    // Advance time past timeout
    bot.time.age = 20; // 1 second
    checker.setProgress(1.0); // Improved by 1.0 > 0.5 threshold

    expect(checker.failed()).toBe(false);
  });

  test('should fail when progress is insufficient', () => {
    const bot = createMockBot();
    const checker = new LinearProgressChecker(bot, 1.0, 0.5);

    checker.setProgress(0);
    // Advance time past timeout
    bot.time.age = 20; // 1 second
    checker.setProgress(0.1); // Only improved 0.1, threshold is 0.5

    expect(checker.failed()).toBe(true);
  });

  test('should reset failed state', () => {
    const bot = createMockBot();
    const checker = new LinearProgressChecker(bot, 1.0, 0.5);

    checker.setProgress(0);
    bot.time.age = 20;
    checker.setProgress(0.1);
    expect(checker.failed()).toBe(true);

    checker.reset();
    expect(checker.failed()).toBe(false);
  });

  test('should get and set min progress', () => {
    const bot = createMockBot();
    const checker = new LinearProgressChecker(bot, 1.0, 0.5);

    expect(checker.getMinProgress()).toBe(0.5);
    checker.setMinProgress(1.0);
    expect(checker.getMinProgress()).toBe(1.0);
  });

  test('should get remaining time', () => {
    const bot = createMockBot();
    const checker = new LinearProgressChecker(bot, 2.0, 0.5);

    checker.setProgress(0); // Initialize
    bot.time.age = 20; // 1 second passed
    expect(checker.getRemainingTime()).toBeCloseTo(1.0, 1);
  });
});

describe('DistanceProgressChecker', () => {
  test('should not be failed initially', () => {
    const bot = createMockBot();
    const checker = new DistanceProgressChecker(bot, 5.0, 1.0);
    expect(checker.failed()).toBe(false);
  });

  test('should set start position on first progress call', () => {
    const bot = createMockBot();
    const checker = new DistanceProgressChecker(bot, 5.0, 1.0);

    expect(checker.getStartPosition()).toBeNull();
    checker.setProgress(new Vec3(10, 64, 20));
    expect(checker.getStartPosition()).not.toBeNull();
    expect(checker.getStartPosition()!.x).toBe(10);
  });

  test('should reset start position', () => {
    const bot = createMockBot();
    const checker = new DistanceProgressChecker(bot, 5.0, 1.0);

    checker.setProgress(new Vec3(10, 64, 20));
    checker.reset();
    expect(checker.getStartPosition()).toBeNull();
  });

  test('should allow setting start position explicitly', () => {
    const bot = createMockBot();
    const checker = new DistanceProgressChecker(bot, 5.0, 1.0);

    checker.setStartPosition(new Vec3(100, 64, 200));
    const pos = checker.getStartPosition();
    expect(pos!.x).toBe(100);
    expect(pos!.z).toBe(200);
  });

  test('should report reduce distance mode', () => {
    const bot = createMockBot();
    const checker1 = new DistanceProgressChecker(bot, 5.0, 1.0, false);
    const checker2 = new DistanceProgressChecker(bot, 5.0, 1.0, true);

    expect(checker1.isReduceDistance()).toBe(false);
    expect(checker2.isReduceDistance()).toBe(true);
  });

  test('should clone positions to prevent mutation', () => {
    const bot = createMockBot();
    const checker = new DistanceProgressChecker(bot, 5.0, 1.0);

    const pos = new Vec3(10, 64, 20);
    checker.setStartPosition(pos);
    pos.x = 999; // Mutate original

    expect(checker.getStartPosition()!.x).toBe(10); // Should be unchanged
  });
});

describe('createApproachChecker', () => {
  test('should create checker in reduce distance mode', () => {
    const bot = createMockBot();
    const checker = createApproachChecker(bot, 5.0, 1.0);
    expect(checker.isReduceDistance()).toBe(true);
  });
});

describe('createMovementChecker', () => {
  test('should create checker in normal distance mode', () => {
    const bot = createMockBot();
    const checker = createMovementChecker(bot, 5.0, 1.0);
    expect(checker.isReduceDistance()).toBe(false);
  });
});
