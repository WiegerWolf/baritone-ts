/**
 * GatherResourcesTask - Flexible Multi-Item Gathering
 * Based on AltoClef's resource gathering system
 *
 * High-level task that coordinates multiple item acquisition
 * methods to gather a set of target items.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ItemTarget } from '../../utils/ItemTarget';
import { MineBlockTask, MineBlockTypeTask } from '../concrete/MineBlockTask';
import { PickupItemTask } from '../concrete/InventoryTask';
import { CraftTask } from '../concrete/CraftTask';
import { GoToNearTask } from '../concrete/GoToTask';
import { CollectWoodTask } from './CollectWoodTask';
import { GetToolTask, type ToolType } from './GetToolTask';

/**
 * Source block mappings for common items
 */
const ITEM_SOURCE_BLOCKS: Record<string, string[]> = {
  // Ores (require pickaxe)
  coal: ['coal_ore', 'deepslate_coal_ore'],
  raw_iron: ['iron_ore', 'deepslate_iron_ore'],
  raw_gold: ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
  raw_copper: ['copper_ore', 'deepslate_copper_ore'],
  diamond: ['diamond_ore', 'deepslate_diamond_ore'],
  emerald: ['emerald_ore', 'deepslate_emerald_ore'],
  lapis_lazuli: ['lapis_ore', 'deepslate_lapis_ore'],
  redstone: ['redstone_ore', 'deepslate_redstone_ore'],

  // Stone (requires pickaxe)
  cobblestone: ['stone', 'cobblestone'],
  cobbled_deepslate: ['deepslate'],

  // Sand/Gravel (shovel preferred)
  sand: ['sand'],
  gravel: ['gravel'],
  flint: ['gravel'],

  // Dirt (shovel preferred)
  dirt: ['dirt', 'grass_block'],
  clay_ball: ['clay'],
};

/**
 * Tool requirements for different block types
 */
const BLOCK_TOOL_REQUIREMENTS: Record<string, ToolType> = {
  // Stone/Ores require pickaxe
  stone: 'pickaxe',
  cobblestone: 'pickaxe',
  deepslate: 'pickaxe',
  coal_ore: 'pickaxe',
  deepslate_coal_ore: 'pickaxe',
  iron_ore: 'pickaxe',
  deepslate_iron_ore: 'pickaxe',
  gold_ore: 'pickaxe',
  deepslate_gold_ore: 'pickaxe',
  copper_ore: 'pickaxe',
  deepslate_copper_ore: 'pickaxe',
  diamond_ore: 'pickaxe',
  deepslate_diamond_ore: 'pickaxe',
  emerald_ore: 'pickaxe',
  deepslate_emerald_ore: 'pickaxe',
  lapis_ore: 'pickaxe',
  deepslate_lapis_ore: 'pickaxe',
  redstone_ore: 'pickaxe',
  deepslate_redstone_ore: 'pickaxe',
  nether_gold_ore: 'pickaxe',

  // Sand/Gravel/Dirt prefer shovel
  sand: 'shovel',
  gravel: 'shovel',
  dirt: 'shovel',
  grass_block: 'shovel',
  clay: 'shovel',
};

/**
 * State for resource gathering
 */
enum GatherState {
  ANALYZING,
  GETTING_TOOL,
  PICKING_UP,
  MINING,
  CRAFTING,
  COLLECTING_WOOD,
  FINISHED,
  FAILED
}

/**
 * Configuration for gather behavior
 */
export interface GatherConfig {
  /** Search radius for blocks/items */
  searchRadius: number;
  /** Whether to craft items if needed */
  allowCrafting: boolean;
  /** Whether to mine blocks for items */
  allowMining: boolean;
  /** Whether to pick up dropped items */
  allowPickup: boolean;
  /** Whether to auto-acquire tools */
  autoGetTools: boolean;
}

const DEFAULT_CONFIG: GatherConfig = {
  searchRadius: 64,
  allowCrafting: true,
  allowMining: true,
  allowPickup: true,
  autoGetTools: true,
};

/**
 * Task to gather multiple types of resources
 */
export class GatherResourcesTask extends Task {
  private targets: ItemTarget[];
  private config: GatherConfig;
  private state: GatherState = GatherState.ANALYZING;
  private currentTarget: ItemTarget | null = null;
  private currentMethod: string | null = null;

