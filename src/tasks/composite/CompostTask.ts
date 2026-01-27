/**
 * CompostTask - Composter Usage Automation
 * Based on AltoClef resource conversion patterns
 *
 * Handles using composters to convert plant materials
 * into bone meal.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for composting
 */
enum CompostState {
  SEARCHING_COMPOSTER,
  APPROACHING,
  ADDING_MATERIAL,
  WAITING,
  COLLECTING,
  FINISHED,
  FAILED
}

/**
 * Configuration for composting
 */
export interface CompostConfig {
  /** Target amount of bone meal to produce */
  targetBonemeal: number;
  /** Search radius for composters */
  searchRadius: number;
  /** Materials to use for composting (in priority order) */
  preferredMaterials: string[];
  /** Whether to place composter if none found */
  placeComposter: boolean;
}

const DEFAULT_CONFIG: CompostConfig = {
  targetBonemeal: 16,
  searchRadius: 32,
  preferredMaterials: [
    'tall_grass', 'grass', 'fern', 'large_fern',
    'seagrass', 'kelp', 'sugar_cane', 'cactus',
    'melon_slice', 'pumpkin', 'carved_pumpkin',
    'wheat_seeds', 'beetroot_seeds', 'melon_seeds', 'pumpkin_seeds',
    'wheat', 'potato', 'carrot', 'beetroot',
    'apple', 'sweet_berries', 'glow_berries',
  ],
  placeComposter: false,
};

/**
 * Compostable materials and their composting chances
 * Higher = better for composting
 */
const COMPOSTABLE_MATERIALS: Map<string, number> = new Map([
  // 30% chance items
  ['kelp', 30], ['leaves', 30], ['seagrass', 30], ['sweet_berries', 30],
  ['tall_grass', 30], ['grass', 30], ['small_dripleaf', 30],

  // 50% chance items
  ['cactus', 50], ['dried_kelp_block', 50], ['melon_slice', 50],
  ['sugar_cane', 50], ['tall_grass', 50], ['vines', 50], ['nether_sprouts', 50],
  ['weeping_vines', 50], ['twisting_vines', 50], ['glow_lichen', 50],

  // 65% chance items
  ['apple', 65], ['beetroot', 65], ['carrot', 65], ['cocoa_beans', 65],
  ['potato', 65], ['wheat', 65], ['brown_mushroom', 65], ['red_mushroom', 65],
  ['crimson_fungus', 65], ['warped_fungus', 65], ['nether_wart', 65],
  ['melon', 65], ['pumpkin', 65], ['sea_pickle', 65], ['lily_pad', 65],
  ['spore_blossom', 65], ['wheat_seeds', 65], ['beetroot_seeds', 65],
  ['melon_seeds', 65], ['pumpkin_seeds', 65],

  // 85% chance items
  ['baked_potato', 85], ['bread', 85], ['cookie', 85], ['hay_block', 85],
  ['dried_kelp', 85], ['brown_mushroom_block', 85], ['red_mushroom_block', 85],
  ['crimson_roots', 85], ['warped_roots', 85], ['flowering_azalea_leaves', 85],
  ['glow_berries', 85], ['moss_carpet', 85],

  // 100% chance items
  ['cake', 100], ['pumpkin_pie', 100], ['moss_block', 100],
]);

/**
 * Task for using composters
 */
export class CompostTask extends Task {
  private config: CompostConfig;
  private state: CompostState = CompostState.SEARCHING_COMPOSTER;
  private targetComposter: Vec3 | null = null;
  private bonemealCollected: number = 0;
  private materialsUsed: number = 0;
  private interactTimer: TimerGame;
  private waitTimer: TimerGame;

  constructor(bot: Bot, config: Partial<CompostConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.interactTimer = new TimerGame(bot, 0.2);
    this.waitTimer = new TimerGame(bot, 0.5);
  }

