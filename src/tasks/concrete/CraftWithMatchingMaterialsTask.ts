/**
 * CraftWithMatchingMaterialsTask - Crafting with Matching Material Variants
 * Based on BaritonePlus CraftWithMatchingMaterialsTask.java
 *
 * Handles crafting recipes that require matching material variants:
 * - Beds require 3 wool of the SAME color
 * - Fences require planks of the SAME wood type
 *
 * This task intelligently:
 * 1. Analyzes available material variants
 * 2. Determines which variant has the most items
 * 3. Crafts using the majority variant
 * 4. Collects more materials if needed
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ResourceTask, ItemTarget, itemTarget } from './ResourceTask';
import { CraftInInventoryTask } from './CraftInInventoryTask';
import { CraftInTableTask } from './ContainerTask';
import {
  WoodType,
  getWoodItems,
  planksToLog,
  type WoodItems,
  DyeColor,
} from '../../utils/ItemHelper';

/**
 * Simple crafting recipe representation
 */
export interface CraftingSlot {
  /** Item names that can fill this slot */
  items: string[];
  /** Count needed in this slot */
  count: number;
}

/**
 * Simple crafting recipe
 */
export interface CraftingRecipe {
  /** Recipe slots (length 4 for 2x2, 9 for 3x3) */
  slots: (CraftingSlot | null)[];
  /** Output item count */
  outputCount: number;
  /** Whether this recipe needs a crafting table (3x3) */
  isBig: boolean;
}

/**
 * Helper to create a crafting slot
 */
export function craftSlot(items: string | string[], count: number = 1): CraftingSlot {
  return {
    items: Array.isArray(items) ? items : [items],
    count,
  };
}

/**
 * Abstract base class for crafting with matching materials
 */
export abstract class CraftWithMatchingMaterialsTask extends ResourceTask {
  protected targetItem: ItemTarget;
  protected recipe: CraftingRecipe;
  protected sameMask: boolean[];

  /** Items that must match (e.g., all wool variants) */
  protected sameResourceItems: string[];
  /** How many "same" items needed per recipe */
  protected sameResourcePerRecipe: number;

  constructor(
    bot: Bot,
    target: ItemTarget,
    recipe: CraftingRecipe,
    sameMask: boolean[]
  ) {
    super(bot, [target]);
    this.targetItem = target;
    this.recipe = recipe;
    this.sameMask = sameMask;

    // Calculate same resource requirements
    let sameCount = 0;
    let sameItems: string[] = [];

    if (recipe.slots.length !== sameMask.length) {
      console.error('CraftWithMatchingMaterialsTask: Recipe size must equal sameMask size');
    }

    for (let i = 0; i < recipe.slots.length; i++) {
      if (sameMask[i] && recipe.slots[i]) {
        sameCount++;
        sameItems = recipe.slots[i]!.items;
      }
    }

    this.sameResourceItems = sameItems;
    this.sameResourcePerRecipe = sameCount;
  }

  onResourceStart(): void {
    // Nothing special on start
  }

  onResourceTick(): Task | null {
    // Calculate crafting possibilities for each material variant
    let canCraftTotal = 0;
    let majorityCraftCount = 0;
    let majorityItem: string | null = null;

    for (const sameItem of this.sameResourceItems) {
      const count = this.getExpectedTotalCountOfSameItem(sameItem);
      const canCraft = Math.floor(count / this.sameResourcePerRecipe) * this.recipe.outputCount;
      canCraftTotal += canCraft;

      if (canCraft > majorityCraftCount) {
        majorityCraftCount = canCraft;
        majorityItem = sameItem;
      }
    }

    // How many more do we need?
    const currentCount = this.countItems(this.targetItem.items);
    const needed = this.targetItem.targetCount - currentCount;

    if (needed <= 0) {
      // Already have enough
      return null;
    }

    if (canCraftTotal >= needed && majorityItem) {
      // We have enough materials to craft!
      // But first check if we need to convert raw materials
      let trueCanCraft = 0;
      for (const sameItem of this.sameResourceItems) {
        const trueCount = this.countItem(sameItem);
        trueCanCraft += Math.floor(trueCount / this.sameResourcePerRecipe) * this.recipe.outputCount;
      }

      if (trueCanCraft < needed) {
        // Need to convert raw materials (e.g., logs to planks)
        return this.getConvertRawMaterialsTask();
      }

      // Generate recipe with specific material
      const specificRecipe = this.generateSpecificRecipe(majorityItem);
      const toCraft = Math.min(majorityCraftCount + currentCount, this.targetItem.targetCount);
      const outputItem = this.getOutputItemForMaterial(majorityItem);

      // Create crafting task
      if (this.recipe.isBig) {
        return this.createCraftInTableTask(outputItem, toCraft, specificRecipe);
      } else {
        return this.createCraftInInventoryTask(outputItem, toCraft, specificRecipe);
      }
    }

    // Need to collect more materials
    return this.getCollectMaterialsTask();
  }

