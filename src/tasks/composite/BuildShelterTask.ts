/**
 * BuildShelterTask - Emergency Shelter Construction
 * Based on AltoClef's shelter building behavior
 *
 * Quickly builds a simple protective shelter when night falls
 * or in dangerous situations.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { PlaceBlockTask } from '../concrete/PlaceBlockTask';
import { MineBlockTask } from '../concrete/MineBlockTask';
import { GoToNearTask } from '../concrete/GoToTask';
import { CollectWoodTask } from './CollectWoodTask';
import { GatherResourcesTask } from './GatherResourcesTask';
import { ItemTarget } from '../../utils/ItemTarget';

/**
 * Shelter type
 */
export enum ShelterType {
  DIRT_HUT,     // Quick dirt walls (fastest)
  WOOD_CABIN,   // Wooden walls with door
  UNDERGROUND,  // Dig into ground
  NERD_POLE,    // Pillar up (emergency)
}

/**
 * State for shelter building
 */
enum ShelterState {
  FINDING_LOCATION,
  GATHERING_MATERIALS,
  CLEARING_AREA,
  BUILDING_FLOOR,
  BUILDING_WALLS,
  BUILDING_ROOF,
  ENTERING,
  FINISHED,
  FAILED
}

/**
 * Configuration for shelter building
 */
export interface ShelterConfig {
  /** Type of shelter to build */
  type: ShelterType;
  /** Interior size (width/length) */
  interiorSize: number;
  /** Wall height */
  wallHeight: number;
  /** Add a door */
  includeDoor: boolean;
  /** Add torches inside */
  addLighting: boolean;
}

const DEFAULT_CONFIG: ShelterConfig = {
  type: ShelterType.DIRT_HUT,
  interiorSize: 3,
  wallHeight: 3,
  includeDoor: true,
  addLighting: true,
};

/**
 * Block position to place
 */
interface BuildBlock {
  position: Vec3;
  placed: boolean;
}

/**
 * Task to build an emergency shelter
 */
export class BuildShelterTask extends Task {
  private config: ShelterConfig;
  private state: ShelterState = ShelterState.FINDING_LOCATION;
  private shelterOrigin: Vec3 | null = null;
  private blocksToPlace: BuildBlock[] = [];
  private blocksToClear: Vec3[] = [];
  private currentBlockIndex: number = 0;
  private buildMaterial: string = 'dirt';

