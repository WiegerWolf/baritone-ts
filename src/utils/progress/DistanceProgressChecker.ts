/**
 * DistanceProgressChecker - Spatial Progress Tracking
 * Based on AltoClef's DistanceProgressChecker.java
 *
 * Wraps a LinearProgressChecker to track 3D distance progress.
 * Can track either increasing distance (moving away) or
 * decreasing distance (approaching a target).
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import type { IProgressChecker } from './IProgressChecker';
import { LinearProgressChecker } from './LinearProgressChecker';

export class DistanceProgressChecker implements IProgressChecker<Vec3> {
  private linearChecker: LinearProgressChecker;
  private startPosition: Vec3 | null = null;
  private reduceDistance: boolean;

  /**
   * Create a distance progress checker
   * @param bot The mineflayer bot
   * @param timeoutSeconds Time window for progress check
   * @param minProgressBlocks Minimum distance change per time window
   * @param reduceDistance If true, checks for decreasing distance (approaching)
   */
  constructor(
    bot: Bot,
    timeoutSeconds: number,
    minProgressBlocks: number,
    reduceDistance: boolean = false
  ) {
    this.linearChecker = new LinearProgressChecker(bot, timeoutSeconds, minProgressBlocks);
    this.reduceDistance = reduceDistance;
  }

  setProgress(position: Vec3): void {
    if (!this.startPosition) {
      this.startPosition = position.clone();
    }

    // Calculate distance from start
    let delta = position.distanceTo(this.startPosition);

    // Invert for approach tasks (distance should decrease)
    if (this.reduceDistance) {
      delta = -delta;
    }

    this.linearChecker.setProgress(delta);
  }

  failed(): boolean {
    return this.linearChecker.failed();
  }

  reset(): void {
    this.startPosition = null;
    this.linearChecker.reset();
  }

  /**
   * Set a new start position for distance calculations
   */
  setStartPosition(position: Vec3): void {
    this.startPosition = position.clone();
    this.linearChecker.reset();
  }

  /**
   * Get the current start position
   */
  getStartPosition(): Vec3 | null {
    return this.startPosition?.clone() ?? null;
  }

  /**
   * Check if configured for reduce distance mode
   */
  isReduceDistance(): boolean {
    return this.reduceDistance;
  }
}

/**
 * Create a distance checker that tracks approaching a target
 */
export function createApproachChecker(
  bot: Bot,
  timeoutSeconds: number,
  minProgressBlocks: number
): DistanceProgressChecker {
  return new DistanceProgressChecker(bot, timeoutSeconds, minProgressBlocks, true);
}

/**
 * Create a distance checker that tracks moving away from start
 */
export function createMovementChecker(
  bot: Bot,
  timeoutSeconds: number,
  minProgressBlocks: number
): DistanceProgressChecker {
  return new DistanceProgressChecker(bot, timeoutSeconds, minProgressBlocks, false);
}
