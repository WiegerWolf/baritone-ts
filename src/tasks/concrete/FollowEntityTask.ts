/**
 * FollowEntityTask - Follow an entity
 */

import type { Bot } from 'mineflayer';
import type { ITask } from '../interfaces';
import { Goal } from '../../types';
import { GoalBlock, GoalNear } from '../../goals';
import { GoToTask } from './GoToTask';

export class FollowEntityTask extends GoToTask {
  private entityId: number;
  private followDistance: number;

  constructor(bot: Bot, entityId: number, followDistance: number = 3) {
    super(bot);
    this.entityId = entityId;
    this.followDistance = followDistance;
    this.recalculateInterval = 10; // Recalculate more frequently for moving targets
  }

  get displayName(): string {
    const entity = this.bot.entities[this.entityId];
    const name = entity ? (entity.username || entity.name || 'entity') : 'unknown';
    return `Follow(${name})`;
  }

  getGoal(): Goal {
    const entity = this.bot.entities[this.entityId];
    if (!entity) {
      // Entity gone - return current position as goal
      const pos = this.bot.entity.position;
      return new GoalBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
    }

    return new GoalNear(
      Math.floor(entity.position.x),
      Math.floor(entity.position.y),
      Math.floor(entity.position.z),
      this.followDistance
    );
  }

  isFinished(): boolean {
    // Never finished - follows until interrupted
    const entity = this.bot.entities[this.entityId];
    if (!entity) return true; // Entity gone

    // Check if within follow distance
    const dist = this.bot.entity.position.distanceTo(entity.position);
    return dist <= this.followDistance;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof FollowEntityTask)) return false;
    return this.entityId === other.entityId;
  }
}
