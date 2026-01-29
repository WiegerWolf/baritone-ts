/**
 * Base class for processes with common functionality
 */

import type { Bot } from 'mineflayer';
import type { Goal } from '../../types';
import { ProcessPriority } from './ProcessPriority';
import { ProcessState } from './ProcessState';
import type { ProcessTickResult } from './ProcessTickResult';
import type { IProcess } from './IProcess';

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
