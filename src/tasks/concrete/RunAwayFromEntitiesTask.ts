/**
 * RunAwayFromEntitiesTask - Flee from a set of entities
 *
 * When the bot is threatened by entities (hostile mobs,
 * dangerous players, etc.), this task calculates the best direction
 * to run and navigates away.
 *
 * The flee direction is calculated by summing the inverse vectors
 * from each threat entity, weighted by their distance.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { defaultGroundedShouldForce } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';

/**
 * Interface for tasks that require being grounded
 */
interface ITaskRequiresGroundedLocal {
  readonly requiresGrounded: boolean;
  shouldForce(interruptingCandidate: ITask | null): boolean;
}

/**
 * Entity supplier function type
 */
export type EntitySupplier = () => Entity[];

export class RunAwayFromEntitiesTask extends Task implements ITaskRequiresGroundedLocal {
  readonly requiresGrounded = true;

  protected entitySupplier: EntitySupplier;
  protected distanceToRun: number;
  private useXZOnly: boolean;
  private penaltyFactor: number;

  private progressChecker: MovementProgressChecker;
  private fleeTarget: Vec3 | null = null;

  /**
   * @param bot The mineflayer bot
   * @param entitySupplier Function that returns entities to flee from
   * @param distanceToRun Distance to maintain from entities
   * @param xzOnly If true, only consider horizontal distance
   * @param penalty Penalty factor for entities (higher = stronger flee)
   */
  constructor(
    bot: Bot,
    entitySupplier: EntitySupplier,
    distanceToRun: number = 15,
    xzOnly: boolean = false,
    penalty: number = 1.0
  ) {
    super(bot);
    this.entitySupplier = entitySupplier;
    this.distanceToRun = distanceToRun;
    this.useXZOnly = xzOnly;
    this.penaltyFactor = penalty;
    this.progressChecker = new MovementProgressChecker(bot);
  }

  shouldForce(interruptingCandidate: ITask | null): boolean {
    return defaultGroundedShouldForce(this.bot, interruptingCandidate);
  }

  get displayName(): string {
    return `RunAway(${this.distanceToRun}m)`;
  }

  onStart(): void {
    this.progressChecker.reset();
    this.fleeTarget = null;
  }

  onTick(): Task | null {
    const entities = this.entitySupplier();

    // Check if we're safe
    if (this.isSafeFromEntities(entities)) {
      return null;
    }

    // Calculate flee direction
    const fleeDir = this.calculateFleeDirection(entities);
    if (!fleeDir) {
      // No clear flee direction - just run
      this.bot.setControlState('forward', true);
      this.bot.setControlState('sprint', true);
      return null;
    }

    // Calculate target position
    const playerPos = this.bot.entity.position;
    this.fleeTarget = playerPos.plus(fleeDir.scaled(this.distanceToRun));

    // Check progress
    this.progressChecker.setProgress(playerPos);
    if (this.progressChecker.failed()) {
      // Not making progress - try different direction
      this.progressChecker.reset();
      const randomAngle = Math.random() * Math.PI * 2;
      const randomDir = new Vec3(Math.cos(randomAngle), 0, Math.sin(randomAngle));
      this.fleeTarget = playerPos.plus(randomDir.scaled(this.distanceToRun));
    }

    // Navigate to flee target
    return new GoToNearTask(
      this.bot,
      Math.floor(this.fleeTarget.x),
      Math.floor(this.fleeTarget.y),
      Math.floor(this.fleeTarget.z),
      2
    );
  }

  /**
   * Calculate the optimal flee direction based on entity positions
   */
  private calculateFleeDirection(entities: Entity[]): Vec3 | null {
    if (entities.length === 0) return null;

    const playerPos = this.bot.entity.position;
    let fleeDir = new Vec3(0, 0, 0);

    for (const entity of entities) {
      if (!entity || entity.isValid === false) continue;

      // Vector from entity to player
      let toPlayer = playerPos.minus(entity.position);

      if (this.useXZOnly) {
        toPlayer = new Vec3(toPlayer.x, 0, toPlayer.z);
      }

      const dist = toPlayer.norm();
      if (dist < 0.1) {
        // Entity is on top of us - random direction
        const angle = Math.random() * Math.PI * 2;
        toPlayer = new Vec3(Math.cos(angle), 0, Math.sin(angle));
      } else {
        // Normalize and weight by inverse distance
        const weight = this.penaltyFactor / (dist + 0.1);
        toPlayer = toPlayer.scaled(weight / dist);
      }

      fleeDir = fleeDir.plus(toPlayer);
    }

    // Normalize the flee direction
    const len = fleeDir.norm();
    if (len < 0.1) {
      return null; // No clear direction
    }

    return fleeDir.scaled(1 / len);
  }

  /**
   * Check if we're at a safe distance from all entities
   */
  private isSafeFromEntities(entities: Entity[]): boolean {
    const playerPos = this.bot.entity.position;
    const safeDist = this.distanceToRun * 1.1; // Slight buffer

    for (const entity of entities) {
      if (!entity || entity.isValid === false) continue;

      let dist: number;
      if (this.useXZOnly) {
        const dx = playerPos.x - entity.position.x;
        const dz = playerPos.z - entity.position.z;
        dist = Math.sqrt(dx * dx + dz * dz);
      } else {
        dist = playerPos.distanceTo(entity.position);
      }

      if (dist < safeDist) {
        return false;
      }
    }

    return true;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    const entities = this.entitySupplier();
    return this.isSafeFromEntities(entities);
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof RunAwayFromEntitiesTask)) return false;
    return Math.abs(this.distanceToRun - other.distanceToRun) < 1 &&
           this.useXZOnly === other.useXZOnly;
  }
}
