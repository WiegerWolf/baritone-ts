/**
 * CraftInInventoryTask - Inventory Crafting Tasks
 * Based on BaritonePlus's crafting system
 *
 * WHY: The 2x2 crafting grid in the player inventory is the fastest
 * way to craft simple items. No need to find or place a crafting table.
 *
 * These tasks handle:
 * - Opening the inventory
 * - Placing items in the 2x2 grid
 * - Receiving crafted output
 * - Handling recipe book for faster crafting (when available)
 *
 * This enables:
 * - Quick crafting of planks from logs
 * - Making sticks
 * - Simple tool/item recipes
 */

import type { Bot } from 'mineflayer';
import type { Item } from 'prismarine-item';
import type { Window } from 'prismarine-windows';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import {
  ReceiveCraftingOutputTask,
  MoveItemToSlotTask,
  EnsureFreePlayerCraftingGridTask,
} from './SlotTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Recipe slot for 2x2 crafting
 */
export interface RecipeSlot {
  /** Item(s) that can go in this slot */
  items: string | string[];
  /** Count needed per craft */
  count: number;
}

/**
 * Recipe definition for 2x2 crafting
 */
export interface InventoryRecipe {
  /** Output item name */
  output: string;
  /** Output count per craft */
  outputCount: number;
  /** Slots (0-3 for 2x2 grid, left to right, top to bottom) */
  slots: (RecipeSlot | null)[];
}

/**
 * Recipe target - what to craft and how many
 */
export interface InventoryRecipeTarget {
  /** Recipe to use */
  recipe: InventoryRecipe;
  /** Target count to have */
  targetCount: number;
}

/**
 * Player inventory crafting slot indices
 * The 2x2 grid slots in mineflayer:
 * - Slot 1: Top-left
 * - Slot 2: Top-right
 * - Slot 3: Bottom-left
 * - Slot 4: Bottom-right
 * - Slot 0: Output
 */
const CRAFT_INPUT_SLOTS = [1, 2, 3, 4];
const CRAFT_OUTPUT_SLOT = 0;

/**
 * Common 2x2 recipes
 */
export const INVENTORY_RECIPES = {
  // Planks from logs
  oak_planks: {
    output: 'oak_planks',
    outputCount: 4,
    slots: [{ items: 'oak_log', count: 1 }, null, null, null],
  } as InventoryRecipe,

  spruce_planks: {
    output: 'spruce_planks',
    outputCount: 4,
    slots: [{ items: 'spruce_log', count: 1 }, null, null, null],
  } as InventoryRecipe,

  birch_planks: {
    output: 'birch_planks',
    outputCount: 4,
    slots: [{ items: 'birch_log', count: 1 }, null, null, null],
  } as InventoryRecipe,

  // Sticks
  stick: {
    output: 'stick',
    outputCount: 4,
    slots: [
      { items: ['oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks', 'mangrove_planks', 'cherry_planks', 'bamboo_planks', 'crimson_planks', 'warped_planks'], count: 1 },
      null,
      { items: ['oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks', 'mangrove_planks', 'cherry_planks', 'bamboo_planks', 'crimson_planks', 'warped_planks'], count: 1 },
      null,
    ],
  } as InventoryRecipe,

  // Crafting table
  crafting_table: {
    output: 'crafting_table',
    outputCount: 1,
    slots: [
      { items: ['oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks', 'mangrove_planks', 'cherry_planks', 'bamboo_planks', 'crimson_planks', 'warped_planks'], count: 1 },
      { items: ['oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks', 'mangrove_planks', 'cherry_planks', 'bamboo_planks', 'crimson_planks', 'warped_planks'], count: 1 },
      { items: ['oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks', 'mangrove_planks', 'cherry_planks', 'bamboo_planks', 'crimson_planks', 'warped_planks'], count: 1 },
      { items: ['oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks', 'mangrove_planks', 'cherry_planks', 'bamboo_planks', 'crimson_planks', 'warped_planks'], count: 1 },
    ],
  } as InventoryRecipe,

  // Torches (coal + stick pattern fits in 2x2)
  torch: {
    output: 'torch',
    outputCount: 4,
    slots: [
      { items: ['coal', 'charcoal'], count: 1 },
      null,
      { items: 'stick', count: 1 },
      null,
    ],
  } as InventoryRecipe,
};

/**
 * Crafting state
 */
enum CraftingState {
  OPENING_INVENTORY,
  CLEARING_GRID,
  PLACING_ITEMS,
  RECEIVING_OUTPUT,
  FINISHED,
  FAILED,
}

