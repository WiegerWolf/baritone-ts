/**
 * GetToEntityTask - Navigate to an entity's position
 *
 * Get the bot close enough to an entity to interact with it.
 * Used for approaching dropped items, mobs, players, etc.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { defaultGroundedShouldForce } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';

export class GetToEntityTask extends Task {
  readonly requiresGrounded = true;

  private entityId: number;
  private closeEnoughDist: number;
  private progressChecker: MovementProgressChecker;

  constructor(bot: Bot, entityId: number, closeEnoughDist: number = 1.5) {
    super(bot);
    this.entityId = entityId;
    this.closeEnoughDist = closeEnoughDist;
    this.progressChecker = new MovementProgressChecker(bot);
  }

  shouldForce(interruptingCandidate: ITask | null): boolean {
    return defaultGroundedShouldForce(this.bot, interruptingCandidate);
  }

  get displayName(): string {
    const entity = this.bot.entities[this.entityId];
    const name = entity?.name ?? 'unknown';
    return `GetToEntity(${name})`;
  }

  onStart(): void {
    this.progressChecker.reset();
  }

  onTick(): Task | null {
    const entity = this.bot.entities[this.entityId];
    if (!entity || entity.isValid === false) {
      return null;
    }

    // Check distance
    const dist = this.bot.entity.position.distanceTo(entity.position);
    if (dist <= this.closeEnoughDist) {
      return null; // Close enough
    }

    // Check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      // Not making progress
      this.progressChecker.reset();
      return new TimeoutWanderTask(this.bot, 5, true);
    }

    // Navigate to entity position
    const pos = entity.position;
    return new GoToNearTask(
      this.bot,
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z),
      Math.ceil(this.closeEnoughDist)
    );
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    const entity = this.bot.entities[this.entityId];
    if (!entity || entity.isValid === false) {
      return true; // Entity gone
    }

    const dist = this.bot.entity.position.distanceTo(entity.position);
    return dist <= this.closeEnoughDist;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetToEntityTask)) return false;
    return this.entityId === other.entityId;
  }
}