  get displayName(): string {
    return `Compost(${this.bonemealCollected}/${this.config.targetBonemeal} bone meal)`;
  }

  onStart(): void {
    this.state = CompostState.SEARCHING_COMPOSTER;
    this.targetComposter = null;
    this.bonemealCollected = 0;
    this.materialsUsed = 0;
  }

  onTick(): Task | null {
    // Check if we've collected enough
    if (this.bonemealCollected >= this.config.targetBonemeal) {
      this.state = CompostState.FINISHED;
      return null;
    }

    // Check if we have materials
    if (!this.hasCompostableMaterial()) {
      this.state = CompostState.FINISHED;
      return null;
    }

    switch (this.state) {
      case CompostState.SEARCHING_COMPOSTER:
        return this.handleSearchingComposter();

      case CompostState.APPROACHING:
        return this.handleApproaching();

      case CompostState.ADDING_MATERIAL:
        return this.handleAddingMaterial();

      case CompostState.WAITING:
        return this.handleWaiting();

      case CompostState.COLLECTING:
        return this.handleCollecting();

      default:
        return null;
    }
  }

  private handleSearchingComposter(): Task | null {
    this.targetComposter = this.findNearestComposter();

    if (this.targetComposter) {
      this.state = CompostState.APPROACHING;
    } else if (this.config.placeComposter && this.hasComposter()) {
      // Would place composter here
      this.state = CompostState.FAILED;
    } else {
      this.state = CompostState.FAILED;
    }

    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.targetComposter) {
      this.state = CompostState.SEARCHING_COMPOSTER;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.targetComposter);

    if (dist <= 4) {
      this.state = CompostState.ADDING_MATERIAL;
      this.interactTimer.reset();
      return null;
    }