  constructor(bot: Bot, config: Partial<ShelterConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get displayName(): string {
    return `BuildShelter(${ShelterType[this.config.type]}, ${ShelterState[this.state]})`;
  }

  onStart(): void {
    this.state = ShelterState.FINDING_LOCATION;
    this.shelterOrigin = null;
    this.blocksToPlace = [];
    this.blocksToClear = [];
    this.currentBlockIndex = 0;

    // Determine build material based on shelter type
    switch (this.config.type) {
      case ShelterType.DIRT_HUT:
        this.buildMaterial = 'dirt';
        break;
      case ShelterType.WOOD_CABIN:
        this.buildMaterial = 'planks';
        break;
      case ShelterType.UNDERGROUND:
        this.buildMaterial = 'cobblestone';
        break;
      case ShelterType.NERD_POLE:
        this.buildMaterial = 'dirt';
        break;
    }
  }

  onTick(): Task | null {
    switch (this.state) {
      case ShelterState.FINDING_LOCATION:
        return this.handleFindingLocation();

      case ShelterState.GATHERING_MATERIALS:
        return this.handleGatheringMaterials();

      case ShelterState.CLEARING_AREA:
        return this.handleClearingArea();

      case ShelterState.BUILDING_FLOOR:
        return this.handleBuildingFloor();

      case ShelterState.BUILDING_WALLS:
        return this.handleBuildingWalls();

      case ShelterState.BUILDING_ROOF:
        return this.handleBuildingRoof();

      case ShelterState.ENTERING:
        return this.handleEntering();

      default:
        return null;
    }
  }

  private handleFindingLocation(): Task | null {
    // Find a suitable location near the player
    this.shelterOrigin = this.findSuitableLocation();
    if (!this.shelterOrigin) {
      // Use current position
      this.shelterOrigin = this.bot.entity.position.clone().floor();
    }

    // Plan the shelter
    this.planShelter();

    // Check if we have enough materials
    const needed = this.calculateMaterialsNeeded();
    const have = this.countBuildMaterial();

    if (have < needed) {
      this.state = ShelterState.GATHERING_MATERIALS;
    } else {
      this.state = ShelterState.CLEARING_AREA;
    }

    return null;
  }

  private handleGatheringMaterials(): Task | null {
    const needed = this.calculateMaterialsNeeded();
    const have = this.countBuildMaterial();

    if (have >= needed) {
      this.state = ShelterState.CLEARING_AREA;
      return null;
    }

    const toGather = needed - have;

    // For dirt, just mine nearby
    if (this.buildMaterial === 'dirt') {
      return new GatherResourcesTask(this.bot, 'dirt', toGather);
    }

    // For planks, need wood first
    if (this.buildMaterial === 'planks' || this.buildMaterial.includes('planks')) {
      // Check if we have logs
      const logs = this.countItem('log');
      if (logs * 4 < toGather) {
        return new CollectWoodTask(this.bot, Math.ceil((toGather - logs * 4) / 4) + 1);
      }
      // Craft planks (handled by GatherResourcesTask)
      return new GatherResourcesTask(this.bot, 'oak_planks', toGather);
    }

    // For cobblestone, mine stone
    if (this.buildMaterial === 'cobblestone') {
      return new GatherResourcesTask(this.bot, 'cobblestone', toGather);
    }

    // Generic gather
    return new GatherResourcesTask(this.bot, this.buildMaterial, toGather);
  }

  private handleClearingArea(): Task | null {
    if (this.blocksToClear.length === 0) {
      this.state = ShelterState.BUILDING_WALLS;
      return null;
    }

    // Find next block to clear
    const blockPos = this.blocksToClear.shift();
    if (!blockPos) {
      this.state = ShelterState.BUILDING_WALLS;
      return null;
    }

    const block = this.bot.blockAt(blockPos);
    if (!block || block.name === 'air' || block.boundingBox === 'empty') {
      // Already clear
      return null;
    }

    return MineBlockTask.fromVec3(this.bot, blockPos, true);
  }

  private handleBuildingFloor(): Task | null {
    // Skip floor for most shelter types
    this.state = ShelterState.BUILDING_WALLS;
    return null;
  }

  private handleBuildingWalls(): Task | null {
    // Find next unplaced wall block
    const nextBlock = this.findNextUnplacedBlock();
    if (!nextBlock) {
      this.state = ShelterState.BUILDING_ROOF;
      return null;
    }

    // Check if we have materials
    if (this.countBuildMaterial() === 0) {
      this.state = ShelterState.GATHERING_MATERIALS;
      return null;
    }

    // Check if position is reachable
    const dist = this.bot.entity.position.distanceTo(nextBlock.position);
    if (dist > 4.5) {
      return new GoToNearTask(
        this.bot,
        Math.floor(nextBlock.position.x),
        Math.floor(nextBlock.position.y),
        Math.floor(nextBlock.position.z),
        3
      );
    }

    // Check if block is already placed
    const block = this.bot.blockAt(nextBlock.position);
    if (block && block.name !== 'air' && block.boundingBox !== 'empty') {
      nextBlock.placed = true;
      return null;
    }

    // Find the material in inventory
    const material = this.findBuildMaterial();
    if (!material) {
      this.state = ShelterState.GATHERING_MATERIALS;
      return null;
    }

    return new PlaceBlockTask(
      this.bot,
      Math.floor(nextBlock.position.x),
      Math.floor(nextBlock.position.y),
      Math.floor(nextBlock.position.z),
      material.name
    );
  }

  private handleBuildingRoof(): Task | null {
    // For simple shelters, roof is part of the wall blocks
    // Check if all blocks are placed
    const unplaced = this.blocksToPlace.filter(b => !b.placed);
    if (unplaced.length === 0) {
      this.state = ShelterState.ENTERING;
      return null;
    }

    // Continue building
    this.state = ShelterState.BUILDING_WALLS;
    return null;
  }

  private handleEntering(): Task | null {
    if (!this.shelterOrigin) {
      this.state = ShelterState.FINISHED;
      return null;
    }

    // Move inside the shelter
    const center = this.shelterOrigin.offset(
      Math.floor(this.config.interiorSize / 2),
      1,
      Math.floor(this.config.interiorSize / 2)
    );

    const dist = this.bot.entity.position.distanceTo(center);
    if (dist <= 2) {
      this.state = ShelterState.FINISHED;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(center.x),
      Math.floor(center.y),
      Math.floor(center.z),
      1
    );
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.state === ShelterState.FINISHED || this.state === ShelterState.FAILED;
  }

  isFailed(): boolean {
    return this.state === ShelterState.FAILED;
  }

  // ---- Planning Methods ----

  private findSuitableLocation(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const searchRadius = 10;

    // Look for flat area
    for (let r = 0; r <= searchRadius; r += 2) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const x = Math.floor(playerPos.x + Math.cos(angle) * r);
        const z = Math.floor(playerPos.z + Math.sin(angle) * r);
        const y = Math.floor(playerPos.y);

        if (this.isLocationSuitable(new Vec3(x, y, z))) {
          return new Vec3(x, y, z);
        }
      }
    }

