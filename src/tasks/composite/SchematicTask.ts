/**
 * SchematicTask - Schematic-Based Building
 * Based on AltoClef patterns
 *
 * Handles loading schematics, analyzing build requirements,
 * gathering materials, and placing blocks according to blueprints.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask } from '../concrete/GetToBlockTask';
import { PlaceBlockTask } from '../concrete/PlaceBlockTask';
import { MineBlockTask } from '../concrete/MineBlockTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for schematic building
 */
enum SchematicState {
  LOADING,
  ANALYZING,
  GATHERING_MATERIALS,
  CLEARING_AREA,
  BUILDING,
  VERIFYING,
  FINISHED,
  FAILED
}

/**
 * A single block in a schematic
 */
export interface SchematicBlock {
  /** Relative position from origin */
  pos: Vec3;
  /** Block type to place */
  blockType: string;
  /** Block properties (facing, etc) */
  properties?: Record<string, string>;
}

/**
 * A complete schematic
 */
export interface Schematic {
  /** Name of the schematic */
  name: string;
  /** Dimensions */
  width: number;
  height: number;
  depth: number;
  /** Blocks to place */
  blocks: SchematicBlock[];
  /** Palette of block types used */
  palette: string[];
}

/**
 * Configuration for schematic building
 */
export interface SchematicConfig {
  /** Origin position to build at */
  origin: Vec3;
  /** The schematic data */
  schematic: Schematic;
  /** Clear existing blocks first */
  clearArea: boolean;
  /** Gather materials automatically */
  gatherMaterials: boolean;
  /** Verify placement after building */
  verifyBuild: boolean;
  /** Build layer by layer (Y-axis) */
  layerByLayer: boolean;
  /** Search radius for materials */
  gatherRadius: number;
}

const DEFAULT_CONFIG: Partial<SchematicConfig> = {
  clearArea: true,
  gatherMaterials: true,
  verifyBuild: true,
  layerByLayer: true,
  gatherRadius: 32,
};

/**
 * Task for schematic-based building
 */
export class SchematicTask extends Task {
  private config: SchematicConfig;
  private state: SchematicState = SchematicState.LOADING;
  private buildQueue: SchematicBlock[] = [];
  private clearQueue: Vec3[] = [];
  private currentBlockIndex: number = 0;
  private currentClearIndex: number = 0;
  private materialsNeeded: Map<string, number> = new Map();
  private materialsHave: Map<string, number> = new Map();
  private buildTimer: TimerGame;
  private placedCount: number = 0;

  constructor(bot: Bot, origin: Vec3, schematic: Schematic, config: Partial<SchematicConfig> = {}) {
    super(bot);
    this.config = {
      ...DEFAULT_CONFIG,
      origin: origin.clone(),
      schematic,
      ...config
    } as SchematicConfig;
    this.buildTimer = new TimerGame(bot, 0.25);
  }

  get displayName(): string {
    const total = this.config.schematic.blocks.length;
    return `Schematic(${this.config.schematic.name}, ${this.placedCount}/${total}, ${SchematicState[this.state]})`;
  }

  onStart(): void {
    this.state = SchematicState.LOADING;
    this.buildQueue = [];
    this.clearQueue = [];
    this.currentBlockIndex = 0;
    this.currentClearIndex = 0;
    this.materialsNeeded.clear();
    this.materialsHave.clear();
    this.placedCount = 0;
  }

  onTick(): Task | null {
    switch (this.state) {
      case SchematicState.LOADING:
        return this.handleLoading();

      case SchematicState.ANALYZING:
        return this.handleAnalyzing();

      case SchematicState.GATHERING_MATERIALS:
        return this.handleGatheringMaterials();

      case SchematicState.CLEARING_AREA:
        return this.handleClearingArea();

      case SchematicState.BUILDING:
        return this.handleBuilding();

      case SchematicState.VERIFYING:
        return this.handleVerifying();

      default:
        return null;
    }
  }

  private handleLoading(): Task | null {
    // Validate schematic
    if (!this.config.schematic || this.config.schematic.blocks.length === 0) {
      this.state = SchematicState.FAILED;
      return null;
    }

    // Sort blocks for optimal build order
    this.buildQueue = this.sortBlocksForBuilding([...this.config.schematic.blocks]);

    this.state = SchematicState.ANALYZING;
    return null;
  }

  private handleAnalyzing(): Task | null {
    // Count required materials
    this.materialsNeeded.clear();
    for (const block of this.buildQueue) {
      const count = this.materialsNeeded.get(block.blockType) || 0;
      this.materialsNeeded.set(block.blockType, count + 1);
    }

    // Count materials in inventory
    this.updateMaterialCounts();

    // Check if we have enough materials
    if (this.config.gatherMaterials && !this.hasAllMaterials()) {
      this.state = SchematicState.GATHERING_MATERIALS;
      return null;
    }

    // Build clear queue if needed
    if (this.config.clearArea) {
      this.clearQueue = this.findBlocksToClear();
      if (this.clearQueue.length > 0) {
        this.state = SchematicState.CLEARING_AREA;
        return null;
      }
    }

    this.state = SchematicState.BUILDING;
    return null;
  }

