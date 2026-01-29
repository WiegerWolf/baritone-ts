/**
 * BuildTask - Structure Building Automation
 * Based on AltoClef's construction system
 *
 * Handles building structures from patterns/blueprints,
 * material gathering, and placement coordination.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { PlaceBlockTask } from '../concrete/PlaceBlockTask';
import { MineBlockTask } from '../concrete/MineBlockTask';
import { GetToBlockTask } from '../concrete/GetToBlockTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Block placement instruction
 */
export interface BlockPlacement {
  x: number;
  y: number;
  z: number;
  blockName: string;
}

/**
 * Build pattern/blueprint
 */
export interface BuildPattern {
  /** Name of the structure */
  name: string;
  /** Block placements relative to origin */
  blocks: BlockPlacement[];
  /** Required materials (blockName -> count) */
  materials: Record<string, number>;
}

/**
 * State for building
 */
enum BuildState {
  ANALYZING,
  GATHERING_MATERIALS,
  CLEARING_AREA,
  BUILDING,
  VERIFYING,
  FINISHED,
  FAILED
}

/**
 * Configuration for building
 */
export interface BuildConfig {
  /** Origin position for the build */
  origin: Vec3;
  /** The pattern to build */
  pattern: BuildPattern;
  /** Clear existing blocks first */
  clearArea: boolean;
  /** Verify placement after building */
  verifyBuild: boolean;
  /** Maximum distance to gather materials from */
  gatherRadius: number;
}

const DEFAULT_CONFIG: Partial<BuildConfig> = {
  clearArea: true,
  verifyBuild: true,
  gatherRadius: 32,
};

/**
 * Common build patterns
 */
export const BUILD_PATTERNS = {
  /** Simple 3x3x3 cube */
  CUBE_3X3: {
    name: 'cube_3x3',
    blocks: generateCube(3, 3, 3, 'cobblestone'),
    materials: { cobblestone: 27 },
  } as BuildPattern,

  /** 5x5 platform */
  PLATFORM_5X5: {
    name: 'platform_5x5',
    blocks: generatePlatform(5, 5, 'cobblestone'),
    materials: { cobblestone: 25 },
  } as BuildPattern,

  /** Simple 4-wall room (5x5x3) */
  SIMPLE_ROOM: {
    name: 'simple_room',
    blocks: generateRoom(5, 3, 5, 'cobblestone'),
    materials: { cobblestone: 48 }, // Walls only, no roof
  } as BuildPattern,

  /** Tower (3x3x8) */
  TOWER: {
    name: 'tower',
    blocks: generateTower(3, 8, 'cobblestone'),
    materials: { cobblestone: 56 },
  } as BuildPattern,
};

/**
 * Task for building structures
 */
export class BuildTask extends Task {
  private config: BuildConfig;
  private state: BuildState = BuildState.ANALYZING;
  private currentBlockIndex: number = 0;
  private placedBlocks: Set<string> = new Set();
  private clearedBlocks: Set<string> = new Set();
  private buildTimer: TimerGame;
  private missingMaterials: Record<string, number> = {};