  onResourceStop(interruptTask: ITask | null): void {
    // Nothing special on stop
  }

  /**
   * Generate a recipe that uses a specific material variant
   */
  private generateSpecificRecipe(specificItem: string): CraftingRecipe {
    const newSlots = this.recipe.slots.map((slot, i) => {
      if (this.sameMask[i] && slot) {
        return craftSlot(specificItem, slot.count);
      }
      return slot;
    });

    return {
      slots: newSlots,
      outputCount: this.recipe.outputCount,
      isBig: this.recipe.isBig,
    };
  }

  /**
   * Count total items matching any of the given names
   */
  protected countItems(names: string[]): number {
    let total = 0;
    for (const name of names) {
      total += this.countItem(name);
    }
    return total;
  }

  /**
   * Count items of a specific name
   */
  protected countItem(name: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === name) {
        count += item.count;
      }
    }
    return count;
  }

  // ---- Abstract/Virtual methods ----

  /**
   * Get expected total count including convertible raw materials
   * Override to include logs that can become planks, etc.
   */
  protected getExpectedTotalCountOfSameItem(sameItem: string): number {
    return this.countItem(sameItem);
  }

  /**
   * Get task to collect more materials
   */
  protected abstract getCollectMaterialsTask(): Task | null;

  /**
   * Get task to convert raw materials (e.g., logs to planks)
   */
  protected abstract getConvertRawMaterialsTask(): Task | null;

  /**
   * Get the output item name for the given material
   * E.g., for oak_planks, return oak_fence
   */
  protected abstract getOutputItemForMaterial(material: string): string;

  /**
   * Create a crafting table task
   */
  protected abstract createCraftInTableTask(
    outputItem: string,
    count: number,
    recipe: CraftingRecipe
  ): Task | null;

  /**
   * Create an inventory crafting task
   */
  protected abstract createCraftInInventoryTask(
    outputItem: string,
    count: number,
    recipe: CraftingRecipe
  ): Task | null;

  protected isEqualResource(other: ResourceTask): boolean {
    if (!(other instanceof CraftWithMatchingMaterialsTask)) return false;
    return JSON.stringify(this.targetItem) === JSON.stringify(other.targetItem);
  }
}

// ============================================================================
// Concrete Implementations
// ============================================================================

/**
 * All plank types
 */
const ALL_PLANKS = [
  'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks',
  'acacia_planks', 'dark_oak_planks', 'crimson_planks', 'warped_planks',
  'mangrove_planks', 'cherry_planks', 'bamboo_planks',
];

/**
 * CraftWithMatchingPlanksTask - Craft items requiring matching planks
 *
 * Handles recipes like fences, doors, signs, etc. that need
 * planks of the same wood type.
 */
export class CraftWithMatchingPlanksTask extends CraftWithMatchingMaterialsTask {
  private outputMapping: Map<string, string>;

  /**
   * @param bot The mineflayer bot
   * @param outputItems All valid output items (e.g., all fence types)
   * @param outputMapping Maps plank type to output item (e.g., oak_planks -> oak_fence)
   * @param recipe The crafting recipe
   * @param sameMask Which slots need matching materials
   * @param count Target count to craft
   */
  constructor(
    bot: Bot,
    outputItems: string[],
    outputMapping: Map<string, string>,
    recipe: CraftingRecipe,
    sameMask: boolean[],
    count: number
  ) {
    super(bot, itemTarget(outputItems, count), recipe, sameMask);
    this.outputMapping = outputMapping;
    this.sameResourceItems = ALL_PLANKS;
  }

  get displayName(): string {
    return `CraftWithPlanks(${this.targetItem.items[0]}, x${this.targetItem.targetCount})`;
  }

  protected getExpectedTotalCountOfSameItem(plankType: string): number {
    // Include logs that can be converted to planks
    const logType = planksToLog(plankType);
    const plankCount = this.countItem(plankType);
    const logCount = logType ? this.countItem(logType) * 4 : 0;
    return plankCount + logCount;
  }

  protected getCollectMaterialsTask(): Task | null {
    // TODO: Implement log collection task
    // For now, return null (task will re-check on next tick)
    return null;
  }

  protected getConvertRawMaterialsTask(): Task | null {
    // Find any logs we can convert
    for (const plankType of ALL_PLANKS) {
      const logType = planksToLog(plankType);
      if (logType && this.countItem(logType) >= 1) {
        // TODO: Return task to craft planks from logs
        return null;
      }
    }
    return null;
  }

  protected getOutputItemForMaterial(plankType: string): string {
    return this.outputMapping.get(plankType) ?? this.targetItem.items[0];
  }

  protected createCraftInTableTask(
    outputItem: string,
    count: number,
    recipe: CraftingRecipe
  ): Task | null {
    // TODO: Integrate with existing CraftInTableTask
    // For now, return null to indicate "keep trying"
    return null;
  }

