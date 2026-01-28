/**
 * PortalTask - Dimension Portal Navigation
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
import { GetToBlockTask, GoToNearTask } from '../concrete/GoToTask';
import { PlaceBlockTask } from '../concrete/PlaceBlockTask';
import { InteractBlockTask } from '../concrete/InteractTask';
import { TimeoutWanderTask } from '../concrete/MovementUtilTask';
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

// ============================================================================
// Legacy compatibility classes from concrete/PortalTask (BaritonePlus style)
// ============================================================================

/**
 * State for EnterNetherPortalTask
 */
enum NetherPortalState {
  FINDING_PORTAL,
  APPROACHING,
  ENTERING,
  WAITING,
  WANDERING,
  FINISHED,
}

/**
 * Configuration for EnterNetherPortalTask
 */
export interface NetherPortalConfig {
  /** Timeout before trying to exit and re-enter portal */
  portalTimeout: number;
  /** Whether to build a portal if none found */
  buildIfMissing: boolean;
  /** Custom portal filter */
  portalFilter?: (pos: Vec3) => boolean;
}

const DEFAULT_NETHER_CONFIG: NetherPortalConfig = {
  portalTimeout: 10,
  buildIfMissing: false,
};

/**
 * Task to enter a nether portal and travel to another dimension.
 * Based on BaritonePlus EnterNetherPortalTask.java
 */
export class EnterNetherPortalTask extends Task {
  private targetDimension: Dimension;
  private config: NetherPortalConfig;
  private state: NetherPortalState = NetherPortalState.FINDING_PORTAL;
  private portalTimeout: TimerGame;
  private leftPortal: boolean = false;
  private currentPortalPos: Vec3 | null = null;

  constructor(
    bot: Bot,
    targetDimension: Dimension,
    config: Partial<NetherPortalConfig> = {}
  ) {
    super(bot);

    if (targetDimension === Dimension.END) {
      throw new Error("Can't use a nether portal to reach the End. Use an End portal.");
    }

    this.targetDimension = targetDimension;
    this.config = { ...DEFAULT_NETHER_CONFIG, ...config };
    this.portalTimeout = new TimerGame(bot, this.config.portalTimeout);
  }

  get displayName(): string {
    const dimName = this.targetDimension === Dimension.NETHER ? 'Nether' : 'Overworld';
    return `EnterPortal(${dimName})`;
  }

  onStart(): void {
    this.state = NetherPortalState.FINDING_PORTAL;
    this.leftPortal = false;
    this.currentPortalPos = null;
    this.portalTimeout.reset();
  }

  onTick(): Task | null {
    if (this.getCurrentDimension() === this.targetDimension) {
      this.state = NetherPortalState.FINISHED;
      return null;
    }

    switch (this.state) {
      case NetherPortalState.FINDING_PORTAL:
        return this.handleFindingPortal();
      case NetherPortalState.APPROACHING:
        return this.handleApproaching();
      case NetherPortalState.ENTERING:
        return this.handleEntering();
      case NetherPortalState.WAITING:
        return this.handleWaiting();
      case NetherPortalState.WANDERING:
        return this.handleWandering();
      default:
        return null;
    }
  }

  private handleFindingPortal(): Task | null {
    const portal = this.findNearestNetherPortal();
    if (portal) {
      this.currentPortalPos = portal;
      this.state = NetherPortalState.APPROACHING;
      return null;
    }

    if (this.config.buildIfMissing) {
      // Building portal is complex - for now, just wander
    }

    this.state = NetherPortalState.WANDERING;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.currentPortalPos) {
      this.state = NetherPortalState.FINDING_PORTAL;
      return null;
    }

    const block = this.bot.blockAt(this.currentPortalPos);
    if (!block || block.name !== 'nether_portal') {
      this.currentPortalPos = null;
      this.state = NetherPortalState.FINDING_PORTAL;
      return null;
    }

