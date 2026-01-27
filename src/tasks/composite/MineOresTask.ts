/**
 * MineOresTask - Specialized Ore Mining Task
 * Based on AltoClef's ore mining behavior
 *
 * Finds and mines ore deposits, handling tool requirements
 * and prioritizing ore types by value.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { MineBlockTask } from '../concrete/MineBlockTask';
import { GoToNearTask } from '../concrete/GoToTask';
import { GetToolTask } from './GetToolTask';

/**
 * Ore types and their properties
 */
interface OreInfo {
  name: string;
  blocks: string[];
  minPickaxeTier: 'wooden' | 'stone' | 'iron' | 'diamond' | 'netherite';
  yRange: { min: number; max: number };
  priority: number; // Higher = more valuable
}

const ORE_INFO: OreInfo[] = [
  {
    name: 'diamond',
    blocks: ['diamond_ore', 'deepslate_diamond_ore'],
    minPickaxeTier: 'iron',
    yRange: { min: -64, max: 16 },
    priority: 100,
  },
  {
    name: 'emerald',
    blocks: ['emerald_ore', 'deepslate_emerald_ore'],
    minPickaxeTier: 'iron',
    yRange: { min: -16, max: 320 },
    priority: 90,
  },
  {
    name: 'gold',
    blocks: ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
    minPickaxeTier: 'iron',
    yRange: { min: -64, max: 32 },
    priority: 70,
  },
  {
    name: 'iron',
    blocks: ['iron_ore', 'deepslate_iron_ore'],
    minPickaxeTier: 'stone',
    yRange: { min: -64, max: 320 },
    priority: 60,
  },
  {
    name: 'copper',
    blocks: ['copper_ore', 'deepslate_copper_ore'],
    minPickaxeTier: 'stone',
    yRange: { min: -16, max: 112 },
    priority: 40,
  },
  {
    name: 'lapis',
    blocks: ['lapis_ore', 'deepslate_lapis_ore'],
    minPickaxeTier: 'stone',
    yRange: { min: -64, max: 64 },
    priority: 50,
  },
  {
    name: 'redstone',
    blocks: ['redstone_ore', 'deepslate_redstone_ore'],
    minPickaxeTier: 'iron',
    yRange: { min: -64, max: 16 },
    priority: 45,
  },
  {
    name: 'coal',
    blocks: ['coal_ore', 'deepslate_coal_ore'],
    minPickaxeTier: 'wooden',
    yRange: { min: 0, max: 320 },
    priority: 30,
  },
];

/**
 * Pickaxe tiers in order
 */
const PICKAXE_TIERS = ['wooden', 'stone', 'iron', 'diamond', 'netherite'] as const;

/**
 * State for ore mining
 */
enum MineOreState {
  CHECKING_TOOL,
  GETTING_TOOL,
  SEARCHING,
  GOING_TO_ORE,
  MINING,
  FINISHED,
  FAILED
}

/**
 * Configuration for ore mining
 */
export interface MineOreConfig {
  /** Target ore types (empty = all ores) */
  targetOres: string[];
  /** Search radius */
  searchRadius: number;
  /** Number of ores to mine (0 = infinite) */
  targetCount: number;
  /** Auto-acquire pickaxe if needed */
  autoGetPickaxe: boolean;
  /** Prefer higher priority ores */
  prioritizeByValue: boolean;
}

const DEFAULT_CONFIG: MineOreConfig = {
  targetOres: [],
  searchRadius: 48,
  targetCount: 0,
  autoGetPickaxe: true,
  prioritizeByValue: true,
};

/**
 * Task to find and mine ore deposits
 */
export class MineOresTask extends Task {
  private config: MineOreConfig;
  private state: MineOreState = MineOreState.CHECKING_TOOL;
  private currentOre: Block | null = null;
  private minedCount: number = 0;
  private requiredTier: string | null = null;

