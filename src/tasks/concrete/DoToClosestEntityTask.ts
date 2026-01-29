/**
 * DoToClosestEntityTask - Find and interact with closest matching entity
 * Based on BaritonePlus DoToClosestEntityTask.java
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { FollowEntityTask } from './FollowEntityTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import type { EntityFilter, EntityTaskFactory } from './AbstractDoToEntityTask';

/**
 * Task to find the closest entity matching criteria and run a task on it.
 *
 * WHY: Many operations need to find the closest entity of a type
 * (closest sheep to shear, closest hostile to attack, etc.) and do something with it.
 * This task handles the finding and proximity tracking while delegating the action.
 *
 * Based on BaritonePlus DoToClosestEntityTask.java
 */
export class DoToClosestEntityTask extends Task {
  private targetEntityTypes: string[];
  private entityFilter: EntityFilter;
  private taskFactory: EntityTaskFactory;
  private originSupplier: (() => Vec3) | null;

  private currentTarget: Entity | null = null;
  private currentTask: Task | null = null;
  private unreachableEntities: Set<number> = new Set();

  constructor(
    bot: Bot,
    taskFactory: EntityTaskFactory,
    entityTypes: string[],
    filter: EntityFilter = () => true,
    originSupplier: (() => Vec3) | null = null
  ) {
    super(bot);
    this.taskFactory = taskFactory;
    this.targetEntityTypes = entityTypes;
    this.entityFilter = filter;
    this.originSupplier = originSupplier;
  }

  get displayName(): string {
    const typeName = this.targetEntityTypes.length === 1
      ? this.targetEntityTypes[0]
      : `${this.targetEntityTypes.length} types`;
    return `DoToClosest(${typeName})`;
  }

  onStart(): void {
    this.currentTarget = null;
    this.currentTask = null;
    this.unreachableEntities.clear();
  }

  onTick(): Task | null {
    // Find closest valid entity
    const closest = this.findClosestEntity();

    if (!closest) {
      // No entity found - wander
      return new TimeoutWanderTask(this.bot, 15);
    }

    // Check if target changed
    if (this.currentTarget !== closest) {
      this.currentTarget = closest;
      this.currentTask = this.taskFactory(closest);
    }

    return this.currentTask;
  }

  private findClosestEntity(): Entity | null {
    const origin = this.originSupplier
      ? this.originSupplier()
      : this.bot.entity.position;

    let closest: Entity | null = null;
    let closestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;

      // Check type
      const entityName = entity.name ?? '';
      if (!this.targetEntityTypes.includes(entityName)) continue;

      // Check filter
      if (!this.entityFilter(entity)) continue;

      // Check if valid
      if (entity.isValid === false) continue;

      // Check if unreachable
      if (this.unreachableEntities.has(entity.id)) continue;

      // Check distance
      const dist = origin.distanceTo(entity.position);
      if (dist < closestDist) {
        closestDist = dist;
        closest = entity;
      }
    }

    return closest;
  }

  onStop(interruptTask: ITask | null): void {
    this.currentTarget = null;
    this.currentTask = null;
  }

  isFinished(): boolean {
    return this.currentTask !== null && this.currentTask.isFinished();
  }

  /**
   * Mark current entity as unreachable
   */
  markCurrentUnreachable(): void {
    if (this.currentTarget) {
      this.unreachableEntities.add(this.currentTarget.id);
      this.currentTarget = null;
      this.currentTask = null;
    }
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof DoToClosestEntityTask)) return false;
    return JSON.stringify(this.targetEntityTypes) === JSON.stringify(other.targetEntityTypes);
  }
}

/**
 * Helper function to create a kill entities task
 */
export function killEntities(bot: Bot, ...entityTypes: string[]): DoToClosestEntityTask {
  return new DoToClosestEntityTask(
    bot,
    (entity) => new KillEntitySubTask(bot, entity.id),
    entityTypes,
    (entity) => entity.isValid !== false
  );
}

/**
 * Simple subtask to kill a specific entity
 */
class KillEntitySubTask extends Task {
  private entityId: number;
  private attackTimer: TimerGame;

  constructor(bot: Bot, entityId: number) {
    super(bot);
    this.entityId = entityId;
    this.attackTimer = new TimerGame(bot, 0.5);
  }

  get displayName(): string {
    return `KillEntity(${this.entityId})`;
  }

  onTick(): Task | null {
    const entity = this.bot.entities[this.entityId];
    if (!entity || entity.isValid === false) {
      return null;
    }

    // Get closer if needed
    const dist = this.bot.entity.position.distanceTo(entity.position);
    if (dist > 4) {
      return new FollowEntityTask(this.bot, this.entityId, 2);
    }

    // Attack
    if (this.attackTimer.elapsed()) {
      try {
        this.bot.attack(entity);
        this.attackTimer.reset();
      } catch {
        // Will retry
      }
    }

    return null;
  }

  isFinished(): boolean {
    const entity = this.bot.entities[this.entityId];
    return !entity || entity.isValid === false;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof KillEntitySubTask)) return false;
    return this.entityId === other.entityId;
  }
}