    return null;
  }

  private isLocationSuitable(pos: Vec3): boolean {
    const size = this.config.interiorSize + 2; // +2 for walls

    // Check if area is relatively flat
    let minY = Infinity;
    let maxY = -Infinity;

    for (let dx = 0; dx < size; dx++) {
      for (let dz = 0; dz < size; dz++) {
        const checkPos = pos.offset(dx, 0, dz);
        const ground = this.findGroundY(checkPos);
        if (ground === null) return false;

        minY = Math.min(minY, ground);
        maxY = Math.max(maxY, ground);
      }
    }

    // Allow 2 blocks of height difference
    return maxY - minY <= 2;
  }

  private findGroundY(pos: Vec3): number | null {
    for (let y = Math.floor(pos.y) + 5; y >= Math.floor(pos.y) - 10; y--) {
      const block = this.bot.blockAt(new Vec3(pos.x, y, pos.z));
      const above = this.bot.blockAt(new Vec3(pos.x, y + 1, pos.z));

      if (!block || !above) continue;

      if (block.boundingBox === 'block' && above.name === 'air') {
        return y + 1;
      }
    }
    return null;
  }

  private planShelter(): void {
    if (!this.shelterOrigin) return;

    this.blocksToPlace = [];
    this.blocksToClear = [];

    const size = this.config.interiorSize;
    const height = this.config.wallHeight;
    const origin = this.shelterOrigin;

    // Plan walls (hollow box)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x <= size + 1; x++) {
        for (let z = 0; z <= size + 1; z++) {
          // Is this on the edge?
          const isWall = x === 0 || x === size + 1 || z === 0 || z === size + 1;
          const isRoof = y === height - 1;

          if (isWall || isRoof) {
            // Skip door position (middle of one wall at ground level)
            if (this.config.includeDoor && y < 2 && x === Math.floor((size + 1) / 2) && z === 0) {
              continue;
            }

            this.blocksToPlace.push({
              position: origin.offset(x, y, z),
              placed: false,
            });
          } else {
            // Interior - needs to be clear
            this.blocksToClear.push(origin.offset(x, y, z));
          }
        }
      }
    }
  }

  private calculateMaterialsNeeded(): number {
    // Count blocks to place that haven't been placed yet
    return this.blocksToPlace.filter(b => !b.placed).length;
  }

  private findNextUnplacedBlock(): BuildBlock | null {
    // Find lowest unplaced block (build from bottom up)
    let lowest: BuildBlock | null = null;

    for (const block of this.blocksToPlace) {
      if (block.placed) continue;

      // Check if block is already there
      const existing = this.bot.blockAt(block.position);
      if (existing && existing.name !== 'air' && existing.boundingBox === 'block') {
        block.placed = true;
        continue;
      }

      if (!lowest || block.position.y < lowest.position.y) {
        lowest = block;
      }
    }

    return lowest;
  }

  // ---- Inventory Helpers ----

  private countBuildMaterial(): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (this.isBuildMaterial(item.name)) {
        count += item.count;
      }
    }
    return count;
  }

  private findBuildMaterial(): any | null {
    for (const item of this.bot.inventory.items()) {
      if (this.isBuildMaterial(item.name)) {
        return item;
      }
    }
    return null;
  }

  private isBuildMaterial(itemName: string): boolean {
    if (this.buildMaterial === 'dirt') {
      return itemName === 'dirt' || itemName === 'grass_block' || itemName === 'coarse_dirt';
    }
    if (this.buildMaterial === 'planks') {
      return itemName.includes('planks');
    }
    if (this.buildMaterial === 'cobblestone') {
      return itemName === 'cobblestone' || itemName === 'cobbled_deepslate' || itemName === 'stone';
    }
    return itemName === this.buildMaterial;
  }

  private countItem(namePart: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name.includes(namePart)) {
        count += item.count;
      }
    }
    return count;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof BuildShelterTask)) return false;

    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Convenience functions
 */
export function buildDirtHut(bot: Bot): BuildShelterTask {
  return new BuildShelterTask(bot, { type: ShelterType.DIRT_HUT });
}

export function buildWoodCabin(bot: Bot): BuildShelterTask {
  return new BuildShelterTask(bot, { type: ShelterType.WOOD_CABIN });
}

export function digUnderground(bot: Bot): BuildShelterTask {
  return new BuildShelterTask(bot, { type: ShelterType.UNDERGROUND });
}

export function buildEmergencyShelter(bot: Bot): BuildShelterTask {
  // Quick dirt shelter with minimal size
  return new BuildShelterTask(bot, {
    type: ShelterType.DIRT_HUT,
    interiorSize: 2,
    wallHeight: 2,
    includeDoor: false,
    addLighting: false,
  });
}
