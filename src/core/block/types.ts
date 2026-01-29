/**
 * Types for block interaction
 */

import type { Vec3 } from 'vec3';
import type { BlockPos } from '../../types';

/**
 * State for block breaking operations
 */
export interface BreakingState {
    target: BlockPos | null;
    started: boolean;
    ticksSinceStart: number;
    toolEquipped: boolean;
}

/**
 * State for block placing operations
 */
export interface PlacingState {
    target: BlockPos | null;
    referenceBlock: BlockPos | null;
    faceVector: Vec3 | null;
    started: boolean;
    sneaking: boolean;
}

/**
 * State for water bucket operations
 */
export interface WaterBucketState {
    active: boolean;
    placedWaterAt: BlockPos | null;
    needsPickup: boolean;
}
