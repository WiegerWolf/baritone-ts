/**
 * Unit tests for Timer utilities
 */

import { describe, test, expect, beforeEach, afterEach, setSystemTime } from 'bun:test';
import { TimerGame, TimerReal, Stopwatch } from './index';

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

describe('TimerReal', () => {
  let now: number;

  beforeEach(() => {
    now = 1000000;
    setSystemTime(new Date(now));
  });

  afterEach(() => {
    setSystemTime();
  });

  test('should not be elapsed initially', () => {
    const timer = new TimerReal(1.0);
    expect(timer.elapsed()).toBe(false);
  });

  test('should be elapsed after duration', () => {
    const timer = new TimerReal(1.0);

    now += 1000; // 1 second
    setSystemTime(new Date(now));
    expect(timer.elapsed()).toBe(true);
  });

  test('should reset timer', () => {
    const timer = new TimerReal(1.0);

    now += 1000;
    setSystemTime(new Date(now));
    expect(timer.elapsed()).toBe(true);

    timer.reset();
    expect(timer.elapsed()).toBe(false);

    now += 1000;
    setSystemTime(new Date(now));
    expect(timer.elapsed()).toBe(true);
  });

  test('should calculate progress', () => {
    const timer = new TimerReal(2.0);

    now += 1000; // Half way
    setSystemTime(new Date(now));
    expect(timer.getProgress()).toBeCloseTo(0.5, 1);

    now += 1000; // Full
    setSystemTime(new Date(now));
    expect(timer.getProgress()).toBeCloseTo(1.0, 1);
  });

});


describe('Stopwatch', () => {
  let now: number;

  beforeEach(() => {
    now = 1000000;
    setSystemTime(new Date(now));
  });

  afterEach(() => {
    setSystemTime();
  });

  test('should start at zero', () => {
    const stopwatch = new Stopwatch();
    stopwatch.start();
    expect(stopwatch.getElapsedSeconds()).toBeCloseTo(0, 2);
  });

  test('should measure elapsed time', () => {
    const stopwatch = new Stopwatch();
    stopwatch.start();

    now += 2500; // 2.5 seconds
    setSystemTime(new Date(now));
    expect(stopwatch.getElapsedSeconds()).toBeCloseTo(2.5, 1);
  });

  test('should reset to zero', () => {
    const stopwatch = new Stopwatch();
    stopwatch.start();

    now += 5000;
    setSystemTime(new Date(now));
    stopwatch.reset();

    expect(stopwatch.getElapsedSeconds()).toBeCloseTo(0, 2);
  });

  test('should stop and start', () => {
    const stopwatch = new Stopwatch();
    stopwatch.start();

    now += 1000;
    setSystemTime(new Date(now));
    stopwatch.stop();

    now += 5000; // Time passes while stopped
    setSystemTime(new Date(now));
    expect(stopwatch.getElapsedSeconds()).toBeCloseTo(1.0, 1);

    stopwatch.start();
    now += 1000;
    setSystemTime(new Date(now));
    expect(stopwatch.getElapsedSeconds()).toBeCloseTo(2.0, 1);
  });

  test('should report running state', () => {
    const stopwatch = new Stopwatch();

    expect(stopwatch.isRunning()).toBe(false);

    stopwatch.start();
    expect(stopwatch.isRunning()).toBe(true);

    stopwatch.stop();
    expect(stopwatch.isRunning()).toBe(false);
  });
});
