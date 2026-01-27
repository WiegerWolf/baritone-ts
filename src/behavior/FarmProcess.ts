import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BaseProcess, ProcessPriority, ProcessTickResult, ProcessState } from './Process';
import { Goal } from '../types';
import { GoalNear, GoalBlock } from '../goals';

/**
 * FarmProcess handles automated farming
 * Based on Baritone's farming behavior
 *
 * Features:
 * - Plant and harvest crops
 * - Support for multiple crop types
 * - Automatic replanting
 * - Configurable search radius
 */

/**
 * Farm configuration
 */
export interface FarmConfig {
  // Search radius for farmland
  searchRadius: number;
  // Crop types to harvest
  cropTypes: string[];
  // Replant after harvesting
  replant: boolean;
  // Minimum growth stage to harvest (0-7)
  minGrowthStage: number;
  // Prioritize closest crops
  prioritizeClosest: boolean;
}

const DEFAULT_CONFIG: FarmConfig = {
  searchRadius: 32,
  cropTypes: ['wheat', 'carrots', 'potatoes', 'beetroots', 'nether_wart'],
  replant: true,
  minGrowthStage: 7,
  prioritizeClosest: true
};

/**
 * Crop information
 */
interface CropInfo {
  // Block name when planted
  blockName: string;
  // Seed item name
  seedItem: string;
  // Maximum growth stage
  maxGrowth: number;
  // Requires farmland
  requiresFarmland: boolean;
}

const CROP_INFO: Record<string, CropInfo> = {
  wheat: {
    blockName: 'wheat',
    seedItem: 'wheat_seeds',
    maxGrowth: 7,
    requiresFarmland: true
  },
  carrots: {
    blockName: 'carrots',
    seedItem: 'carrot',
    maxGrowth: 7,
    requiresFarmland: true
  },
  potatoes: {
    blockName: 'potatoes',
    seedItem: 'potato',
    maxGrowth: 7,
    requiresFarmland: true
  },
  beetroots: {
    blockName: 'beetroots',
    seedItem: 'beetroot_seeds',
    maxGrowth: 3,
    requiresFarmland: true
  },
  nether_wart: {
    blockName: 'nether_wart',
    seedItem: 'nether_wart',
    maxGrowth: 3,
    requiresFarmland: false // Requires soul sand
  },
  melon: {
    blockName: 'melon',
    seedItem: 'melon_seeds',
    maxGrowth: 0, // Melon blocks don't have growth stages
    requiresFarmland: true
  },
  pumpkin: {
    blockName: 'pumpkin',
    seedItem: 'pumpkin_seeds',
    maxGrowth: 0,
    requiresFarmland: true
  }
};

type FarmState = 'searching' | 'harvesting' | 'planting' | 'moving';

export class FarmProcess extends BaseProcess {
  readonly displayName = 'Farm';

  private config: FarmConfig;
  private targetCrops: Vec3[] = [];
  private currentTarget: Vec3 | null = null;
  private farmState: FarmState = 'searching';
  private cropsHarvested: number = 0;
  private cropsPlanted: number = 0;
  private lastSearchTime: number = 0;
  private searchCooldown: number = 2000;

