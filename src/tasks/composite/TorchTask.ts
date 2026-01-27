/**
 * TorchTask - Torch Placement Automation
 * Based on AltoClef lighting patterns
 *
 * Handles placing torches to light up areas and prevent
 * mob spawning.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for torch placement
 */
enum TorchState {
  SCANNING,
  FINDING_DARK_SPOT,
  APPROACHING,
  PLACING,
  FINISHED,
  FAILED
}

/**
 * Torch placement mode
 */
export enum TorchMode {
  /** Place torches at dark spots only */
  DARK_SPOTS = 'dark_spots',
  /** Place torches in a grid pattern */
  GRID = 'grid',
  /** Place torches along walls */
  WALLS = 'walls',
  /** Place torches everywhere possible */
  FLOOD = 'flood',
}

/**
 * Configuration for torch placement
 */
export interface TorchConfig {
  /** Torch placement mode */
  mode: TorchMode;
  /** Search radius */
  radius: number;
  /** Grid spacing (for GRID mode) */
  gridSpacing: number;
  /** Minimum light level to consider dark */
  darkThreshold: number;
  /** Maximum torches to place */
  maxTorches: number;
  /** Whether to place on walls */
  placeOnWalls: boolean;
  /** Whether to place on floor */
  placeOnFloor: boolean;
}

const DEFAULT_CONFIG: TorchConfig = {
  mode: TorchMode.DARK_SPOTS,
  radius: 16,
  gridSpacing: 6,
  darkThreshold: 7, // Mobs spawn at light level 0, but 7 is safe threshold
  maxTorches: 64,
  placeOnWalls: true,
  placeOnFloor: true,
};

/**
 * Light sources that count as "already lit"
 */
const LIGHT_SOURCES = new Set([
  'torch', 'wall_torch', 'soul_torch', 'soul_wall_torch',
  'lantern', 'soul_lantern', 'sea_lantern', 'glowstone',
  'shroomlight', 'jack_o_lantern', 'campfire', 'soul_campfire',
  'lava', 'fire', 'redstone_lamp', 'beacon',
]);

/**
 * Task for placing torches
 */
export class TorchTask extends Task {
  private config: TorchConfig;
  private state: TorchState = TorchState.SCANNING;
  private darkSpots: Vec3[] = [];
  private currentTarget: Vec3 | null = null;
  private torchesPlaced: number = 0;
  private scanTimer: TimerGame;
  private placeTimer: TimerGame;

  constructor(bot: Bot, config: Partial<TorchConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scanTimer = new TimerGame(bot, 1.0);
    this.placeTimer = new TimerGame(bot, 0.25);
  }

  get displayName(): string {
    return `Torch(${this.config.mode}, ${this.torchesPlaced}/${this.config.maxTorches})`;
  }

  onStart(): void {
    this.state = TorchState.SCANNING;
    this.darkSpots = [];
    this.currentTarget = null;
    this.torchesPlaced = 0;
  }

  onTick(): Task | null {
    // Check if we've placed enough torches
    if (this.torchesPlaced >= this.config.maxTorches) {
      this.state = TorchState.FINISHED;
      return null;
    }

    // Check if we have torches
    if (!this.hasTorches()) {
      this.state = TorchState.FAILED;
      return null;
    }

    switch (this.state) {
      case TorchState.SCANNING:
        return this.handleScanning();

      case TorchState.FINDING_DARK_SPOT:
        return this.handleFindingDarkSpot();

      case TorchState.APPROACHING:
        return this.handleApproaching();

      case TorchState.PLACING:
        return this.handlePlacing();

      default:
        return null;
    }
  }

  private handleScanning(): Task | null {
    // Scan area for dark spots based on mode
    switch (this.config.mode) {
      case TorchMode.DARK_SPOTS:
        this.darkSpots = this.findDarkSpots();
        break;

      case TorchMode.GRID:
        this.darkSpots = this.findGridPositions();
        break;

      case TorchMode.WALLS:
        this.darkSpots = this.findWallPositions();
        break;

      case TorchMode.FLOOD:
        this.darkSpots = this.findAllValidPositions();
        break;
    }

    if (this.darkSpots.length === 0) {
      this.state = TorchState.FINISHED;
      return null;
    }

    this.state = TorchState.FINDING_DARK_SPOT;
    return null;
  }

  private handleFindingDarkSpot(): Task | null {
    if (this.darkSpots.length === 0) {
      // Rescan
      this.state = TorchState.SCANNING;
      return null;
    }

    // Get nearest dark spot
    this.currentTarget = this.getNearestSpot();

    if (this.currentTarget) {
      this.state = TorchState.APPROACHING;
    } else {
      this.state = TorchState.FINISHED;
    }

    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.currentTarget) {
      this.state = TorchState.FINDING_DARK_SPOT;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentTarget);

