import { describe, test, expect, beforeEach, afterEach, setSystemTime } from 'bun:test';
import { TimerReal } from './index';

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

  test('should get current millis', () => {
    const timer = new TimerReal(1.0);
    expect(timer.getCurrentMillis()).toBe(now);
  });

  test('should get interval in millis', () => {
    const timer = new TimerReal(2.5);
    expect(timer.getIntervalMillis()).toBe(2500);
  });

  test('should set interval in millis', () => {
    const timer = new TimerReal(1.0);
    timer.setIntervalMillis(3000);
    expect(timer.getInterval()).toBe(3.0);
  });
});


describe('TimerReal edge cases', () => {
  let now: number;

  beforeEach(() => {
    now = 1000000;
    setSystemTime(new Date(now));
  });

  afterEach(() => {
    setSystemTime();
  });

  test('should handle zero interval (always elapsed)', () => {
    const timer = new TimerReal(0);
    expect(timer.elapsed()).toBe(true);
  });

  test('should handle forceElapsed', () => {
    const timer = new TimerReal(100.0);
    timer.forceElapsed();
    expect(timer.elapsed()).toBe(true);
  });

  test('should handle exact boundary', () => {
    const timer = new TimerReal(1.0);
    now += 999;
    setSystemTime(new Date(now));
    expect(timer.elapsed()).toBe(false);

    now += 1;
    setSystemTime(new Date(now));
    expect(timer.elapsed()).toBe(true);
  });
});
