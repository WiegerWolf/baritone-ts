/**
 * MiningRequirementTask - Mining Level and Material Collection Tasks
 * Based on BaritonePlus's mining requirement system
 *
 * WHY: Minecraft has a tool progression system where certain blocks require
 * specific tool materials to mine. These tasks ensure the bot has appropriate
 * tools before attempting to mine blocks that would otherwise waste time.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { MineAndCollectTask } from './MineAndCollectTask';
import { itemTarget } from './ResourceTask';

/**
 * Mining requirement levels matching Minecraft's tool progression
 *
 * WHY: Different blocks require different tool materials:
 * - HAND: Dirt, sand, gravel (any tool or hand)
 * - WOOD: Stone, coal ore (wood pickaxe or better)
 * - STONE: Iron ore, lapis (stone pickaxe or better)
 * - IRON: Gold ore, diamond, redstone, emerald (iron pickaxe or better)
 * - DIAMOND: Obsidian, ancient debris (diamond/netherite pickaxe only)
 */
export enum MiningRequirement {
  HAND = 0,
  WOOD = 1,
  STONE = 2,
  IRON = 3,
  DIAMOND = 4,
}

/**
 * Map of mining requirements to pickaxe items
 */
const PICKAXE_FOR_REQUIREMENT: Record<MiningRequirement, string | null> = {
  [MiningRequirement.HAND]: null,
  [MiningRequirement.WOOD]: 'wooden_pickaxe',
  [MiningRequirement.STONE]: 'stone_pickaxe',
  [MiningRequirement.IRON]: 'iron_pickaxe',
  [MiningRequirement.DIAMOND]: 'diamond_pickaxe',
};

/**
 * All pickaxe types in order of quality
 */
const PICKAXE_TIERS: string[] = [
  'wooden_pickaxe',
  'stone_pickaxe',
  'golden_pickaxe', // Gold is weak but meets WOOD requirement
  'iron_pickaxe',
  'diamond_pickaxe',
  'netherite_pickaxe',
];

/**
 * Map of pickaxe to its mining level
 */
const PICKAXE_LEVEL: Record<string, MiningRequirement> = {
  'wooden_pickaxe': MiningRequirement.WOOD,
  'stone_pickaxe': MiningRequirement.STONE,
  'golden_pickaxe': MiningRequirement.WOOD, // Gold can mine stone tier
  'iron_pickaxe': MiningRequirement.IRON,
  'diamond_pickaxe': MiningRequirement.DIAMOND,
  'netherite_pickaxe': MiningRequirement.DIAMOND,
};

/**
 * State for mining requirement task
 */
enum MiningReqState {
  CHECKING,
  CRAFTING,
  COLLECTING_MATERIALS,
  FINISHED
}

/**
 * Task to ensure we have a tool at or above a mining level.
 *
 * WHY: Before attempting to mine obsidian, we need a diamond pickaxe.
 * Before mining iron ore, we need at least a stone pickaxe. This task
 * checks current inventory and crafts/obtains the required pickaxe if missing.
 *
 * Based on BaritonePlus SatisfyMiningRequirementTask.java
 */
export class SatisfyMiningRequirementTask extends Task {
  private requirement: MiningRequirement;
  private state: MiningReqState = MiningReqState.CHECKING;

  constructor(bot: Bot, requirement: MiningRequirement) {
    super(bot);
    this.requirement = requirement;
  }

  get displayName(): string {
    return `SatisfyMiningReq(${MiningRequirement[this.requirement]})`;
  }

  onStart(): void {
    this.state = MiningReqState.CHECKING;
  }

