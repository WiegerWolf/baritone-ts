import { describe, test, expect, beforeEach } from 'bun:test';
import { TimerGame } from './index';

describe('TimerGame', () => {
  let mockBot: any;

  beforeEach(() => {
    mockBot = {
      time: { age: 0 },
    };
  });

  test('should not be elapsed initially', () => {
    const timer = new TimerGame(mockBot, 1.0);
    expect(timer.elapsed()).toBe(false);
  });

  test('should be elapsed after duration', () => {
    const timer = new TimerGame(mockBot, 1.0); // 1 second = 20 ticks

    // Advance 20 ticks (1 second)
    mockBot.time.age = 20;
    expect(timer.elapsed()).toBe(true);
  });

  test('should reset timer', () => {
    const timer = new TimerGame(mockBot, 1.0);

    mockBot.time.age = 20;
    expect(timer.elapsed()).toBe(true);

    timer.reset();
    expect(timer.elapsed()).toBe(false);

    mockBot.time.age = 40;
    expect(timer.elapsed()).toBe(true);
  });

  test('should calculate progress', () => {
    const timer = new TimerGame(mockBot, 2.0); // 2 seconds = 40 ticks

    mockBot.time.age = 20; // Half way
    expect(timer.getProgress()).toBeCloseTo(0.5, 1);

    mockBot.time.age = 40; // Full
    expect(timer.getProgress()).toBeCloseTo(1.0, 1);
  });

  test('should allow progress to exceed 1 when past interval', () => {
    const timer = new TimerGame(mockBot, 1.0);

    mockBot.time.age = 100; // 5 seconds, but interval is 1 second
    // Progress can exceed 1.0 (design decision, not capped)
    expect(timer.getProgress()).toBe(5.0);
  });

  test('should get elapsed time in seconds', () => {
    const timer = new TimerGame(mockBot, 5.0);

    mockBot.time.age = 40; // 2 seconds
    // getProgress gives us 0.4 (40 ticks / 100 ticks for 5 seconds)
    expect(timer.getProgress()).toBeCloseTo(0.4, 1);
  });

  test('should get current ticks', () => {
    const timer = new TimerGame(mockBot, 1.0);
    mockBot.time.age = 42;
    expect(timer.getCurrentTicks()).toBe(42);
  });

  test('should get interval in ticks', () => {
    const timer = new TimerGame(mockBot, 2.5); // 2.5 seconds = 50 ticks
    expect(timer.getIntervalTicks()).toBe(50);
  });

  test('should set interval in ticks', () => {
    const timer = new TimerGame(mockBot, 1.0);
    timer.setIntervalTicks(60); // 60 ticks = 3 seconds
    expect(timer.getInterval()).toBe(3.0);
    expect(timer.getIntervalTicks()).toBe(60);
  });

  test('should get elapsed time', () => {
    const timer = new TimerGame(mockBot, 5.0);
    mockBot.time.age = 40; // 2 seconds
    expect(timer.getElapsedTime()).toBeCloseTo(2.0, 1);
  });

  test('should get remaining time', () => {
    const timer = new TimerGame(mockBot, 5.0);
    mockBot.time.age = 40; // 2 seconds elapsed
    expect(timer.getRemainingTime()).toBeCloseTo(3.0, 1);
  });

  test('should return 0 remaining time when elapsed', () => {
    const timer = new TimerGame(mockBot, 1.0);
    mockBot.time.age = 100; // 5 seconds elapsed, interval is 1s
    expect(timer.getRemainingTime()).toBe(0);
  });

  test('should force elapsed', () => {
    const timer = new TimerGame(mockBot, 10.0);
    expect(timer.elapsed()).toBe(false);
    timer.forceElapsed();
    expect(timer.elapsed()).toBe(true);
  });

  test('should reset with new interval', () => {
    const timer = new TimerGame(mockBot, 1.0);
    timer.resetWithInterval(3.0);
    expect(timer.getInterval()).toBe(3.0);
    expect(timer.elapsed()).toBe(false);
    mockBot.time.age = 60; // 3 seconds
    expect(timer.elapsed()).toBe(true);
  });

  test('should set interval without resetting', () => {
    const timer = new TimerGame(mockBot, 1.0);
    mockBot.time.age = 10; // 0.5 seconds
    timer.setInterval(0.3); // Set to 0.3 seconds (6 ticks)
    // Elapsed time is still 0.5s, which is > 0.3s
    expect(timer.elapsed()).toBe(true);
  });
});

describe('TimerGame edge cases', () => {
  let mockBot: any;

  beforeEach(() => {
    mockBot = {
      time: { age: 0 },
    };
  });

  test('should handle zero interval (always elapsed)', () => {
    const timer = new TimerGame(mockBot, 0);
    expect(timer.elapsed()).toBe(true);
  });

  test('should handle forceElapsed then reset cycle', () => {
    const timer = new TimerGame(mockBot, 10.0);
    timer.forceElapsed();
    expect(timer.elapsed()).toBe(true);

    timer.reset();
    expect(timer.elapsed()).toBe(false);

    mockBot.time.age = 200; // 10 seconds
    expect(timer.elapsed()).toBe(true);
  });

  test('should handle exact boundary (elapsed at exactly interval)', () => {
    const timer = new TimerGame(mockBot, 1.0); // 20 ticks
    mockBot.time.age = 19;
    expect(timer.elapsed()).toBe(false); // 0.95s < 1.0s

    mockBot.time.age = 20;
    expect(timer.elapsed()).toBe(true); // 1.0s >= 1.0s (inclusive)
  });

  test('should handle very small interval', () => {
    const timer = new TimerGame(mockBot, 0.05); // 1 tick
    mockBot.time.age = 1;
    expect(timer.elapsed()).toBe(true);
  });

  test('getProgress with zero interval should return Infinity', () => {
    const timer = new TimerGame(mockBot, 0);
    mockBot.time.age = 20;
    // elapsed / 0 = Infinity
    expect(timer.getProgress()).toBe(Infinity);
  });
});