  constructor(bot: Bot, config: BuildConfig) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config } as BuildConfig;
    this.buildTimer = new TimerGame(bot, 0.5);
  }

  get displayName(): string {
    const progress = this.currentBlockIndex;
    const total = this.config.pattern.blocks.length;
    return `Build(${this.config.pattern.name}, ${progress}/${total}, ${BuildState[this.state]})`;
  }

  onStart(): void {
    this.state = BuildState.ANALYZING;
    this.currentBlockIndex = 0;
    this.placedBlocks.clear();
    this.clearedBlocks.clear();
    this.missingMaterials = {};
  }

  onTick(): Task | null {
    switch (this.state) {
      case BuildState.ANALYZING:
        return this.handleAnalyzing();

      case BuildState.GATHERING_MATERIALS:
        return this.handleGatheringMaterials();

      case BuildState.CLEARING_AREA:
        return this.handleClearingArea();

      case BuildState.BUILDING:
        return this.handleBuilding();

      case BuildState.VERIFYING:
        return this.handleVerifying();

      default:
        return null;
    }
  }

  private handleAnalyzing(): Task | null {
    // Check what materials we have vs need
    this.missingMaterials = {};

    for (const [blockName, needed] of Object.entries(this.config.pattern.materials)) {
      const have = this.countItem(blockName);
      if (have < needed) {
        this.missingMaterials[blockName] = needed - have;
      }
    }

    if (Object.keys(this.missingMaterials).length > 0) {
      this.state = BuildState.GATHERING_MATERIALS;
    } else if (this.config.clearArea) {
      this.state = BuildState.CLEARING_AREA;
    } else {
      this.state = BuildState.BUILDING;
    }

    return null;
  }

  private handleGatheringMaterials(): Task | null {
    // Check if we now have enough
    let stillMissing = false;
    for (const [blockName, needed] of Object.entries(this.missingMaterials)) {
      const have = this.countItem(blockName);
      if (have < needed) {
        stillMissing = true;
        break;
      }
    }

    if (!stillMissing) {
      if (this.config.clearArea) {
        this.state = BuildState.CLEARING_AREA;
      } else {
        this.state = BuildState.BUILDING;
      }
      return null;
    }

    // For now, just fail if we don't have materials
    // A more complete implementation would mine/craft materials
    this.state = BuildState.FAILED;
    return null;
  }

  private handleClearingArea(): Task | null {
    const origin = this.config.origin;

    // Find next block to clear
    for (const placement of this.config.pattern.blocks) {
      const worldPos = new Vec3(
        origin.x + placement.x,
        origin.y + placement.y,
        origin.z + placement.z
      );
      const key = `${worldPos.x},${worldPos.y},${worldPos.z}`;

      if (this.clearedBlocks.has(key)) continue;

      const block = this.bot.blockAt(worldPos);
      if (block && block.boundingBox !== 'empty' && block.name !== placement.blockName) {
        // Need to clear this block
        return new MineBlockTask(
          this.bot,
          Math.floor(worldPos.x),
          Math.floor(worldPos.y),
          Math.floor(worldPos.z)
        );
      }

      this.clearedBlocks.add(key);
    }

    // All cleared
    this.state = BuildState.BUILDING;
    return null;
  }

  private handleBuilding(): Task | null {
    if (!this.buildTimer.elapsed()) {
      return null;
    }

    const origin = this.config.origin;
    const blocks = this.config.pattern.blocks;

    // Find next block to place
    while (this.currentBlockIndex < blocks.length) {
      const placement = blocks[this.currentBlockIndex];
      const worldPos = new Vec3(
        origin.x + placement.x,
        origin.y + placement.y,
        origin.z + placement.z
      );
      const key = `${worldPos.x},${worldPos.y},${worldPos.z}`;

      // Check if already placed
      const existingBlock = this.bot.blockAt(worldPos);
      if (existingBlock && existingBlock.name === placement.blockName) {
        this.placedBlocks.add(key);
        this.currentBlockIndex++;
        continue;
      }

      // Check if we can place (need adjacent solid block)
      if (!this.canPlaceAt(worldPos)) {
        // Skip for now, will retry later
        this.currentBlockIndex++;
        continue;
      }

      // Place this block
      this.buildTimer.reset();
      return new PlaceBlockTask(
        this.bot,
        Math.floor(worldPos.x),
        Math.floor(worldPos.y),
        Math.floor(worldPos.z),
        placement.blockName
      );
    }

    // Check if we placed everything
    if (this.placedBlocks.size >= blocks.length) {
      if (this.config.verifyBuild) {
        this.state = BuildState.VERIFYING;
      } else {
        this.state = BuildState.FINISHED;
      }
    } else {
      // Restart from beginning to catch any we skipped
      this.currentBlockIndex = 0;
    }

    return null;
  }

  private handleVerifying(): Task | null {
    const origin = this.config.origin;
    let allCorrect = true;

    for (const placement of this.config.pattern.blocks) {
      const worldPos = new Vec3(
        origin.x + placement.x,
        origin.y + placement.y,
        origin.z + placement.z
      );

      const block = this.bot.blockAt(worldPos);
      if (!block || block.name !== placement.blockName) {
        allCorrect = false;
        break;
      }
    }

    if (allCorrect) {
      this.state = BuildState.FINISHED;
    } else {
      // Retry building
      this.currentBlockIndex = 0;
      this.state = BuildState.BUILDING;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.placedBlocks.clear();
    this.clearedBlocks.clear();
  }

  isFinished(): boolean {
    return this.state === BuildState.FINISHED || this.state === BuildState.FAILED;
  }

  isFailed(): boolean {
    return this.state === BuildState.FAILED;
  }

  // ---- Helper Methods ----

  private countItem(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName) {
        count += item.count;
      }
    }
    return count;
  }

  private canPlaceAt(pos: Vec3): boolean {
    // Check if there's an adjacent solid block to place against
    const offsets = [
      new Vec3(1, 0, 0), new Vec3(-1, 0, 0),
      new Vec3(0, 1, 0), new Vec3(0, -1, 0),
      new Vec3(0, 0, 1), new Vec3(0, 0, -1),
    ];

    for (const offset of offsets) {
      const adjacent = pos.plus(offset);
      const block = this.bot.blockAt(adjacent);
      if (block && block.boundingBox !== 'empty') {
        return true;
      }
    }

    return false;
  }

  /**
   * Get build progress percentage
   */
  getProgress(): number {
    return (this.placedBlocks.size / this.config.pattern.blocks.length) * 100;
  }

  /**
   * Get missing materials
   */
  getMissingMaterials(): Record<string, number> {
    return { ...this.missingMaterials };
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof BuildTask)) return false;

    return this.config.pattern.name === other.config.pattern.name &&
           this.config.origin.equals(other.config.origin);
  }
}