  private handleGatheringMaterials(): Task | null {
    // This would delegate to GatherResourcesTask
    // For now, check if we have materials
    this.updateMaterialCounts();

    if (this.hasAllMaterials()) {
      if (this.config.clearArea && this.clearQueue.length > 0) {
        this.state = SchematicState.CLEARING_AREA;
      } else {
        this.state = SchematicState.BUILDING;
      }
      return null;
    }

    // Find what we're missing
    for (const [blockType, needed] of this.materialsNeeded) {
      const have = this.materialsHave.get(blockType) || 0;
      if (have < needed) {
        // Need to gather this block type
        // For now, fail if we can't gather
        this.state = SchematicState.FAILED;
        return null;
      }
    }

    this.state = SchematicState.BUILDING;
    return null;
  }

  private handleClearingArea(): Task | null {
    if (this.currentClearIndex >= this.clearQueue.length) {
      this.state = SchematicState.BUILDING;
      return null;
    }

    const clearPos = this.clearQueue[this.currentClearIndex];
    const worldPos = this.toWorldPos(clearPos);

    // Check if already clear
    const block = this.bot.blockAt(worldPos);
    if (!block || block.boundingBox === 'empty' || block.name === 'air') {
      this.currentClearIndex++;
      return null;
    }

    // Get close and mine
    const dist = this.bot.entity.position.distanceTo(worldPos);
    if (dist > 4) {
      return new GetToBlockTask(
        this.bot,
        Math.floor(worldPos.x),
        Math.floor(worldPos.y),
        Math.floor(worldPos.z)
      );
    }

    this.currentClearIndex++;
    return new MineBlockTask(
      this.bot,
      Math.floor(worldPos.x),
      Math.floor(worldPos.y),
      Math.floor(worldPos.z)
    );
  }

  private handleBuilding(): Task | null {
    if (this.currentBlockIndex >= this.buildQueue.length) {
      if (this.config.verifyBuild) {
        this.state = SchematicState.VERIFYING;
      } else {
        this.state = SchematicState.FINISHED;
      }
      return null;
    }

    const schematicBlock = this.buildQueue[this.currentBlockIndex];
    const worldPos = this.toWorldPos(schematicBlock.pos);

    // Check if already placed correctly
    const existingBlock = this.bot.blockAt(worldPos);
    if (existingBlock && existingBlock.name === schematicBlock.blockType) {
      this.currentBlockIndex++;
      this.placedCount++;
      return null;
    }

    // Need to place block
    const dist = this.bot.entity.position.distanceTo(worldPos);
    if (dist > 4) {
      return new GetToBlockTask(
        this.bot,
        Math.floor(worldPos.x),
        Math.floor(worldPos.y),
        Math.floor(worldPos.z)
      );
    }

    // Check if we have the material
    if (!this.hasMaterial(schematicBlock.blockType)) {
      // Skip this block
      this.currentBlockIndex++;
      return null;
    }

    // Place the block
    if (!this.buildTimer.elapsed()) {
      return null;
    }
    this.buildTimer.reset();

    this.currentBlockIndex++;
    this.placedCount++;

    return new PlaceBlockTask(
      this.bot,
      Math.floor(worldPos.x),
      Math.floor(worldPos.y),
      Math.floor(worldPos.z),
      schematicBlock.blockType
    );
  }

