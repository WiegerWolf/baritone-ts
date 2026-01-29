/**
 * GetToYTask - Navigate to a specific Y level
 *
 * Get the bot to a specific altitude, useful for
 * reaching mining levels or escaping caves.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { defaultGroundedShouldForce } from '../interfaces';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';
import { TimeoutWanderTask } from './MovementUtilTask';

/**
 * Interface for tasks that require being grounded (simplified for this file)
 */
interface ITaskRequiresGroundedLocal {
  readonly requiresGrounded: boolean;
  shouldForce(interruptingCandidate: ITask | null): boolean;
}

export class GetToYTask extends Task implements ITaskRequiresGroundedLocal {
  readonly requiresGrounded = true;

  private targetY: number;
  private tolerance: number;
  private progressChecker: MovementProgressChecker;

  constructor(bot: Bot, targetY: number, tolerance: number = 2) {
    super(bot);
    this.targetY = targetY;
    this.tolerance = tolerance;
    this.progressChecker = new MovementProgressChecker(bot);
  }

  /**
   * Implementation of ITaskRequiresGrounded.shouldForce
   */
  shouldForce(interruptingCandidate: ITask | null): boolean {
    return defaultGroundedShouldForce(this.bot, interruptingCandidate);
  }

  get displayName(): string {
    return `GetToY(${this.targetY})`;
  }

  onStart(): void {
    this.progressChecker.reset();
  }

  onTick(): Task | null {
    const currentY = this.bot.entity.position.y;

    // Check if at target level
    if (Math.abs(currentY - this.targetY) <= this.tolerance) {
      return null;
    }

    // Update and check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      // Stuck - try wandering
      this.progressChecker.reset();
      return new TimeoutWanderTask(this.bot, 5);
    }

    // Need to go up
    if (currentY < this.targetY) {
      // Try to find upward path
      this.bot.setControlState('jump', true);
      this.bot.setControlState('forward', true);
    } else {
      // Need to go down - just walk around and look for downward paths
      this.bot.setControlState('forward', true);
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    const currentY = this.bot.entity.position.y;
    return Math.abs(currentY - this.targetY) <= this.tolerance;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetToYTask)) return false;
    return this.targetY === other.targetY;
  }
}
