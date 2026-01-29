/**
 * WrapperTask - A task that wraps another task (decorator pattern)
 */

import type { Bot } from 'mineflayer';
import type { ITask } from '../interfaces';
import { Task } from './Task';

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
