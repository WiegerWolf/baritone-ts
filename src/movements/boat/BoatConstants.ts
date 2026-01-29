import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';

// Boat travel costs (in ticks)
export const BOAT_BOARD_COST = 10; // Time to get in boat
export const BOAT_TRAVEL_COST_PER_BLOCK = 1.5; // Faster than swimming (9.091), slower than sprinting (3.564)
export const BOAT_DISEMBARK_COST = 5; // Time to exit boat
export const BOAT_PLACE_COST = 15; // Time to place boat item

// Boat physics
export const BOAT_SPEED = 8.0; // Blocks per second (with W held)
export const BOAT_ROTATION_SPEED = 90; // Degrees per second
export const BOAT_SEARCH_RADIUS = 5; // Search for nearby boats

/**
 * Boat travel state
 */
export enum BoatState {
    IDLE,
    FINDING_BOAT,
    BOARDING,
    TRAVELING,
    DISEMBARKING,
    FINISHED
}

/**
 * Check if bot is in a boat
 */
export function isInBoat(bot: Bot): boolean {
    // @ts-ignore - vehicle property may not be in type definitions
    const vehicle = bot.vehicle;
    return vehicle !== null && vehicle !== undefined && (vehicle.name?.includes('boat') || false);
}

/**
 * Find nearby boat entity
 */
export function findNearbyBoat(bot: Bot): Entity | null {
    const pos = bot.entity.position;
    const radiusSq = BOAT_SEARCH_RADIUS * BOAT_SEARCH_RADIUS;

    let nearestBoat: Entity | null = null;
    let nearestDistSq = Infinity;

    for (const entity of Object.values(bot.entities)) {
        if (!entity.name?.includes('boat')) continue;
        if (!entity.isValid) continue;

        const distSq = entity.position.distanceSquared(pos);
        if (distSq < radiusSq && distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearestBoat = entity;
        }
    }

    return nearestBoat;
}

/**
 * Check if bot has boat item
 */
export function hasBoatItem(bot: Bot): boolean {
    return bot.inventory.items().some(item =>
        item.name.includes('boat') && !item.name.includes('chest_boat')
    );
}
