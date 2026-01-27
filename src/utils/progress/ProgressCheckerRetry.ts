/**
 * ProgressCheckerRetry - Fault Tolerance Decorator
 * Based on AltoClef's ProgressCheckerRetry.java
 *
 * Wraps another progress checker and allows multiple attempts
 * before actually failing. Useful for intermittent failures
 * like temporary server lag.
 *
 * Example: Allow 3 retries before considering truly stuck
 * new ProgressCheckerRetry(new DistanceProgressChecker(...), 3)
 */

import type { IProgressChecker } from './IProgressChecker';

export class ProgressCheckerRetry<T> implements IProgressChecker<T> {
  private subChecker: IProgressChecker<T>;
  private maxRetries: number;
  private retryCount: number = 0;

  /**
   * Create a retry wrapper
   * @param subChecker The underlying progress checker
   * @param maxRetries Maximum retries before truly failing
   */
  constructor(subChecker: IProgressChecker<T>, maxRetries: number) {
    this.subChecker = subChecker;
    this.maxRetries = maxRetries;
  }

  setProgress(progress: T): void {
    this.subChecker.setProgress(progress);
  }

  failed(): boolean {
    if (this.subChecker.failed()) {
      this.retryCount++;

      if (this.retryCount >= this.maxRetries) {
        return true; // All retries exhausted
      }

      // Reset for retry
      this.subChecker.reset();
    }

    return false;
  }

  reset(): void {
    this.retryCount = 0;
    this.subChecker.reset();
  }

  /**
   * Get current retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Get max retries
   */
  getMaxRetries(): number {
    return this.maxRetries;
  }

  /**
   * Set max retries
   */
  setMaxRetries(maxRetries: number): void {
    this.maxRetries = maxRetries;
  }

  /**
   * Get remaining retries
   */
  getRemainingRetries(): number {
    return this.maxRetries - this.retryCount;
  }

  /**
   * Get the underlying checker
   */
  getSubChecker(): IProgressChecker<T> {
    return this.subChecker;
  }
}
