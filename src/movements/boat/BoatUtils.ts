import { Vec3 } from 'vec3';
import type { CalculationContext } from '../../types';
import {
    BOAT_BOARD_COST,
    BOAT_TRAVEL_COST_PER_BLOCK,
    BOAT_DISEMBARK_COST,
    isInBoat,
    findNearbyBoat,
    hasBoatItem
} from './BoatConstants';

/**
 * Check if position is on water surface
 */
export function isWaterSurface(ctx: CalculationContext, x: number, y: number, z: number): boolean {
    const current = ctx.getBlock(x, y, z);
    const above = ctx.getBlock(x, y + 1, z);
    const below = ctx.getBlock(x, y - 1, z);

    if (!current || !above) return false;

    // Water at current level, air above
    const isWater = current.name === 'water';
    const isAirAbove = ctx.canWalkThrough(above);

    // Can also be on water with water below
    const isWaterBelow = below?.name === 'water';

    return (isWater && isAirAbove) || (isAirAbove && isWaterBelow);
}

/**
 * Find water surface height at position
 */
export function findWaterSurface(ctx: CalculationContext, x: number, z: number, startY: number): number | null {
    // Search from startY downward for water surface
    for (let y = startY; y >= startY - 20; y--) {
        if (isWaterSurface(ctx, x, y, z)) {
            return y;
        }
    }

    // Search upward
    for (let y = startY + 1; y <= startY + 10; y++) {
        if (isWaterSurface(ctx, x, y, z)) {
            return y;
        }
    }

    return null;
}

/**
 * Check if there's a clear water path between two points
 */
export function hasWaterPath(
    ctx: CalculationContext,
    from: Vec3,
    to: Vec3
): boolean {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.ceil(dist);

    for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const x = Math.floor(from.x + dx * t);
        const z = Math.floor(from.z + dz * t);

        // Check if there's water at this position
        const surfaceY = findWaterSurface(ctx, x, z, Math.floor(from.y));
        if (surfaceY === null) {
            return false;
        }
    }

    return true;
}

/**
 * Boat path segment - represents a boat travel segment
 */
export interface BoatPathSegment {
    type: 'board' | 'travel' | 'disembark';
    from: Vec3;
    to: Vec3;
    cost: number;
}

/**
 * Plan boat route between two points
 */
export function planBoatPath(
    ctx: CalculationContext,
    start: Vec3,
    goal: Vec3
): BoatPathSegment[] | null {
    const segments: BoatPathSegment[] = [];

    // Find water near start
    const startWaterY = findWaterSurface(
        ctx,
        Math.floor(start.x),
        Math.floor(start.z),
        Math.floor(start.y)
    );
    if (startWaterY === null) {
        return null; // No water near start
    }

    // Find landing spot near goal
    const goalWaterY = findWaterSurface(
        ctx,
        Math.floor(goal.x),
        Math.floor(goal.z),
        Math.floor(goal.y)
    );

    // Board boat
    const alreadyInBoat = isInBoat(ctx.bot);
    segments.push({
        type: 'board',
        from: start,
        to: new Vec3(start.x, startWaterY, start.z),
        cost: alreadyInBoat ? 0 : BOAT_BOARD_COST
    });

    // Travel
    const travelDest = goalWaterY !== null
        ? new Vec3(goal.x, goalWaterY, goal.z)
        : new Vec3(goal.x, startWaterY, goal.z);

    const travelDist = new Vec3(start.x, startWaterY, start.z).distanceTo(travelDest);

    segments.push({
        type: 'travel',
        from: new Vec3(start.x, startWaterY, start.z),
        to: travelDest,
        cost: travelDist * BOAT_TRAVEL_COST_PER_BLOCK
    });

    // Disembark if goal is on land
    if (goalWaterY === null || !isWaterSurface(ctx, Math.floor(goal.x), Math.floor(goal.y), Math.floor(goal.z))) {
        segments.push({
            type: 'disembark',
            from: travelDest,
            to: goal,
            cost: BOAT_DISEMBARK_COST
        });
    }

    return segments;
}

/**
 * Check if boat travel is viable
 */
export function isBoatViable(
    ctx: CalculationContext,
    start: Vec3,
    goal: Vec3,
    swimmingCost: number
): boolean {
    // Need boat or boat item
    if (!isInBoat(ctx.bot) && !findNearbyBoat(ctx.bot) && !hasBoatItem(ctx.bot)) {
        return false;
    }

    // Need water at start
    const startWaterY = findWaterSurface(
        ctx,
        Math.floor(start.x),
        Math.floor(start.z),
        Math.floor(start.y)
    );
    if (startWaterY === null) {
        return false;
    }

    // Calculate boat cost
    const dist = start.distanceTo(goal);
    const boatCost = BOAT_BOARD_COST + dist * BOAT_TRAVEL_COST_PER_BLOCK + BOAT_DISEMBARK_COST;

    // Boat is viable if significantly faster than swimming
    return boatCost < swimmingCost * 0.5;
}
