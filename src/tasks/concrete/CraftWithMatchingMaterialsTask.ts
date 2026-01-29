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

export default {
  CraftWithMatchingMaterialsTask,
  craftSlot,
};