  constructor(bot: Bot, config: Partial<MineOreConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get displayName(): string {
    const ores = this.config.targetOres.length > 0
      ? this.config.targetOres.join(', ')
      : 'all';
    if (this.config.targetCount > 0) {
      return `MineOres(${ores}, ${this.minedCount}/${this.config.targetCount})`;
    }
    return `MineOres(${ores}, ${this.minedCount} mined)`;
  }

  onStart(): void {
    this.state = MineOreState.CHECKING_TOOL;
    this.currentOre = null;
    this.minedCount = 0;
    this.requiredTier = null;
  }

  onTick(): Task | null {
    // Check if we've reached target count
    if (this.config.targetCount > 0 && this.minedCount >= this.config.targetCount) {
      this.state = MineOreState.FINISHED;
      return null;
    }

    switch (this.state) {
      case MineOreState.CHECKING_TOOL:
        return this.handleCheckingTool();

      case MineOreState.GETTING_TOOL:
        return this.handleGettingTool();

      case MineOreState.SEARCHING:
        return this.handleSearching();

      case MineOreState.GOING_TO_ORE:
        return this.handleGoingToOre();

      case MineOreState.MINING:
        return this.handleMining();

      default:
        return null;
    }
  }

  private handleCheckingTool(): Task | null {
    // Get highest tier pickaxe we have
    const currentTier = this.getBestPickaxeTier();

    if (!currentTier && this.config.autoGetPickaxe) {
      this.requiredTier = 'wooden';
      this.state = MineOreState.GETTING_TOOL;
      return null;
    }

    this.state = MineOreState.SEARCHING;
    return null;
  }

  private handleGettingTool(): Task | null {
    if (this.getBestPickaxeTier()) {
      this.state = MineOreState.SEARCHING;
      return null;
    }

    const tier = this.requiredTier || 'wooden';
    return new GetToolTask(this.bot, 'pickaxe', tier);
  }

  private handleSearching(): Task | null {
    this.currentOre = this.findBestOre();
    if (!this.currentOre) {
      // No ore found
      if (this.minedCount > 0 || this.config.targetCount === 0) {
        this.state = MineOreState.FINISHED;
      } else {
        this.state = MineOreState.FAILED;
      }
      return null;
    }

    // Check if we have the right pickaxe tier
    const oreInfo = this.getOreInfo(this.currentOre.name);
    if (oreInfo) {
      const currentTier = this.getBestPickaxeTier();
      if (!this.canMineWith(currentTier, oreInfo.minPickaxeTier)) {
        if (this.config.autoGetPickaxe) {
          this.requiredTier = oreInfo.minPickaxeTier;
          this.state = MineOreState.GETTING_TOOL;
          return null;
        }
        // Can't mine this ore, try to find another
        this.currentOre = null;
        return null;
      }
    }

    this.state = MineOreState.GOING_TO_ORE;
    return null;
  }

  private handleGoingToOre(): Task | null {
    if (!this.currentOre) {
      this.state = MineOreState.SEARCHING;
      return null;
    }

    // Verify ore still exists
    const block = this.bot.blockAt(this.currentOre.position);
    if (!block || !this.isTargetOre(block.name)) {
      this.currentOre = null;
      this.state = MineOreState.SEARCHING;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentOre.position);
    if (dist <= 4.0) {
      this.state = MineOreState.MINING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.currentOre.position.x),
      Math.floor(this.currentOre.position.y),
      Math.floor(this.currentOre.position.z),
      3
    );
  }

  private handleMining(): Task | null {
    if (!this.currentOre) {
      this.state = MineOreState.SEARCHING;
      return null;
    }

    // Check if ore is still there
    const block = this.bot.blockAt(this.currentOre.position);
    if (!block || !this.isTargetOre(block.name)) {
      // Ore mined or changed
      this.minedCount++;
      this.currentOre = null;
      this.state = MineOreState.SEARCHING;
      return null;
    }

    return MineBlockTask.fromVec3(this.bot, this.currentOre.position, true);
  }

  onStop(interruptTask: ITask | null): void {
    this.currentOre = null;
  }

