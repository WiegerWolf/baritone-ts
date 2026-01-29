/**
 * SingleTaskChain - A chain that always runs a single task determined each tick
 * Common pattern for survival chains (food, escape, MLG)
 */

import { TaskChain } from './TaskChain';
import { Task } from '../base/Task';

/**
 * A chain that always runs a single task determined each tick
 * Common pattern for survival chains (food, escape, MLG)
 */
export abstract class SingleTaskChain extends TaskChain {
    /**
     * Determine the task to run this tick.
     * Return null if no task needed.
     */
    protected abstract getTaskForTick(): Task | null;

    override onTick(): void {
        const newTask = this.getTaskForTick();

        if (newTask === null) {
            // No task needed, stop any existing task
            if (this.mainTask) {
                this.mainTask.stop(null);
                this.mainTask = null;
            }
            return;
        }

        // Check if we need to switch tasks
        if (!newTask.isEqual(this.mainTask)) {
            this.setTask(newTask);
        }

        // Tick the task
        if (this.mainTask) {
            this.mainTask.tick();
        }
    }
}