  onTick(): Task | null {
    // Check if requirement is already met
    if (this.hasRequiredPickaxe()) {
      this.state = MiningReqState.FINISHED;
      return null;
    }

    // HAND requirement is always satisfied
    if (this.requirement === MiningRequirement.HAND) {
      this.state = MiningReqState.FINISHED;
      return null;
    }

    // Need to obtain the required pickaxe
    // For now, we use MineAndCollectTask to get the pickaxe
    // In a full implementation, this would use CraftTask
    const requiredPickaxe = PICKAXE_FOR_REQUIREMENT[this.requirement];
    if (!requiredPickaxe) {
      this.state = MiningReqState.FINISHED;
      return null;
    }

    // Return a task to get the pickaxe
    // This is simplified - full impl would craft it
    return new MineAndCollectTask(
      this.bot,
      [itemTarget(requiredPickaxe, 1)],
      [], // Can't mine pickaxes - would need crafting
      { searchRadius: 0 } // Force failure quickly
    );
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.state === MiningReqState.FINISHED || this.hasRequiredPickaxe();
  }

  // ---- Helper methods ----

  /**
   * Check if we have a pickaxe at or above the required level
   */
  private hasRequiredPickaxe(): boolean {
    // HAND requirement is always met
    if (this.requirement === MiningRequirement.HAND) return true;

    const inventory = this.bot.inventory.items();

    for (const item of inventory) {
      const level = PICKAXE_LEVEL[item.name];
      if (level !== undefined && level >= this.requirement) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the best pickaxe in inventory
   */
  getBestPickaxe(): string | null {
    const inventory = this.bot.inventory.items();
    let bestLevel = -1;
    let bestPickaxe: string | null = null;

    for (const item of inventory) {
      const level = PICKAXE_LEVEL[item.name];
      if (level !== undefined && level > bestLevel) {
        bestLevel = level;
        bestPickaxe = item.name;
      }
    }

    return bestPickaxe;
  }

  /**
   * Get current mining level capability
   */
  getCurrentMiningLevel(): MiningRequirement {
    const inventory = this.bot.inventory.items();
    let maxLevel = MiningRequirement.HAND;

    for (const item of inventory) {
      const level = PICKAXE_LEVEL[item.name];
      if (level !== undefined && level > maxLevel) {
        maxLevel = level;
      }
    }

    return maxLevel;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof SatisfyMiningRequirementTask)) return false;
    return this.requirement === other.requirement;
  }
}

/**
 * Throwaway/building materials that can be easily collected
 */
export const BUILDING_MATERIALS: string[] = [
  'cobblestone',
  'dirt',
  'netherrack',
  'cobbled_deepslate',
  'end_stone',
  'sand',
  'gravel',
  'andesite',
  'diorite',
  'granite',
  'tuff',
  'stone',
  'deepslate',
];

/**
 * Blocks that can be mined to get building materials
 */
const MATERIAL_BLOCKS: string[] = [
  'stone',      // -> cobblestone
  'dirt',       // -> dirt
  'netherrack', // -> netherrack
  'deepslate',  // -> cobbled_deepslate
  'end_stone',  // -> end_stone
  'sand',       // -> sand
  'gravel',     // -> gravel
  'andesite',   // -> andesite
  'diorite',    // -> diorite
  'granite',    // -> granite
  'tuff',       // -> tuff
];

/**
 * State for building materials task
 */
enum BuildingMaterialsState {
  CHECKING,
  COLLECTING,
  FINISHED
}

/**
 * Task to collect building/throwaway materials.
 *
 * WHY: Many tasks require "throwaway" blocks for scaffolding, bridging,
 * or clearing liquids. This task collects common building materials like
 * cobblestone, dirt, or netherrack - whatever is easiest to find.
 *
 * Based on BaritonePlus GetBuildingMaterialsTask.java
 */
export class GetBuildingMaterialsTask extends Task {
  private targetCount: number;
  private state: BuildingMaterialsState = BuildingMaterialsState.CHECKING;

  constructor(bot: Bot, count: number) {
    super(bot);
    this.targetCount = count;
  }

  get displayName(): string {
    const current = this.getBuildingMaterialCount();
    return `GetBuildingMaterials(${current}/${this.targetCount})`;
  }

  onStart(): void {
    this.state = BuildingMaterialsState.CHECKING;
  }

