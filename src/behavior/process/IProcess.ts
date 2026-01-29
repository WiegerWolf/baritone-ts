/**
 * Base interface for all processes
 */

import type { ProcessPriority } from './ProcessPriority';
import type { ProcessState } from './ProcessState';
import type { ProcessTickResult } from './ProcessTickResult';

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
