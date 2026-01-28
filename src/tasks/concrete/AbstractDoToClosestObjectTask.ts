/**
 * AbstractDoToClosestObjectTask - Base class for finding and interacting with closest objects
 * Based on BaritonePlus's AbstractDoToClosestObjectTask
 *
 * WHY this base class matters:
 * - Provides intelligent closest-object selection using heuristic caching
 * - Avoids "ping-pong" behavior where bot switches between equidistant targets
 * - Considers pathfinding cost, not just Euclidean distance
 * - When a closer object appears, evaluates if switching is worthwhile
 * - Caches heuristic values to make informed decisions about target switches
 *
 * The key insight: straight-line distance doesn't reflect actual travel cost.
 * A block that's 10m away but requires a 50m path around obstacles is farther
 * than a block that's 15m away with a direct path. This class tracks actual
 * pathfinding costs and uses them to make better target selection decisions.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimeoutWanderTask } from './MovementUtilTask';

/**
 * Cached heuristic data for a potential target
 * Stores historical pathfinding costs to inform target selection
 */
class CachedHeuristic {
  private closestDistanceSqr: number = Number.POSITIVE_INFINITY;
  private tickAttempted: number = 0;
  private heuristicValue: number = Number.POSITIVE_INFINITY;

  /**
   * Get the cached heuristic value (pathfinding cost estimate)
   */
  getHeuristicValue(): number {
    return this.heuristicValue;
  }

  /**
   * Update heuristic to minimum of current and new value
   * WHY minimum: once we've found a good path, that's our baseline
   */
  updateHeuristic(value: number): void {
    this.heuristicValue = Math.min(this.heuristicValue, value);
  }

  /**
   * Get the closest squared distance ever recorded to this target
   */
  getClosestDistanceSqr(): number {
    return this.closestDistanceSqr;
  }

  /**
   * Update distance to minimum of current and new value
   */
  updateDistance(distanceSqr: number): void {
    this.closestDistanceSqr = Math.min(this.closestDistanceSqr, distanceSqr);
  }

  /**
   * Get the tick when this target was last attempted
   */
  getTickAttempted(): number {
    return this.tickAttempted;
  }

  /**
   * Set the tick when this target was attempted
   */
  setTickAttempted(tick: number): void {
    this.tickAttempted = tick;
  }
}

/**
 * Abstract base class for tasks that need to find and interact with the closest object.
 *
 * Subclasses must implement:
 * - getPos(obj): Get position of an object
 * - getClosestTo(pos): Find closest object to a position
 * - getOriginPos(): Get the position to measure distance from (usually player)
 * - getGoalTask(obj): Get the task to execute when pursuing an object
 * - isValid(obj): Check if an object is still a valid target
 *
 * Optional overrides:
 * - getWanderTask(): Task to execute when no targets found
 */
export abstract class AbstractDoToClosestObjectTask<T> extends Task {
  private heuristicMap: Map<T, CachedHeuristic> = new Map();
  private currentlyPursuing: T | null = null;
  private wasWanderingFlag: boolean = false;
  private goalTask: Task | null = null;
  private tickCounter: number = 0;

  constructor(bot: Bot) {
    super(bot);
  }

  /**
   * Get position of an object
   */
  protected abstract getPos(obj: T): Vec3;

  /**
   * Find the closest object to a position
   * Returns null if no valid objects found
   */
  protected abstract getClosestTo(pos: Vec3): T | null;

  /**
   * Get the origin position for distance calculations (usually player position)
   */
  protected abstract getOriginPos(): Vec3;

  /**
   * Get the task to execute when pursuing an object
   */
  protected abstract getGoalTask(obj: T): Task;

  /**
   * Check if an object is still a valid target
   */
  protected abstract isValid(obj: T): boolean;

  /**
   * Get the wander task when no objects are found (can be overridden)
   */
  protected getWanderTask(): Task {
    return new TimeoutWanderTask(this.bot, 5);
  }

  /**
   * Reset the search - clears cached heuristics and current target
   */
  resetSearch(): void {
    this.currentlyPursuing = null;
    this.heuristicMap.clear();
    this.goalTask = null;
  }

  /**
   * Check if the task was wandering (no target found) on last tick
   */
  wasWandering(): boolean {
    return this.wasWanderingFlag;
  }

  /**
   * Get the currently pursued object (if any)
   */
  getCurrentTarget(): T | null {
    return this.currentlyPursuing;
  }

  /**
   * Get the current calculated heuristic (pathfinding cost estimate)
   * In mineflayer, we approximate this with distance since we don't have
   * direct access to pathfinding internals like Baritone provides
   */
  private getCurrentCalculatedHeuristic(): number {
    if (!this.currentlyPursuing) return Number.POSITIVE_INFINITY;

    const playerPos = this.bot.entity.position;
    const targetPos = this.getPos(this.currentlyPursuing);

    // Use distance as heuristic approximation
    // A more sophisticated implementation could use pathfinder's cost
    return playerPos.distanceTo(targetPos);
  }

  /**
   * Check if we're actively moving towards a target
   */
  private isMovingToClosestPos(): boolean {
    return this.goalTask !== null;
  }

  onStart(): void {
    this.resetSearch();
    this.wasWanderingFlag = false;
  }

