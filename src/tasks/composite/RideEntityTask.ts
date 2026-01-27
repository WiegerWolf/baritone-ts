/**
 * RideEntityTask - Entity Riding Automation
 * Based on AltoClef patterns
 *
 * Handles mounting and riding horses, pigs, striders, and other
 * rideable entities. More general than BoatTask.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for riding
 */
enum RideState {
  FINDING_MOUNT,
  APPROACHING,
  MOUNTING,
  RIDING,
  NAVIGATING,
  DISMOUNTING,
  FINISHED,
  FAILED
}

/**
 * Rideable entity types
 */
export enum RideableEntity {
  HORSE = 'horse',
  DONKEY = 'donkey',
  MULE = 'mule',
  PIG = 'pig',
  STRIDER = 'strider',
  CAMEL = 'camel',
  SKELETON_HORSE = 'skeleton_horse',
  ZOMBIE_HORSE = 'zombie_horse',
}

/**
 * Required items for riding
 */
const RIDE_REQUIREMENTS: Map<RideableEntity, { saddle: boolean; controlItem?: string }> = new Map([
  [RideableEntity.HORSE, { saddle: true }],
  [RideableEntity.DONKEY, { saddle: true }],
  [RideableEntity.MULE, { saddle: true }],
  [RideableEntity.PIG, { saddle: true, controlItem: 'carrot_on_a_stick' }],
  [RideableEntity.STRIDER, { saddle: true, controlItem: 'warped_fungus_on_a_stick' }],
  [RideableEntity.CAMEL, { saddle: true }],
  [RideableEntity.SKELETON_HORSE, { saddle: false }], // Already saddled
  [RideableEntity.ZOMBIE_HORSE, { saddle: false }],
]);

/**
 * Configuration for riding
 */
export interface RideConfig {
  /** Entity type to ride */
  entityType: RideableEntity | null;
  /** Target destination (optional) */
  destination: Vec3 | null;
  /** Search radius for mount */
  searchRadius: number;
  /** Prefer tamed animals */
  preferTamed: boolean;
  /** Automatically dismount at destination */
  dismountAtDestination: boolean;
  /** Arrival threshold */
  arrivalThreshold: number;
}

const DEFAULT_CONFIG: RideConfig = {
  entityType: null,
  destination: null,
  searchRadius: 32,
  preferTamed: true,
  dismountAtDestination: true,
  arrivalThreshold: 3,
};

/**
 * Task for riding entities
 */
export class RideEntityTask extends Task {
  private config: RideConfig;
  private state: RideState = RideState.FINDING_MOUNT;
  private mount: Entity | null = null;
  private rideTimer: TimerGame;
  private controlTimer: TimerGame;

  constructor(bot: Bot, config: Partial<RideConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rideTimer = new TimerGame(bot, 0.5);
    this.controlTimer = new TimerGame(bot, 0.1);
  }

  get displayName(): string {
    const dest = this.config.destination
      ? `to ${Math.floor(this.config.destination.x)},${Math.floor(this.config.destination.z)}`
      : 'freely';
    return `RideEntity(${this.config.entityType ?? 'any'}, ${dest}, ${RideState[this.state]})`;
  }

  onStart(): void {
    this.state = RideState.FINDING_MOUNT;
    this.mount = null;
  }

  onTick(): Task | null {
    switch (this.state) {
      case RideState.FINDING_MOUNT:
        return this.handleFindingMount();

      case RideState.APPROACHING:
        return this.handleApproaching();

      case RideState.MOUNTING:
        return this.handleMounting();

      case RideState.RIDING:
        return this.handleRiding();

      case RideState.NAVIGATING:
        return this.handleNavigating();

      case RideState.DISMOUNTING:
        return this.handleDismounting();

      default:
        return null;
    }
  }

  private handleFindingMount(): Task | null {
    // Check if already riding
    if (this.isRiding()) {
      this.mount = this.getCurrentMount();
      if (this.config.destination) {
        this.state = RideState.NAVIGATING;
      } else {
        this.state = RideState.RIDING;
      }
      return null;
    }

    this.mount = this.findRideableEntity();

    if (this.mount) {
      this.state = RideState.APPROACHING;
      return null;
    }

    // No mount found
    this.state = RideState.FAILED;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.mount || !this.mount.isValid) {
      this.state = RideState.FINDING_MOUNT;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.mount.position);