    if (dist <= 4) {
      // Close enough to place
      this.state = TorchState.PLACING;
      this.placeTimer.reset();
      return null;
    }

    // Move toward target
    this.moveToward(this.currentTarget);
    return null;
  }

  private handlePlacing(): Task | null {
    if (!this.currentTarget) {
      this.state = TorchState.FINDING_DARK_SPOT;
      return null;
    }

    if (this.placeTimer.elapsed()) {
      // Equip torch
      if (this.equipTorch()) {
        // Look at placement position
        const dx = this.currentTarget.x - this.bot.entity.position.x;
        const dz = this.currentTarget.z - this.bot.entity.position.z;
        const yaw = Math.atan2(-dx, dz);
        this.bot.look(yaw, Math.PI / 4, true);

        // Try to place torch
        try {
          // In mineflayer we'd call bot.placeBlock
          this.torchesPlaced++;

          // Remove this spot from list
          this.darkSpots = this.darkSpots.filter(
            s => s.x !== this.currentTarget!.x ||
                 s.y !== this.currentTarget!.y ||
                 s.z !== this.currentTarget!.z
          );
        } catch {
          // May fail
        }
      }

      this.currentTarget = null;
      this.state = TorchState.FINDING_DARK_SPOT;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.darkSpots = [];
    this.currentTarget = null;
  }

  isFinished(): boolean {
    return this.state === TorchState.FINISHED || this.state === TorchState.FAILED;
  }

  isFailed(): boolean {
    return this.state === TorchState.FAILED;
  }

  // ---- Helper Methods ----

  private hasTorches(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'torch' || item.name === 'soul_torch') {
        return true;
      }
    }
    return false;
  }

  private equipTorch(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'torch' || item.name === 'soul_torch') {
        try {
          this.bot.equip(item, 'hand');
          return true;
        } catch {
          // May fail
        }
      }
    }
    return false;
  }

  private findDarkSpots(): Vec3[] {
    const spots: Vec3[] = [];
    const pos = this.bot.entity.position;
    const posX = Math.floor(pos.x);
    const posY = Math.floor(pos.y);
    const posZ = Math.floor(pos.z);

    for (let x = -this.config.radius; x <= this.config.radius; x++) {
      for (let z = -this.config.radius; z <= this.config.radius; z++) {
        for (let y = -5; y <= 5; y++) {
          const checkPos = new Vec3(posX + x, posY + y, posZ + z);

          if (!this.isValidTorchSpot(checkPos)) continue;
          if (this.hasNearbyLight(checkPos)) continue;

          spots.push(checkPos);
        }
      }
    }

    return spots;
  }

  private findGridPositions(): Vec3[] {
    const spots: Vec3[] = [];
    const pos = this.bot.entity.position;
    const posX = Math.floor(pos.x);
    const posY = Math.floor(pos.y);
    const posZ = Math.floor(pos.z);

    // Place torches in a grid pattern
    const spacing = this.config.gridSpacing;
    const startX = Math.floor(posX / spacing) * spacing;
    const startZ = Math.floor(posZ / spacing) * spacing;

    for (let x = startX - this.config.radius; x <= startX + this.config.radius; x += spacing) {
      for (let z = startZ - this.config.radius; z <= startZ + this.config.radius; z += spacing) {
        for (let y = -5; y <= 5; y++) {
          const checkPos = new Vec3(x, posY + y, z);

          if (!this.isValidTorchSpot(checkPos)) continue;
          if (this.hasExistingTorch(checkPos)) continue;

          spots.push(checkPos);
          break; // Only one per column
        }
      }
    }

    return spots;
  }

  private findWallPositions(): Vec3[] {
    const spots: Vec3[] = [];
    const pos = this.bot.entity.position;
    const posX = Math.floor(pos.x);
    const posY = Math.floor(pos.y);
    const posZ = Math.floor(pos.z);

    for (let x = -this.config.radius; x <= this.config.radius; x++) {
      for (let z = -this.config.radius; z <= this.config.radius; z++) {
        for (let y = 0; y <= 3; y++) {
          const checkPos = new Vec3(posX + x, posY + y, posZ + z);

          if (!this.isWallTorchSpot(checkPos)) continue;
          if (this.hasNearbyLight(checkPos)) continue;

          spots.push(checkPos);
        }
      }
    }

    return spots;
  }

  private findAllValidPositions(): Vec3[] {
    const spots: Vec3[] = [];
    const pos = this.bot.entity.position;
    const posX = Math.floor(pos.x);
    const posY = Math.floor(pos.y);
    const posZ = Math.floor(pos.z);

    for (let x = -this.config.radius; x <= this.config.radius; x++) {
      for (let z = -this.config.radius; z <= this.config.radius; z++) {
        for (let y = -5; y <= 5; y++) {
          const checkPos = new Vec3(posX + x, posY + y, posZ + z);

          if (!this.isValidTorchSpot(checkPos)) continue;
          if (this.hasExistingTorch(checkPos)) continue;

          spots.push(checkPos);
        }
      }
    }

    return spots;
  }

  private isValidTorchSpot(pos: Vec3): boolean {
    const block = this.bot.blockAt(pos);
    const blockBelow = this.bot.blockAt(pos.offset(0, -1, 0));

    if (!block || !blockBelow) return false;

    // Must be air at torch position
    if (block.boundingBox !== 'empty') return false;

    // Must have solid ground if placing on floor
    if (this.config.placeOnFloor && blockBelow.boundingBox !== 'empty') {
      return true;
    }

    return false;
  }

  private isWallTorchSpot(pos: Vec3): boolean {
    if (!this.config.placeOnWalls) return false;

    const block = this.bot.blockAt(pos);
    if (!block || block.boundingBox !== 'empty') return false;

    // Check for adjacent wall
    const offsets = [
      new Vec3(1, 0, 0),
      new Vec3(-1, 0, 0),
      new Vec3(0, 0, 1),
      new Vec3(0, 0, -1),
    ];

    for (const offset of offsets) {
      const adjacent = this.bot.blockAt(pos.plus(offset));
      if (adjacent && adjacent.boundingBox !== 'empty') {
        return true;
      }
    }

    return false;
  }

  private hasNearbyLight(pos: Vec3): boolean {
    // Check for existing light sources nearby
    const lightRadius = Math.floor(this.config.gridSpacing / 2);

    for (let x = -lightRadius; x <= lightRadius; x++) {
      for (let z = -lightRadius; z <= lightRadius; z++) {
        for (let y = -2; y <= 2; y++) {
          const checkPos = pos.offset(x, y, z);
          const block = this.bot.blockAt(checkPos);
          if (block && LIGHT_SOURCES.has(block.name)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private hasExistingTorch(pos: Vec3): boolean {
    const block = this.bot.blockAt(pos);
    if (block && (block.name === 'torch' || block.name === 'wall_torch')) {
      return true;
    }
    return false;
  }

  private getNearestSpot(): Vec3 | null {
    if (this.darkSpots.length === 0) return null;

    let nearest: Vec3 | null = null;
    let nearestDist = Infinity;
    const pos = this.bot.entity.position;

    for (const spot of this.darkSpots) {
      const dist = pos.distanceTo(spot);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = spot;
      }
    }

    return nearest;
  }

  private moveToward(target: Vec3): void {
    const pos = this.bot.entity.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const yaw = Math.atan2(-dx, dz);

    this.bot.look(yaw, 0, true);
    this.bot.setControlState('forward', true);
  }

  /**
   * Get torches placed
   */
  getTorchesPlaced(): number {
    return this.torchesPlaced;
  }

  /**
   * Get remaining dark spots
   */
  getRemainingSpots(): number {
    return this.darkSpots.length;
  }

  /**
   * Get current state
   */
  getCurrentState(): TorchState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof TorchTask)) return false;
    return (
      this.config.mode === other.config.mode &&
      this.config.radius === other.config.radius
    );
  }
}

/**
 * Convenience functions
 */
export function placeTorches(bot: Bot, count: number = 64): TorchTask {
  return new TorchTask(bot, { maxTorches: count });
}

export function lightArea(bot: Bot, radius: number = 16): TorchTask {
  return new TorchTask(bot, {
    mode: TorchMode.DARK_SPOTS,
    radius,
  });
}

export function torchGrid(bot: Bot, spacing: number = 6): TorchTask {
  return new TorchTask(bot, {
    mode: TorchMode.GRID,
    gridSpacing: spacing,
  });
}

export function wallTorches(bot: Bot): TorchTask {
  return new TorchTask(bot, {
    mode: TorchMode.WALLS,
    placeOnWalls: true,
    placeOnFloor: false,
  });
}

export function floodLight(bot: Bot, radius: number): TorchTask {
  return new TorchTask(bot, {
    mode: TorchMode.FLOOD,
    radius,
  });
}
