/**
 * GetWithinRangeOfBlockTask - Navigate within range of a block
 *
 * WHY: Some tasks just need to be near a block, not at it exactly.
 * This task navigates to be within a specified distance of a target block.
 *
 * Based on BaritonePlus GetWithinRangeOfBlockTask.java
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';

export class GetWithinRangeOfBlockTask extends Task {
  private targetPos: Vec3;
  private range: number;
  private finished: boolean = false;

  constructor(bot: Bot, x: number, y: number, z: number, range: number) {
    super(bot);
    this.targetPos = new Vec3(x, y, z);
    this.range = range;
  }

  get displayName(): string {
    return `GetWithinRange(${this.targetPos.x},${this.targetPos.y},${this.targetPos.z} r=${this.range})`;
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    const dist = this.bot.entity.position.distanceTo(this.targetPos);

    if (dist <= this.range) {
      this.finished = true;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.targetPos.x),
      Math.floor(this.targetPos.y),
      Math.floor(this.targetPos.z),
      this.range
    );
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.finished ||
           this.bot.entity.position.distanceTo(this.targetPos) <= this.range;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetWithinRangeOfBlockTask)) return false;
    return this.targetPos.equals(other.targetPos) && this.range === other.range;
  }
}

/**
 * Helper to get within range of a block
 */
export function getWithinRangeOf(
  bot: Bot,
  x: number,
  y: number,
  z: number,
  range: number
): GetWithinRangeOfBlockTask {
  return new GetWithinRangeOfBlockTask(bot, x, y, z, range);
}
