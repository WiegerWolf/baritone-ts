/**
 * Block interaction helpers
 * Barrel export for all block-related classes and utilities
 */

// Types
export type { BreakingState, PlacingState, WaterBucketState } from './types';

// Classes
export { BlockBreakHelper } from './BlockBreakHelper';
export { BlockPlaceHelper } from './BlockPlaceHelper';
export { WaterBucketHelper } from './WaterBucketHelper';

// Utility functions
export {
    calculateFaceVector,
    findReferenceBlock,
    canReachBlock,
    calculateLookRotation
} from './utils';
