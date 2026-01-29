/**
 * ConstructNetherPortalTask - Nether Portal Construction
 * Based on BaritonePlus's ConstructNetherPortalBucketTask.java
 *
 * WHY: Building a Nether portal requires precise placement of 10-14 obsidian
 * blocks in a specific frame pattern. This task automates the construction
 * using the water+lava bucket method (casting obsidian in place).
 *
 * The bucket method:
 * 1. Find a lava lake
 * 2. Place water on lava to create obsidian
 * 3. Build frame piece by piece
 * 4. Light portal with flint & steel
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { DestroyBlockTask, ClearLiquidTask } from './ConstructionTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { InteractWithBlockTask, Direction } from './InteractWithBlockTask';
import { BlockPos } from '../../types';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Portal frame positions relative to origin (bottom-left of portal opening)
 * Order matters for construction sequence
 */
const PORTAL_FRAME: Vec3[] = [
  // Left side
  new Vec3(0, 0, -1),
  new Vec3(0, 1, -1),
  new Vec3(0, 2, -1),
  // Right side
  new Vec3(0, 0, 2),
  new Vec3(0, 1, 2),
  new Vec3(0, 2, 2),
  // Top
  new Vec3(0, 3, 0),
  new Vec3(0, 3, 1),
  // Bottom
  new Vec3(0, -1, 0),
  new Vec3(0, -1, 1),
];

/**
 * Portal interior positions (must be cleared for ignition)
 */
const PORTAL_INTERIOR: Vec3[] = [
  // Inside
  new Vec3(0, 0, 0),
  new Vec3(0, 1, 0),
  new Vec3(0, 2, 0),
  new Vec3(0, 0, 1),
  new Vec3(0, 1, 1),
  new Vec3(0, 2, 1),
  // Outside buffer
  new Vec3(1, 0, 0),
  new Vec3(1, 1, 0),
  new Vec3(1, 2, 0),
  new Vec3(1, 0, 1),
  new Vec3(1, 1, 1),
  new Vec3(1, 2, 1),
  new Vec3(-1, 0, 0),
  new Vec3(-1, 1, 0),
  new Vec3(-1, 2, 0),
  new Vec3(-1, 0, 1),
  new Vec3(-1, 1, 1),
  new Vec3(-1, 2, 1),
];

/**
 * State for portal construction
 */
enum PortalConstructionState {
  GETTING_MATERIALS,
  SEARCHING_LOCATION,
  BUILDING_FRAME,
  CLEARING_INTERIOR,
  LIGHTING_PORTAL,
  FINISHED,
  FAILED,
}

/**
 * Configuration for ConstructNetherPortalTask
 */
export interface ConstructNetherPortalConfig {
  /** Position for portal (null = auto-find) */
  position: BlockPos | null;
  /** Whether to use bucket method (water + lava) */
  useBucketMethod: boolean;
  /** Search range for lava lake */
  lavaSearchRange: number;
}

const DEFAULT_CONFIG: ConstructNetherPortalConfig = {
  position: null,
  useBucketMethod: true,
  lavaSearchRange: 64,
};

/**
 * Task to construct a Nether portal.
 *
 * WHY: Nether portals are essential for dimension travel and are
 * required for game progression. Building them manually is tedious
 * and error-prone.
 *
 * This task uses the bucket method:
 * 1. Collects water bucket, lava bucket, and flint & steel
 * 2. Finds a suitable location near lava
 * 3. Casts each obsidian frame piece using water + lava
 * 4. Clears the interior
 * 5. Lights the portal
 *
 * Based on BaritonePlus ConstructNetherPortalBucketTask.java
 */
export class ConstructNetherPortalTask extends Task {
  private config: ConstructNetherPortalConfig;
  private state: PortalConstructionState = PortalConstructionState.GETTING_MATERIALS;
  private portalOrigin: BlockPos | null = null;
  private currentFrameIndex: number = 0;
  private currentInteriorIndex: number = 0;
  private progressChecker: MovementProgressChecker;
  private lavaSearchTimer: TimerGame;
  private wanderTask: TimeoutWanderTask;

  constructor(bot: Bot, config: Partial<ConstructNetherPortalConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.progressChecker = new MovementProgressChecker(bot);
    this.lavaSearchTimer = new TimerGame(bot, 5);
    this.wanderTask = new TimeoutWanderTask(bot, 5);
  }

  /**
   * Create task to build portal at specific position
   */
  static at(bot: Bot, x: number, y: number, z: number): ConstructNetherPortalTask {
    return new ConstructNetherPortalTask(bot, {
      position: new BlockPos(x, y, z),
    });
  }