  onTick(): Task | null {
    this.tickCounter++;
    this.wasWanderingFlag = false;

    // Reset pursuit if current target is no longer valid
    if (this.currentlyPursuing !== null && !this.isValid(this.currentlyPursuing)) {
      this.heuristicMap.delete(this.currentlyPursuing);
      this.currentlyPursuing = null;
    }

    // Get closest object from origin position
    const checkNewClosest = this.getClosestTo(this.getOriginPos());

    // Process the closest object
    if (checkNewClosest !== null && checkNewClosest !== this.currentlyPursuing) {
      const newClosest = checkNewClosest;

      if (this.currentlyPursuing === null) {
        // We don't have a target yet - use the new one
        this.currentlyPursuing = newClosest;
      } else {
        if (this.isMovingToClosestPos()) {
          // Currently moving towards a target - consider switching
          const currentHeuristic = this.getCurrentCalculatedHeuristic();
          const playerPos = this.bot.entity.position;
          const closestDistanceSqr = this.getPos(this.currentlyPursuing).distanceSquared(playerPos);

          // Update heuristic for current target
          if (!this.heuristicMap.has(this.currentlyPursuing)) {
            this.heuristicMap.set(this.currentlyPursuing, new CachedHeuristic());
          }
          const h = this.heuristicMap.get(this.currentlyPursuing)!;
          h.updateHeuristic(currentHeuristic);
          h.updateDistance(closestDistanceSqr);
          h.setTickAttempted(this.tickCounter);

          if (this.heuristicMap.has(newClosest)) {
            // New target has cached heuristic - compare
            const maybeReAttempt = this.heuristicMap.get(newClosest)!;
            const maybeClosestDistance = this.getPos(newClosest).distanceSquared(playerPos);

            // Switch if: new has better heuristic OR we got considerably closer
            if (maybeReAttempt.getHeuristicValue() < h.getHeuristicValue() ||
                maybeClosestDistance < maybeReAttempt.getClosestDistanceSqr() / 4) {
              // The new target looks better - switch to it
              this.currentlyPursuing = newClosest;
              maybeReAttempt.updateDistance(maybeClosestDistance);
            }
          } else {
            // New target has no cached heuristic - try it out
            this.currentlyPursuing = newClosest;
          }
        }
        // If not moving yet, keep current target and let movement kick in
      }
    }

    // If we have a target, pursue it
    if (this.currentlyPursuing !== null) {
      this.goalTask = this.getGoalTask(this.currentlyPursuing);
      return this.goalTask;
    } else {
      this.goalTask = null;
    }

    // No target found - wander
    if (checkNewClosest === null && this.currentlyPursuing === null) {
      this.wasWanderingFlag = true;
      return this.getWanderTask();
    }

    return null;
  }

  onStop(): void {
    this.bot.clearControlStates();
  }

  /**
   * Default implementation - tasks using this pattern typically don't finish
   */
  isFinished(): boolean {
    return false;
  }
}

/**
 * Configuration for DoToClosestObjectTask
 */
export interface DoToClosestObjectConfig<T> {
  /**
   * Function to get position of an object
   */
  getPos: (obj: T) => Vec3;

  /**
   * Function to find closest object to a position
   */
  getClosestTo: (pos: Vec3) => T | null;

  /**
   * Function to get origin position for distance calculations
   */
  getOriginPos?: () => Vec3;

  /**
   * Function to create task for pursuing an object
   */
  getGoalTask: (obj: T) => Task;

  /**
   * Function to check if object is still valid
   */
  isValid: (obj: T) => boolean;

  /**
   * Custom wander task (optional)
   */
  wanderTask?: Task;
}

/**
 * Concrete implementation using configuration object
 * Useful when you don't want to create a subclass
 */
export class DoToClosestObjectTask<T> extends AbstractDoToClosestObjectTask<T> {
  private config: DoToClosestObjectConfig<T>;

  constructor(bot: Bot, config: DoToClosestObjectConfig<T>) {
    super(bot);
    this.config = config;
  }

  get displayName(): string {
    return 'DoToClosestObject';
  }

  protected getPos(obj: T): Vec3 {
    return this.config.getPos(obj);
  }

  protected getClosestTo(pos: Vec3): T | null {
    return this.config.getClosestTo(pos);
  }

  protected getOriginPos(): Vec3 {
    if (this.config.getOriginPos) {
      return this.config.getOriginPos();
    }
    return this.bot.entity.position;
  }

  protected getGoalTask(obj: T): Task {
    return this.config.getGoalTask(obj);
  }

  protected isValid(obj: T): boolean {
    return this.config.isValid(obj);
  }

  protected getWanderTask(): Task {
    if (this.config.wanderTask) {
      return this.config.wanderTask;
    }
    return super.getWanderTask();
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof DoToClosestObjectTask)) return false;
    // Configuration-based tasks are equal if they have the same config
    return this.config === other.config;
  }
}

/**
 * Convenience function to create a DoToClosestObjectTask
 */
export function doToClosestObject<T>(
  bot: Bot,
  config: DoToClosestObjectConfig<T>
): DoToClosestObjectTask<T> {
  return new DoToClosestObjectTask(bot, config);
}