  protected createCraftInInventoryTask(
    outputItem: string,
    count: number,
    recipe: CraftingRecipe
  ): Task | null {
    // TODO: Integrate with existing CraftInInventoryTask
    // For now, return null to indicate "keep trying"
    return null;
  }
}

/**
 * All wool colors
 */
const ALL_WOOL = [
  'white_wool', 'orange_wool', 'magenta_wool', 'light_blue_wool',
  'yellow_wool', 'lime_wool', 'pink_wool', 'gray_wool',
  'light_gray_wool', 'cyan_wool', 'purple_wool', 'blue_wool',
  'brown_wool', 'green_wool', 'red_wool', 'black_wool',
];

/**
 * CraftWithMatchingWoolTask - Craft items requiring matching wool
 *
 * Handles recipes like beds that need wool of the same color.
 */
export class CraftWithMatchingWoolTask extends CraftWithMatchingMaterialsTask {
  private outputMapping: Map<string, string>;

  /**
   * @param bot The mineflayer bot
   * @param outputItems All valid output items (e.g., all bed colors)
   * @param outputMapping Maps wool type to output item (e.g., white_wool -> white_bed)
   * @param recipe The crafting recipe
   * @param sameMask Which slots need matching materials
   * @param count Target count to craft
   */
  constructor(
    bot: Bot,
    outputItems: string[],
    outputMapping: Map<string, string>,
    recipe: CraftingRecipe,
    sameMask: boolean[],
    count: number
  ) {
    super(bot, itemTarget(outputItems, count), recipe, sameMask);
    this.outputMapping = outputMapping;
    this.sameResourceItems = ALL_WOOL;
  }

  get displayName(): string {
    return `CraftWithWool(${this.targetItem.items[0]}, x${this.targetItem.targetCount})`;
  }

  protected getCollectMaterialsTask(): Task | null {
    // TODO: Implement wool collection (shear sheep, etc.)
    return null;
  }

  protected getConvertRawMaterialsTask(): Task | null {
    // Wool doesn't have raw material conversion like logs->planks
    return null;
  }

  protected getOutputItemForMaterial(woolType: string): string {
    return this.outputMapping.get(woolType) ?? this.targetItem.items[0];
  }

  protected createCraftInTableTask(
    outputItem: string,
    count: number,
    recipe: CraftingRecipe
  ): Task | null {
    // TODO: Integrate with existing CraftInTableTask
    // For now, return null to indicate "keep trying"
    return null;
  }

  protected createCraftInInventoryTask(
    outputItem: string,
    count: number,
    recipe: CraftingRecipe
  ): Task | null {
    // TODO: Integrate with existing CraftInInventoryTask
    // For now, return null to indicate "keep trying"
    return null;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a bed crafting task (requires 3x3 table)
 */
export function craftBed(bot: Bot, count: number = 1): CraftWithMatchingWoolTask {
  const outputItems = ALL_WOOL.map(w => w.replace('_wool', '_bed'));

  const outputMapping = new Map<string, string>();
  for (const wool of ALL_WOOL) {
    outputMapping.set(wool, wool.replace('_wool', '_bed'));
  }

  // Bed recipe: 3 wool on top, 3 planks on bottom
  const recipe: CraftingRecipe = {
    slots: [
      craftSlot(ALL_WOOL), craftSlot(ALL_WOOL), craftSlot(ALL_WOOL),
      craftSlot(ALL_PLANKS), craftSlot(ALL_PLANKS), craftSlot(ALL_PLANKS),
      null, null, null,
    ],
    outputCount: 1,
    isBig: true,
  };

  // Wool slots (0, 1, 2) must match
  const sameMask = [true, true, true, false, false, false, false, false, false];

  return new CraftWithMatchingWoolTask(bot, outputItems, outputMapping, recipe, sameMask, count);
}

/**
 * Create a fence crafting task
 */
export function craftFence(bot: Bot, count: number = 1): CraftWithMatchingPlanksTask {
  const outputItems = ALL_PLANKS.map(p => p.replace('_planks', '_fence'));

  const outputMapping = new Map<string, string>();
  for (const plank of ALL_PLANKS) {
    outputMapping.set(plank, plank.replace('_planks', '_fence'));
  }

  // Fence recipe: plank-stick-plank on two rows
  const recipe: CraftingRecipe = {
    slots: [
      craftSlot(ALL_PLANKS), craftSlot('stick'), craftSlot(ALL_PLANKS),
      craftSlot(ALL_PLANKS), craftSlot('stick'), craftSlot(ALL_PLANKS),
      null, null, null,
    ],
    outputCount: 3,
    isBig: true,
  };

  // Plank slots (0, 2, 3, 5) must match
  const sameMask = [true, false, true, true, false, true, false, false, false];

  return new CraftWithMatchingPlanksTask(bot, outputItems, outputMapping, recipe, sameMask, count);
}

export default {
  CraftWithMatchingMaterialsTask,
  CraftWithMatchingPlanksTask,
  CraftWithMatchingWoolTask,
  craftBed,
  craftFence,
  craftSlot,
};
