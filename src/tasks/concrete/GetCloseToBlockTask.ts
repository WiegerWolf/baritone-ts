/**
 * GetCloseToBlockTask - Get as close as possible to a block
 *
 * WHY: Some blocks may not be directly reachable (center of lava pool,
 * inside a wall, etc.). This task iteratively reduces the approach distance,
 * getting as close as pathfinding allows. Useful for approaching unreachable
 * goals like lava sources for bucket collection.
 *
 * Based on BaritonePlus GetCloseToBlockTask.java
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetWithinRangeOfBlockTask } from './GetWithinRangeOfBlockTask';

export class GetCloseToBlockTask extends Task {
  private targetPos: Vec3;
  private currentRange: number = Number.MAX_SAFE_INTEGER;

  constructor(bot: Bot, x: number, y: number, z: number) {
    super(bot);
    this.targetPos = new Vec3(x, y, z);
  }

  get displayName(): string {
    return `GetCloseTo(${this.targetPos.x},${this.targetPos.y},${this.targetPos.z} r=${this.currentRange})`;
  }

  onStart(): void {
    this.currentRange = Number.MAX_SAFE_INTEGER;
  }

  onTick(): Task | null {
    // If we've reached the current range, reduce it
    // This creates a strictly decreasing range, getting as close as possible
    if (this.isInCurrentRange()) {
      this.currentRange = this.getCurrentDistance() - 1;
    }

    // Stop if we can't get any closer
    if (this.currentRange < 1) {
      return null;
    }

    return new GetWithinRangeOfBlockTask(
      this.bot,
      Math.floor(this.targetPos.x),
      Math.floor(this.targetPos.y),
      Math.floor(this.targetPos.z),
      this.currentRange
    );
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    // We're finished when we can't get any closer
    return this.currentRange < 1;
  }

  // ---- Helper methods ----

  private getCurrentDistance(): number {
    return Math.floor(this.bot.entity.position.distanceTo(this.targetPos));
  }

  private isInCurrentRange(): boolean {
    const distSquared = this.bot.entity.position.distanceSquared(this.targetPos);
    return distSquared <= this.currentRange * this.currentRange;
  }

  /**
   * Get how close we managed to get
   */
  getAchievedDistance(): number {
    return this.getCurrentDistance();
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetCloseToBlockTask)) return false;
    return this.targetPos.equals(other.targetPos);
  }
}

/**
 * Helper function to get as close as possible to a block
 */
export function getCloseTo(
  bot: Bot,
  x: number,
  y: number,
  z: number
): GetCloseToBlockTask {
  return new GetCloseToBlockTask(bot, x, y, z);
}

/**
 * Helper function to get as close as possible to a position vector
 */
export function getCloseToVec(
  bot: Bot,
  pos: Vec3
): GetCloseToBlockTask {
  return new GetCloseToBlockTask(bot, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
}