/**
 * Task to craft items using the 2x2 inventory grid.
 *
 * WHY: Quick crafting without needing a crafting table.
 * This handles:
 * 1. Opening the inventory
 * 2. Clearing the crafting grid if items are present
 * 3. Placing ingredients in correct slots
 * 4. Collecting the output
 *
 * Based on BaritonePlus CraftInInventoryTask.java
 */
export class CraftInInventoryTask extends Task {
  private target: InventoryRecipeTarget;
  private state: CraftingState = CraftingState.OPENING_INVENTORY;
  private clickTimer: TimerGame;
  private currentSlotIndex: number = 0;
  private crafted: number = 0;

  constructor(bot: Bot, target: InventoryRecipeTarget) {
    super(bot);
    this.target = target;
    this.clickTimer = new TimerGame(bot, 0.1);
  }

  /**
   * Create task to craft a specific item count
   */
  static craft(bot: Bot, outputItem: string, count: number): CraftInInventoryTask | null {
    // Find recipe
    const recipe = Object.values(INVENTORY_RECIPES).find(r => r.output === outputItem);
    if (!recipe) return null;

    return new CraftInInventoryTask(bot, {
      recipe,
      targetCount: count,
    });
  }

  get displayName(): string {
    return `CraftInInventory(${this.target.targetCount}x ${this.target.recipe.output})`;
  }

  onStart(): void {
    this.state = CraftingState.OPENING_INVENTORY;
    this.currentSlotIndex = 0;
    this.crafted = 0;
  }

  onTick(): Task | null {
    // Check if we have enough already
    const currentCount = this.getItemCount(this.target.recipe.output);
    if (currentCount >= this.target.targetCount) {
      this.state = CraftingState.FINISHED;
      return null;
    }

    switch (this.state) {
      case CraftingState.OPENING_INVENTORY:
        return this.handleOpeningInventory();

      case CraftingState.CLEARING_GRID:
        return this.handleClearingGrid();

      case CraftingState.PLACING_ITEMS:
        return this.handlePlacingItems();

      case CraftingState.RECEIVING_OUTPUT:
        return this.handleReceivingOutput();

      default:
        return null;
    }
  }

  private handleOpeningInventory(): Task | null {
    // Check if inventory is open
    if (!this.isPlayerInventoryOpen()) {
      // Open inventory
      try {
        (this.bot as any).openInventory?.();
      } catch {
        // Will retry
      }
      return null;
    }

    // Check if crafting grid has items
    if (this.craftingGridHasItems()) {
      this.state = CraftingState.CLEARING_GRID;
      return null;
    }

    // Check if we have ingredients
    if (!this.hasIngredients()) {
      this.state = CraftingState.FAILED;
      return null;
    }

    this.state = CraftingState.PLACING_ITEMS;
    this.currentSlotIndex = 0;
    return null;
  }

  private handleClearingGrid(): Task | null {
    return new EnsureFreePlayerCraftingGridTask(this.bot);
  }

  private handlePlacingItems(): Task | null {
    const recipe = this.target.recipe;
    const craftsNeeded = this.getCraftsNeeded();

    // Go through each slot
    while (this.currentSlotIndex < recipe.slots.length) {
      const slotDef = recipe.slots[this.currentSlotIndex];
      const targetSlot = CRAFT_INPUT_SLOTS[this.currentSlotIndex];

      if (!slotDef) {
        // Slot should be empty
        this.currentSlotIndex++;
        continue;
      }

      // Check current slot contents
      const slotItem = this.getSlotItem(targetSlot);
      const neededCount = slotDef.count * craftsNeeded;

      const validItems = Array.isArray(slotDef.items) ? slotDef.items : [slotDef.items];
      const correctItem = slotItem && validItems.some(name =>
        slotItem.name === name || slotItem.name.includes(name)
      );
      const hasEnough = slotItem && slotItem.count >= neededCount;

      if (correctItem && hasEnough) {
        // Slot is good
        this.currentSlotIndex++;
        continue;
      }

      // Need to fill this slot - find item in inventory and move it
      const sourceSlot = this.findInventorySlotWithItem(validItems);
      if (sourceSlot === null) {
        // Can't find item - fail
        this.state = CraftingState.FAILED;
        return null;
      }
      return new MoveItemToSlotTask(this.bot, sourceSlot, targetSlot);
    }

    // All slots filled, check for output
    this.state = CraftingState.RECEIVING_OUTPUT;
    return null;
  }