// ---- Pattern Generation Helpers ----

function generateCube(width: number, height: number, depth: number, blockName: string): BlockPlacement[] {
  const blocks: BlockPlacement[] = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        blocks.push({ x, y, z, blockName });
      }
    }
  }
  return blocks;
}

function generatePlatform(width: number, depth: number, blockName: string): BlockPlacement[] {
  const blocks: BlockPlacement[] = [];
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      blocks.push({ x, y: 0, z, blockName });
    }
  }
  return blocks;
}

function generateRoom(width: number, height: number, depth: number, blockName: string): BlockPlacement[] {
  const blocks: BlockPlacement[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        // Only walls (edges)
        if (x === 0 || x === width - 1 || z === 0 || z === depth - 1) {
          blocks.push({ x, y, z, blockName });
        }
      }
    }
  }

  return blocks;
}

function generateTower(width: number, height: number, blockName: string): BlockPlacement[] {
  const blocks: BlockPlacement[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < width; z++) {
        // Only walls
        if (x === 0 || x === width - 1 || z === 0 || z === width - 1) {
          blocks.push({ x, y, z, blockName });
        }
      }
    }
  }

  return blocks;
}

/**
 * Convenience functions
 */
export function buildCube(bot: Bot, origin: Vec3, size: number = 3, blockName: string = 'cobblestone'): BuildTask {
  return new BuildTask(bot, {
    origin,
    pattern: {
      name: `cube_${size}`,
      blocks: generateCube(size, size, size, blockName),
      materials: { [blockName]: size * size * size },
    },
    clearArea: true,
    verifyBuild: true,
    gatherRadius: 32,
  });
}

export function buildPlatform(bot: Bot, origin: Vec3, width: number = 5, depth: number = 5, blockName: string = 'cobblestone'): BuildTask {
  return new BuildTask(bot, {
    origin,
    pattern: {
      name: `platform_${width}x${depth}`,
      blocks: generatePlatform(width, depth, blockName),
      materials: { [blockName]: width * depth },
    },
    clearArea: true,
    verifyBuild: true,
    gatherRadius: 32,
  });
}

export function buildWall(bot: Bot, origin: Vec3, length: number, height: number, blockName: string = 'cobblestone'): BuildTask {
  const blocks: BlockPlacement[] = [];
  for (let x = 0; x < length; x++) {
    for (let y = 0; y < height; y++) {
      blocks.push({ x, y, z: 0, blockName });
    }
  }

  return new BuildTask(bot, {
    origin,
    pattern: {
      name: `wall_${length}x${height}`,
      blocks,
      materials: { [blockName]: length * height },
    },
    clearArea: true,
    verifyBuild: true,
    gatherRadius: 32,
  });
}

export function buildFromPattern(bot: Bot, origin: Vec3, pattern: BuildPattern): BuildTask {
  return new BuildTask(bot, {
    origin,
    pattern,
    clearArea: true,
    verifyBuild: true,
    gatherRadius: 32,
  });
}