  constructor(bot: Bot, pathfinder: any, config: Partial<FarmConfig> = {}) {
    super(bot, pathfinder, ProcessPriority.NORMAL);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set crop types to farm
   */
  setCropTypes(types: string[]): void {
    this.config.cropTypes = types;
    this.targetCrops = [];
    this.currentTarget = null;
  }

  /**
   * Set search radius
   */
  setSearchRadius(radius: number): void {
    this.config.searchRadius = radius;
  }

  /**
   * Enable/disable replanting
   */
  setReplant(replant: boolean): void {
    this.config.replant = replant;
  }

  /**
   * Set minimum growth stage for harvesting
   */
  setMinGrowthStage(stage: number): void {
    this.config.minGrowthStage = stage;
  }

  onActivate(): void {
    super.onActivate();
    this.cropsHarvested = 0;
    this.cropsPlanted = 0;
    this.farmState = 'searching';
    this.findTargetCrops();
  }

  onDeactivate(): void {
    super.onDeactivate();
    this.currentTarget = null;
    this.targetCrops = [];
  }

  tick(): ProcessTickResult {
    // Refresh crop list periodically
    const now = Date.now();
    if (now - this.lastSearchTime > this.searchCooldown) {
      this.findTargetCrops();
      this.lastSearchTime = now;
    }

    switch (this.farmState) {
      case 'searching':
        return this.handleSearching();
      case 'moving':
        return this.handleMoving();
      case 'harvesting':
        return this.handleHarvesting();
      case 'planting':
        return this.handlePlanting();
    }
  }

  private handleSearching(): ProcessTickResult {
    // Find next target
    this.currentTarget = this.selectBestTarget();

    if (!this.currentTarget) {
      if (this.cropsHarvested > 0 || this.cropsPlanted > 0) {
        return this.completeResult(
          `Farmed ${this.cropsHarvested} crops, planted ${this.cropsPlanted}`
        );
      }
      return this.failedResult('No crops found to farm');
    }

    this.farmState = 'moving';
    return this.waitResult('Found crop, moving...');
  }

  private handleMoving(): ProcessTickResult {
    if (!this.currentTarget) {
      this.farmState = 'searching';
      return this.waitResult('Target lost, searching...');
    }

    // Check if we're close enough to interact
    const pos = this.bot.entity.position;
    const dist = pos.distanceTo(this.currentTarget);

    if (dist < 4) {
      // Close enough to harvest
      this.farmState = 'harvesting';
      return this.waitResult('Arrived, harvesting...');
    }

    // Move toward target
    const goal = new GoalNear(
      this.currentTarget.x,
      this.currentTarget.y,
      this.currentTarget.z,
      3
    );
    return this.newGoalResult(goal, 'Moving to crop');
  }

  private handleHarvesting(): ProcessTickResult {
    if (!this.currentTarget) {
      this.farmState = 'searching';
      return this.waitResult('Target lost');
    }

    // Get the block at target
    const block = this.bot.blockAt(this.currentTarget);
    if (!block) {
      this.farmState = 'searching';
      return this.waitResult('Block not found');
    }

    // Check if it's still a mature crop
    const cropInfo = this.getCropInfo(block.name);
    if (!cropInfo) {
      // Not a crop anymore (was harvested)
      this.targetCrops = this.targetCrops.filter(
        c => !c.equals(this.currentTarget!)
      );
      this.currentTarget = null;
      this.farmState = 'searching';
      return this.waitResult('Crop already harvested');
    }

    const age = this.getBlockAge(block);
    if (age < this.config.minGrowthStage && cropInfo.maxGrowth > 0) {
      // Not mature yet
      this.targetCrops = this.targetCrops.filter(
        c => !c.equals(this.currentTarget!)
      );
      this.currentTarget = null;
      this.farmState = 'searching';
      return this.waitResult('Crop not mature');
    }

    // Harvest the crop (dig it)
    this.bot.dig(block).then(() => {
      this.cropsHarvested++;

      if (this.config.replant && cropInfo) {
        // Check if we have seeds
        const seedItem = this.bot.inventory.items().find(
          item => item.name === cropInfo.seedItem
        );

        if (seedItem) {
          this.farmState = 'planting';
        } else {
          this.currentTarget = null;
          this.farmState = 'searching';
        }
      } else {
        this.currentTarget = null;
        this.farmState = 'searching';
      }
    }).catch(() => {
      this.currentTarget = null;
      this.farmState = 'searching';
    });

    return this.waitResult('Harvesting...');
  }

  private handlePlanting(): ProcessTickResult {
    if (!this.currentTarget) {
      this.farmState = 'searching';
      return this.waitResult('No planting location');
    }

    // Get block below where we want to plant
    const farmlandPos = this.currentTarget.offset(0, -1, 0);
    const farmland = this.bot.blockAt(farmlandPos);

    if (!farmland) {
      this.currentTarget = null;
      this.farmState = 'searching';
      return this.waitResult('No farmland found');
    }

    // Get the crop info for what we harvested
    const cropType = this.config.cropTypes.find(type => {
      const info = CROP_INFO[type];
      return info && (
        (info.requiresFarmland && farmland.name === 'farmland') ||
        (!info.requiresFarmland && farmland.name === 'soul_sand')
      );
    });

    if (!cropType) {
      this.currentTarget = null;
      this.farmState = 'searching';
      return this.waitResult('Cannot replant here');
    }

    const cropInfo = CROP_INFO[cropType];
    const seedItem = this.bot.inventory.items().find(
      item => item.name === cropInfo.seedItem
    );

    if (!seedItem) {
      this.currentTarget = null;
      this.farmState = 'searching';
      return this.waitResult('No seeds available');
    }

    // Equip seed and plant
    this.bot.equip(seedItem, 'hand').then(() => {
      return this.bot.placeBlock(farmland, new Vec3(0, 1, 0));
    }).then(() => {
      this.cropsPlanted++;
      this.currentTarget = null;
      this.farmState = 'searching';
    }).catch(() => {
      this.currentTarget = null;
      this.farmState = 'searching';
    });

    return this.waitResult('Planting...');
  }

  /**
   * Find all target crops in range
   */
  private findTargetCrops(): void {
    this.targetCrops = [];
    const botPos = this.bot.entity.position;
    const radius = this.config.searchRadius;

    // Scan area for crops
    for (let x = -radius; x <= radius; x++) {
      for (let y = -10; y <= 10; y++) {
        for (let z = -radius; z <= radius; z++) {
          const pos = botPos.offset(x, y, z).floored();
          const block = this.bot.blockAt(pos);

          if (!block) continue;

          // Check if it's a target crop
          const cropInfo = this.getCropInfo(block.name);
          if (!cropInfo) continue;

          // Check if it's in our configured crop types
          const matchingType = this.config.cropTypes.find(type => {
            const info = CROP_INFO[type];
            return info && info.blockName === block.name;
          });

          if (!matchingType) continue;

          // Check growth stage
          const age = this.getBlockAge(block);
          if (age < this.config.minGrowthStage && cropInfo.maxGrowth > 0) {
            continue;
          }

          this.targetCrops.push(pos);
        }
      }
    }

    // Sort by distance if configured
    if (this.config.prioritizeClosest) {
      this.targetCrops.sort((a, b) => {
        const distA = a.distanceSquared(botPos);
        const distB = b.distanceSquared(botPos);
        return distA - distB;
      });
    }
  }

  /**
   * Select the best target crop
   */
  private selectBestTarget(): Vec3 | null {
    if (this.targetCrops.length === 0) {
      return null;
    }

    // Filter out invalid targets
    const validTargets = this.targetCrops.filter(pos => {
      const block = this.bot.blockAt(pos);
      if (!block) return false;

      const cropInfo = this.getCropInfo(block.name);
      if (!cropInfo) return false;

      const age = this.getBlockAge(block);
      return age >= this.config.minGrowthStage || cropInfo.maxGrowth === 0;
    });

    this.targetCrops = validTargets;
    return validTargets[0] || null;
  }

  /**
   * Get crop info by block name
   */
  private getCropInfo(blockName: string): CropInfo | null {
    for (const [key, info] of Object.entries(CROP_INFO)) {
      if (info.blockName === blockName) {
        return info;
      }
    }
    return null;
  }

  /**
   * Get the age/growth stage of a crop block
   */
  private getBlockAge(block: any): number {
    // Age is usually stored in block state properties
    const properties = block.getProperties?.() || {};
    if ('age' in properties) {
      return parseInt(properties.age, 10) || 0;
    }
    return 0;
  }

  /**
   * Get crops harvested count
   */
  getCropsHarvested(): number {
    return this.cropsHarvested;
  }

  /**
   * Get crops planted count
   */
  getCropsPlanted(): number {
    return this.cropsPlanted;
  }

  /**
   * Get current target
   */
  getCurrentTarget(): Vec3 | null {
    return this.currentTarget;
  }

  /**
   * Get all found target crops
   */
  getTargetCrops(): Vec3[] {
    return [...this.targetCrops];
  }
}
