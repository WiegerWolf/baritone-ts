/**
 * TaskRunner - Central Task Orchestrator
 * Based on AltoClef's TaskRunner.java
 *
 * The TaskRunner manages multiple TaskChains and ensures only the highest
 * priority chain runs each tick. This is the core of the reactive behavior
 * system:
 *
 * Example flow:
 * 1. User says "mine diamonds" → UserTaskChain starts mining
 * 2. Creeper approaches → MobDefenseChain takes priority (100 > 50)
 * 3. Bot kills creeper → MobDefenseChain priority drops
 * 4. UserTaskChain resumes mining
 * 5. Bot gets hungry → FoodChain priority rises (55 > 50)
 * 6. Bot eats → FoodChain priority drops
 * 7. UserTaskChain continues
 */

import type { Bot } from 'mineflayer';
import { EventEmitter } from 'events';
import type { ITaskChain, ITask } from './interfaces';
import { TaskChain, UserTaskChain, ChainPriority } from './TaskChain';
import { Task } from './Task';

/**
 * Events emitted by the TaskRunner
 */
export interface TaskRunnerEvents {
  'chain_changed': (newChain: ITaskChain | null, oldChain: ITaskChain | null) => void;
  'task_started': (chain: ITaskChain, task: ITask) => void;
  'task_finished': (chain: ITaskChain, task: ITask) => void;
  'tick': () => void;
}

/**
 * Central orchestrator for task chains
 */
export class TaskRunner extends EventEmitter {
  private bot: Bot;
  private chains: TaskChain[] = [];
  private activeChain: TaskChain | null = null;
  private userTaskChain: UserTaskChain;
  private running: boolean = false;
  private tickInterval: NodeJS.Timer | null = null;

  constructor(bot: Bot) {
    super();
    this.bot = bot;

    // Create and register the user task chain
    this.userTaskChain = new UserTaskChain(bot);
    this.registerChain(this.userTaskChain);
  }

  /**
   * Register a task chain to be managed
   * Chains are sorted by priority when determining which to run
   */
  registerChain(chain: TaskChain): void {
    if (!this.chains.includes(chain)) {
      this.chains.push(chain);
    }
  }

  /**
   * Unregister a task chain
   */
  unregisterChain(chain: TaskChain): void {
    const index = this.chains.indexOf(chain);
    if (index !== -1) {
      if (chain === this.activeChain) {
        chain.onInterrupt(this.activeChain);
        this.activeChain = null;
      }
      this.chains.splice(index, 1);
    }
  }

  /**
   * Get the user task chain for setting user tasks
   */
  getUserTaskChain(): UserTaskChain {
    return this.userTaskChain;
  }

  /**
   * Convenience method to set a user task
   */
  setUserTask(task: Task): void {
    this.userTaskChain.setUserTask(task);
  }

  /**
   * Cancel the current user task
   */
  cancelUserTask(): void {
    this.userTaskChain.cancel();
  }

  /**
   * Get the currently active chain
   */
  getActiveChain(): TaskChain | null {
    return this.activeChain;
  }

  /**
   * Get all registered chains
   */
  getChains(): readonly TaskChain[] {
    return this.chains;
  }

  /**
   * Main tick method - runs the highest priority active chain
   */
  tick(): void {
    this.emit('tick');

    // Find highest priority active chain
    let maxPriority = ChainPriority.INACTIVE;
    let maxChain: TaskChain | null = null;

    for (const chain of this.chains) {
      if (!chain.isActive()) continue;

      const priority = chain.getPriority();
      if (priority > maxPriority) {
        maxPriority = priority;
        maxChain = chain;
      }
    }

    // Handle chain switching
    if (maxChain !== this.activeChain) {
      const oldChain = this.activeChain;

      // Interrupt old chain
      if (oldChain && maxChain) {
        oldChain.onInterrupt(maxChain);
      }

      this.activeChain = maxChain;
      this.emit('chain_changed', maxChain, oldChain);
    }

    // Tick the active chain
    if (this.activeChain) {
      const taskBefore = this.activeChain.getCurrentTask();
      this.activeChain.onTick();
      const taskAfter = this.activeChain.getCurrentTask();

      // Emit task events
      if (taskBefore !== taskAfter) {
        if (taskBefore) {
          this.emit('task_finished', this.activeChain, taskBefore);
        }
        if (taskAfter) {
          this.emit('task_started', this.activeChain, taskAfter);
        }
      }
    }
  }

  /**
   * Start the task runner (attaches to bot physics tick)
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Option 1: Attach to bot physics tick
    this.bot.on('physicsTick', this.onPhysicsTick);

    // Note: AltoClef runs on client tick, but mineflayer's physicsTick
    // is the closest equivalent (20 times per second)
  }

  /**
   * Stop the task runner
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    this.bot.removeListener('physicsTick', this.onPhysicsTick);

    // Stop all chains
    for (const chain of this.chains) {
      chain.stopTask();
    }
    this.activeChain = null;
  }

  /**
   * Physics tick handler
   */
  private onPhysicsTick = (): void => {
    if (this.running) {
      this.tick();
    }
  };

  /**
   * Check if the runner is currently running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get debug information about current state
   */
  getDebugInfo(): string {
    const lines: string[] = [];
    lines.push(`TaskRunner (${this.running ? 'running' : 'stopped'})`);
    lines.push(`Active Chain: ${this.activeChain?.displayName ?? 'none'}`);
    lines.push('Chains:');

    for (const chain of this.chains) {
      const isActive = chain === this.activeChain;
      const priority = chain.getPriority();
      const task = chain.getCurrentTask();
      const taskInfo = task ? ` -> ${task.getTaskChainString()}` : '';
      lines.push(`  ${isActive ? '>' : ' '} ${chain.displayName} (p=${priority})${taskInfo}`);
    }

    return lines.join('\n');
  }
}

/**
 * Create a TaskRunner and attach it to a bot
 */
export function createTaskRunner(bot: Bot): TaskRunner {
  const runner = new TaskRunner(bot);
  return runner;
}
