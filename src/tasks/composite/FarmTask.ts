/**
 * FarmTask - Agricultural Automation Task
 * Based on AltoClef's farming behavior
 *
 * Handles planting, growing, and harvesting crops.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { MineBlockTask } from '../concrete/MineBlockTask';
import { PlaceBlockTask } from '../concrete/PlaceBlockTask';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { EquipTask, EquipmentSlot } from '../concrete/EquipTask';
import { GetToolTask } from './GetToolTask';

/**
 * Crop information
 */
interface CropInfo {
  name: string;
  seedItem: string;
  harvestBlock: string;
  maxAge: number;
  drops: string[];
}

const CROPS: CropInfo[] = [
  {
    name: 'wheat',
    seedItem: 'wheat_seeds',
    harvestBlock: 'wheat',
    maxAge: 7,
    drops: ['wheat', 'wheat_seeds'],
  },
  {
    name: 'carrot',
    seedItem: 'carrot',
    harvestBlock: 'carrots',
    maxAge: 7,
    drops: ['carrot'],
  },
  {
    name: 'potato',
    seedItem: 'potato',
    harvestBlock: 'potatoes',
    maxAge: 7,
    drops: ['potato', 'poisonous_potato'],
  },
  {
    name: 'beetroot',
    seedItem: 'beetroot_seeds',
    harvestBlock: 'beetroots',
    maxAge: 3,
    drops: ['beetroot', 'beetroot_seeds'],
  },
  {
    name: 'melon',
    seedItem: 'melon_seeds',
    harvestBlock: 'melon',
    maxAge: 0, // Melon blocks don't have age
    drops: ['melon_slice'],
  },
  {
    name: 'pumpkin',
    seedItem: 'pumpkin_seeds',
    harvestBlock: 'pumpkin',
    maxAge: 0, // Pumpkin blocks don't have age
    drops: ['pumpkin'],
  },
];

/**
 * State for farming
 */
enum FarmState {
  SCANNING,
  GETTING_TOOL,
  GOING_TO_CROP,
  HARVESTING,
  GOING_TO_FARMLAND,
  PLANTING,
  FINISHED,
  IDLE
}

/**
 * Farm operation mode
 */
export enum FarmMode {
  HARVEST_ONLY,
  PLANT_ONLY,
  HARVEST_AND_REPLANT,
  MAINTAIN, // Continuous farming
}

/**
 * Configuration for farming
 */
export interface FarmConfig {
  /** Farming mode */
  mode: FarmMode;
  /** Target crops (empty = all crops) */
  targetCrops: string[];
  /** Search radius */
  searchRadius: number;
  /** Target harvest count (0 = infinite/until no more crops) */
  targetCount: number;
  /** Auto-acquire hoe for tilling */
  autoGetHoe: boolean;
}

const DEFAULT_CONFIG: FarmConfig = {
  mode: FarmMode.HARVEST_AND_REPLANT,
  targetCrops: [],
  searchRadius: 32,
  targetCount: 0,
  autoGetHoe: true,
};

/**
 * Task for farming activities
 */
export class FarmTask extends Task {
  private config: FarmConfig;
  private state: FarmState = FarmState.SCANNING;
  private currentTarget: Vec3 | null = null;
  private currentCrop: CropInfo | null = null;
  private harvestedCount: number = 0;
  private plantedCount: number = 0;
  private lastScanTime: number = 0;
  private scanInterval: number = 5000; // ms

