/**
 * LinearProgressChecker - Minimum Improvement Threshold
 * Based on AltoClef's LinearProgressChecker.java
 *
 * Checks that a numeric value improves by at least minProgress
 * within the timeout period. If progress stalls, marks as failed.
 *
 * Example: Require 0.1 blocks movement per 6 seconds
 * new LinearProgressChecker(bot, 6.0, 0.1)
 */

import type { Bot } from 'mineflayer';
import type { IProgressChecker } from './IProgressChecker';
import { TimerGame } from '../timers/TimerGame';

export class LinearProgressChecker implements IProgressChecker<number> {
  private timer: TimerGame;
  private minProgress: number;
  private lastProgress: number = 0;
  private hasFailed: boolean = false;
  private initialized: boolean = false;

  /**
   * Create a linear progress checker
   * @param bot The mineflayer bot
   * @param timeoutSeconds Time window for progress check
   * @param minProgress Minimum required improvement per time window
   */
  constructor(bot: Bot, timeoutSeconds: number, minProgress: number) {
    this.timer = new TimerGame(bot, timeoutSeconds);
    this.minProgress = minProgress;
  }

  setProgress(progress: number): void {
    // Initialize on first call
    if (!this.initialized) {
      this.lastProgress = progress;
      this.initialized = true;
      this.timer.reset();
      return;
    }

    // Check progress at each interval
    if (this.timer.elapsed()) {
      const improvement = progress - this.lastProgress;

      if (improvement < this.minProgress) {
        this.hasFailed = true;
      }

      this.lastProgress = progress;
      this.timer.reset();
    }
  }

  failed(): boolean {
    return this.hasFailed;
  }

  reset(): void {
    this.hasFailed = false;
    this.initialized = false;
    this.timer.reset();
  }

  /**
   * Get the current minimum progress threshold
   */
  getMinProgress(): number {
    return this.minProgress;
  }

  /**
   * Set the minimum progress threshold
   */
  setMinProgress(minProgress: number): void {
    this.minProgress = minProgress;
  }

  /**
   * Get time remaining until next check
   */
  getRemainingTime(): number {
    return this.timer.getRemainingTime();
  }
}