  private handleReceivingOutput(): Task | null {
    // Check if output is ready
    const outputItem = this.getSlotItem(CRAFT_OUTPUT_SLOT);

    if (outputItem && outputItem.name === this.target.recipe.output) {
      return new ReceiveCraftingOutputTask(this.bot, this.target.recipe.output);
    }

    // Check if done
    const currentCount = this.getItemCount(this.target.recipe.output);
    if (currentCount >= this.target.targetCount) {
      this.state = CraftingState.FINISHED;
      return null;
    }

    // Need to craft more
    this.state = CraftingState.PLACING_ITEMS;
    this.currentSlotIndex = 0;
    return null;
  }

  private isPlayerInventoryOpen(): boolean {
    const window = (this.bot as any).currentWindow;
    // Inventory is considered "open" if no other window is open
    // or if it's the player inventory type
    return !window || (window.type || '').toLowerCase().includes('inventory');
  }

  private craftingGridHasItems(): boolean {
    for (const slot of CRAFT_INPUT_SLOTS) {
      const item = this.getSlotItem(slot);
      if (item) return true;
    }
    return false;
  }

  private hasIngredients(): boolean {
    const craftsNeeded = this.getCraftsNeeded();

    for (const slotDef of this.target.recipe.slots) {
      if (!slotDef) continue;

      const validItems = Array.isArray(slotDef.items) ? slotDef.items : [slotDef.items];
      const needed = slotDef.count * craftsNeeded;

      let have = 0;
      for (const item of this.bot.inventory.items()) {
        if (validItems.some(name => item.name === name || item.name.includes(name))) {
          have += item.count;
        }
      }

      if (have < needed) return false;
    }

    return true;
  }

  private getCraftsNeeded(): number {
    const currentCount = this.getItemCount(this.target.recipe.output);
    const needed = this.target.targetCount - currentCount;
    return Math.ceil(needed / this.target.recipe.outputCount);
  }

  private getSlotItem(slot: number): Item | null {
    return this.bot.inventory.slots[slot] || null;
  }

  private findInventorySlotWithItem(validItems: string[]): number | null {
    // Search inventory slots (not crafting grid or armor)
    // Slots 9-35 are main inventory, 36-44 are hotbar
    for (let slot = 9; slot < 45; slot++) {
      const item = this.bot.inventory.slots[slot];
      if (item && validItems.some(name => item.name === name || item.name.includes(name))) {
        return slot;
      }
    }
    return null;
  }

  private getItemCount(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName || item.name.includes(itemName)) {
        count += item.count;
      }
    }
    return count;
  }

  onStop(interruptTask: ITask | null): void {
    // Close inventory if open
    const window = (this.bot as any).currentWindow;
    if (window) {
      try {
        this.bot.closeWindow(window);
      } catch {
        // Ignore
      }
    }
  }

  isFinished(): boolean {
    return this.state === CraftingState.FINISHED || this.state === CraftingState.FAILED;
  }

  isFailed(): boolean {
    return this.state === CraftingState.FAILED;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof CraftInInventoryTask)) return false;
    return this.target.recipe.output === other.target.recipe.output &&
           this.target.targetCount === other.target.targetCount;
  }
}

/**
 * Convenience function to craft planks from logs
 */
export function craftPlanks(bot: Bot, logType: string, count: number): CraftInInventoryTask {
  const plankType = logType.replace('_log', '_planks').replace('_wood', '_planks');
  const recipe = INVENTORY_RECIPES[plankType as keyof typeof INVENTORY_RECIPES] ||
    INVENTORY_RECIPES.oak_planks;

  // Adjust recipe for the specific log type
  const adjustedRecipe: InventoryRecipe = {
    ...recipe,
    output: plankType,
    slots: [{ items: logType, count: 1 }, null, null, null],
  };

  return new CraftInInventoryTask(bot, {
    recipe: adjustedRecipe,
    targetCount: count,
  });
}

/**
 * Convenience function to craft sticks
 */
export function craftSticks(bot: Bot, count: number): CraftInInventoryTask {
  return new CraftInInventoryTask(bot, {
    recipe: INVENTORY_RECIPES.stick,
    targetCount: count,
  });
}

/**
 * Convenience function to craft a crafting table
 */
export function craftCraftingTable(bot: Bot): CraftInInventoryTask {
  return new CraftInInventoryTask(bot, {
    recipe: INVENTORY_RECIPES.crafting_table,
    targetCount: 1,
  });
}
