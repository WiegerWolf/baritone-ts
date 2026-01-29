/**
 * GoToTask - Abstract base for navigation tasks
 *
 * Delegates pathfinding to the bot's pathfinder plugin (bot.pathfinder)
 * which handles A* computation, path execution, and movement control.
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

/**
 * Base task for all navigation tasks.
 *
 * Uses the bot's pathfinder plugin (set up via pathfinder(bot, options))
 * rather than creating its own A* instance. This ensures the pathfinder
 * settings (canDig, canPlace, etc.) are consistent and the physics tick
 * handler drives path execution.
 */
export abstract class GoToTask extends GroundedTask {
  protected reachedGoal: boolean = false;
  private goalSet: boolean = false;
  /** How often to re-set the goal (ticks). Subclasses can lower for moving targets. */
  protected recalculateInterval: number = 20;
  private ticksSinceGoalSet: number = 0;

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
    this.goalSet = false;
    this.ticksSinceGoalSet = 0;
  }

  onTick(): Task | null {
    // Check if we've reached the goal
    const pos = this.bot.entity.position;
    const goal = this.getGoal();

    if (goal.isEnd(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z))) {
      this.reachedGoal = true;
      this.stopPathfinder();
      return null;
    }

    // Set/update the goal on the pathfinder plugin
    const pf = (this.bot as any).pathfinder;
    if (pf) {
      this.ticksSinceGoalSet++;
      if (!this.goalSet || this.ticksSinceGoalSet >= this.recalculateInterval) {
        pf.setGoal(goal, true); // dynamic=true so it continuously recalculates
        this.goalSet = true;
        this.ticksSinceGoalSet = 0;
      }
    }

    return null; // No subtask needed — pathfinder plugin drives movement
  }

  onStop(interruptTask: ITask | null): void {
    this.stopPathfinder();
  }

  isFinished(): boolean {
    return this.reachedGoal;
  }

  private stopPathfinder(): void {
    const pf = (this.bot as any).pathfinder;
    if (pf && this.goalSet) {
      pf.stop();
      this.goalSet = false;
    }
    this.bot.clearControlStates();
  }

  /**
   * Check if currently pathing
   */
  isPathing(): boolean {
    const pf = (this.bot as any).pathfinder;
    return pf?.isMoving() ?? false;
  }

  /**
   * Get remaining distance estimate
   */
  getRemainingDistance(): number {
    const pos = this.bot.entity.position;
    const goal = this.getGoal();
    if ('x' in goal && 'y' in goal && 'z' in goal) {
      const g = goal as any;
      return Math.sqrt(
        Math.pow(g.x - pos.x, 2) +
        Math.pow(g.y - pos.y, 2) +
        Math.pow(g.z - pos.z, 2)
      );
    }
    return Infinity;
  }
}
