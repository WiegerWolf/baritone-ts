import { Vec3 } from 'vec3';
import type { CalculationContext } from '../../types';
import { BlockPos, COST_INF } from '../../types';
import {
    ELYTRA_GLIDE_COST_PER_BLOCK,
    ELYTRA_BOOST_COST,
    hasFireworkRockets,
    MIN_HEIGHT_FOR_FLIGHT
} from './ElytraConstants';

/**
 * Check if position is safe for landing
 */
export function isSafeLandingSpot(ctx: CalculationContext, x: number, y: number, z: number): boolean {
    const ground = ctx.getBlock(x, y - 1, z);
    const body1 = ctx.getBlock(x, y, z);
    const body2 = ctx.getBlock(x, y + 1, z);

    if (!ground || !body1 || !body2) return false;

    return ctx.canWalkOn(ground) &&
        ctx.canWalkThrough(body1) &&
        ctx.canWalkThrough(body2);
}

/**
 * Find safe landing spot near target
 */
export function findLandingSpot(
    ctx: CalculationContext,
    targetX: number,
    targetY: number,
    targetZ: number,
    searchRadius: number = 5
): BlockPos | null {
    // Search in expanding squares
    for (let r = 0; r <= searchRadius; r++) {
        for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
                if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue; // Only check perimeter

                const x = Math.floor(targetX) + dx;
                const z = Math.floor(targetZ) + dz;

                // Search vertically for landing spot
                for (let dy = 5; dy >= -5; dy--) {
                    const y = Math.floor(targetY) + dy;
                    if (isSafeLandingSpot(ctx, x, y, z)) {
                        return new BlockPos(x, y, z);
                    }
                }
            }
        }
    }

    return null;
}

/**
 * Calculate flight cost between two points
 */
export function calculateFlightCost(
    from: Vec3,
    to: Vec3,
    hasRockets: boolean
): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;

    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    let cost = ELYTRA_GLIDE_COST_PER_BLOCK * horizontalDist;

    // Climbing requires rockets
    if (dy > 0) {
        if (!hasRockets) {
            return COST_INF; // Can't climb without rockets
        }
        // Each rocket gives about 10 blocks of climb
        const rocketsNeeded = Math.ceil(dy / 10);
        cost += rocketsNeeded * ELYTRA_BOOST_COST;
    }

    // Diving is faster
    if (dy < 0) {
        cost *= 0.8; // 20% faster when descending
    }

    return cost;
}

export type ElytraPathSegmentType = 'takeoff' | 'glide' | 'boost' | 'land';

/**
 * Elytra path segment - represents a flight path
 */
export interface ElytraPathSegment {
    type: ElytraPathSegmentType;
    from: Vec3;
    to: Vec3;
    cost: number;
}

/**
 * Plan an elytra flight path between two points
 */
export function planElytraPath(
    ctx: CalculationContext,
    start: Vec3,
    goal: Vec3,
    maxWaypoints: number = 10
): ElytraPathSegment[] | null {
    const { hasElytraEquipped, getHeightAboveGround } = require('./ElytraConstants');

    if (!hasElytraEquipped(ctx.bot)) {
        return null;
    }

    const hasRockets = hasFireworkRockets(ctx.bot) > 0;
    const segments: ElytraPathSegment[] = [];

    // Check if we need to take off
    const startHeight = getHeightAboveGround(ctx, start.x, start.y, start.z);
    if (startHeight < MIN_HEIGHT_FOR_FLIGHT) {
        // Can't fly from here - need to find takeoff point
        return null;
    }

    // Takeoff segment
    const { ELYTRA_TAKEOFF_COST, ELYTRA_LAND_COST } = require('./ElytraConstants');
    segments.push({
        type: 'takeoff',
        from: start,
        to: new Vec3(start.x, start.y + 5, start.z),
        cost: ELYTRA_TAKEOFF_COST
    });

    // Check if we can reach goal directly
    const directCost = calculateFlightCost(start, goal, hasRockets);
    if (directCost < COST_INF) {
        // Simple case - direct flight
        segments.push({
            type: 'glide',
            from: start,
            to: goal,
            cost: directCost
        });

        // Land
        const landingSpot = findLandingSpot(ctx, goal.x, goal.y, goal.z);
        if (landingSpot) {
            segments.push({
                type: 'land',
                from: goal,
                to: new Vec3(landingSpot.x, landingSpot.y, landingSpot.z),
                cost: ELYTRA_LAND_COST
            });
        }

        return segments;
    }

    // Need waypoints for climbing (rocket-assisted)
    if (goal.y > start.y && hasRockets) {
        const heightDiff = goal.y - start.y;
        const numClimbs = Math.ceil(heightDiff / 20); // Climb in 20-block segments

        let currentPos = start.clone();
        for (let i = 0; i < numClimbs && i < maxWaypoints; i++) {
            const nextY = Math.min(currentPos.y + 20, goal.y);
            const progress = (i + 1) / numClimbs;
            const nextX = start.x + (goal.x - start.x) * progress;
            const nextZ = start.z + (goal.z - start.z) * progress;

            const nextPos = new Vec3(nextX, nextY, nextZ);

            segments.push({
                type: 'boost',
                from: currentPos,
                to: nextPos,
                cost: calculateFlightCost(currentPos, nextPos, true)
            });

            currentPos = nextPos;
        }

        // Final glide to goal
        if (currentPos.distanceTo(goal) > 1) {
            segments.push({
                type: 'glide',
                from: currentPos,
                to: goal,
                cost: calculateFlightCost(currentPos, goal, true)
            });
        }

        // Land
        const landingSpot = findLandingSpot(ctx, goal.x, goal.y, goal.z);
        if (landingSpot) {
            segments.push({
                type: 'land',
                from: goal,
                to: new Vec3(landingSpot.x, landingSpot.y, landingSpot.z),
                cost: ELYTRA_LAND_COST
            });
        }

        return segments;
    }

    return null;
}

/**
 * Check if elytra flight is viable for the distance
 */
export function isElytraViable(
    ctx: CalculationContext,
    start: Vec3,
    goal: Vec3,
    walkingCost: number
): boolean {
    const { hasElytraEquipped, getHeightAboveGround } = require('./ElytraConstants');

    if (!hasElytraEquipped(ctx.bot)) return false;

    const startHeight = getHeightAboveGround(ctx, start.x, start.y, start.z);
    if (startHeight < MIN_HEIGHT_FOR_FLIGHT) return false;

    const hasRockets = hasFireworkRockets(ctx.bot) > 0;
    const flightCost = calculateFlightCost(start, goal, hasRockets);

    // Elytra is viable if it's significantly faster
    return flightCost < walkingCost * 0.5;
}
