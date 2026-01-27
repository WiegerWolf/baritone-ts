/**
 * BaseTimer - Abstract Timer Base Class
 * Based on AltoClef's BaseTimer.java
 *
 * Uses the Template Method pattern - subclasses implement currentTime()
 * to determine how time is measured (server ticks vs wall clock).
 */

/**
 * Abstract base class for timers
 */
export abstract class BaseTimer {
  protected prevTime: number = 0;
  protected interval: number;

  /**
   * Create a timer with the given interval
   * @param intervalSeconds The interval in seconds
   */
  constructor(intervalSeconds: number) {
    this.interval = intervalSeconds;
    this.reset();
  }

  /**
   * Get the current time in seconds.
   * Subclasses implement this for different time sources.
   */
  protected abstract currentTime(): number;

  /**
   * Check if the interval has elapsed since the last reset
   */
  elapsed(): boolean {
    return (this.currentTime() - this.prevTime) >= this.interval;
  }

  /**
   * Get time elapsed since last reset (in seconds)
   */
  getElapsedTime(): number {
    return this.currentTime() - this.prevTime;
  }

  /**
   * Get remaining time until interval elapses (in seconds)
   * Returns 0 if already elapsed
   */
  getRemainingTime(): number {
    const remaining = this.interval - (this.currentTime() - this.prevTime);
    return Math.max(0, remaining);
  }

  /**
   * Reset the timer to start counting from now
   */
  reset(): void {
    this.prevTime = this.currentTime();
  }

  /**
   * Reset the timer and set a new interval
   */
  resetWithInterval(intervalSeconds: number): void {
    this.interval = intervalSeconds;
    this.reset();
  }

  /**
   * Get the current interval
   */
  getInterval(): number {
    return this.interval;
  }

  /**
   * Set the interval (without resetting)
   */
  setInterval(intervalSeconds: number): void {
    this.interval = intervalSeconds;
  }

  /**
   * Force the timer to be elapsed (useful for initial trigger)
   */
  forceElapsed(): void {
    this.prevTime = this.currentTime() - this.interval - 1;
  }

  /**
   * Get progress through the interval (0.0 to 1.0+)
   */
  getProgress(): number {
    return this.getElapsedTime() / this.interval;
  }
}
