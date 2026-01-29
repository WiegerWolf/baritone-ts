/**
 * AbstractDoToEntityTask - Base class for entity interaction tasks
 * Based on BaritonePlus's entity interaction system
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { FollowEntityTask } from './FollowEntityTask';
import { GoToNearTask } from './GoToNearTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { LookHelper } from '../../utils/LookHelper';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';

/**
 * Entity filter function type
 */
export type EntityFilter = (entity: Entity) => boolean;

/**
 * Configuration for AbstractDoToEntityTask
 */
export interface EntityTaskConfig {
  /** Distance to maintain from entity (-1 for default reach) */
  maintainDistance: number;
  /** Lower range for combat guard */
  combatGuardLowerRange: number;
  /** Field radius for combat guard */
  combatGuardLowerFieldRadius: number;
  /** Entity reach range */
  reachRange: number;
  /** Timeout for reaching entity */
  reachTimeout: number;
}

/**
 * Task factory function type
 */
export type EntityTaskFactory = (entity: Entity) => Task;

/**
 * State for entity interaction
 */
enum EntityInteractState {
  FINDING_ENTITY,
  APPROACHING,
  MAINTAINING_DISTANCE,
  INTERACTING,
  WAITING,
  WANDERING,
  FINISHED,
  FAILED
}

const DEFAULT_CONFIG: EntityTaskConfig = {
  maintainDistance: -1, // Use reach range minus 1
  combatGuardLowerRange: 0,
  combatGuardLowerFieldRadius: Infinity,
  reachRange: 4.5,
  reachTimeout: 30,
};

/**
 * Abstract base class for tasks that interact with entities.
 *
 * WHY: Many tasks need to interact with entities (combat, trading, taming).
 * This base class handles the common logic of finding entities, approaching them,
 * maintaining proper distance, and then delegating the actual interaction to subclasses.
 *
 * Based on BaritonePlus AbstractDoToEntityTask.java
 */
export abstract class AbstractDoToEntityTask extends Task {
  protected config: EntityTaskConfig;
  private state: EntityInteractState = EntityInteractState.FINDING_ENTITY;
  private progressChecker: MovementProgressChecker;
  private lookHelper: LookHelper;
  private targetEntity: Entity | null = null;
  private unreachableEntities: Set<number> = new Set();

  constructor(bot: Bot, config: Partial<EntityTaskConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.progressChecker = new MovementProgressChecker(bot);
    this.lookHelper = new LookHelper(bot);
  }

  get displayName(): string {
    const entityName = this.targetEntity?.name ?? 'unknown';
    return `DoToEntity(${entityName})`;
  }

  onStart(): void {
    this.state = EntityInteractState.FINDING_ENTITY;
    this.targetEntity = null;
    this.unreachableEntities.clear();
    this.progressChecker.reset();
  }

  onTick(): Task | null {
    switch (this.state) {
      case EntityInteractState.FINDING_ENTITY:
        return this.handleFindingEntity();

      case EntityInteractState.APPROACHING:
        return this.handleApproaching();

      case EntityInteractState.MAINTAINING_DISTANCE:
        return this.handleMaintainingDistance();

      case EntityInteractState.INTERACTING:
        return this.handleInteracting();

      case EntityInteractState.WANDERING:
        return this.handleWandering();

      default:
        return null;
    }
  }

  private handleFindingEntity(): Task | null {
    const entity = this.getEntityTarget();

    if (!entity) {
      // No entity found - wander and search
      this.state = EntityInteractState.WANDERING;
      return null;
    }

    // Skip unreachable entities
    if (this.unreachableEntities.has(entity.id)) {
      return null;
    }

    this.targetEntity = entity;
    this.state = EntityInteractState.APPROACHING;
    this.progressChecker.reset();
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.targetEntity || !this.isValidEntity(this.targetEntity)) {
      this.targetEntity = null;
      this.state = EntityInteractState.FINDING_ENTITY;
      return null;
    }

