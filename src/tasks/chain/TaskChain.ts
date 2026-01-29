/**
 * TaskChain - Priority-Based Task Chain
 * Based on AltoClef's TaskChain.java
 *
 * Task chains compete for execution based on priority. Only the highest
 * priority active chain runs each tick. This enables:
 * - Reactive behavior (defense > food > user task)
 * - Independent concerns (food, survival, combat don't interfere)
 * - Automatic priority-based preemption
 *
 * Chain types:
 * - UserTaskChain: User-initiated tasks (priority ~50)
 * - FoodChain: Automatic eating (priority ~55)
 * - MobDefenseChain: Combat (priority 100 when danger)
 * - WorldSurvivalChain: Lava/fire escape (priority 100)
 * - MLGBucketChain: Fall protection (priority 100 during fall)
 */

import type { Bot } from 'mineflayer';
import type { ITaskChain, ITask } from '../interfaces';
import { Task } from '../base/Task';

/**
 * Abstract base class for task chains
 */
export abstract class TaskChain implements ITaskChain {
    protected bot: Bot;
    protected mainTask: Task | null = null;
    private lastPriority: number = 0;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    /**
     * Display name for logging
     */
    abstract readonly displayName: string;

    /**
     * Get the current priority of this chain.
     * Override to implement dynamic priority based on game state.
     */
    abstract getPriority(): number;

    /**
     * Check if this chain is currently active (has work to do)
     */
    abstract isActive(): boolean;

    /**
     * Called every tick while this chain has the highest priority
     */
    onTick(): void {
        if (this.mainTask) {
            this.mainTask.tick();

            // Check if task finished
            if (this.mainTask.isFinished()) {
                this.mainTask.stop(null);
                this.mainTask = null;
            }
        }
    }

    /**
     * Called when this chain is interrupted by a higher-priority chain
     */
    onInterrupt(interruptingChain: ITaskChain): void {
        // By default, pause but don't stop the task
        // Subclasses can override to stop tasks on interrupt
    }

    /**
     * Get the current task being executed
     */
    getCurrentTask(): Task | null {
        return this.mainTask;
    }

    /**
     * Set the main task for this chain
     */
    protected setTask(task: Task | null): void {
        if (this.mainTask && task) {
            if (!task.isEqual(this.mainTask)) {
                this.mainTask.stop(task);
                this.mainTask = task;
            }
        } else {
            if (this.mainTask) {
                this.mainTask.stop(task);
            }
            this.mainTask = task;
        }
    }

    /**
     * Stop the current task
     */
    stopTask(): void {
        if (this.mainTask) {
            this.mainTask.stop(null);
            this.mainTask = null;
        }
    }
}
