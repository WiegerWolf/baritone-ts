import { Vec3 } from 'vec3';

// Cost to interact with a door/gate (ticks)
export const DOOR_OPEN_COST = 2.0;

// Door block names
const DOOR_BLOCKS = new Set([
    'oak_door', 'spruce_door', 'birch_door', 'jungle_door',
    'acacia_door', 'dark_oak_door', 'mangrove_door', 'cherry_door',
    'bamboo_door', 'crimson_door', 'warped_door',
    'iron_door' // Needs redstone, handled separately
]);

// Fence gate block names
const FENCE_GATE_BLOCKS = new Set([
    'oak_fence_gate', 'spruce_fence_gate', 'birch_fence_gate', 'jungle_fence_gate',
    'acacia_fence_gate', 'dark_oak_fence_gate', 'mangrove_fence_gate', 'cherry_fence_gate',
    'bamboo_fence_gate', 'crimson_fence_gate', 'warped_fence_gate'
]);

// Trapdoor block names
const TRAPDOOR_BLOCKS = new Set([
    'oak_trapdoor', 'spruce_trapdoor', 'birch_trapdoor', 'jungle_trapdoor',
    'acacia_trapdoor', 'dark_oak_trapdoor', 'mangrove_trapdoor', 'cherry_trapdoor',
    'bamboo_trapdoor', 'crimson_trapdoor', 'warped_trapdoor',
    'iron_trapdoor' // Needs redstone
]);

/**
 * Check if a block is a door
 */
export function isDoor(blockName: string): boolean {
    return DOOR_BLOCKS.has(blockName);
}

/**
 * Check if a block is a fence gate
 */
export function isFenceGate(blockName: string): boolean {
    return FENCE_GATE_BLOCKS.has(blockName);
}

/**
 * Check if a block is a trapdoor
 */
export function isTrapdoor(blockName: string): boolean {
    return TRAPDOOR_BLOCKS.has(blockName);
}

/**
 * Check if a block is any openable barrier
 */
export function isOpenable(blockName: string): boolean {
    return isDoor(blockName) || isFenceGate(blockName) || isTrapdoor(blockName);
}

/**
 * Check if a door/gate requires redstone
 */
export function requiresRedstone(blockName: string): boolean {
    return blockName === 'iron_door' || blockName === 'iron_trapdoor';
}