  /**
   * Create task to auto-find location and build
   */
  static autoLocate(bot: Bot): ConstructNetherPortalTask {
    return new ConstructNetherPortalTask(bot);
  }

  get displayName(): string {
    if (this.portalOrigin) {
      return `ConstructNetherPortal(${this.portalOrigin.x}, ${this.portalOrigin.y}, ${this.portalOrigin.z})`;
    }
    return 'ConstructNetherPortal(searching)';
  }

  onStart(): void {
    this.state = PortalConstructionState.GETTING_MATERIALS;
    this.portalOrigin = this.config.position;
    this.currentFrameIndex = 0;
    this.currentInteriorIndex = 0;
    this.progressChecker.reset();
    this.lavaSearchTimer.reset();
  }

  onTick(): Task | null {
    // Check if portal is complete
    if (this.isPortalComplete()) {
      this.state = PortalConstructionState.FINISHED;
      return null;
    }

    // Check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      this.progressChecker.reset();
      if (this.portalOrigin) {
        // Try different location
        this.portalOrigin = null;
        return this.wanderTask;
      }
    }

    // Step 1: Get materials
    if (!this.hasMaterials()) {
      this.state = PortalConstructionState.GETTING_MATERIALS;
      // In full implementation, would return tasks to get materials
      // For now, just check what we're missing
      return null;
    }

    // Step 2: Find location if needed
    if (!this.portalOrigin) {
      this.state = PortalConstructionState.SEARCHING_LOCATION;

      if (this.lavaSearchTimer.elapsed()) {
        this.lavaSearchTimer.reset();
        const lavaLake = this.findLavaLake();
        if (lavaLake) {
          const portalSpot = this.findPortalSpot(lavaLake);
          if (portalSpot) {
            this.portalOrigin = portalSpot;
          }
        }
      }

      if (!this.portalOrigin) {
        return new TimeoutWanderTask(this.bot, 5);
      }
    }

    // Step 3: Build frame
    if (this.currentFrameIndex < PORTAL_FRAME.length) {
      const frameOffset = PORTAL_FRAME[this.currentFrameIndex];
      const framePos = new BlockPos(
        this.portalOrigin.x + Math.floor(frameOffset.x),
        this.portalOrigin.y + Math.floor(frameOffset.y),
        this.portalOrigin.z + Math.floor(frameOffset.z)
      );

      const block = this.bot.blockAt(new Vec3(framePos.x, framePos.y, framePos.z));

      if (block && block.name === 'obsidian') {
        // This frame piece is done
        this.currentFrameIndex++;

        // Clear water above if present
        const waterCheck = this.bot.blockAt(
          new Vec3(framePos.x, framePos.y + 1, framePos.z)
        );
        if (waterCheck && waterCheck.name === 'water') {
          return new ClearLiquidTask(
            this.bot,
            framePos.x,
            framePos.y + 1,
            framePos.z,
            'cobblestone'
          );
        }
        return null;
      }

      this.state = PortalConstructionState.BUILDING_FRAME;
      // In full implementation, would use PlaceObsidianBucketTask
      // For now, return null as we need the bucket casting logic
      return null;
    }

    // Step 4: Clear interior
    for (let i = this.currentInteriorIndex; i < PORTAL_INTERIOR.length; i++) {
      const interiorOffset = PORTAL_INTERIOR[i];
      const interiorPos = new Vec3(
        this.portalOrigin.x + interiorOffset.x,
        this.portalOrigin.y + interiorOffset.y,
        this.portalOrigin.z + interiorOffset.z
      );

      const block = this.bot.blockAt(interiorPos);
      if (block && block.name !== 'air' && block.name !== 'nether_portal') {
        this.state = PortalConstructionState.CLEARING_INTERIOR;
        this.currentInteriorIndex = i;
        return new DestroyBlockTask(
          this.bot,
          Math.floor(interiorPos.x),
          Math.floor(interiorPos.y),
          Math.floor(interiorPos.z)
        );
      }
    }

    // Step 5: Light the portal
    this.state = PortalConstructionState.LIGHTING_PORTAL;
    const ignitionBlock = new BlockPos(
      this.portalOrigin.x,
      this.portalOrigin.y - 1,
      this.portalOrigin.z
    );