    // Check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      // Not making progress - mark as unreachable
      this.unreachableEntities.add(this.targetEntity.id);
      this.targetEntity = null;
      this.state = EntityInteractState.FINDING_ENTITY;
      return null;
    }

    const playerPos = this.bot.entity.position;
    const entityPos = this.targetEntity.position;
    const dist = playerPos.distanceTo(entityPos);

    // Calculate maintain distance
    const maintainDistance = this.config.maintainDistance >= 0
      ? this.config.maintainDistance
      : this.config.reachRange - 1;

    // Check if too close
    if (dist < maintainDistance) {
      this.state = EntityInteractState.MAINTAINING_DISTANCE;
      return null;
    }

    // Check if in range for interaction
    if (dist <= this.config.reachRange) {
      // Look at entity
      this.lookHelper.startLookingAt(entityPos.offset(0, this.targetEntity.height / 2, 0));
      this.lookHelper.tick();

      // Check if looking at entity
      if (this.isLookingAtEntity()) {
        this.state = EntityInteractState.INTERACTING;
        this.progressChecker.reset();
        return null;
      }
    }

    // Move toward entity
    return new FollowEntityTask(this.bot, this.targetEntity.id, Math.max(1, maintainDistance - 1));
  }

  private handleMaintainingDistance(): Task | null {
    if (!this.targetEntity || !this.isValidEntity(this.targetEntity)) {
      this.targetEntity = null;
      this.state = EntityInteractState.FINDING_ENTITY;
      return null;
    }

    const playerPos = this.bot.entity.position;
    const entityPos = this.targetEntity.position;
    const dist = playerPos.distanceTo(entityPos);

    const maintainDistance = this.config.maintainDistance >= 0
      ? this.config.maintainDistance
      : this.config.reachRange - 1;

    // If too close, step back
    if (dist < maintainDistance) {
      // Calculate flee direction
      const fleeDir = playerPos.minus(entityPos);
      const len = Math.sqrt(fleeDir.x * fleeDir.x + fleeDir.z * fleeDir.z);

      if (len > 0.1) {
        const targetPos = playerPos.plus(new Vec3(
          (fleeDir.x / len) * 3,
          0,
          (fleeDir.z / len) * 3
        ));

        return new GoToNearTask(
          this.bot,
          Math.floor(targetPos.x),
          Math.floor(targetPos.y),
          Math.floor(targetPos.z),
          1
        );
      }
    }

    // Now at good distance - try to interact
    if (dist <= this.config.reachRange) {
      this.lookHelper.startLookingAt(entityPos.offset(0, this.targetEntity.height / 2, 0));
      this.lookHelper.tick();
      this.state = EntityInteractState.INTERACTING;
    } else {
      this.state = EntityInteractState.APPROACHING;
    }

    return null;
  }

  private handleInteracting(): Task | null {
    if (!this.targetEntity || !this.isValidEntity(this.targetEntity)) {
      this.targetEntity = null;
      this.state = EntityInteractState.FINDING_ENTITY;
      return null;
    }

    // Delegate to subclass for actual interaction
    return this.onEntityInteract(this.targetEntity);
  }

  private handleWandering(): Task | null {
    // Wander to find entities
    const subtask = new TimeoutWanderTask(this.bot, 10);

    // Check if we found an entity while wandering
    const entity = this.getEntityTarget();
    if (entity && !this.unreachableEntities.has(entity.id)) {
      this.targetEntity = entity;
      this.state = EntityInteractState.APPROACHING;
      return null;
    }

    return subtask;
  }

  onStop(interruptTask: ITask | null): void {
    this.lookHelper.stopLooking();
    this.targetEntity = null;
  }

  isFinished(): boolean {
    return this.state === EntityInteractState.FINISHED || this.state === EntityInteractState.FAILED;
  }

  isFailed(): boolean {
    return this.state === EntityInteractState.FAILED;
  }

  // ---- Abstract methods for subclasses ----

  /**
   * Get the target entity to interact with
   */
  protected abstract getEntityTarget(): Entity | null;

  /**
   * Called when in range of entity and looking at it.
   * Return a subtask for the interaction, or null when done.
   */
  protected abstract onEntityInteract(entity: Entity): Task | null;

  // ---- Helper methods ----

  protected isValidEntity(entity: Entity): boolean {
    return entity.isValid !== false;
  }

  protected isLookingAtEntity(): boolean {
    if (!this.targetEntity) return false;

    // Simple check - raycast toward entity
    const rayBlock = this.bot.blockAtCursor(this.config.reachRange);
    if (rayBlock) {
      // We're looking at a block, not entity
      return false;
    }

    // Check if entity is in view direction
    const playerPos = this.bot.entity.position.offset(0, 1.62, 0);
    const entityPos = this.targetEntity.position.offset(0, this.targetEntity.height / 2, 0);
    const lookDir = this.getPlayerLookDirection();
    const toEntity = entityPos.minus(playerPos);
    const toEntityLen = Math.sqrt(toEntity.x * toEntity.x + toEntity.y * toEntity.y + toEntity.z * toEntity.z);

    if (toEntityLen < 0.1) return true;

    const dot = (lookDir.x * toEntity.x + lookDir.y * toEntity.y + lookDir.z * toEntity.z) / toEntityLen;
    return dot > 0.95; // Within ~18 degrees
  }

  protected getPlayerLookDirection(): Vec3 {
    const yaw = this.bot.entity.yaw;
    const pitch = this.bot.entity.pitch;
    return new Vec3(
      -Math.sin(yaw) * Math.cos(pitch),
      -Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch)
    );
  }

  protected getTargetEntity(): Entity | null {
    return this.targetEntity;
  }

  /**
   * Mark task as finished
   */
  protected markFinished(): void {
    this.state = EntityInteractState.FINISHED;
  }

  /**
   * Mark task as failed
   */
  protected markFailed(): void {
    this.state = EntityInteractState.FAILED;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof AbstractDoToEntityTask)) return false;
    return Math.abs(this.config.maintainDistance - other.config.maintainDistance) < 0.1;
  }
}
