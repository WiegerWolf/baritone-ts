import type { Bot } from 'mineflayer';
import type { CalculationContext } from '../../types';

// Elytra flight costs (in ticks, approximate)
export const ELYTRA_TAKEOFF_COST = 10; // Time to jump and deploy
export const ELYTRA_GLIDE_COST_PER_BLOCK = 0.5; // Very fast horizontal movement
export const ELYTRA_BOOST_COST = 5; // Time to use rocket
export const ELYTRA_LAND_COST = 15; // Time to safely land

// Flight physics constants
export const GLIDE_PITCH_OPTIMAL = -10; // Degrees, optimal glide angle
export const DIVE_PITCH_MAX = -60; // Maximum dive angle
export const CLIMB_PITCH_MAX = 45; // Maximum climb angle (with rockets)
export const MIN_HEIGHT_FOR_FLIGHT = 10; // Minimum height above ground to consider flying
export const ROCKET_BOOST_DURATION = 30; // Ticks of boost per rocket

/**
 * Elytra flight state
 */
export enum ElytraState {
    IDLE,
    TAKING_OFF,
    GLIDING,
    BOOSTING,
    LANDING,
    LANDED
}

/**
 * Check if bot has elytra equipped
 */
export function hasElytraEquipped(bot: Bot): boolean {
    const chestSlot = bot.inventory.slots[6]; // Chest armor slot
    return chestSlot?.name === 'elytra';
}

/**
 * Check if bot has firework rockets
 */
export function hasFireworkRockets(bot: Bot): number {
    let count = 0;
    for (const item of bot.inventory.items()) {
        if (item.name === 'firework_rocket') {
            count += item.count;
        }
    }
    return count;
}

/**
 * Calculate height above ground at position
 */
export function getHeightAboveGround(ctx: CalculationContext, x: number, y: number, z: number): number {
    const floorX = Math.floor(x);
    const floorZ = Math.floor(z);

    for (let checkY = Math.floor(y); checkY >= y - 256; checkY--) {
        const block = ctx.getBlock(floorX, checkY, floorZ);
        if (block && ctx.canWalkOn(block)) {
            return y - checkY - 1;
        }
    }

    return 256; // No ground found
}
