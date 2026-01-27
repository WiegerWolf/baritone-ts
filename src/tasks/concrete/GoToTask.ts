/**
 * GoToTask - Navigation Tasks
 * Based on AltoClef's navigation tasks
 *
 * Tasks for moving the bot to specific locations using the pathfinder.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task, GroundedTask } from '../Task';
import type { ITask } from '../interfaces';
import { Goal, BlockPos, CalculationContext, PathResult, PathNode } from '../../types';
import { GoalBlock, GoalNear, GoalGetToBlock, GoalXZ } from '../../goals';
import { AStar } from '../../pathing/AStar';
import { PathExecutor } from '../../pathing/PathExecutor';
import { CalculationContextImpl } from '../../core/CalculationContext';

/**
 * Base task for all navigation tasks
 */
export abstract class GoToTask extends GroundedTask {
  protected pathfinder: AStar | null = null;
  protected pathExecutor: PathExecutor | null = null;
  protected currentPath: PathNode[] = [];
  protected pathingTimeout: number = 10000; // 10 seconds
  protected recalculateInterval: number = 20; // Recalculate every 20 ticks
  protected ticksSinceRecalc: number = 0;
  protected reachedGoal: boolean = false;

  abstract getGoal(): Goal;

  get displayName(): string {
    const goal = this.getGoal();
    if ('x' in goal && 'y' in goal && 'z' in goal) {
      return `GoTo(${(goal as any).x}, ${(goal as any).y}, ${(goal as any).z})`;
    }
    return `GoTo(${goal.constructor.name})`;
  }

  onStart(): void {
    this.reachedGoal = false;
    this.ticksSinceRecalc = this.recalculateInterval; // Force immediate calculation
    this.currentPath = [];
    this.pathExecutor = null;
  }

  onTick(): Task | null {
    // Check if we've reached the goal
    const pos = this.bot.entity.position;
    const goal = this.getGoal();

    if (goal.isEnd(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z))) {
      this.reachedGoal = true;
      this.bot.clearControlStates();
      return null;
    }

    // Check if we need to recalculate path
    this.ticksSinceRecalc++;
    if (this.ticksSinceRecalc >= this.recalculateInterval || this.currentPath.length === 0) {
      this.calculatePath();
      this.ticksSinceRecalc = 0;
    }

    // Execute current path
    if (this.pathExecutor) {
      const complete = this.pathExecutor.onTick();

      // Handle path completion or failure
      if (complete) {
        this.pathExecutor = null;
        this.currentPath = [];
        // Will recalculate next tick
      }
    }

    return null; // No subtask needed
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.pathfinder = null;
    this.pathExecutor = null;
    this.currentPath = [];
  }

  isFinished(): boolean {
    return this.reachedGoal;
  }

  /**
   * Calculate path to goal
   */
  protected calculatePath(): void {
    const pos = this.bot.entity.position;
    const goal = this.getGoal();

    // Create calculation context
    const ctx = new CalculationContextImpl(this.bot);

    // Create pathfinder
    this.pathfinder = new AStar(
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z),
      goal,
      ctx,
      this.pathingTimeout,
      this.pathingTimeout / 2
    );

    // Compute path synchronously (TODO: make async)
    const result = this.pathfinder.compute(100); // 100ms computation time

    if (result.path.length > 0) {
      this.currentPath = result.path;
      this.pathExecutor = new PathExecutor(this.bot, ctx, result.path);
    }
  }

  /**
   * Check if currently pathing
   */
  isPathing(): boolean {
    return this.pathExecutor !== null && this.currentPath.length > 0;
  }

  /**
   * Get remaining distance estimate
   */
  getRemainingDistance(): number {
    if (this.currentPath.length === 0) return Infinity;
    const last = this.currentPath[this.currentPath.length - 1];
    const pos = this.bot.entity.position;
    return Math.sqrt(
      Math.pow(last.x - pos.x, 2) +
      Math.pow(last.y - pos.y, 2) +
      Math.pow(last.z - pos.z, 2)
    );
  }
}

/**
 * Task to go to a specific block position
 */
export class GoToBlockTask extends GoToTask {
  private target: BlockPos;

  constructor(bot: Bot, x: number, y: number, z: number) {
    super(bot);
    this.target = new BlockPos(x, y, z);
  }

  static fromVec3(bot: Bot, pos: Vec3): GoToBlockTask {
    return new GoToBlockTask(bot, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  }

  static fromBlockPos(bot: Bot, pos: BlockPos): GoToBlockTask {
    return new GoToBlockTask(bot, pos.x, pos.y, pos.z);
  }

  get displayName(): string {
    return `GoToBlock(${this.target.x}, ${this.target.y}, ${this.target.z})`;
  }

  getGoal(): Goal {
    return new GoalBlock(this.target.x, this.target.y, this.target.z);
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GoToBlockTask)) return false;
    return this.target.equals(other.target);
  }
}

/**
 * Task to get within reach of a block (for mining/interaction)
 */
export class GetToBlockTask extends GoToTask {
  private target: BlockPos;

  constructor(bot: Bot, x: number, y: number, z: number) {
    super(bot);
    this.target = new BlockPos(x, y, z);
  }

  static fromVec3(bot: Bot, pos: Vec3): GetToBlockTask {
    return new GetToBlockTask(bot, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  }

  static fromBlockPos(bot: Bot, pos: BlockPos): GetToBlockTask {
    return new GetToBlockTask(bot, pos.x, pos.y, pos.z);
  }

  get displayName(): string {
    return `GetToBlock(${this.target.x}, ${this.target.y}, ${this.target.z})`;
  }

  getGoal(): Goal {
    return new GoalGetToBlock(this.target.x, this.target.y, this.target.z);
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetToBlockTask)) return false;
    return this.target.equals(other.target);
  }
}

/**
 * Task to get near a position (within a radius)
 */
export class GoToNearTask extends GoToTask {
  private target: BlockPos;
  private radius: number;

  constructor(bot: Bot, x: number, y: number, z: number, radius: number = 3) {
    super(bot);
    this.target = new BlockPos(x, y, z);
    this.radius = radius;
  }

  static fromVec3(bot: Bot, pos: Vec3, radius: number = 3): GoToNearTask {
    return new GoToNearTask(bot, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z), radius);
  }

  get displayName(): string {
    return `GoToNear(${this.target.x}, ${this.target.y}, ${this.target.z}, r=${this.radius})`;
  }

  getGoal(): Goal {
    return new GoalNear(this.target.x, this.target.y, this.target.z, this.radius);
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GoToNearTask)) return false;
    return this.target.equals(other.target) && this.radius === other.radius;
  }
}

/**
 * Task to go to XZ coordinates (any Y level)
 */
export class GoToXZTask extends GoToTask {
  private x: number;
  private z: number;

  constructor(bot: Bot, x: number, z: number) {
    super(bot);
    this.x = x;
    this.z = z;
  }

  get displayName(): string {
    return `GoToXZ(${this.x}, ${this.z})`;
  }

  getGoal(): Goal {
    return new GoalXZ(this.x, this.z);
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GoToXZTask)) return false;
    return this.x === other.x && this.z === other.z;
  }
}

/**
 * Task to follow an entity
 */
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
