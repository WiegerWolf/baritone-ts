/**
 * UserTaskChain - A chain for user-initiated tasks
 * Only active when a task has been explicitly set
 */

import { TaskChain } from './TaskChain';
import { Task } from '../base/Task';
import { ChainPriority } from './ChainPriority';

/**
 * A chain for user-initiated tasks
 * Only active when a task has been explicitly set
 */
export class UserTaskChain extends TaskChain {
    readonly displayName = 'UserTaskChain';

    getPriority(): number {
        return this.mainTask ? ChainPriority.USER_TASK : ChainPriority.INACTIVE;
    }

    isActive(): boolean {
        return this.mainTask !== null && !this.mainTask.isFinished();
    }

    /**
     * Set a user task to execute
     */
    setUserTask(task: Task): void {
        this.setTask(task);
    }

    /**
     * Cancel the current user task
     */
    cancel(): void {
        this.stopTask();
    }

    /**
     * Check if there's an active user task
     */
    hasTask(): boolean {
        return this.mainTask !== null;
    }
}
