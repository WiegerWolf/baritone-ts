import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { CalculationContext, MovementStatus, BlockPos, COST_INF } from '../types';

/**
 * MovementElytra handles elytra flight movements
 * Based on Baritone's elytra behavior system
 *
 * NOTE: Elytra movements don't fit into the standard block-based A* system.
 * They are used as an alternative high-level path planner for long distances.
 *
 * Features:
 * - Takeoff from ground or while falling
 * - Gliding between points
 * - Firework rocket boost management
 * - Landing detection and execution
 * - Flight path optimization
 */

// Elytra flight costs (in ticks, approximate)
export const ELYTRA_TAKEOFF_COST = 10; // Time to jump and deploy
export const ELYTRA_GLIDE_COST_PER_BLOCK = 0.5; // Very fast horizontal movement
export const ELYTRA_BOOST_COST = 5; // Time to use rocket
export const ELYTRA_LAND_COST = 15; // Time to safely land

// Flight physics constants
const GLIDE_PITCH_OPTIMAL = -10; // Degrees, optimal glide angle
const DIVE_PITCH_MAX = -60; // Maximum dive angle
const CLIMB_PITCH_MAX = 45; // Maximum climb angle (with rockets)
const MIN_HEIGHT_FOR_FLIGHT = 10; // Minimum height above ground to consider flying
const ROCKET_BOOST_DURATION = 30; // Ticks of boost per rocket

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

/**
 * Elytra path segment - represents a flight path
 */
export interface ElytraPathSegment {
  type: 'takeoff' | 'glide' | 'boost' | 'land';
  from: Vec3;
  to: Vec3;
  cost: number;
}

/**
 * ElytraController - handles elytra flight execution
 */
export class ElytraController {
  private bot: Bot;
  private ctx: CalculationContext;
  private state: ElytraState = ElytraState.IDLE;
  private target: Vec3 | null = null;
  private lastRocketTick: number = 0;

  constructor(bot: Bot, ctx: CalculationContext) {
    this.bot = bot;
    this.ctx = ctx;
  }

  /**
   * Start flying to target
   */
  startFlight(target: Vec3): boolean {
    if (!hasElytraEquipped(this.bot)) {
      return false;
    }

    this.target = target;
    this.state = ElytraState.TAKING_OFF;
    return true;
  }

  /**
   * Stop flight
   */
  stopFlight(): void {
    this.state = ElytraState.IDLE;
    this.target = null;
    this.bot.setControlState('jump', false);
  }

  /**
   * Get current state
   */
  getState(): ElytraState {
    return this.state;
  }

  /**
   * Tick flight execution
   * Returns true when flight is complete
   */
  tick(): boolean {
    if (!this.target) return true;

    const pos = this.bot.entity.position;
    const distToTarget = pos.distanceTo(this.target);

    switch (this.state) {
      case ElytraState.IDLE:
        return true;

      case ElytraState.TAKING_OFF:
        // Jump to start flight
        this.bot.setControlState('jump', true);

        // Check if we're airborne enough to start gliding
        if (this.bot.entity.velocity.y > 0.1) {
          // @ts-ignore - elytraFly may not be in type definitions
          if (typeof this.bot.elytraFly === 'function') {
            this.bot.elytraFly();
          }
          this.bot.setControlState('jump', false);
          this.state = ElytraState.GLIDING;
        }
        return false;

      case ElytraState.GLIDING:
        // Check if arrived
        if (distToTarget < 5) {
          this.state = ElytraState.LANDING;
          return false;
        }

        // Navigate toward target
        this.navigateToward(this.target);

        // Check if we need to boost
        const heightAboveGround = getHeightAboveGround(this.ctx, pos.x, pos.y, pos.z);
        if (this.target.y > pos.y + 5 || heightAboveGround < 20) {
          if (hasFireworkRockets(this.bot) > 0) {
            this.state = ElytraState.BOOSTING;
          }
        }
        return false;

      case ElytraState.BOOSTING:
        // Use rocket
        const currentTick = Date.now();
        if (currentTick - this.lastRocketTick > ROCKET_BOOST_DURATION * 50) {
          this.useRocket();
          this.lastRocketTick = currentTick;
        }

        this.navigateToward(this.target);

        // Return to gliding after boost
        this.state = ElytraState.GLIDING;
        return false;

      case ElytraState.LANDING:
        // Find landing spot
        const landingSpot = findLandingSpot(
          this.ctx,
          this.target.x,
          this.target.y,
          this.target.z
        );

        if (landingSpot) {
          this.navigateToward(new Vec3(landingSpot.x + 0.5, landingSpot.y, landingSpot.z + 0.5));
        }

        // Check if landed
        if (this.bot.entity.onGround) {
          this.state = ElytraState.LANDED;
          return true;
        }
        return false;

      case ElytraState.LANDED:
        return true;

      default:
        return true;
    }
  }

  /**
   * Navigate toward a position
   */
  private navigateToward(target: Vec3): void {
    const pos = this.bot.entity.position;

    // Calculate direction
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const dz = target.z - pos.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    // Calculate yaw
    const yaw = Math.atan2(-dx, dz);

    // Calculate pitch based on vertical difference
    let pitch: number;
    if (dy > 10) {
      pitch = CLIMB_PITCH_MAX * Math.PI / 180;
    } else if (dy < -20) {
      pitch = DIVE_PITCH_MAX * Math.PI / 180;
    } else {
      pitch = GLIDE_PITCH_OPTIMAL * Math.PI / 180;
    }

    this.bot.look(yaw, pitch, true);
  }

  /**
   * Use a firework rocket
   */
  private async useRocket(): Promise<void> {
    const rockets = this.bot.inventory.items().find(i => i.name === 'firework_rocket');
    if (rockets) {
      try {
        await this.bot.equip(rockets, 'hand');
        this.bot.activateItem();
      } catch {
        // Ignore equip errors
      }
    }
  }
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
  if (!hasElytraEquipped(ctx.bot)) return false;

  const startHeight = getHeightAboveGround(ctx, start.x, start.y, start.z);
  if (startHeight < MIN_HEIGHT_FOR_FLIGHT) return false;

  const hasRockets = hasFireworkRockets(ctx.bot) > 0;
  const flightCost = calculateFlightCost(start, goal, hasRockets);

  // Elytra is viable if it's significantly faster
  return flightCost < walkingCost * 0.5;
}