  constructor(
    bot: Bot,
    targets: ItemTarget | ItemTarget[] | string | string[],
    counts?: number | number[],
    config: Partial<GatherConfig> = {}
  ) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Normalize targets
    if (Array.isArray(targets)) {
      if (typeof targets[0] === 'string') {
        // string[]
        const names = targets as string[];
        const countArray = Array.isArray(counts) ? counts : names.map(() => counts ?? 1);
        this.targets = names.map((name, i) => new ItemTarget([name], countArray[i] ?? 1));
      } else {
        // ItemTarget[]
        this.targets = targets as ItemTarget[];
      }
    } else if (targets instanceof ItemTarget) {
      this.targets = [targets];
    } else {
      // Single string
      this.targets = [new ItemTarget([targets], typeof counts === 'number' ? counts : 1)];
    }
  }

  get displayName(): string {
    const progress = this.targets.map(t => {
      const have = this.getItemCount(t);
      const need = t.getTargetCount();
      return `${t.getItemNames()[0]}:${have}/${need}`;
    }).join(', ');
    return `GatherResources(${progress})`;
  }

  onStart(): void {
    this.state = GatherState.ANALYZING;
    this.currentTarget = null;
    this.currentMethod = null;
  }

  onTick(): Task | null {
    // Check if all targets are satisfied
    if (this.allTargetsMet()) {
      this.state = GatherState.FINISHED;
      return null;
    }

    switch (this.state) {
      case GatherState.ANALYZING:
        return this.handleAnalyzing();

      case GatherState.GETTING_TOOL:
        return this.handleGettingTool();

      case GatherState.PICKING_UP:
        return this.handlePickingUp();

      case GatherState.MINING:
        return this.handleMining();

      case GatherState.CRAFTING:
        return this.handleCrafting();

      case GatherState.COLLECTING_WOOD:
        return this.handleCollectingWood();

      default:
        return null;
    }
  }

  private handleAnalyzing(): Task | null {
    // Find first unsatisfied target
    this.currentTarget = this.findUnsatisfiedTarget();
    if (!this.currentTarget) {
      this.state = GatherState.FINISHED;
      return null;
    }

    const itemNames = this.currentTarget.getItemNames();

    // 1. Check for dropped items nearby (highest priority - they despawn)
    if (this.config.allowPickup) {
      const droppedItem = this.findDroppedItem(itemNames);
      if (droppedItem) {
        this.state = GatherState.PICKING_UP;
        this.currentMethod = 'pickup';
        return null;
      }
    }

    // 2. Check if this is wood-related (use specialized task)
    if (this.isWoodItem(itemNames)) {
      this.state = GatherState.COLLECTING_WOOD;
      this.currentMethod = 'wood';
      return null;
    }

    // 3. Check if we can mine blocks for this item
    if (this.config.allowMining) {
      const sourceBlock = this.findSourceBlock(itemNames);
      if (sourceBlock) {
        // Check if we need a tool
        const requiredTool = this.getRequiredTool(sourceBlock.name);
        if (requiredTool && this.config.autoGetTools && !this.hasTool(requiredTool)) {
          this.state = GatherState.GETTING_TOOL;
          this.currentMethod = requiredTool;
          return null;
        }

        this.state = GatherState.MINING;
        this.currentMethod = 'mine';
        return null;
      }
    }

    // 4. Check if we can craft this item
    if (this.config.allowCrafting) {
      const canCraft = this.canCraftItem(itemNames[0]);
      if (canCraft) {
        this.state = GatherState.CRAFTING;
        this.currentMethod = 'craft';
        return null;
      }
    }

    // No method available
    this.state = GatherState.FAILED;
    return null;
  }

  private handleGettingTool(): Task | null {
    if (!this.currentMethod) {
      this.state = GatherState.ANALYZING;
      return null;
    }

    const toolType = this.currentMethod as ToolType;
    if (this.hasTool(toolType)) {
      this.state = GatherState.ANALYZING;
      return null;
    }

    return new GetToolTask(this.bot, toolType);
  }

  private handlePickingUp(): Task | null {
    if (!this.currentTarget) {
      this.state = GatherState.ANALYZING;
      return null;
    }

    const itemNames = this.currentTarget.getItemNames();
    const droppedItem = this.findDroppedItem(itemNames);
    if (!droppedItem) {
      this.state = GatherState.ANALYZING;
      return null;
    }

    const needed = this.currentTarget.getTargetCount() - this.getItemCount(this.currentTarget);
    return new PickupItemTask(this.bot, [...itemNames], needed);
  }

  private handleMining(): Task | null {
    if (!this.currentTarget) {
      this.state = GatherState.ANALYZING;
      return null;
    }

    // Check if target is now satisfied
    if (this.currentTarget.isMet(this.getItemCount(this.currentTarget))) {
      this.state = GatherState.ANALYZING;
      return null;
    }

    const itemNames = this.currentTarget.getItemNames();
    const sourceBlocks = this.getSourceBlocks(itemNames);

    if (sourceBlocks.length === 0) {
      this.state = GatherState.ANALYZING;
      return null;
    }

    // Find nearest source block
    const block = this.findSourceBlock(itemNames);
    if (!block) {
      this.state = GatherState.ANALYZING;
      return null;
    }

    return MineBlockTask.fromVec3(this.bot, block.position, true);
  }

  private handleCrafting(): Task | null {
    if (!this.currentTarget) {
      this.state = GatherState.ANALYZING;
      return null;
    }

    const itemNames = this.currentTarget.getItemNames();
    const needed = this.currentTarget.getTargetCount() - this.getItemCount(this.currentTarget);

    if (needed <= 0) {
      this.state = GatherState.ANALYZING;
      return null;
    }

    return new CraftTask(this.bot, itemNames[0], needed);
  }

  private handleCollectingWood(): Task | null {
    if (!this.currentTarget) {
      this.state = GatherState.ANALYZING;
      return null;
    }

    const needed = this.currentTarget.getTargetCount() - this.getItemCount(this.currentTarget);
    if (needed <= 0) {
      this.state = GatherState.ANALYZING;
      return null;
    }

    return new CollectWoodTask(this.bot, needed);
  }

  onStop(interruptTask: ITask | null): void {
    this.currentTarget = null;
    this.currentMethod = null;
  }

  isFinished(): boolean {
    return this.state === GatherState.FINISHED || this.state === GatherState.FAILED;
  }

  isFailed(): boolean {
    return this.state === GatherState.FAILED;
  }

  // ---- Helper Methods ----

  private allTargetsMet(): boolean {
    for (const target of this.targets) {
      if (!target.isMet(this.getItemCount(target))) {
        return false;
      }
    }
    return true;
  }

  private findUnsatisfiedTarget(): ItemTarget | null {
    for (const target of this.targets) {
      if (!target.isMet(this.getItemCount(target))) {
        return target;
      }
    }
    return null;
  }

  private getItemCount(target: ItemTarget): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (target.matches(item.name)) {
        count += item.count;
      }
    }
    return count;
  }

  private findDroppedItem(itemNames: readonly string[]): any | null {
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name !== 'item' && entity.entityType !== 2) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist > this.config.searchRadius) continue;

      // Check item metadata
      const metadata = (entity as any).metadata;
      if (metadata) {
        for (const entry of metadata) {
          if (entry && typeof entry === 'object' && 'itemId' in entry) {
            const mcData = require('minecraft-data')(this.bot.version);
            const item = mcData.items[entry.itemId];
            if (item && itemNames.includes(item.name)) {
              return entity;
            }
          }
        }
      }
    }

    return null;
  }

  private isWoodItem(itemNames: readonly string[]): boolean {
    return itemNames.some(name =>
      name.includes('log') || name.includes('stem') || name.includes('wood')
    );
  }

  private getSourceBlocks(itemNames: readonly string[]): string[] {
    const blocks: string[] = [];
    for (const name of itemNames) {
      const sources = ITEM_SOURCE_BLOCKS[name];
      if (sources) {
        blocks.push(...sources);
      }
    }
    return blocks;
  }

  private findSourceBlock(itemNames: readonly string[]): Block | null {
    const sourceBlocks = this.getSourceBlocks(itemNames);
    if (sourceBlocks.length === 0) return null;

    const playerPos = this.bot.entity.position;
    let nearest: Block | null = null;
    let nearestDist = Infinity;

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x += 4) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z += 4) {
        for (let y = -20; y <= 20; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block || !sourceBlocks.includes(block.name)) continue;

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

  private getRequiredTool(blockName: string): ToolType | null {
    return BLOCK_TOOL_REQUIREMENTS[blockName] ?? null;
  }

  private hasTool(toolType: ToolType): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name.includes(toolType)) {
        return true;
      }
    }
    return false;
  }

  private canCraftItem(itemName: string): boolean {
    try {
      const mcData = require('minecraft-data')(this.bot.version);
      const itemData = mcData.itemsByName[itemName];
      if (!itemData) return false;

      const recipes = this.bot.recipesFor(itemData.id, null, 1, null);
      return recipes.length > 0;
    } catch {
      return false;
    }
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GatherResourcesTask)) return false;

    if (this.targets.length !== other.targets.length) return false;

    for (let i = 0; i < this.targets.length; i++) {
      const a = this.targets[i];
      const b = other.targets[i];
      if (a.toString() !== b.toString()) return false;
    }

    return true;
  }
}

/**
 * Convenience function to gather resources
 */
export function gatherResources(
  bot: Bot,
  items: string | string[],
  counts?: number | number[],
  config?: Partial<GatherConfig>
): GatherResourcesTask {
  return new GatherResourcesTask(bot, items, counts, config);
}
