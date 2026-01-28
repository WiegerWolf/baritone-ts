/**
 * FastTravelTask - Nether Portal Fast Travel
 * Based on BaritonePlus's FastTravelTask.java
 *
 * WHY: The Nether has 8:1 distance scaling with the Overworld.
 * Walking 1 block in the Nether = 8 blocks in the Overworld.
 * This means long-distance travel is much faster through the Nether.
 *
 * This task:
 * 1. Calculates if Nether travel is worth it (distance threshold)
 * 2. Goes to the Nether
 * 3. Travels to the scaled coordinates
 * 4. Builds/uses a portal back to the Overworld
 * 5. Walks the remaining distance
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { Dimension } from './ResourceTask';
import { GoToDimensionTask, EnterNetherPortalTask } from '../composite/PortalTask';
import { GetToBlockTask } from './GoToTask';
import { GoToXZTask } from './GoToTask';
import { BlockPos } from '../../types';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for fast travel
 */
enum FastTravelState {
  CHECKING_THRESHOLD,
  COLLECTING_MATERIALS,
  ENTERING_NETHER,
  TRAVELING_NETHER,
  BUILDING_EXIT_PORTAL,
  EXITING_NETHER,
  WALKING_OVERWORLD,
  FINISHED,
}

/**
 * Configuration for FastTravelTask
 */
export interface FastTravelConfig {
  /** Target position in the Overworld */
  target: BlockPos;
  /** Distance threshold before using Nether travel (default based on 8:1 ratio benefits) */
  threshold?: number;
  /** Whether to collect portal materials if absent */
  collectMaterialsIfAbsent: boolean;
  /** Timeout for reaching ideal nether coordinates before placing portal anyway */
  netherCoordinateTimeout: number;
}

const DEFAULT_CONFIG: Partial<FastTravelConfig> = {
  threshold: undefined, // Will be calculated
  collectMaterialsIfAbsent: true,
  netherCoordinateTimeout: 15,
};

/**
 * Close enough threshold when in Nether (blocks)
 * If we're within this distance of our ideal XZ in the Nether, we can build portal
 */
const NETHER_CLOSE_ENOUGH_THRESHOLD = 15;

/**
 * Minimum practical threshold for Nether travel
 * Nether portals within 16 blocks point to same overworld portal (128 overworld blocks)
 */
const MIN_THRESHOLD = 16 * 8; // 128 blocks

/**
 * Task to fast travel using the Nether.
 *
 * WHY: Nether travel is 8x faster due to coordinate scaling.
 * A 1000-block journey in the Overworld is only 125 blocks in the Nether.
 *
 * Algorithm:
 * 1. If in Overworld and far from target: Go to Nether
 * 2. In Nether: Travel to target/8 coordinates
 * 3. Build/find portal and return to Overworld
 * 4. Walk remaining distance to exact target
 *
 * Based on BaritonePlus FastTravelTask.java
 */
export class FastTravelTask extends Task {
  private config: FastTravelConfig;
  private state: FastTravelState = FastTravelState.CHECKING_THRESHOLD;
  private forceOverworldWalking: boolean = false;
  private netherCoordinateTimer: TimerGame;
  private goToOverworldTask: Task | null = null;

  constructor(bot: Bot, config: Partial<FastTravelConfig> & { target: BlockPos }) {
    super(bot);
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as FastTravelConfig;
    this.netherCoordinateTimer = new TimerGame(bot, this.config.netherCoordinateTimeout);
  }

  /**
   * Create fast travel task to a position
   */
  static to(bot: Bot, x: number, y: number, z: number): FastTravelTask {
    return new FastTravelTask(bot, {
      target: new BlockPos(x, y, z),
      collectMaterialsIfAbsent: true,
    });
  }

