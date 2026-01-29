/**
 * BoatTask - Boat/Vehicle Handling
 * Based on AltoClef patterns
 *
 * Handles finding, entering, controlling boats,
 * and navigating over water.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { InteractEntityTask } from '../concrete/InteractTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for boat handling
 */
enum BoatState {
  FINDING_BOAT,
  APPROACHING,
  ENTERING,
  NAVIGATING,
  EXITING,
  FINISHED,
  FAILED
}

/**
 * Configuration for boat task
 */
export interface BoatConfig {
  /** Target position to navigate to */
  targetX: number;
  targetZ: number;
  /** Search radius for existing boat */
  searchRadius: number;
  /** Place boat if not found */
  placeBoatIfNeeded: boolean;
  /** Exit boat when reaching destination */
  exitOnArrival: boolean;
  /** Arrival distance threshold */
  arrivalDistance: number;
}

const DEFAULT_CONFIG: Partial<BoatConfig> = {
  searchRadius: 32,
  placeBoatIfNeeded: true,
  exitOnArrival: true,
  arrivalDistance: 5,
};

/**
 * Boat entity types
 */
const BOAT_TYPES = [
  'boat', 'oak_boat', 'spruce_boat', 'birch_boat',
  'jungle_boat', 'acacia_boat', 'dark_oak_boat',
  'mangrove_boat', 'cherry_boat', 'bamboo_raft',
  'oak_chest_boat', 'spruce_chest_boat', 'birch_chest_boat',
  'jungle_chest_boat', 'acacia_chest_boat', 'dark_oak_chest_boat',
  'mangrove_chest_boat', 'cherry_chest_boat', 'bamboo_chest_raft',
];

/**
 * Task for boat navigation
 */
export class BoatTask extends Task {
  private config: BoatConfig;
  private state: BoatState = BoatState.FINDING_BOAT;
  private targetBoat: Entity | null = null;
  private navTimer: TimerGame;
  private isInBoat: boolean = false;

  constructor(bot: Bot, targetX: number, targetZ: number, config: Partial<BoatConfig> = {}) {
    super(bot);
    this.config = {
      ...DEFAULT_CONFIG,
      targetX,
      targetZ,
      ...config
    } as BoatConfig;
    this.navTimer = new TimerGame(bot, 0.5);
  }

  get displayName(): string {
    const dist = this.getDistanceToTarget();
    return `Boat(${this.config.targetX}, ${this.config.targetZ}, dist: ${Math.round(dist)}, ${BoatState[this.state]})`;
  }

  onStart(): void {
    this.state = BoatState.FINDING_BOAT;
    this.targetBoat = null;
    this.isInBoat = false;
  }

  onTick(): Task | null {
    // Check if arrived
    if (this.state === BoatState.NAVIGATING && this.hasArrived()) {
      if (this.config.exitOnArrival) {
        this.state = BoatState.EXITING;
      } else {
        this.state = BoatState.FINISHED;
      }
    }

    switch (this.state) {
      case BoatState.FINDING_BOAT:
        return this.handleFindingBoat();

      case BoatState.APPROACHING:
        return this.handleApproaching();

      case BoatState.ENTERING:
        return this.handleEntering();

      case BoatState.NAVIGATING:
        return this.handleNavigating();

      case BoatState.EXITING:
        return this.handleExiting();

      default:
        return null;
    }
  }

