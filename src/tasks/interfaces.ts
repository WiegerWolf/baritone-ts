/**
 * Task Safety Interfaces
 * Based on AltoClef's ITaskCanForce, ITaskRequiresGrounded, ITaskOverridesGrounded
 *
 * These interfaces enable safe task interruption handling:
 * - ITaskCanForce: Tasks that can prevent interruption
 * - ITaskRequiresGrounded: Tasks that shouldn't be interrupted mid-air
 * - ITaskOverridesGrounded: Tasks that can interrupt grounded tasks (e.g., MLG bucket)
 */

import type { Bot } from 'mineflayer';

/**
 * Interface for tasks that can force themselves to continue running
 * even when a higher-priority task wants to interrupt.
 */
export interface ITaskCanForce {
  /**
   * Determine if this task should force itself to continue.
   * @param interruptingCandidate The task that wants to interrupt this one
   * @returns true if this task should NOT be interrupted
   */
  shouldForce(interruptingCandidate: ITask | null): boolean;
}

/**
 * Interface for tasks that require the player to be grounded (or safe).
 * Prevents mid-air task switching which could cause death.
 *
 * Examples: parkour jumps, pillar building, descending movements
 */
export interface ITaskRequiresGrounded extends ITaskCanForce {
  /**
   * Default implementation: prevent interruption unless grounded or safe.
   * Override to customize behavior.
   */
  shouldForce(interruptingCandidate: ITask | null): boolean;
}

/**
 * Marker interface for tasks that can interrupt grounded tasks.
 * Used by emergency tasks like MLG bucket placement.
 */
export interface ITaskOverridesGrounded {
  readonly overridesGrounded: true;
}

/**
 * Check if a task overrides grounded requirements
 */
export function taskOverridesGrounded(task: ITask | null): boolean {
  if (!task) return false;
  return 'overridesGrounded' in task && (task as ITaskOverridesGrounded).overridesGrounded === true;
}

/**
 * Check if the player is grounded or in a safe state
 */
export function isGroundedOrSafe(bot: Bot): boolean {
  const entity = bot.entity;
  if (!entity) return true;

  // On ground
  if (entity.onGround) return true;

  // In water (swimming)
  if (bot.entity.isInWater) return true;

  // On ladder/vine (climbing)
  const block = bot.blockAt(entity.position);
  if (block && (block.name === 'ladder' || block.name.includes('vine'))) {
    return true;
  }

  return false;
}

/**
 * Default implementation for ITaskRequiresGrounded.shouldForce
 */
export function defaultGroundedShouldForce(
  bot: Bot,
  interruptingCandidate: ITask | null
): boolean {
  // If the interrupting task overrides grounded, allow it
  if (taskOverridesGrounded(interruptingCandidate)) {
    return false;
  }

  // If not grounded, force current task to continue
  return !isGroundedOrSafe(bot);
}

/**
 * Base interface for all tasks
 */
export interface ITask {
  /**
   * Display name for logging/debugging
   */
  readonly displayName: string;

  /**
   * Called when the task starts
   */
  onStart(): void;

  /**
   * Called every tick while active
   * @returns The child task to run, or null if this task handles execution directly
   */
  onTick(): ITask | null;

  /**
   * Called when the task is stopped
   * @param interruptTask The task that is replacing this one, or null if cancelled
   */
  onStop(interruptTask: ITask | null): void;

  /**
   * Check if the task has completed its goal
   */
  isFinished(): boolean;

  /**
   * Check if this task is equivalent to another (for preventing unnecessary restarts)
   */
  isEqual(other: ITask | null): boolean;
}

/**
 * Interface for task chains that compete for execution
 */
export interface ITaskChain {
  /**
   * Display name for logging
   */
  readonly displayName: string;

  /**
   * Get the current priority of this chain.
   * Higher priority chains run before lower priority ones.
   * Return 0 or negative to indicate the chain is inactive.
   */
  getPriority(): number;

  /**
   * Check if this chain is currently active (has work to do)
   */
  isActive(): boolean;

  /**
   * Called every tick while this chain has the highest priority
   */
  onTick(): void;

  /**
   * Called when this chain is interrupted by a higher-priority chain
   */
  onInterrupt(interruptingChain: ITaskChain): void;

  /**
   * Get the current task being executed, if any
   */
  getCurrentTask(): ITask | null;
}