  constructor(bot: Bot, config: Partial<FarmConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get displayName(): string {
    const crops = this.config.targetCrops.length > 0
      ? this.config.targetCrops.join(', ')
      : 'all';
    return `Farm(${crops}, harvested: ${this.harvestedCount}, planted: ${this.plantedCount})`;
  }

  onStart(): void {
    this.state = FarmState.SCANNING;
    this.currentTarget = null;
    this.currentCrop = null;
    this.harvestedCount = 0;
    this.plantedCount = 0;
    this.lastScanTime = 0;
  }

  onTick(): Task | null {
    // Check if we've reached target count
    if (this.config.targetCount > 0 && this.harvestedCount >= this.config.targetCount) {
      this.state = FarmState.FINISHED;
      return null;
    }

    switch (this.state) {
      case FarmState.SCANNING:
        return this.handleScanning();

      case FarmState.GETTING_TOOL:
        return this.handleGettingTool();

      case FarmState.GOING_TO_CROP:
        return this.handleGoingToCrop();

      case FarmState.HARVESTING:
        return this.handleHarvesting();

      case FarmState.GOING_TO_FARMLAND:
        return this.handleGoingToFarmland();

      case FarmState.PLANTING:
        return this.handlePlanting();

      case FarmState.IDLE:
        return this.handleIdle();

      default:
        return null;
    }
  }

  private handleScanning(): Task | null {
    const now = Date.now();

    // Rate limit scanning
    if (now - this.lastScanTime < this.scanInterval && this.state === FarmState.IDLE) {
      return null;
    }
    this.lastScanTime = now;

    // Look for mature crops to harvest
    if (this.config.mode !== FarmMode.PLANT_ONLY) {
      const matureCrop = this.findMatureCrop();
      if (matureCrop) {
        this.currentTarget = matureCrop.position;
        this.currentCrop = this.getCropInfo(matureCrop.name);
        this.state = FarmState.GOING_TO_CROP;
        return null;
      }
    }

    // Look for empty farmland to plant
    if (this.config.mode !== FarmMode.HARVEST_ONLY) {
      const emptyFarmland = this.findEmptyFarmland();
      if (emptyFarmland) {
        this.currentTarget = emptyFarmland.position;
        this.currentCrop = this.getPlantableCrop();
        if (this.currentCrop) {
          this.state = FarmState.GOING_TO_FARMLAND;
          return null;
        }
      }
    }

    // Nothing to do
    if (this.config.mode === FarmMode.MAINTAIN) {
      this.state = FarmState.IDLE;
    } else {
      this.state = FarmState.FINISHED;
    }
    return null;
  }

  private handleGettingTool(): Task | null {
    // Check if we have a hoe
    if (this.hasHoe()) {
      this.state = FarmState.SCANNING;
      return null;
    }

    return new GetToolTask(this.bot, 'hoe');
  }

  private handleGoingToCrop(): Task | null {
    if (!this.currentTarget) {
      this.state = FarmState.SCANNING;
      return null;
    }

    // Verify crop still exists and is mature
    const block = this.bot.blockAt(this.currentTarget);
    if (!block || !this.isMatureCrop(block)) {
      this.currentTarget = null;
      this.state = FarmState.SCANNING;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentTarget);
    if (dist <= 4.0) {
      this.state = FarmState.HARVESTING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.currentTarget.x),
      Math.floor(this.currentTarget.y),
      Math.floor(this.currentTarget.z),
      3
    );
  }

  private handleHarvesting(): Task | null {
    if (!this.currentTarget) {
      this.state = FarmState.SCANNING;
      return null;
    }

    const block = this.bot.blockAt(this.currentTarget);
    if (!block || !this.isMatureCrop(block)) {
      // Crop harvested or gone
      this.harvestedCount++;

      // Check if we should replant
      if (this.config.mode === FarmMode.HARVEST_AND_REPLANT && this.currentCrop) {
        // Target position is now empty farmland
        this.state = FarmState.PLANTING;
        return null;
      }

      this.currentTarget = null;
      this.state = FarmState.SCANNING;
      return null;
    }

    return MineBlockTask.fromVec3(this.bot, this.currentTarget, true);
  }

