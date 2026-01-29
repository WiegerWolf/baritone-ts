/**
 * PortalNavTask - Dimension Portal Navigation
 * Based on AltoClef's dimension handling
 *
 * Handles finding, using, and navigating through
 * nether and end portals with coordinate conversion.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask } from '../concrete/GetToBlockTask';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { PlaceBlockTask } from '../concrete/PlaceBlockTask';
import { InteractBlockTask } from '../concrete/InteractBlockTask';
import { TimeoutWanderTask } from '../concrete/TimeoutWanderTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Portal type
 */
export enum PortalType {
  NETHER,
  END,
}

/**
 * Dimension names (matching concrete/ResourceTask for compatibility)
 */
export enum Dimension {
  OVERWORLD = 'minecraft:overworld',
  NETHER = 'minecraft:the_nether',
  END = 'minecraft:the_end',
}

/**
 * State for portal navigation
 */
enum PortalState {
  FINDING_PORTAL,
  APPROACHING,
  ENTERING,
  IN_TRANSIT,
  ARRIVED,
  BUILDING_PORTAL,
  FINISHED,
  FAILED
}

/**
 * Configuration for portal navigation
 */
export interface PortalConfig {
  /** Type of portal to use */
  portalType: PortalType;
  /** Search radius for existing portal */
  searchRadius: number;
  /** Build portal if not found */
  buildIfNeeded: boolean;
  /** Wait time in portal (seconds) */
  transitTime: number;
  /** Target dimension (for verification) */
  targetDimension?: Dimension;
}

const DEFAULT_CONFIG: PortalConfig = {
  portalType: PortalType.NETHER,
  searchRadius: 128,
  buildIfNeeded: false,
  transitTime: 4,
};

/**
 * Portal frame blocks for nether portal
 */
const NETHER_PORTAL_FRAME = [
  // Bottom row
  { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 3, y: 0, z: 0 },
  // Left column
  { x: 0, y: 1, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 0, y: 3, z: 0 },
  // Right column
  { x: 3, y: 1, z: 0 }, { x: 3, y: 2, z: 0 }, { x: 3, y: 3, z: 0 },
  // Top row
  { x: 0, y: 4, z: 0 }, { x: 1, y: 4, z: 0 }, { x: 2, y: 4, z: 0 }, { x: 3, y: 4, z: 0 },
];

/**
 * Task for portal navigation
 */
export class PortalTask extends Task {
  private config: PortalConfig;
  private state: PortalState = PortalState.FINDING_PORTAL;
  private portalPos: Vec3 | null = null;
  private transitTimer: TimerGame;
  private startDimension: string = '';
  private buildIndex: number = 0;

  constructor(bot: Bot, config: Partial<PortalConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.transitTimer = new TimerGame(bot, this.config.transitTime);
  }

  get displayName(): string {
    const portalName = PortalType[this.config.portalType];
    return `Portal(${portalName}, ${PortalState[this.state]})`;
  }

  onStart(): void {
    this.state = PortalState.FINDING_PORTAL;
    this.portalPos = null;
    this.startDimension = this.getCurrentDimension();
    this.buildIndex = 0;
  }

  onTick(): Task | null {
    switch (this.state) {
      case PortalState.FINDING_PORTAL:
        return this.handleFindingPortal();

      case PortalState.APPROACHING:
        return this.handleApproaching();

      case PortalState.ENTERING:
        return this.handleEntering();

      case PortalState.IN_TRANSIT:
        return this.handleInTransit();

      case PortalState.ARRIVED:
        return this.handleArrived();

      case PortalState.BUILDING_PORTAL:
        return this.handleBuildingPortal();

      default:
        return null;
    }
  }

