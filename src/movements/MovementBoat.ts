import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { CalculationContext, BlockPos, COST_INF } from '../types';

/**
 * MovementBoat handles boat travel on water
 * Based on Baritone's boat behavior
 *
 * NOTE: Boat movements don't fit into the standard block-based A* system.
 * They are used as an alternative for crossing bodies of water.
 *
 * Features:
 * - Board nearby boats
 * - Navigate on water surface
 * - Disembark at destination
 * - Optimal water routing
 */

// Boat travel costs (in ticks)
export const BOAT_BOARD_COST = 10; // Time to get in boat
export const BOAT_TRAVEL_COST_PER_BLOCK = 1.5; // Faster than swimming (9.091), slower than sprinting (3.564)
export const BOAT_DISEMBARK_COST = 5; // Time to exit boat
export const BOAT_PLACE_COST = 15; // Time to place boat item

// Boat physics
const BOAT_SPEED = 8.0; // Blocks per second (with W held)
const BOAT_ROTATION_SPEED = 90; // Degrees per second
const BOAT_SEARCH_RADIUS = 5; // Search for nearby boats

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
 * BoatController - handles boat travel execution
 */
export class BoatController {
  private bot: Bot;
  private ctx: CalculationContext;
  private state: BoatState = BoatState.IDLE;
  private target: Vec3 | null = null;
  private targetBoat: Entity | null = null;

  constructor(bot: Bot, ctx: CalculationContext) {
    this.bot = bot;
    this.ctx = ctx;
  }

  /**
   * Start boat travel to target
   */
  startTravel(target: Vec3): boolean {
    // Check if water is available
    const startY = findWaterSurface(
      this.ctx,
      Math.floor(this.bot.entity.position.x),
      Math.floor(this.bot.entity.position.z),
      Math.floor(this.bot.entity.position.y)
    );

    if (startY === null && !isInBoat(this.bot)) {
      return false;
    }

    this.target = target;
    this.state = isInBoat(this.bot) ? BoatState.TRAVELING : BoatState.FINDING_BOAT;
    return true;
  }

  /**
   * Stop boat travel
   */
  stopTravel(): void {
    this.state = BoatState.IDLE;
    this.target = null;
    this.bot.setControlState('forward', false);
    this.bot.setControlState('back', false);
  }

  /**
   * Get current state
   */
  getState(): BoatState {
    return this.state;
  }

  /**
   * Tick boat travel execution
   * Returns true when travel is complete
   */
  tick(): boolean {
    if (!this.target && this.state !== BoatState.IDLE) {
      this.state = BoatState.IDLE;
      return true;
    }

    switch (this.state) {
      case BoatState.IDLE:
        return true;

      case BoatState.FINDING_BOAT:
        // Look for nearby boat or place one
        this.targetBoat = findNearbyBoat(this.bot);

        if (this.targetBoat) {
          this.state = BoatState.BOARDING;
        } else if (hasBoatItem(this.bot)) {
          // Place a boat
          this.placeBoat();
        } else {
          // Can't proceed without boat
          this.state = BoatState.FINISHED;
          return true;
        }
        return false;

      case BoatState.BOARDING:
        if (isInBoat(this.bot)) {
          this.state = BoatState.TRAVELING;
          return false;
        }

        // Move toward and board boat
        if (this.targetBoat && this.targetBoat.isValid) {
          const dist = this.bot.entity.position.distanceTo(this.targetBoat.position);

          if (dist < 3) {
            // Mount the boat
            this.bot.mount(this.targetBoat);
          } else {
            // Move toward boat
            this.bot.lookAt(this.targetBoat.position);
            this.bot.setControlState('forward', true);
          }
        } else {
          // Boat disappeared, find another
          this.state = BoatState.FINDING_BOAT;
        }
        return false;

      case BoatState.TRAVELING:
        if (!isInBoat(this.bot)) {
          // Fell out of boat?
          this.state = BoatState.FINDING_BOAT;
          return false;
        }

        const pos = this.bot.entity.position;
        const distToTarget = pos.distanceTo(this.target!);

        if (distToTarget < 3) {
          this.state = BoatState.DISEMBARKING;
          return false;
        }

        // Navigate toward target
        this.navigateToward(this.target!);
        return false;

      case BoatState.DISEMBARKING:
        this.bot.setControlState('forward', false);

        if (!isInBoat(this.bot)) {
          this.state = BoatState.FINISHED;
          return true;
        }

        // Dismount
        this.bot.dismount();
        return false;

      case BoatState.FINISHED:
        return true;

      default:
        return true;
    }
  }

  /**
   * Navigate boat toward a position
   */
  private navigateToward(target: Vec3): void {
    const pos = this.bot.entity.position;

    // Calculate direction
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;

    // Calculate yaw
    const yaw = Math.atan2(-dx, dz);

    this.bot.look(yaw, 0, false);
    this.bot.setControlState('forward', true);
  }

  /**
   * Place a boat on water
   */
  private async placeBoat(): Promise<void> {
    const boatItem = this.bot.inventory.items().find(i =>
      i.name.includes('boat') && !i.name.includes('chest_boat')
    );

    if (boatItem) {
      try {
        await this.bot.equip(boatItem, 'hand');

        // Look at water below/ahead
        const pos = this.bot.entity.position;
        const waterY = findWaterSurface(
          this.ctx,
          Math.floor(pos.x),
          Math.floor(pos.z),
          Math.floor(pos.y)
        );

        if (waterY !== null) {
          await this.bot.lookAt(new Vec3(pos.x, waterY, pos.z));
          this.bot.activateItem();

          // Wait for boat to spawn
          setTimeout(() => {
            this.targetBoat = findNearbyBoat(this.bot);
            if (this.targetBoat) {
              this.state = BoatState.BOARDING;
            }
          }, 500);
        }
      } catch {
        // Ignore equip errors
      }
    }
  }
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