  private handleVerifying(): Task | null {
    // Check that all blocks are placed correctly
    let allCorrect = true;

    for (const schematicBlock of this.buildQueue) {
      const worldPos = this.toWorldPos(schematicBlock.pos);
      const block = this.bot.blockAt(worldPos);

      if (!block || block.name !== schematicBlock.blockType) {
        allCorrect = false;
        break;
      }
    }

    if (allCorrect) {
      this.state = SchematicState.FINISHED;
    } else {
      // Try rebuilding
      this.state = SchematicState.BUILDING;
      this.currentBlockIndex = 0;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.state === SchematicState.FINISHED || this.state === SchematicState.FAILED;
  }

  isFailed(): boolean {
    return this.state === SchematicState.FAILED;
  }

  // ---- Helper Methods ----

  private toWorldPos(relativePos: Vec3): Vec3 {
    return this.config.origin.plus(relativePos);
  }

  private sortBlocksForBuilding(blocks: SchematicBlock[]): SchematicBlock[] {
    if (this.config.layerByLayer) {
      // Sort by Y (bottom to top), then by distance from center
      return blocks.sort((a, b) => {
        if (a.pos.y !== b.pos.y) {
          return a.pos.y - b.pos.y;
        }
        const distA = a.pos.x * a.pos.x + a.pos.z * a.pos.z;
        const distB = b.pos.x * b.pos.x + b.pos.z * b.pos.z;
        return distA - distB;
      });
    }

    // Sort by distance from origin
    return blocks.sort((a, b) => {
      const distA = a.pos.x * a.pos.x + a.pos.y * a.pos.y + a.pos.z * a.pos.z;
      const distB = b.pos.x * b.pos.x + b.pos.y * b.pos.y + b.pos.z * b.pos.z;
      return distA - distB;
    });
  }

  private updateMaterialCounts(): void {
    this.materialsHave.clear();
    for (const item of this.bot.inventory.items()) {
      const count = this.materialsHave.get(item.name) || 0;
      this.materialsHave.set(item.name, count + item.count);
    }
  }

  private hasAllMaterials(): boolean {
    for (const [blockType, needed] of this.materialsNeeded) {
      const have = this.materialsHave.get(blockType) || 0;
      if (have < needed) {
        return false;
      }
    }
    return true;
  }

  private hasMaterial(blockType: string): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === blockType) {
        return true;
      }
    }
    return false;
  }

  private findBlocksToClear(): Vec3[] {
    const toClear: Vec3[] = [];

    for (const schematicBlock of this.buildQueue) {
      const worldPos = this.toWorldPos(schematicBlock.pos);
      const block = this.bot.blockAt(worldPos);

      if (block && block.boundingBox !== 'empty' && block.name !== 'air' &&
          block.name !== schematicBlock.blockType) {
        toClear.push(schematicBlock.pos.clone());
      }
    }

    return toClear;
  }

  /**
   * Get build progress (0-1)
   */
  getProgress(): number {
    if (this.buildQueue.length === 0) return 0;
    return this.placedCount / this.buildQueue.length;
  }

  /**
   * Get materials needed
   */
  getMaterialsNeeded(): Map<string, number> {
    return new Map(this.materialsNeeded);
  }

  /**
   * Get current state
   */
  getCurrentState(): SchematicState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof SchematicTask)) return false;

    return this.config.origin.equals(other.config.origin) &&
           this.config.schematic.name === other.config.schematic.name;
  }
}

/**
 * Create an empty schematic
 */
export function createEmptySchematic(name: string): Schematic {
  return {
    name,
    width: 0,
    height: 0,
    depth: 0,
    blocks: [],
    palette: [],
  };
}

/**
 * Create a schematic from a list of blocks
 */
export function createSchematic(name: string, blocks: SchematicBlock[]): Schematic {
  const palette = [...new Set(blocks.map(b => b.blockType))];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const block of blocks) {
    minX = Math.min(minX, block.pos.x);
    minY = Math.min(minY, block.pos.y);
    minZ = Math.min(minZ, block.pos.z);
    maxX = Math.max(maxX, block.pos.x);
    maxY = Math.max(maxY, block.pos.y);
    maxZ = Math.max(maxZ, block.pos.z);
  }

  return {
    name,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    depth: maxZ - minZ + 1,
    blocks,
    palette,
  };
}

/**
 * Create a simple cube schematic
 */
export function createCubeSchematic(size: number, blockType: string): Schematic {
  const blocks: SchematicBlock[] = [];

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        blocks.push({
          pos: new Vec3(x, y, z),
          blockType,
        });
      }
    }
  }

  return createSchematic(`cube_${size}x${size}x${size}`, blocks);
}

/**
 * Create a hollow box schematic
 */
export function createHollowBoxSchematic(width: number, height: number, depth: number, blockType: string): Schematic {
  const blocks: SchematicBlock[] = [];

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        // Only place blocks on edges
        const isEdge = x === 0 || x === width - 1 ||
                       y === 0 || y === height - 1 ||
                       z === 0 || z === depth - 1;
        if (isEdge) {
          blocks.push({
            pos: new Vec3(x, y, z),
            blockType,
          });
        }
      }
    }
  }

  return createSchematic(`hollow_box_${width}x${height}x${depth}`, blocks);
}

/**
 * Create a wall schematic
 */
export function createWallSchematic(length: number, height: number, blockType: string): Schematic {
  const blocks: SchematicBlock[] = [];

  for (let x = 0; x < length; x++) {
    for (let y = 0; y < height; y++) {
      blocks.push({
        pos: new Vec3(x, y, 0),
        blockType,
      });
    }
  }

  return createSchematic(`wall_${length}x${height}`, blocks);
}

/**
 * Convenience functions
 */
export function buildSchematic(bot: Bot, origin: Vec3, schematic: Schematic): SchematicTask {
  return new SchematicTask(bot, origin, schematic);
}

export function buildCube(bot: Bot, origin: Vec3, size: number, blockType: string): SchematicTask {
  return new SchematicTask(bot, origin, createCubeSchematic(size, blockType));
}

export function buildHollowBox(bot: Bot, origin: Vec3, width: number, height: number, depth: number, blockType: string): SchematicTask {
  return new SchematicTask(bot, origin, createHollowBoxSchematic(width, height, depth, blockType));
}

export function buildWall(bot: Bot, origin: Vec3, length: number, height: number, blockType: string): SchematicTask {
  return new SchematicTask(bot, origin, createWallSchematic(length, height, blockType));
}
