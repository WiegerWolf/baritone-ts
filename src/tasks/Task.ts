/**
 * Task - Hierarchical Task Base Class
 * Based on AltoClef's Task.java
 *
 * Tasks form a dynamic tree of execution. Each tick, a task decides what child
 * task to run (or handles execution directly). This enables:
 * - State machines without explicit states
 * - Dynamic switching based on game state
 * - Clean interruption propagation
 *
 * Key concepts:
 * - Tasks have lifecycle: onStart() → onTick() → onStop()
 * - onTick() returns child task to delegate to, or null to handle directly
 * - Tasks can prevent interruption via ITaskCanForce
 */

import type { Bot } from 'mineflayer';
import type { ITask, ITaskCanForce } from './interfaces';

/**
 * Abstract base class for all tasks
 */
export abstract class Task implements ITask {
  /**
   * Current child task being delegated to
   */
  protected sub: Task | null = null;

  /**
   * Whether this is the first tick (for onStart)
   */
  private first: boolean = true;

  /**
   * Whether this task is currently active
   */
  private active: boolean = false;

  /**
   * Whether this task has been stopped
   */
  private stopped: boolean = false;

  /**
   * Reference to the bot
   */
  protected bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  /**
   * Display name for logging
   */
  abstract readonly displayName: string;

  /**
   * Called when the task first starts executing
   * Override to perform initialization
   */
  onStart(): void {
    // Default: no-op
  }

  /**
   * Called every tick while active.
   * Return a child task to delegate to, or null to handle directly.
   */
  abstract onTick(): Task | null;

  /**
   * Called when the task is stopped (interrupted or completed)
   * @param interruptTask The task that is replacing this one, or null if cancelled/completed
   */
  onStop(interruptTask: Task | null): void {
    // Default: no-op
  }

  /**
   * Check if the task has completed its goal
   */
  abstract isFinished(): boolean;

  /**
   * Check if this task is equivalent to another task.
   * Used to prevent unnecessary task restarts.
   * Override for custom equality logic.
   */
  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    // Default: same class counts as equal
    return this.constructor === other.constructor;
  }

  /**
   * Check if the current subtask can be interrupted by a new subtask.
   * Respects ITaskCanForce interface.
   */
  protected canBeInterrupted(currentSub: Task | null, newSub: Task | null): boolean {
    if (!currentSub) return true;

    // Check if current task implements ITaskCanForce
    if (this.implementsTaskCanForce(currentSub)) {
      const forceTask = currentSub as unknown as ITaskCanForce;
      if (forceTask.shouldForce(newSub)) {
        return false; // Current task is forcing itself to continue
      }
    }

    return true;
  }

  /**
   * Type guard for ITaskCanForce
   */
  private implementsTaskCanForce(task: Task): task is Task & ITaskCanForce {
    return 'shouldForce' in task && typeof (task as any).shouldForce === 'function';
  }

  /**
   * Main tick method - handles lifecycle and delegation
   * Called by TaskChain, not directly overridden by subclasses
   */
  tick(): void {
    // Handle first-time initialization
    if (this.first) {
      this.onStart();
      this.first = false;
      this.active = true;
    }

    // Get the child task to run (or null)
    const newSub = this.onTick();

    if (newSub !== null) {
      // Check if we need to switch subtasks
      if (!newSub.isEqual(this.sub)) {
        if (this.canBeInterrupted(this.sub, newSub)) {
          // Stop old subtask
          if (this.sub !== null) {
            this.sub.stop(newSub);
          }
          // Start new subtask
          this.sub = newSub;
        }
      }

      // Tick the current subtask
      if (this.sub !== null) {
        this.sub.tick();
      }
    } else {
      // No subtask - stop any existing one
      if (this.sub !== null) {
        this.sub.stop(null);
        this.sub = null;
      }
    }
  }

  /**
   * Stop this task and all subtasks
   */
  stop(interruptTask: Task | null): void {
    if (this.stopped) return;
    this.stopped = true;

    // Stop subtask first
    if (this.sub !== null) {
      this.sub.stop(interruptTask);
      this.sub = null;
    }

    // Call lifecycle method
    this.onStop(interruptTask);

    this.active = false;
    this.first = true;
  }

  /**
   * Check if this task is currently active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Check if this task has been stopped
   */
  isStopped(): boolean {
    return this.stopped;
  }

  /**
   * Reset this task for reuse
   */
  reset(): void {
    this.first = true;
    this.active = false;
    this.stopped = false;
    this.sub = null;
  }

  /**
   * Get the current subtask (for debugging)
   */
  getCurrentSubtask(): Task | null {
    return this.sub;
  }

  /**
   * Get the full task chain as a string (for debugging)
   */
  getTaskChainString(): string {
    let result = this.displayName;
    if (this.sub) {
      result += ' > ' + this.sub.getTaskChainString();
    }
    return result;
  }
}

/**
 * A task that wraps another task (decorator pattern)
 */
export abstract class WrapperTask extends Task {
  protected wrapped: Task;

  constructor(bot: Bot, wrapped: Task) {
    super(bot);
    this.wrapped = wrapped;
  }

  get displayName(): string {
    return `${this.constructor.name}(${this.wrapped.displayName})`;
  }

  onTick(): Task | null {
    return this.wrapped;
  }

  isFinished(): boolean {
    return this.wrapped.isFinished();
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof WrapperTask)) return false;
    return this.wrapped.isEqual(other.wrapped);
  }
}

/**
 * A task that requires the player to be grounded
 */
export abstract class GroundedTask extends Task {
  shouldForce(interruptingCandidate: ITask | null): boolean {
    // Check if interrupter can override grounded
    if (interruptingCandidate && 'overridesGrounded' in interruptingCandidate) {
      return false;
    }

    // Force if not grounded
    const entity = this.bot.entity;
    if (!entity) return false;

    if (entity.onGround) return false;
    if (this.bot.entity.isInWater) return false;

    // Check if on ladder/vine
    const block = this.bot.blockAt(entity.position);
    if (block && (block.name === 'ladder' || block.name.includes('vine'))) {
      return false;
    }

    return true; // Not grounded, force continuation
  }
}