  private handleGoingToFarmland(): Task | null {
    if (!this.currentTarget) {
      this.state = FarmState.SCANNING;
      return null;
    }

    // Verify farmland still empty
    const above = this.bot.blockAt(this.currentTarget.offset(0, 1, 0));
    if (above && above.name !== 'air') {
      this.currentTarget = null;
      this.state = FarmState.SCANNING;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentTarget);
    if (dist <= 4.0) {
      this.state = FarmState.PLANTING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.currentTarget.x),
      Math.floor(this.currentTarget.y),
      Math.floor(this.currentTarget.z),
      3
    );
  }

  private handlePlanting(): Task | null {
    if (!this.currentTarget || !this.currentCrop) {
      this.state = FarmState.SCANNING;
      return null;
    }

    // Check if we have seeds
    if (!this.hasSeeds(this.currentCrop.seedItem)) {
      this.currentTarget = null;
      this.state = FarmState.SCANNING;
      return null;
    }

    // Check if farmland is still valid
    const farmland = this.bot.blockAt(this.currentTarget);
    if (!farmland || farmland.name !== 'farmland') {
      this.currentTarget = null;
      this.state = FarmState.SCANNING;
      return null;
    }

    // Check if space above is clear
    const above = this.bot.blockAt(this.currentTarget.offset(0, 1, 0));
    if (above && above.name !== 'air') {
      this.currentTarget = null;
      this.state = FarmState.SCANNING;
      return null;
    }

    // Equip seeds and plant
    const seedItem = this.findItem(this.currentCrop.seedItem);
    if (seedItem) {
      try {
        // Right-click on farmland to plant
        this.bot.equip(seedItem, 'hand');
        this.bot.activateBlock(farmland);
        this.plantedCount++;
      } catch {
        // Will retry
      }
    }

    this.currentTarget = null;
    this.state = FarmState.SCANNING;
    return null;
  }

  private handleIdle(): Task | null {
    // In maintain mode, periodically scan
    this.state = FarmState.SCANNING;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.currentTarget = null;
    this.currentCrop = null;
  }

  isFinished(): boolean {
    return this.state === FarmState.FINISHED;
  }

  // ---- Helper Methods ----

  private getCropInfo(blockName: string): CropInfo | null {
    return CROPS.find(c => c.harvestBlock === blockName) ?? null;
  }

  private isMatureCrop(block: Block): boolean {
    const info = this.getCropInfo(block.name);
    if (!info) return false;

    // Check if it's a target crop
    if (this.config.targetCrops.length > 0) {
      if (!this.config.targetCrops.includes(info.name)) {
        return false;
      }
    }

    // Melons and pumpkins are always "mature" (they're the fruit blocks)
    if (info.maxAge === 0) {
      return block.name === info.harvestBlock;
    }

    // Check age property
    const age = (block as any).metadata ?? block.stateId;
    return age >= info.maxAge;
  }

  private findMatureCrop(): Block | null {
    const playerPos = this.bot.entity.position;
    let nearest: Block | null = null;
    let nearestDist = Infinity;

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x += 2) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z += 2) {
        for (let y = -5; y <= 10; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block || !this.isMatureCrop(block)) continue;

          const dist = playerPos.distanceTo(pos);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = block;
          }
        }
      }
    }

    return nearest;
  }

  private findEmptyFarmland(): Block | null {
    const playerPos = this.bot.entity.position;
    let nearest: Block | null = null;
    let nearestDist = Infinity;

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x += 2) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z += 2) {
        for (let y = -5; y <= 10; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block || block.name !== 'farmland') continue;

          // Check if space above is empty
          const above = this.bot.blockAt(pos.offset(0, 1, 0));
          if (above && above.name !== 'air') continue;

          const dist = playerPos.distanceTo(pos);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = block;
          }
        }
      }
    }

    return nearest;
  }

  private getPlantableCrop(): CropInfo | null {
    // Find a crop we have seeds for
    for (const crop of CROPS) {
      // Skip if not a target crop
      if (this.config.targetCrops.length > 0) {
        if (!this.config.targetCrops.includes(crop.name)) {
          continue;
        }
      }

      if (this.hasSeeds(crop.seedItem)) {
        return crop;
      }
    }
    return null;
  }

  private hasSeeds(seedItem: string): boolean {
    return this.bot.inventory.items().some(item => item.name === seedItem);
  }

  private hasHoe(): boolean {
    return this.bot.inventory.items().some(item => item.name.includes('hoe'));
  }

  private findItem(itemName: string): any {
    return this.bot.inventory.items().find(item => item.name === itemName);
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof FarmTask)) return false;

    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Convenience functions
 */
export function harvestCrops(bot: Bot, count: number = 0): FarmTask {
  return new FarmTask(bot, { mode: FarmMode.HARVEST_ONLY, targetCount: count });
}

export function harvestAndReplant(bot: Bot, count: number = 0): FarmTask {
  return new FarmTask(bot, { mode: FarmMode.HARVEST_AND_REPLANT, targetCount: count });
}

export function maintainFarm(bot: Bot): FarmTask {
  return new FarmTask(bot, { mode: FarmMode.MAINTAIN });
}

export function harvestWheat(bot: Bot, count: number = 0): FarmTask {
  return new FarmTask(bot, {
    mode: FarmMode.HARVEST_AND_REPLANT,
    targetCrops: ['wheat'],
    targetCount: count,
  });
}
