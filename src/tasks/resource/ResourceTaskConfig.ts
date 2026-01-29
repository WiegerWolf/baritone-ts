/**
 * Configuration for ResourceTask behavior
 */

export interface ResourceTaskConfig {
    /** Whether to pick up dropped items */
    pickupEnabled: boolean;
    /** Whether to loot containers */
    containerLootEnabled: boolean;
    /** Whether to mine blocks */
    miningEnabled: boolean;
    /** Whether to craft items */
    craftingEnabled: boolean;
    /** Maximum distance to search for pickups */
    pickupRange: number;
    /** Maximum distance to search for containers */
    containerRange: number;
    /** Maximum distance for mining */
    miningRange: number;
}

export const DEFAULT_CONFIG: ResourceTaskConfig = {
    pickupEnabled: true,
    containerLootEnabled: true,
    miningEnabled: true,
    craftingEnabled: true,
    pickupRange: 32,
    containerRange: 64,
    miningRange: 128,
};