    return new InteractWithBlockTask(this.bot, {
      target: ignitionBlock,
      direction: Direction.UP,
      itemToUse: 'flint_and_steel',
    });
  }

  /**
   * Check if we have required materials
   */
  private hasMaterials(): boolean {
    const items = this.bot.inventory.items();

    // Count total buckets (empty, water, or lava) including stack counts
    let bucketCount = 0;
    for (const item of items) {
      if (item.name === 'bucket' || item.name === 'water_bucket' || item.name === 'lava_bucket') {
        bucketCount += item.count;
      }
    }
    const hasBuckets = bucketCount >= 2;

    const hasIgniter = items.some(i =>
      i.name === 'flint_and_steel' || i.name === 'fire_charge'
    );

    return hasBuckets && hasIgniter;
  }

  /**
   * Check if portal is complete (nether portal block exists)
   */
  private isPortalComplete(): boolean {
    if (!this.portalOrigin) return false;

    const portalBlock = this.bot.blockAt(
      new Vec3(this.portalOrigin.x, this.portalOrigin.y + 1, this.portalOrigin.z)
    );

    return portalBlock?.name === 'nether_portal';
  }

  /**
   * Find a lava lake nearby
   */
  private findLavaLake(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const radius = this.config.lavaSearchRange;

    let bestLava: Vec3 | null = null;
    let bestSize = 0;

    for (let x = -radius; x <= radius; x += 8) {
      for (let z = -radius; z <= radius; z += 8) {
        for (let y = -20; y <= 10; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (block && block.name === 'lava') {
            // Count adjacent lava blocks
            const size = this.countAdjacentLava(pos);
            if (size > bestSize && size >= 12) {
              bestSize = size;
              bestLava = pos;
            }
          }
        }
      }
    }

    return bestLava;
  }

  /**
   * Count adjacent lava blocks (flood fill)
   */
  private countAdjacentLava(origin: Vec3, visited: Set<string> = new Set()): number {
    const key = `${Math.floor(origin.x)},${Math.floor(origin.y)},${Math.floor(origin.z)}`;
    if (visited.has(key)) return 0;
    visited.add(key);

    if (visited.size > 50) return visited.size; // Limit recursion

    const block = this.bot.blockAt(origin);
    if (!block || block.name !== 'lava') return 0;

    let count = 1;
    const neighbors = [
      origin.offset(1, 0, 0),
      origin.offset(-1, 0, 0),
      origin.offset(0, 0, 1),
      origin.offset(0, 0, -1),
      origin.offset(0, 1, 0),
      origin.offset(0, -1, 0),
    ];

    for (const neighbor of neighbors) {
      count += this.countAdjacentLava(neighbor, visited);
    }

    return count;
  }

  /**
   * Find a suitable spot for portal near lava
   */
  private findPortalSpot(lavaPos: Vec3): BlockPos | null {
    // Search in 4 directions from lava
    const directions = [
      new Vec3(1, 0, 0),
      new Vec3(-1, 0, 0),
      new Vec3(0, 0, 1),
      new Vec3(0, 0, -1),
    ];

    for (const dir of directions) {
      for (let dist = 2; dist <= 20; dist++) {
        const checkPos = lavaPos.plus(dir.scaled(dist));

        if (this.isValidPortalSpot(checkPos)) {
          return new BlockPos(
            Math.floor(checkPos.x),
            Math.floor(checkPos.y),
            Math.floor(checkPos.z)
          );
        }
      }
    }

    return null;
  }

  /**
   * Check if a position is valid for portal construction
   */
  private isValidPortalSpot(pos: Vec3): boolean {
    // Check that there's no lava/water/bedrock in the portal region
    for (let dx = -1; dx <= 2; dx++) {
      for (let dz = -1; dz <= 3; dz++) {
        for (let dy = -1; dy <= 4; dy++) {
          const checkPos = pos.offset(dx, dy, dz);
          const block = this.bot.blockAt(checkPos);

          if (block) {
            if (block.name === 'lava' || block.name === 'water' || block.name === 'bedrock') {
              return false;
            }
          }
        }
      }
    }

    // Need at least one solid block to stand on
    const groundBlock = this.bot.blockAt(pos.offset(0, -1, 0));
    if (!groundBlock || groundBlock.boundingBox !== 'block') {
      return false;
    }

    return true;
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.state === PortalConstructionState.FINISHED || this.isPortalComplete();
  }

  /**
   * Get current state
   */
  getState(): PortalConstructionState {
    return this.state;
  }

  /**
   * Get portal origin
   */
  getPortalOrigin(): BlockPos | null {
    return this.portalOrigin;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ConstructNetherPortalTask)) return false;
    if (this.config.position && other.config.position) {
      return this.config.position.equals(other.config.position);
    }
    return this.config.position === null && other.config.position === null;
  }
}

/**
 * Convenience function to construct portal at position
 */
export function constructPortalAt(bot: Bot, x: number, y: number, z: number): ConstructNetherPortalTask {
  return ConstructNetherPortalTask.at(bot, x, y, z);
}

/**
 * Convenience function to auto-locate and construct portal
 */
export function constructPortal(bot: Bot): ConstructNetherPortalTask {
  return ConstructNetherPortalTask.autoLocate(bot);
}

export { PortalConstructionState };