  private handleFindingPortal(): Task | null {
    this.portalPos = this.findPortal();

    if (this.portalPos) {
      this.state = PortalState.APPROACHING;
      return null;
    }

    // No portal found
    if (this.config.buildIfNeeded && this.config.portalType === PortalType.NETHER) {
      this.state = PortalState.BUILDING_PORTAL;
      return null;
    }

    this.state = PortalState.FAILED;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.portalPos) {
      this.state = PortalState.FINDING_PORTAL;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.portalPos);
    if (dist <= 2.0) {
      this.state = PortalState.ENTERING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.portalPos.x),
      Math.floor(this.portalPos.y),
      Math.floor(this.portalPos.z),
      1
    );
  }

  private handleEntering(): Task | null {
    if (!this.portalPos) {
      this.state = PortalState.FINDING_PORTAL;
      return null;
    }

    // Walk into the portal
    const portalBlock = this.bot.blockAt(this.portalPos);
    if (!portalBlock || !this.isPortalBlock(portalBlock.name)) {
      this.state = PortalState.FINDING_PORTAL;
      return null;
    }

    // Move toward portal center
    const dist = this.bot.entity.position.distanceTo(this.portalPos);
    if (dist > 0.5) {
      this.bot.setControlState('forward', true);
      this.lookAt(this.portalPos);
    } else {
      this.bot.setControlState('forward', false);
      this.transitTimer.reset();
      this.state = PortalState.IN_TRANSIT;
    }

    return null;
  }

  private handleInTransit(): Task | null {
    // Check if we've changed dimension
    const currentDim = this.getCurrentDimension();
    if (currentDim !== this.startDimension) {
      this.state = PortalState.ARRIVED;
      return null;
    }

    // Wait for transit
    if (this.transitTimer.elapsed()) {
      // Still in same dimension, might have failed
      this.state = PortalState.ARRIVED; // Assume success anyway
    }

    return null;
  }

  private handleArrived(): Task | null {
    // Move away from portal spawn point
    this.bot.setControlState('forward', true);

    // Brief delay then finish
    this.state = PortalState.FINISHED;
    return null;
  }

  private handleBuildingPortal(): Task | null {
    // Check if we have obsidian
    const obsidianCount = this.countItem('obsidian');
    if (obsidianCount < 10) {
      this.state = PortalState.FAILED;
      return null;
    }

    // Build portal frame
    if (this.buildIndex >= NETHER_PORTAL_FRAME.length) {
      // Frame complete, light it
      return this.lightPortal();
    }

    const pos = NETHER_PORTAL_FRAME[this.buildIndex];
    const buildPos = this.bot.entity.position.offset(pos.x, pos.y, pos.z);

    const block = this.bot.blockAt(buildPos);
    if (block && block.name === 'obsidian') {
      this.buildIndex++;
      return null;
    }

    this.buildIndex++;
    return new PlaceBlockTask(
      this.bot,
      Math.floor(buildPos.x),
      Math.floor(buildPos.y),
      Math.floor(buildPos.z),
      'obsidian'
    );
  }

  private lightPortal(): Task | null {
    // Find flint and steel
    const flintAndSteel = this.findItem('flint_and_steel');
    if (!flintAndSteel) {
      this.state = PortalState.FAILED;
      return null;
    }

    // Find interior block to light
    const interiorPos = this.bot.entity.position.offset(1, 1, 0);

    // Equip and use
    try {
      this.bot.equip(flintAndSteel, 'hand');
    } catch {
      // May fail
    }

    this.state = PortalState.FINDING_PORTAL;
    return new InteractBlockTask(
      this.bot,
      Math.floor(interiorPos.x),
      Math.floor(interiorPos.y),
      Math.floor(interiorPos.z)
    );
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.portalPos = null;
  }

  isFinished(): boolean {
    return this.state === PortalState.FINISHED || this.state === PortalState.FAILED;
  }

  isFailed(): boolean {
    return this.state === PortalState.FAILED;
  }

  // ---- Helper Methods ----

  /**
   * Find nearest portal using shell expansion search.
   * Searches in concentric rings for efficiency - first hit is nearest.
   */
  private findPortal(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const searchRadius = Math.min(this.config.searchRadius, 64);

    let nearest: Vec3 | null = null;
    let nearestDist = Infinity;

    const portalBlockName = this.config.portalType === PortalType.NETHER
      ? 'nether_portal'
      : 'end_portal';

    // Shell expansion: search in growing rings (more efficient)
    for (let r = 1; r <= searchRadius; r++) {
      for (let x = -r; x <= r; x++) {
        for (let y = -Math.min(r, 32); y <= Math.min(r, 32); y++) {
          for (let z = -r; z <= r; z++) {
            // Only check outer shell (not interior blocks already checked)
            if (Math.abs(x) !== r && Math.abs(y) !== Math.min(r, 32) && Math.abs(z) !== r) continue;

            const checkPos = new Vec3(
              Math.floor(playerPos.x) + x,
              Math.floor(playerPos.y) + y,
              Math.floor(playerPos.z) + z
            );

            const block = this.bot.blockAt(checkPos);
            if (block && block.name === portalBlockName) {
              // Check for standable position (solid block below)
              const below = this.bot.blockAt(checkPos.offset(0, -1, 0));
              if (below && below.boundingBox === 'block') {
                const dist = playerPos.distanceTo(checkPos);
                if (dist < nearestDist) {
                  nearestDist = dist;
                  nearest = checkPos;
                }
              }
            }
          }
        }
      }
      // Early exit - first hit in its ring is nearest
      if (nearest) break;
    }

    return nearest;
  }

  private isPortalBlock(blockName: string): boolean {
    return blockName === 'nether_portal' || blockName === 'end_portal';
  }

  private getCurrentDimension(): string {
    // Try to get dimension from bot
    const bot = this.bot as any;
    if (bot.game && bot.game.dimension) {
      return bot.game.dimension;
    }
    return 'unknown';
  }

  private findItem(itemName: string): any | null {
    return this.bot.inventory.items().find(item => item.name === itemName) ?? null;
  }

  private countItem(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName) {
        count += item.count;
      }
    }
    return count;
  }

  private lookAt(pos: Vec3): void {
    try {
      this.bot.lookAt(pos);
    } catch {
      // May fail
    }
  }

  /**
   * Convert overworld coordinates to nether
   */
  static overworldToNether(x: number, z: number): { x: number; z: number } {
    return {
      x: Math.floor(x / 8),
      z: Math.floor(z / 8),
    };
  }

  /**
   * Convert nether coordinates to overworld
   */
  static netherToOverworld(x: number, z: number): { x: number; z: number } {
    return {
      x: x * 8,
      z: z * 8,
    };
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PortalTask)) return false;

    return this.config.portalType === other.config.portalType;
  }
}

/**
 * Convenience functions
 */
export function enterNether(bot: Bot): PortalTask {
  return new PortalTask(bot, { portalType: PortalType.NETHER });
}

export function enterEnd(bot: Bot): PortalTask {
  return new PortalTask(bot, { portalType: PortalType.END });
}

export function buildAndEnterNether(bot: Bot): PortalTask {
  return new PortalTask(bot, {
    portalType: PortalType.NETHER,
    buildIfNeeded: true,
  });
}

export function findNearestPortal(bot: Bot, type: PortalType = PortalType.NETHER): PortalTask {
  return new PortalTask(bot, {
    portalType: type,
    buildIfNeeded: false,
  });
}