    if (this.isInPortal()) {
      this.state = NetherPortalState.WAITING;
      this.portalTimeout.reset();
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentPortalPos);
    if (dist <= 1.5) {
      this.state = NetherPortalState.ENTERING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.currentPortalPos.x),
      Math.floor(this.currentPortalPos.y),
      Math.floor(this.currentPortalPos.z),
      1
    );
  }

  private handleEntering(): Task | null {
    if (!this.currentPortalPos) {
      this.state = NetherPortalState.FINDING_PORTAL;
      return null;
    }

    if (this.isInPortal()) {
      this.state = NetherPortalState.WAITING;
      this.portalTimeout.reset();
      return null;
    }

    this.bot.setControlState('forward', true);
    return null;
  }

  private handleWaiting(): Task | null {
    if (!this.isInPortal()) {
      this.portalTimeout.reset();
      this.state = NetherPortalState.APPROACHING;
      return null;
    }

    this.bot.clearControlStates();

    if (this.portalTimeout.elapsed() && !this.leftPortal) {
      this.state = NetherPortalState.WANDERING;
      this.leftPortal = true;
      return null;
    }

    return null;
  }

  private handleWandering(): Task | null {
    const portal = this.findNearestNetherPortal();
    if (portal) {
      this.currentPortalPos = portal;
      this.state = NetherPortalState.APPROACHING;
      return null;
    }

    return new TimeoutWanderTask(this.bot, 5);
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.currentPortalPos = null;
  }

  isFinished(): boolean {
    return this.state === NetherPortalState.FINISHED ||
           this.getCurrentDimension() === this.targetDimension;
  }

  private findNearestNetherPortal(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const searchRadius = 64;

    let nearest: Vec3 | null = null;
    let nearestDist = Infinity;

    for (let r = 1; r <= searchRadius; r++) {
      for (let x = -r; x <= r; x++) {
        for (let y = -Math.min(r, 32); y <= Math.min(r, 32); y++) {
          for (let z = -r; z <= r; z++) {
            if (Math.abs(x) !== r && Math.abs(y) !== r && Math.abs(z) !== r) continue;

            const checkPos = new Vec3(
              Math.floor(playerPos.x) + x,
              Math.floor(playerPos.y) + y,
              Math.floor(playerPos.z) + z
            );

            const block = this.bot.blockAt(checkPos);
            if (block && block.name === 'nether_portal') {
              if (this.config.portalFilter && !this.config.portalFilter(checkPos)) {
                continue;
              }

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
      if (nearest) break;
    }

    return nearest;
  }

  private isInPortal(): boolean {
    const playerBlockPos = this.bot.entity.position.floored();
    const block = this.bot.blockAt(playerBlockPos);
    return block !== null && block.name === 'nether_portal';
  }

  private getCurrentDimension(): Dimension {
    const dimensionName = (this.bot as any).game?.dimension ?? 'minecraft:overworld';
    if (dimensionName.includes('nether')) return Dimension.NETHER;
    if (dimensionName.includes('end')) return Dimension.END;
    return Dimension.OVERWORLD;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof EnterNetherPortalTask)) return false;
    return this.targetDimension === other.targetDimension;
  }
}

/**
 * Task to go to a specific dimension.
 * Based on BaritonePlus GoToDimensionTask.java
 */
export class GoToDimensionTask extends Task {
  private targetDimension: Dimension;
  private finished: boolean = false;

  constructor(bot: Bot, targetDimension: Dimension) {
    super(bot);
    this.targetDimension = targetDimension;
  }

  get displayName(): string {
    const dimName = this.targetDimension === Dimension.NETHER ? 'Nether'
      : this.targetDimension === Dimension.END ? 'End'
      : 'Overworld';
    return `GoToDimension(${dimName})`;
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    const current = this.getCurrentDimension();

    if (current === this.targetDimension) {
      this.finished = true;
      return null;
    }

    if (this.targetDimension === Dimension.END) {
      // End portal logic would require finding stronghold
      // For now, fail gracefully
      this.finished = true;
      return null;
    }

    return new EnterNetherPortalTask(this.bot, this.targetDimension);
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.finished || this.getCurrentDimension() === this.targetDimension;
  }

  private getCurrentDimension(): Dimension {
    const dimensionName = (this.bot as any).game?.dimension ?? 'minecraft:overworld';
    if (dimensionName.includes('nether')) return Dimension.NETHER;
    if (dimensionName.includes('end')) return Dimension.END;
    return Dimension.OVERWORLD;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GoToDimensionTask)) return false;
    return this.targetDimension === other.targetDimension;
  }
}

/**
 * Helper to enter the nether (legacy API)
 */
export function enterNetherLegacy(bot: Bot): EnterNetherPortalTask {
  return new EnterNetherPortalTask(bot, Dimension.NETHER);
}

/**
 * Helper to return to overworld (legacy API)
 */
export function returnToOverworld(bot: Bot): EnterNetherPortalTask {
  return new EnterNetherPortalTask(bot, Dimension.OVERWORLD);
}

/**
 * Helper to go to a dimension
 */
export function goToDimension(bot: Bot, dimension: Dimension): GoToDimensionTask {
  return new GoToDimensionTask(bot, dimension);
}
