/**
 * TimerReal - Wall Clock Based Timer
 * Based on AltoClef's TimerReal.java
 *
 * Uses wall-clock time for timing. This is NOT lag-immune but
 * is useful for timeouts and profiling.
 *
 * Use for:
 * - Timeout detection
 * - Profiling/benchmarking
 * - Human-facing time limits
 */

import { BaseTimer } from './BaseTimer';

/**
 * Timer based on real wall-clock time
 */
export class TimerReal extends BaseTimer {
  /**
   * Create a real-time timer
   * @param intervalSeconds The interval in seconds
   */
  constructor(intervalSeconds: number) {
    super(intervalSeconds);
  }

  /**
   * Get current wall-clock time in seconds
   */
  protected currentTime(): number {
    return Date.now() / 1000.0;
  }

  /**
   * Get current time in milliseconds
   */
  getCurrentMillis(): number {
    return Date.now();
  }

  /**
   * Get interval in milliseconds
   */
  getIntervalMillis(): number {
    return this.interval * 1000;
  }

  /**
   * Set interval in milliseconds
   */
  setIntervalMillis(millis: number): void {
    this.interval = millis / 1000.0;
  }
}

/**
 * Stopwatch utility using real time
 */
export class Stopwatch {
  private startTime: number = 0;
  private running: boolean = false;
  private accumulated: number = 0;

  /**
   * Start the stopwatch
   */
  start(): void {
    if (!this.running) {
      this.startTime = Date.now();
      this.running = true;
    }
  }

  /**
   * Stop the stopwatch
   */
  stop(): void {
    if (this.running) {
      this.accumulated += Date.now() - this.startTime;
      this.running = false;
    }
  }

  /**
   * Reset the stopwatch
   */
  reset(): void {
    this.accumulated = 0;
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time in milliseconds
   */
  getElapsedMillis(): number {
    if (this.running) {
      return this.accumulated + (Date.now() - this.startTime);
    }
    return this.accumulated;
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedSeconds(): number {
    return this.getElapsedMillis() / 1000.0;
  }

  /**
   * Check if the stopwatch is running
   */
  isRunning(): boolean {
    return this.running;
  }
}
