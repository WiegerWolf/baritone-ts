/**
 * GoToTask - Abstract base for navigation tasks
 *
 * Subclasses are in their own files:
 * - GoToBlockTask.ts
 * - GetToBlockTask.ts
 * - GoToNearTask.ts
 * - GoToXZTask.ts
 * - FollowEntityTask.ts
 */

import type { Bot } from 'mineflayer';
import { Task, GroundedTask } from '../Task';
import type { ITask } from '../interfaces';
import { Goal, PathNode } from '../../types';
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