  isFinished(): boolean {
    return this.state === MineOreState.FINISHED || this.state === MineOreState.FAILED;
  }

  isFailed(): boolean {
    return this.state === MineOreState.FAILED;
  }

  // ---- Helper Methods ----

  /**
   * Get info for an ore type
   */
  private getOreInfo(blockName: string): OreInfo | null {
    for (const info of ORE_INFO) {
      if (info.blocks.includes(blockName)) {
        return info;
      }
    }
    return null;
  }

  /**
   * Check if block is a target ore
   */
  private isTargetOre(blockName: string): boolean {
    // If no target ores specified, accept all
    if (this.config.targetOres.length === 0) {
      return ORE_INFO.some(info => info.blocks.includes(blockName));
    }

    // Check if it matches target ores
    for (const target of this.config.targetOres) {
      const info = ORE_INFO.find(i => i.name === target);
      if (info && info.blocks.includes(blockName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find best ore to mine
   */
  private findBestOre(): Block | null {
    const playerPos = this.bot.entity.position;
    const candidates: { block: Block; priority: number; distance: number }[] = [];

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x += 2) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z += 2) {
        for (let y = -20; y <= 20; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block || !this.isTargetOre(block.name)) continue;

          const info = this.getOreInfo(block.name);
          if (!info) continue;

          // Check if in valid Y range
          if (pos.y < info.yRange.min || pos.y > info.yRange.max) continue;

          // Check if we can mine it with current pickaxe
          const currentTier = this.getBestPickaxeTier();
          if (!this.canMineWith(currentTier, info.minPickaxeTier)) {
            // Skip if we can't get better pickaxe
            if (!this.config.autoGetPickaxe) continue;
          }

          const distance = playerPos.distanceTo(pos);
          candidates.push({ block, priority: info.priority, distance });
        }
      }
    }

    if (candidates.length === 0) return null;

    // Sort by priority (descending) then distance (ascending)
    if (this.config.prioritizeByValue) {
      candidates.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.distance - b.distance;
      });
    } else {
      candidates.sort((a, b) => a.distance - b.distance);
    }

    return candidates[0].block;
  }

  /**
   * Get best pickaxe tier in inventory
   */
  private getBestPickaxeTier(): string | null {
    let bestIndex = -1;

    for (const item of this.bot.inventory.items()) {
      if (!item.name.includes('pickaxe')) continue;

      for (let i = PICKAXE_TIERS.length - 1; i >= 0; i--) {
        if (item.name.includes(PICKAXE_TIERS[i]) && i > bestIndex) {
          bestIndex = i;
          break;
        }
      }
    }

    return bestIndex >= 0 ? PICKAXE_TIERS[bestIndex] : null;
  }

  /**
   * Check if current tier can mine required tier
   */
  private canMineWith(
    current: string | null,
    required: 'wooden' | 'stone' | 'iron' | 'diamond' | 'netherite'
  ): boolean {
    if (!current) return false;

    const currentIndex = PICKAXE_TIERS.indexOf(current as any);
    const requiredIndex = PICKAXE_TIERS.indexOf(required);

    return currentIndex >= requiredIndex;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof MineOresTask)) return false;

    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Convenience functions for mining specific ore types
 */
export function mineDiamonds(bot: Bot, count: number = 0): MineOresTask {
  return new MineOresTask(bot, { targetOres: ['diamond'], targetCount: count });
}

export function mineIron(bot: Bot, count: number = 0): MineOresTask {
  return new MineOresTask(bot, { targetOres: ['iron'], targetCount: count });
}

export function mineCoal(bot: Bot, count: number = 0): MineOresTask {
  return new MineOresTask(bot, { targetOres: ['coal'], targetCount: count });
}

export function mineGold(bot: Bot, count: number = 0): MineOresTask {
  return new MineOresTask(bot, { targetOres: ['gold'], targetCount: count });
}

export function mineAllOres(bot: Bot, count: number = 0): MineOresTask {
  return new MineOresTask(bot, { targetCount: count });
}
