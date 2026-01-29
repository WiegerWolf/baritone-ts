import { describe, test, expect, beforeEach, afterEach, setSystemTime } from 'bun:test';
import { Stopwatch } from './index';

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

  test('double start should not reset accumulated time', () => {
    const stopwatch = new Stopwatch();
    stopwatch.start();

    now += 1000;
    setSystemTime(new Date(now));

    // Second start while running should be a no-op
    stopwatch.start();

    now += 1000;
    setSystemTime(new Date(now));

    expect(stopwatch.getElapsedMillis()).toBe(2000);
  });

  test('double stop should not lose accumulated time', () => {
    const stopwatch = new Stopwatch();
    stopwatch.start();

    now += 1000;
    setSystemTime(new Date(now));
    stopwatch.stop();

    // Second stop while already stopped should be a no-op
    now += 5000;
    setSystemTime(new Date(now));
    stopwatch.stop();

    expect(stopwatch.getElapsedMillis()).toBe(1000);
  });

  test('getElapsedMillis when stopped should return accumulated only', () => {
    const stopwatch = new Stopwatch();
    stopwatch.start();

    now += 500;
    setSystemTime(new Date(now));
    stopwatch.stop();

    // Time passes but stopwatch is stopped
    now += 10000;
    setSystemTime(new Date(now));
    expect(stopwatch.getElapsedMillis()).toBe(500);
  });

  test('reset while running should reset start time', () => {
    const stopwatch = new Stopwatch();
    stopwatch.start();

    now += 3000;
    setSystemTime(new Date(now));
    stopwatch.reset();

    // After reset, accumulated = 0, startTime = now
    // But note: reset doesn't stop, so it's still not running
    // (reset sets accumulated=0, startTime=now, but doesn't change running)
    expect(stopwatch.getElapsedMillis()).toBeCloseTo(0, 0);
  });

  test('multiple stop/start cycles accumulate correctly', () => {
    const stopwatch = new Stopwatch();

    stopwatch.start();
    now += 100;
    setSystemTime(new Date(now));
    stopwatch.stop();

    stopwatch.start();
    now += 200;
    setSystemTime(new Date(now));
    stopwatch.stop();

    stopwatch.start();
    now += 300;
    setSystemTime(new Date(now));
    stopwatch.stop();

    expect(stopwatch.getElapsedMillis()).toBe(600);
  });
});