    if (dist <= 2) {
      this.state = RideState.MOUNTING;
      this.rideTimer.reset();
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.mount.position.x),
      Math.floor(this.mount.position.y),
      Math.floor(this.mount.position.z),
      1
    );
  }

  private handleMounting(): Task | null {
    if (!this.mount || !this.mount.isValid) {
      this.state = RideState.FINDING_MOUNT;
      return null;
    }

    if (!this.rideTimer.elapsed()) {
      return null;
    }

    // Attempt to mount
    try {
      this.bot.mount(this.mount);
    } catch {
      // May fail
    }

    // Check if mounted
    if (this.isRiding()) {
      if (this.config.destination) {
        this.state = RideState.NAVIGATING;
      } else {
        this.state = RideState.RIDING;
      }
    } else {
      // Try again
      this.rideTimer.reset();
    }

    return null;
  }

  private handleRiding(): Task | null {
    // Just riding without destination
    if (!this.isRiding()) {
      this.state = RideState.FINISHED;
    }
    return null;
  }

  private handleNavigating(): Task | null {
    if (!this.isRiding()) {
      this.state = RideState.FINDING_MOUNT;
      return null;
    }

    if (!this.config.destination) {
      this.state = RideState.RIDING;
      return null;
    }

    // Check if arrived
    const dist = this.bot.entity.position.distanceTo(this.config.destination);
    if (dist <= this.config.arrivalThreshold) {
      if (this.config.dismountAtDestination) {
        this.state = RideState.DISMOUNTING;
      } else {
        this.state = RideState.FINISHED;
      }
      return null;
    }

    // Control the mount toward destination
    if (this.controlTimer.elapsed()) {
      this.controlMountToward(this.config.destination);
      this.controlTimer.reset();
    }

    return null;
  }

  private handleDismounting(): Task | null {
    if (!this.isRiding()) {
      this.state = RideState.FINISHED;
      return null;
    }

    try {
      this.bot.dismount();
    } catch {
      // May fail
    }

    this.state = RideState.FINISHED;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.mount = null;
  }

  isFinished(): boolean {
    return this.state === RideState.FINISHED || this.state === RideState.FAILED;
  }

  isFailed(): boolean {
    return this.state === RideState.FAILED;
  }

  // ---- Helper Methods ----

  private findRideableEntity(): Entity | null {
    const playerPos = this.bot.entity.position;
    let best: Entity | null = null;
    let bestScore = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;

      const name = entity.name ?? '';
      if (!this.isRideableType(name)) continue;

      // Check if matches required type
      if (this.config.entityType && name !== this.config.entityType) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist > this.config.searchRadius) continue;

      // Score based on distance and tamed status
      let score = dist;
      if (this.config.preferTamed && this.isTamed(entity)) {
        score -= 20; // Prefer tamed
      }

      if (score < bestScore) {
        bestScore = score;
        best = entity;
      }
    }

    return best;
  }

  private isRideableType(name: string): boolean {
    return Object.values(RideableEntity).includes(name as RideableEntity);
  }

  private isTamed(entity: Entity): boolean {
    const metadata = (entity as any).metadata;
    if (!metadata) return false;

    const flags = metadata[17];
    if (typeof flags === 'number') {
      return (flags & 0x04) !== 0; // Bit 2 = tamed
    }
    return false;
  }

  private isRiding(): boolean {
    const bot = this.bot as any;
    return !!bot.vehicle;
  }

  private getCurrentMount(): Entity | null {
    const bot = this.bot as any;
    return bot.vehicle ?? null;
  }

  private controlMountToward(target: Vec3): void {
    const pos = this.bot.entity.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;

    // Calculate yaw toward target
    const yaw = Math.atan2(-dx, dz);
    this.bot.look(yaw, 0, true);

    // Move forward
    this.bot.setControlState('forward', true);

    // Sprint if far
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 10) {
      this.bot.setControlState('sprint', true);
    } else {
      this.bot.setControlState('sprint', false);
    }
  }

  /**
   * Get current mount
   */
  getMount(): Entity | null {
    return this.mount;
  }

  /**
   * Get current state
   */
  getCurrentState(): RideState {
    return this.state;
  }

  /**
   * Check if riding
   */
  isCurrentlyRiding(): boolean {
    return this.isRiding();
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof RideEntityTask)) return false;

    return this.config.entityType === other.config.entityType;
  }
}

/**
 * Convenience functions
 */
export function rideHorse(bot: Bot, destination?: Vec3): RideEntityTask {
  return new RideEntityTask(bot, {
    entityType: RideableEntity.HORSE,
    destination: destination ?? null,
  });
}

export function ridePig(bot: Bot, destination?: Vec3): RideEntityTask {
  return new RideEntityTask(bot, {
    entityType: RideableEntity.PIG,
    destination: destination ?? null,
  });
}

export function rideStrider(bot: Bot, destination?: Vec3): RideEntityTask {
  return new RideEntityTask(bot, {
    entityType: RideableEntity.STRIDER,
    destination: destination ?? null,
  });
}

export function rideToPosition(bot: Bot, destination: Vec3): RideEntityTask {
  return new RideEntityTask(bot, {
    destination,
    dismountAtDestination: true,
  });
}

export function mountNearbyRideable(bot: Bot): RideEntityTask {
  return new RideEntityTask(bot, {
    entityType: null,
    dismountAtDestination: false,
  });
}