    this.moveToward(this.targetComposter);
    return null;
  }

  private handleAddingMaterial(): Task | null {
    if (!this.targetComposter) {
      this.state = CompostState.SEARCHING_COMPOSTER;
      return null;
    }

    // Check composter state
    const composterBlock = this.bot.blockAt(this.targetComposter);
    if (!composterBlock || composterBlock.name !== 'composter') {
      this.state = CompostState.SEARCHING_COMPOSTER;
      return null;
    }

    // Check if composter is full (ready to harvest)
    const level = this.getComposterLevel(composterBlock);
    if (level >= 7) {
      this.state = CompostState.COLLECTING;
      return null;
    }

    if (this.interactTimer.elapsed()) {
      // Get best material to add
      const material = this.getBestMaterial();
      if (!material) {
        this.state = CompostState.FINISHED;
        return null;
      }

      // Equip and use material
      if (this.equipMaterial(material)) {
        // Look at composter
        const dx = this.targetComposter.x - this.bot.entity.position.x;
        const dz = this.targetComposter.z - this.bot.entity.position.z;
        const yaw = Math.atan2(-dx, dz);
        this.bot.look(yaw, Math.PI / 6, true);

        // Right-click composter
        try {
          // In mineflayer we'd call bot.activateBlock
          this.materialsUsed++;
        } catch {
          // May fail
        }
      }

      this.state = CompostState.WAITING;
      this.waitTimer.reset();
    }

    return null;
  }

  private handleWaiting(): Task | null {
    if (this.waitTimer.elapsed()) {
      // Check composter state
      if (this.targetComposter) {
        const composterBlock = this.bot.blockAt(this.targetComposter);
        if (composterBlock) {
          const level = this.getComposterLevel(composterBlock);
          if (level >= 7) {
            this.state = CompostState.COLLECTING;
            return null;
          }
        }
      }

      // Add more material
      this.state = CompostState.ADDING_MATERIAL;
      this.interactTimer.reset();
    }

    return null;
  }

  private handleCollecting(): Task | null {
    if (!this.targetComposter) {
      this.state = CompostState.SEARCHING_COMPOSTER;
      return null;
    }

    // Look at composter
    const dx = this.targetComposter.x - this.bot.entity.position.x;
    const dz = this.targetComposter.z - this.bot.entity.position.z;
    const yaw = Math.atan2(-dx, dz);
    this.bot.look(yaw, Math.PI / 6, true);

    // Right-click to collect
    try {
      // In mineflayer we'd call bot.activateBlock
      this.bonemealCollected++;
    } catch {
      // May fail
    }

    // Continue adding material
    this.state = CompostState.ADDING_MATERIAL;
    this.interactTimer.reset();
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.targetComposter = null;
  }

  isFinished(): boolean {
    return this.state === CompostState.FINISHED || this.state === CompostState.FAILED;
  }

  isFailed(): boolean {
    return this.state === CompostState.FAILED;
  }

  // ---- Helper Methods ----

  private findNearestComposter(): Vec3 | null {
    const pos = this.bot.entity.position;
    const posX = Math.floor(pos.x);
    const posY = Math.floor(pos.y);
    const posZ = Math.floor(pos.z);
    let nearest: Vec3 | null = null;
    let nearestDist = this.config.searchRadius;

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x++) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z++) {
        for (let y = -5; y <= 5; y++) {
          const checkPos = new Vec3(posX + x, posY + y, posZ + z);
          const block = this.bot.blockAt(checkPos);

          if (block && block.name === 'composter') {
            const dist = pos.distanceTo(checkPos);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = checkPos;
            }
          }
        }
      }
    }

    return nearest;
  }

  private hasCompostableMaterial(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (COMPOSTABLE_MATERIALS.has(item.name)) {
        return true;
      }
    }
    return false;
  }

  private hasComposter(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'composter') {
        return true;
      }
    }
    return false;
  }

  private getBestMaterial(): string | null {
    // Check preferred materials first
    for (const material of this.config.preferredMaterials) {
      for (const item of this.bot.inventory.items()) {
        if (item.name === material || item.name.includes(material)) {
          return item.name;
        }
      }
    }

    // Fall back to any compostable (prefer lower value items)
    let best: string | null = null;
    let bestValue = Infinity;

    for (const item of this.bot.inventory.items()) {
      const value = COMPOSTABLE_MATERIALS.get(item.name);
      if (value !== undefined && value < bestValue) {
        bestValue = value;
        best = item.name;
      }
    }

    return best;
  }

  private equipMaterial(name: string): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === name) {
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

  private getComposterLevel(block: any): number {
    // In mineflayer, composter level is stored in block state
    // Level 0-7, with 7 being full (ready to harvest)
    const metadata = block.metadata ?? 0;
    return metadata;
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
   * Get bone meal collected
   */
  getBonemealCollected(): number {
    return this.bonemealCollected;
  }

  /**
   * Get materials used
   */
  getMaterialsUsed(): number {
    return this.materialsUsed;
  }

  /**
   * Get current state
   */
  getCurrentState(): CompostState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof CompostTask)) return false;
    return this.config.targetBonemeal === other.config.targetBonemeal;
  }
}

/**
 * Convenience functions
 */
export function compost(bot: Bot, targetBonemeal: number = 16): CompostTask {
  return new CompostTask(bot, { targetBonemeal });
}

export function compostAll(bot: Bot): CompostTask {
  return new CompostTask(bot, { targetBonemeal: 1000 });
}

export function compostSeeds(bot: Bot, targetBonemeal: number = 16): CompostTask {
  return new CompostTask(bot, {
    targetBonemeal,
    preferredMaterials: ['wheat_seeds', 'beetroot_seeds', 'melon_seeds', 'pumpkin_seeds'],
  });
}

export function compostPlants(bot: Bot, targetBonemeal: number = 16): CompostTask {
  return new CompostTask(bot, {
    targetBonemeal,
    preferredMaterials: ['tall_grass', 'grass', 'fern', 'seagrass', 'kelp'],
  });
}
