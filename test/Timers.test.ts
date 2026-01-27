/**
 * Unit tests for Timer utilities
 */

import { TimerGame, TimerReal, Stopwatch } from '../src/utils/timers';

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
});

describe('TimerReal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should not be elapsed initially', () => {
    const timer = new TimerReal(1.0);
    expect(timer.elapsed()).toBe(false);
  });

  test('should be elapsed after duration', () => {
    const timer = new TimerReal(1.0);

    jest.advanceTimersByTime(1000); // 1 second
    expect(timer.elapsed()).toBe(true);
  });

  test('should reset timer', () => {
    const timer = new TimerReal(1.0);

    jest.advanceTimersByTime(1000);
    expect(timer.elapsed()).toBe(true);

    timer.reset();
    expect(timer.elapsed()).toBe(false);

    jest.advanceTimersByTime(1000);
    expect(timer.elapsed()).toBe(true);
  });

  test('should calculate progress', () => {
    const timer = new TimerReal(2.0);

    jest.advanceTimersByTime(1000); // Half way
    expect(timer.getProgress()).toBeCloseTo(0.5, 1);

    jest.advanceTimersByTime(1000); // Full
    expect(timer.getProgress()).toBeCloseTo(1.0, 1);
  });

});


describe('Stopwatch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should start at zero', () => {
    const stopwatch = new Stopwatch();
    stopwatch.start();
    expect(stopwatch.getElapsedSeconds()).toBeCloseTo(0, 2);
  });

  test('should measure elapsed time', () => {
    const stopwatch = new Stopwatch();
    stopwatch.start();

    jest.advanceTimersByTime(2500); // 2.5 seconds
    expect(stopwatch.getElapsedSeconds()).toBeCloseTo(2.5, 1);
  });

  test('should reset to zero', () => {
    const stopwatch = new Stopwatch();
    stopwatch.start();

    jest.advanceTimersByTime(5000);
    stopwatch.reset();

    expect(stopwatch.getElapsedSeconds()).toBeCloseTo(0, 2);
  });

  test('should stop and start', () => {
    const stopwatch = new Stopwatch();
    stopwatch.start();

    jest.advanceTimersByTime(1000);
    stopwatch.stop();

    jest.advanceTimersByTime(5000); // Time passes while stopped
    expect(stopwatch.getElapsedSeconds()).toBeCloseTo(1.0, 1);

    stopwatch.start();
    jest.advanceTimersByTime(1000);
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
