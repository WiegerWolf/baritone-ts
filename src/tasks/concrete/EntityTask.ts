/**
 * EntityTask - Entity Interaction Tasks
 * Based on BaritonePlus's entity interaction system
 *
 * Tasks for interacting with entities - finding closest entities,
 * maintaining distance, and performing actions on entities.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask, FollowEntityTask } from './GoToTask';
import { TimeoutWanderTask } from './MovementUtilTask';
import { LookHelper } from '../../utils/LookHelper';
import { TimerGame } from '../../utils/timers/TimerGame';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';

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

/**
 * Entity filter function type
 */
export type EntityFilter = (entity: Entity) => boolean;

/**
 * Task factory function type
 */
export type EntityTaskFactory = (entity: Entity) => Task;

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
 * Task to give an item to a player entity.
 *
 * WHY: Trading, gifting, or handing items to other players requires
 * approaching them and dropping the item near them.
 */
export class GiveItemToPlayerTask extends AbstractDoToEntityTask {
  private itemName: string;
  private amount: number;
  private targetPlayerName: string;
  private given: boolean = false;

  constructor(bot: Bot, playerName: string, itemName: string, amount: number = 1) {
    super(bot, { maintainDistance: 2, reachRange: 3 });
    this.targetPlayerName = playerName;
    this.itemName = itemName;
    this.amount = amount;
  }

  get displayName(): string {
    return `GiveItem(${this.itemName} x${this.amount} to ${this.targetPlayerName})`;
  }

  onStart(): void {
    super.onStart();
    this.given = false;
  }

  protected getEntityTarget(): Entity | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity.type === 'player' && entity.username === this.targetPlayerName) {
        return entity;
      }
    }
    return null;
  }

  protected onEntityInteract(entity: Entity): Task | null {
    if (this.given) {
      this.markFinished();
      return null;
    }

    // Find the item in inventory
    const item = this.bot.inventory.items().find(i =>
      i.name === this.itemName || i.name.includes(this.itemName)
    );

    if (!item) {
      // Don't have the item
      this.markFailed();
      return null;
    }

    // Drop the item toward the player
    try {
      this.bot.toss(item.type, null, Math.min(item.count, this.amount));
      this.given = true;
    } catch (err) {
      this.markFailed();
    }

    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GiveItemToPlayerTask)) return false;
    return this.targetPlayerName === other.targetPlayerName &&
           this.itemName === other.itemName &&
           this.amount === other.amount;
  }
}

/**
 * Task to kill a specific player.
 *
 * WHY: PvP scenarios require targeting and attacking specific players.
 * This task handles finding and attacking a named player.
 */
export class KillPlayerTask extends AbstractDoToEntityTask {
  private targetPlayerName: string;

  constructor(bot: Bot, playerName: string) {
    super(bot, { maintainDistance: 3, reachRange: 4 });
    this.targetPlayerName = playerName;
  }

  get displayName(): string {
    return `KillPlayer(${this.targetPlayerName})`;
  }

  protected getEntityTarget(): Entity | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity.type === 'player' && entity.username === this.targetPlayerName) {
        if (entity.isValid !== false) {
          return entity;
        }
      }
    }
    return null;
  }

  protected onEntityInteract(entity: Entity): Task | null {
    // Check if target is dead
    const target = this.getEntityTarget();
    if (!target || target.isValid === false) {
      this.markFinished();
      return null;
    }

    // Attack the player
    try {
      this.bot.attack(entity);
    } catch (err) {
      // Will retry
    }

    return null;
  }

  isFinished(): boolean {
    // Finished when target player is no longer valid (dead or logged out)
    const target = this.getEntityTarget();
    return !target || target.isValid === false || super.isFinished();
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof KillPlayerTask)) return false;
    return this.targetPlayerName === other.targetPlayerName;
  }
}

/**
 * Task to approach and interact with an entity (right-click).
 *
 * WHY: Many entity interactions use right-click (trading with villagers,
 * mounting horses, etc.). This task handles approach and interaction.
 */
export class InteractWithEntityTask extends AbstractDoToEntityTask {
  private entityId: number;
  private interacted: boolean = false;

  constructor(bot: Bot, entityId: number) {
    super(bot, { maintainDistance: 2, reachRange: 3 });
    this.entityId = entityId;
  }

  get displayName(): string {
    const entity = this.bot.entities[this.entityId];
    const name = entity?.name ?? 'unknown';
    return `InteractWithEntity(${name})`;
  }

  onStart(): void {
    super.onStart();
    this.interacted = false;
  }

  protected getEntityTarget(): Entity | null {
    return this.bot.entities[this.entityId] ?? null;
  }

  protected onEntityInteract(entity: Entity): Task | null {
    if (this.interacted) {
      this.markFinished();
      return null;
    }

    try {
      this.bot.useOn(entity);
      this.interacted = true;
    } catch (err) {
      // Try activateEntity as fallback
      try {
        (this.bot as any).activateEntity?.(entity);
        this.interacted = true;
      } catch {
        this.markFailed();
      }
    }

    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof InteractWithEntityTask)) return false;
    return this.entityId === other.entityId;
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