  private handleFindingBoat(): Task | null {
    // Check if already in boat
    if (this.isRidingBoat()) {
      this.isInBoat = true;
      this.state = BoatState.NAVIGATING;
      return null;
    }

    this.targetBoat = this.findNearestBoat();

    if (this.targetBoat) {
      this.state = BoatState.APPROACHING;
      return null;
    }

    // No boat found
    if (this.config.placeBoatIfNeeded && this.hasBoatItem()) {
      // Place boat in water
      const placed = this.placeBoat();
      if (placed) {
        this.state = BoatState.FINDING_BOAT;
        return null;
      }
    }

    this.state = BoatState.FAILED;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.targetBoat || !this.targetBoat.isValid) {
      this.state = BoatState.FINDING_BOAT;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.targetBoat.position);
    if (dist <= 3.0) {
      this.state = BoatState.ENTERING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.targetBoat.position.x),
      Math.floor(this.targetBoat.position.y),
      Math.floor(this.targetBoat.position.z),
      2
    );
  }

  private handleEntering(): Task | null {
    if (this.isRidingBoat()) {
      this.isInBoat = true;
      this.state = BoatState.NAVIGATING;
      return null;
    }

    if (!this.targetBoat || !this.targetBoat.isValid) {
      this.state = BoatState.FINDING_BOAT;
      return null;
    }

    // Right-click boat to enter
    return new InteractEntityTask(this.bot, this.targetBoat.id);
  }

  private handleNavigating(): Task | null {
    if (!this.isRidingBoat()) {
      this.isInBoat = false;
      this.state = BoatState.FINDING_BOAT;
      return null;
    }

    if (!this.navTimer.elapsed()) {
      return null;
    }

    // Navigate toward target
    this.navigateToward(this.config.targetX, this.config.targetZ);
    this.navTimer.reset();

    return null;
  }

  private handleExiting(): Task | null {
    if (!this.isRidingBoat()) {
      this.isInBoat = false;
      this.state = BoatState.FINISHED;
      return null;
    }

    // Dismount boat
    try {
      this.bot.dismount();
    } catch {
      // Sneak to dismount as fallback
      this.bot.setControlState('sneak', true);
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.targetBoat = null;
    this.isInBoat = false;
  }

  isFinished(): boolean {
    return this.state === BoatState.FINISHED || this.state === BoatState.FAILED;
  }

  isFailed(): boolean {
    return this.state === BoatState.FAILED;
  }

  // ---- Helper Methods ----

  private isRidingBoat(): boolean {
    const bot = this.bot as any;
    const vehicle = bot.vehicle;
    if (!vehicle) return false;

    return this.isBoatEntity(vehicle.name ?? '');
  }

  private isBoatEntity(name: string): boolean {
    return BOAT_TYPES.includes(name) || name.includes('boat') || name.includes('raft');
  }

  private findNearestBoat(): Entity | null {
    const playerPos = this.bot.entity.position;
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;

      if (!this.isBoatEntity(entity.name ?? '')) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist <= this.config.searchRadius && dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private hasBoatItem(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (this.isBoatEntity(item.name)) {
        return true;
      }
    }
    return false;
  }

  private placeBoat(): boolean {
    // Find boat item
    const boatItem = this.bot.inventory.items().find(item => this.isBoatEntity(item.name));
    if (!boatItem) return false;

    // Find water to place boat on
    const waterPos = this.findNearbyWater();
    if (!waterPos) return false;

    try {
      this.bot.equip(boatItem, 'hand');
      // Place boat by right-clicking water
      const waterBlock = this.bot.blockAt(waterPos);
      if (waterBlock) {
        this.bot.placeBlock(waterBlock, new Vec3(0, 1, 0));
        return true;
      }
    } catch {
      // May fail
    }

    return false;
  }

  private findNearbyWater(): Vec3 | null {
    const playerPos = this.bot.entity.position;

    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        for (let y = -3; y <= 3; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);
          if (block && block.name === 'water') {
            return pos;
          }
        }
      }
    }

    return null;
  }

  private getDistanceToTarget(): number {
    const pos = this.bot.entity.position;
    const dx = this.config.targetX - pos.x;
    const dz = this.config.targetZ - pos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private hasArrived(): boolean {
    return this.getDistanceToTarget() <= this.config.arrivalDistance;
  }

  private navigateToward(targetX: number, targetZ: number): void {
    const pos = this.bot.entity.position;
    const dx = targetX - pos.x;
    const dz = targetZ - pos.z;

    // Calculate yaw to target
    const yaw = Math.atan2(-dx, dz);

    try {
      // Look toward target
      this.bot.look(yaw, 0, true);

      // Move forward
      this.bot.setControlState('forward', true);
    } catch {
      // May fail
    }
  }

  /**
   * Check if currently in boat
   */
  isCurrentlyInBoat(): boolean {
    return this.isInBoat;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof BoatTask)) return false;

    return this.config.targetX === other.config.targetX &&
           this.config.targetZ === other.config.targetZ;
  }
}

/**
 * Convenience functions
 */
export function boatToPosition(bot: Bot, x: number, z: number): BoatTask {
  return new BoatTask(bot, x, z);
}

export function boatToVec3(bot: Bot, pos: Vec3): BoatTask {
  return new BoatTask(bot, Math.floor(pos.x), Math.floor(pos.z));
}

export function enterNearestBoat(bot: Bot): BoatTask {
  const pos = bot.entity.position;
  return new BoatTask(bot, Math.floor(pos.x), Math.floor(pos.z), {
    exitOnArrival: false,
  });
}