  onTick(): Task | null {
    const currentCount = this.getBuildingMaterialCount();

    if (currentCount >= this.targetCount) {
      this.state = BuildingMaterialsState.FINISHED;
      return null;
    }

    this.state = BuildingMaterialsState.COLLECTING;

    // Create item targets for all building materials
    const needed = this.targetCount - currentCount;
    const targets = BUILDING_MATERIALS.map(mat => itemTarget(mat, needed));

    return new MineAndCollectTask(
      this.bot,
      targets,
      MATERIAL_BLOCKS,
      {
        searchRadius: 32,
        preferDrops: false,
      }
    );
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.state === BuildingMaterialsState.FINISHED ||
           this.getBuildingMaterialCount() >= this.targetCount;
  }

  // ---- Helper methods ----

  /**
   * Count all building materials in inventory
   */
  getBuildingMaterialCount(): number {
    const inventory = this.bot.inventory.items();
    let total = 0;

    for (const item of inventory) {
      if (BUILDING_MATERIALS.includes(item.name)) {
        total += item.count;
      }
    }

    return total;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetBuildingMaterialsTask)) return false;
    return this.targetCount === other.targetCount;
  }
}

/**
 * Helper function to satisfy mining requirement
 */
export function satisfyMiningRequirement(
  bot: Bot,
  requirement: MiningRequirement
): SatisfyMiningRequirementTask {
  return new SatisfyMiningRequirementTask(bot, requirement);
}

/**
 * Helper function to ensure we can mine stone-tier blocks
 */
export function ensureStonePickaxe(bot: Bot): SatisfyMiningRequirementTask {
  return new SatisfyMiningRequirementTask(bot, MiningRequirement.STONE);
}

/**
 * Helper function to ensure we can mine iron-tier blocks
 */
export function ensureIronPickaxe(bot: Bot): SatisfyMiningRequirementTask {
  return new SatisfyMiningRequirementTask(bot, MiningRequirement.IRON);
}

/**
 * Helper function to ensure we can mine diamond-tier blocks (obsidian)
 */
export function ensureDiamondPickaxe(bot: Bot): SatisfyMiningRequirementTask {
  return new SatisfyMiningRequirementTask(bot, MiningRequirement.DIAMOND);
}

/**
 * Helper function to get building materials
 */
export function getBuildingMaterials(
  bot: Bot,
  count: number
): GetBuildingMaterialsTask {
  return new GetBuildingMaterialsTask(bot, count);
}

/**
 * Check if the inventory meets a mining requirement
 */
export function miningRequirementMet(
  bot: Bot,
  requirement: MiningRequirement
): boolean {
  if (requirement === MiningRequirement.HAND) return true;

  const inventory = bot.inventory.items();

  for (const item of inventory) {
    const level = PICKAXE_LEVEL[item.name];
    if (level !== undefined && level >= requirement) {
      return true;
    }
  }

  return false;
}

/**
 * Get the mining requirement for a block type
 */
export function getBlockMiningRequirement(blockName: string): MiningRequirement {
  // Obsidian and ancient debris require diamond
  if (blockName === 'obsidian' || blockName === 'ancient_debris' || blockName === 'crying_obsidian') {
    return MiningRequirement.DIAMOND;
  }

  // Ores that require iron
  if (blockName.includes('gold_ore') || blockName.includes('diamond_ore') ||
      blockName.includes('redstone_ore') || blockName.includes('emerald_ore')) {
    return MiningRequirement.IRON;
  }

  // Ores that require stone
  if (blockName.includes('iron_ore') || blockName.includes('lapis_ore') ||
      blockName.includes('copper_ore')) {
    return MiningRequirement.STONE;
  }

  // Stone-type blocks require wood
  if (blockName === 'stone' || blockName === 'cobblestone' ||
      blockName.includes('coal_ore') || blockName === 'deepslate' ||
      blockName === 'cobbled_deepslate') {
    return MiningRequirement.WOOD;
  }

  // Default - can mine with hand
  return MiningRequirement.HAND;
}
