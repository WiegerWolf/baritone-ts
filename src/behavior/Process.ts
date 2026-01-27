import type { Bot } from 'mineflayer';
import { Goal, BlockPos } from '../types';

/**
 * Process system for high-level behaviors
 * Based on Baritone's IBaritoneProcess system
 *
 * Processes are high-level behaviors that can take control of pathfinding.
 * Only one process can be active at a time, and they have priorities.
 *
 * Examples: MineProcess, FollowProcess, ExploreProcess, BuildProcess
 */

/**
 * Process priority levels
 */
export enum ProcessPriority {
  LOWEST = 0,
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  HIGHEST = 4,
  PAUSED = -1
}

/**
 * Process state
 */
export enum ProcessState {
  IDLE,      // Not doing anything
  ACTIVE,    // Currently running
  PAUSED,    // Temporarily paused
  COMPLETE,  // Finished successfully
  FAILED     // Failed to complete
}

/**
 * Result of a process tick
 */
export interface ProcessTickResult {
  // Should pathfinding continue?
  continuePathing: boolean;
  // New goal to set (if any)
  newGoal?: Goal;
  // Custom status message
  status?: string;
  // Should the process remain active?
  keepActive: boolean;
}

/**
 * Base interface for all processes
 */
export interface IProcess {
  /**
   * Display name for logging
   */
  readonly displayName: string;

  /**
   * Priority of this process
   */
  readonly priority: ProcessPriority;

  /**
   * Current state
   */
  readonly state: ProcessState;

  /**
   * Called when process becomes active
   */
  onActivate(): void;

  /**
   * Called when process is deactivated
   */
  onDeactivate(): void;

  /**
   * Called every tick while active
   * Return the tick result to control pathfinding
   */
  tick(): ProcessTickResult;

  /**
   * Check if process is complete
   */
  isComplete(): boolean;

  /**
   * Check if process has failed
   */
  hasFailed(): boolean;

  /**
   * Cancel the process
   */
  cancel(): void;

  /**
   * Pause the process
   */
  pause(): void;

  /**
   * Resume the process
   */
  resume(): void;
}

/**
 * Base class for processes with common functionality
 */
export abstract class BaseProcess implements IProcess {
  protected bot: Bot;
  protected pathfinder: any; // Reference to pathfinder plugin

  abstract readonly displayName: string;
  readonly priority: ProcessPriority;

  private _state: ProcessState = ProcessState.IDLE;

  constructor(bot: Bot, pathfinder: any, priority: ProcessPriority = ProcessPriority.NORMAL) {
    this.bot = bot;
    this.pathfinder = pathfinder;
    this.priority = priority;
  }

  get state(): ProcessState {
    return this._state;
  }

  protected setState(state: ProcessState): void {
    this._state = state;
  }

  onActivate(): void {
    this._state = ProcessState.ACTIVE;
  }

  onDeactivate(): void {
    if (this._state === ProcessState.ACTIVE) {
      this._state = ProcessState.IDLE;
    }
  }

  abstract tick(): ProcessTickResult;

  isComplete(): boolean {
    return this._state === ProcessState.COMPLETE;
  }

  hasFailed(): boolean {
    return this._state === ProcessState.FAILED;
  }

  cancel(): void {
    this._state = ProcessState.IDLE;
  }

  pause(): void {
    if (this._state === ProcessState.ACTIVE) {
      this._state = ProcessState.PAUSED;
    }
  }

  resume(): void {
    if (this._state === ProcessState.PAUSED) {
      this._state = ProcessState.ACTIVE;
    }
  }

  /**
   * Helper to create a "continue pathing" result
   */
  protected continueResult(status?: string): ProcessTickResult {
    return {
      continuePathing: true,
      keepActive: true,
      status
    };
  }

  /**
   * Helper to create a "new goal" result
   */
  protected newGoalResult(goal: Goal, status?: string): ProcessTickResult {
    return {
      continuePathing: true,
      newGoal: goal,
      keepActive: true,
      status
    };
  }

  /**
   * Helper to create a "complete" result
   */
  protected completeResult(status?: string): ProcessTickResult {
    this._state = ProcessState.COMPLETE;
    return {
      continuePathing: false,
      keepActive: false,
      status
    };
  }

  /**
   * Helper to create a "failed" result
   */
  protected failedResult(status?: string): ProcessTickResult {
    this._state = ProcessState.FAILED;
    return {
      continuePathing: false,
      keepActive: false,
      status
    };
  }

  /**
   * Helper to create a "wait" result (keep active but don't path)
   */
  protected waitResult(status?: string): ProcessTickResult {
    return {
      continuePathing: false,
      keepActive: true,
      status
    };
  }
}

/**
 * Process manager handles process lifecycle and priority
 */
export class ProcessManager {
  private bot: Bot;
  private pathfinder: any;
  private processes: Map<string, IProcess> = new Map();
  private activeProcess: IProcess | null = null;

  constructor(bot: Bot, pathfinder: any) {
    this.bot = bot;
    this.pathfinder = pathfinder;
  }

  /**
   * Register a process
   */
  register(name: string, process: IProcess): void {
    this.processes.set(name, process);
  }

  /**
   * Unregister a process
   */
  unregister(name: string): void {
    const process = this.processes.get(name);
    if (process === this.activeProcess) {
      this.deactivate();
    }
    this.processes.delete(name);
  }

  /**
   * Activate a process by name
   */
  activate(name: string): boolean {
    const process = this.processes.get(name);
    if (!process) return false;

    // Check if current process has higher priority
    if (this.activeProcess && this.activeProcess.priority > process.priority) {
      return false;
    }

    // Deactivate current process
    if (this.activeProcess) {
      this.activeProcess.onDeactivate();
    }

    // Activate new process
    this.activeProcess = process;
    process.onActivate();
    return true;
  }

  /**
   * Deactivate current process
   */
  deactivate(): void {
    if (this.activeProcess) {
      this.activeProcess.onDeactivate();
      this.activeProcess = null;
    }
  }

  /**
   * Get the currently active process
   */
  getActive(): IProcess | null {
    return this.activeProcess;
  }

  /**
   * Get a process by name
   */
  get(name: string): IProcess | undefined {
    return this.processes.get(name);
  }

  /**
   * Check if a process is active
   */
  isActive(name: string): boolean {
    const process = this.processes.get(name);
    return process !== undefined && process === this.activeProcess;
  }

  /**
   * Tick the active process
   */
  tick(): ProcessTickResult | null {
    if (!this.activeProcess) {
      return null;
    }

    // Check if process is paused
    if (this.activeProcess.state === ProcessState.PAUSED) {
      return { continuePathing: false, keepActive: true, status: 'Paused' };
    }

    // Tick the process
    const result = this.activeProcess.tick();

    // Handle process completion
    if (!result.keepActive || this.activeProcess.isComplete() || this.activeProcess.hasFailed()) {
      this.activeProcess.onDeactivate();
      this.activeProcess = null;
    }

    return result;
  }

  /**
   * Cancel all processes
   */
  cancelAll(): void {
    if (this.activeProcess) {
      this.activeProcess.cancel();
      this.activeProcess = null;
    }
  }

  /**
   * Get all registered process names
   */
  getRegisteredNames(): string[] {
    return Array.from(this.processes.keys());
  }
}