  /**
   * Create fast travel task to a Vec3
   */
  static toVec3(bot: Bot, pos: Vec3): FastTravelTask {
    return FastTravelTask.to(
      bot,
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z)
    );
  }

  get displayName(): string {
    return `FastTravel(${this.config.target.x}, ${this.config.target.y}, ${this.config.target.z})`;
  }

  onStart(): void {
    this.state = FastTravelState.CHECKING_THRESHOLD;
    this.forceOverworldWalking = false;
    this.netherCoordinateTimer.reset();
    this.goToOverworldTask = null;
  }

  onTick(): Task | null {
    const dimension = this.getCurrentDimension();
    const netherTarget = this.getNetherTarget();
    const threshold = this.getOverworldThreshold();

    // Calculate distances
    const distanceToTarget = this.getXZDistance(
      this.bot.entity.position,
      new Vec3(this.config.target.x, 0, this.config.target.z)
    );

    switch (dimension) {
      case 'overworld':
        return this.handleOverworld(distanceToTarget, threshold);

      case 'nether':
        return this.handleNether(netherTarget);

      case 'the_end':
        // Shouldn't be in the End - go back to Overworld
        return new GoToDimensionTask(this.bot, Dimension.OVERWORLD);
    }

    return null;
  }

  private handleOverworld(distanceToTarget: number, threshold: number): Task | null {
    this.netherCoordinateTimer.reset();

    // Check if we should just walk
    if (this.forceOverworldWalking || distanceToTarget <= threshold) {
      this.forceOverworldWalking = true;
      this.state = FastTravelState.WALKING_OVERWORLD;
      return new GetToBlockTask(
        this.bot,
        this.config.target.x,
        this.config.target.y,
        this.config.target.z
      );
    }

    // Check if we have portal materials
    const canBuildPortal = this.canBuildPortal();
    const canLightPortal = this.canLightPortal();

    if (!canBuildPortal || !canLightPortal) {
      if (this.config.collectMaterialsIfAbsent) {
        this.state = FastTravelState.COLLECTING_MATERIALS;
        // Would collect materials here - simplified to just walk
        // In full implementation: TaskCatalogue.getItemTask(Items.DIAMOND_PICKAXE, 1)
        this.forceOverworldWalking = true;
        return new GetToBlockTask(
          this.bot,
          this.config.target.x,
          this.config.target.y,
          this.config.target.z
        );
      } else {
        // No materials and not collecting - just walk
        this.forceOverworldWalking = true;
        return new GetToBlockTask(
          this.bot,
          this.config.target.x,
          this.config.target.y,
          this.config.target.z
        );
      }
    }

    // Go to Nether
    this.state = FastTravelState.ENTERING_NETHER;
    return new GoToDimensionTask(this.bot, Dimension.NETHER);
  }

  private handleNether(netherTarget: Vec3): Task | null {
    // Check if we should exit - if we've walked a bit from entry
    if (!this.forceOverworldWalking && this.goToOverworldTask) {
      // Continue exiting
      if (!this.goToOverworldTask.isFinished()) {
        this.state = FastTravelState.EXITING_NETHER;
        return this.goToOverworldTask;
      }
    }

    // Check if we're close enough to build exit portal
    const distToNetherTarget = this.getXZDistance(
      this.bot.entity.position,
      netherTarget
    );

    if (distToNetherTarget <= NETHER_CLOSE_ENOUGH_THRESHOLD) {
      // Check if we're at exact coordinates or timeout
      const atExactCoords =
        Math.floor(this.bot.entity.position.x) === Math.floor(netherTarget.x) &&
        Math.floor(this.bot.entity.position.z) === Math.floor(netherTarget.z);

      if (atExactCoords || this.netherCoordinateTimer.elapsed()) {
        // Go back to Overworld
        this.state = FastTravelState.EXITING_NETHER;
        this.forceOverworldWalking = true;
        this.goToOverworldTask = new GoToDimensionTask(this.bot, Dimension.OVERWORLD);
        return this.goToOverworldTask;
      }
    } else {
      this.netherCoordinateTimer.reset();
    }

    // Travel to ideal nether coordinates
    this.state = FastTravelState.TRAVELING_NETHER;
    return new GoToXZTask(
      this.bot,
      Math.floor(netherTarget.x),
      Math.floor(netherTarget.z)
    );
  }

  /**
   * Get current dimension
   */
  private getCurrentDimension(): string {
    const dimName = (this.bot as any).game?.dimension || 'overworld';
    if (dimName.includes('nether')) return 'nether';
    if (dimName.includes('end')) return 'the_end';
    return 'overworld';
  }

  /**
   * Get target coordinates in the Nether (Overworld / 8)
   */
  private getNetherTarget(): Vec3 {
    return new Vec3(
      Math.floor(this.config.target.x / 8),
      this.config.target.y,
      Math.floor(this.config.target.z / 8)
    );
  }

  /**
   * Get overworld threshold for when to use Nether travel
   */
  private getOverworldThreshold(): number {
    if (this.config.threshold !== undefined) {
      return Math.max(this.config.threshold, MIN_THRESHOLD);
    }

    // Default: Use Nether travel if distance > 500 blocks
    // This accounts for portal building time + Nether travel risks
    return Math.max(500, MIN_THRESHOLD);
  }

  /**
   * Calculate XZ distance (ignoring Y)
   */
  private getXZDistance(a: Vec3, b: Vec3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Check if we can build a portal (have obsidian or diamond pickaxe)
   */
  private canBuildPortal(): boolean {
    const hasPickaxe = this.hasItem('diamond_pickaxe');
    const hasObsidian = this.getItemCount('obsidian') >= 10;
    return hasPickaxe || hasObsidian;
  }

  /**
   * Check if we can light a portal
   */
  private canLightPortal(): boolean {
    return this.hasItem('flint_and_steel') || this.hasItem('fire_charge');
  }

  /**
   * Check if we have an item
   */
  private hasItem(itemName: string): boolean {
    return this.bot.inventory.items().some(item =>
      item.name === itemName || item.name.includes(itemName)
    );
  }

  /**
   * Get item count
   */
  private getItemCount(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName || item.name.includes(itemName)) {
        count += item.count;
      }
    }
    return count;
  }

  onStop(interruptTask: ITask | null): void {
    this.goToOverworldTask = null;
  }

  isFinished(): boolean {
    if (this.state === FastTravelState.FINISHED) return true;

    // Finished when we're close to target in Overworld
    const dimension = this.getCurrentDimension();
    if (dimension !== 'overworld') return false;

    const dist = this.bot.entity.position.distanceTo(
      new Vec3(this.config.target.x, this.bot.entity.position.y, this.config.target.z)
    );
    return dist <= 3;
  }

  /**
   * Get current state
   */
  getState(): FastTravelState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof FastTravelTask)) return false;
    return this.config.target.equals(other.config.target) &&
           this.config.collectMaterialsIfAbsent === other.config.collectMaterialsIfAbsent &&
           this.config.threshold === other.config.threshold;
  }
}

/**
 * Convenience function to fast travel to coordinates
 */
export function fastTravelTo(bot: Bot, x: number, y: number, z: number): FastTravelTask {
  return FastTravelTask.to(bot, x, y, z);
}

/**
 * Convenience function to fast travel to a position
 */
export function fastTravelToPos(bot: Bot, pos: Vec3): FastTravelTask {
  return FastTravelTask.toVec3(bot, pos);
}

export { FastTravelState };
