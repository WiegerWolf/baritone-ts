/**
 * Result of a process tick
 */

import type { Goal } from '../../types';

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
