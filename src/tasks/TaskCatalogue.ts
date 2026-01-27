/**
 * TaskCatalogue - Item to Task Mapping
 * Based on AltoClef's TaskCatalogue.java
 *
 * Provides the ability to create tasks for obtaining items through:
 * - Crafting (using recipes)
 * - Mining (from source blocks)
 * - Smelting (furnace recipes)
 * - Other acquisition methods
 *
 * This enables recursive crafting: to craft a pickaxe, you need sticks,
 * which require planks, which require logs.
 */

import type { Bot } from 'mineflayer';
import { Task } from './Task';
import { ResourceTask, MineAndCollectTask, ITEM_SOURCE_BLOCKS } from './ResourceTask';
import { ItemTarget } from '../utils/ItemTarget';
import { getRecipe, CraftingRecipe, RecipeTarget, COMMON_RECIPES, isCraftable } from '../crafting/CraftingRecipe';

/**
 * Task provider function signature
 */
export type TaskProvider = (bot: Bot, itemName: string, count: number) => Task | null;

/**
 * Smelting recipe representation
 */
export interface SmeltingRecipe {
  input: string[];  // Any of these inputs
  output: string;
  outputCount: number;
  fuel?: string[];  // Required fuel (optional for blast furnace)
}

/**
 * Common smelting recipes
 */
export const SMELTING_RECIPES: Record<string, SmeltingRecipe> = {
  iron_ingot: {
    input: ['raw_iron', 'iron_ore', 'deepslate_iron_ore'],
    output: 'iron_ingot',
    outputCount: 1,
  },
  gold_ingot: {
    input: ['raw_gold', 'gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
    output: 'gold_ingot',
    outputCount: 1,
  },
  copper_ingot: {
    input: ['raw_copper', 'copper_ore', 'deepslate_copper_ore'],
    output: 'copper_ingot',
    outputCount: 1,
  },
  glass: {
    input: ['sand', 'red_sand'],
    output: 'glass',
    outputCount: 1,
  },
  stone: {
    input: ['cobblestone'],
    output: 'stone',
    outputCount: 1,
  },
  smooth_stone: {
    input: ['stone'],
    output: 'smooth_stone',
    outputCount: 1,
  },
  charcoal: {
    input: ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'],
    output: 'charcoal',
    outputCount: 1,
  },
  brick: {
    input: ['clay_ball'],
    output: 'brick',
    outputCount: 1,
  },
  cooked_beef: {
    input: ['beef'],
    output: 'cooked_beef',
    outputCount: 1,
  },
  cooked_porkchop: {
    input: ['porkchop'],
    output: 'cooked_porkchop',
    outputCount: 1,
  },
  cooked_chicken: {
    input: ['chicken'],
    output: 'cooked_chicken',
    outputCount: 1,
  },
  cooked_mutton: {
    input: ['mutton'],
    output: 'cooked_mutton',
    outputCount: 1,
  },
  cooked_cod: {
    input: ['cod'],
    output: 'cooked_cod',
    outputCount: 1,
  },
  cooked_salmon: {
    input: ['salmon'],
    output: 'cooked_salmon',
    outputCount: 1,
  },
  baked_potato: {
    input: ['potato'],
    output: 'baked_potato',
    outputCount: 1,
  },
  dried_kelp: {
    input: ['kelp'],
    output: 'dried_kelp',
    outputCount: 1,
  },
};

/**
 * Get smelting recipe for an item
 */
export function getSmeltingRecipe(itemName: string): SmeltingRecipe | null {
  return SMELTING_RECIPES[itemName] ?? null;
}

/**
 * TaskCatalogue - Central registry for item acquisition tasks
 */
export class TaskCatalogue {
  private bot: Bot;
  private customProviders: Map<string, TaskProvider> = new Map();

  constructor(bot: Bot) {
    this.bot = bot;
  }

  /**
   * Get a task to acquire the specified item
   */
  getItemTask(itemName: string, count: number): Task | null {
    // 1. Check custom providers first
    const customProvider = this.customProviders.get(itemName);
    if (customProvider) {
      const task = customProvider(this.bot, itemName, count);
      if (task) return task;
    }

    // 2. Check if craftable
    const recipe = getRecipe(itemName);
    if (recipe) {
      return this.createCraftTask(recipe, count);
    }

    // 3. Check if smeltable
    const smeltRecipe = getSmeltingRecipe(itemName);
    if (smeltRecipe) {
      return this.createSmeltTask(smeltRecipe, count);
    }

    // 4. Check if minable
    const sourceBlocks = ITEM_SOURCE_BLOCKS[itemName];
    if (sourceBlocks) {
      return this.createMineTask(itemName, count, sourceBlocks);
    }

    // 5. Cannot obtain this item
    return null;
  }

  /**
   * Get a task to acquire items matching an ItemTarget
   */
  getItemTargetTask(target: ItemTarget): Task | null {
    // Try each item name until one works
    for (const itemName of target.getItemNames()) {
      const task = this.getItemTask(itemName, target.targetCount);
      if (task) return task;
    }
    return null;
  }

  /**
   * Check if an item can be obtained
   */
  canObtain(itemName: string): boolean {
    return (
      this.customProviders.has(itemName) ||
      isCraftable(itemName) ||
      getSmeltingRecipe(itemName) !== null ||
      itemName in ITEM_SOURCE_BLOCKS
    );
  }

  /**
   * Get the acquisition method for an item
   */
  getAcquisitionMethod(itemName: string): 'craft' | 'smelt' | 'mine' | 'custom' | null {
    if (this.customProviders.has(itemName)) return 'custom';
    if (isCraftable(itemName)) return 'craft';
    if (getSmeltingRecipe(itemName)) return 'smelt';
    if (itemName in ITEM_SOURCE_BLOCKS) return 'mine';
    return null;
  }

  /**
   * Register a custom task provider for an item
   */
  registerProvider(itemName: string, provider: TaskProvider): void {
    this.customProviders.set(itemName, provider);
  }

  /**
   * Remove a custom task provider
   */
  unregisterProvider(itemName: string): boolean {
    return this.customProviders.delete(itemName);
  }

  /**
   * Get all obtainable items
   */
  getObtainableItems(): string[] {
    const items = new Set<string>();

    // Custom providers
    for (const item of this.customProviders.keys()) {
      items.add(item);
    }

    // Craftable items
    for (const item of Object.keys(COMMON_RECIPES)) {
      items.add(item);
    }

    // Smeltable items
    for (const item of Object.keys(SMELTING_RECIPES)) {
      items.add(item);
    }

    // Minable items
    for (const item of Object.keys(ITEM_SOURCE_BLOCKS)) {
      items.add(item);
    }

    return Array.from(items).sort();
  }

  // ---- Task Creation ----

  /**
   * Create a crafting task
   * Note: This is a placeholder - actual implementation would
   * use CraftInTableTask or similar
   */
  private createCraftTask(recipe: CraftingRecipe, count: number): Task {
    // For now, return a placeholder task
    // Actual implementation would:
    // 1. Check if can craft in inventory or need table
    // 2. Gather ingredients (recursively using this catalogue)
    // 3. Place items in grid
    // 4. Click result
    return new CraftItemPlaceholderTask(this.bot, recipe, count);
  }

  /**
   * Create a smelting task
   * Note: This is a placeholder
   */
  private createSmeltTask(recipe: SmeltingRecipe, count: number): Task {
    return new SmeltItemPlaceholderTask(this.bot, recipe, count);
  }

  /**
   * Create a mining task
   */
  private createMineTask(itemName: string, count: number, sourceBlocks: string[]): Task {
    const target = new ItemTarget([itemName], count);
    const sourceMap = new Map<string, string[]>();
    sourceMap.set(itemName, sourceBlocks);

    const task = new MineAndCollectTask(this.bot, [target], sourceMap);
    return task;
  }
}

/**
 * Placeholder task for crafting (actual implementation would be more complex)
 */
class CraftItemPlaceholderTask extends Task {
  private recipe: CraftingRecipe;
  private targetCount: number;

  constructor(bot: Bot, recipe: CraftingRecipe, targetCount: number) {
    super(bot);
    this.recipe = recipe;
    this.targetCount = targetCount;
  }

  get displayName(): string {
    return `Craft(${this.recipe.result} x${this.targetCount})`;
  }

  onTick(): Task | null {
    // Placeholder: would implement actual crafting logic
    // 1. Check if need crafting table
    // 2. Gather ingredients (recursive)
    // 3. Open crafting interface
    // 4. Place items
    // 5. Click result
    return null;
  }

  isFinished(): boolean {
    // Check if we have enough of the result item
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === this.recipe.result) {
        count += item.count;
      }
    }
    return count >= this.targetCount;
  }
}

/**
 * Placeholder task for smelting
 */
class SmeltItemPlaceholderTask extends Task {
  private recipe: SmeltingRecipe;
  private targetCount: number;

  constructor(bot: Bot, recipe: SmeltingRecipe, targetCount: number) {
    super(bot);
    this.recipe = recipe;
    this.targetCount = targetCount;
  }

  get displayName(): string {
    return `Smelt(${this.recipe.output} x${this.targetCount})`;
  }

  onTick(): Task | null {
    // Placeholder: would implement actual smelting logic
    // 1. Find or place furnace
    // 2. Gather input items
    // 3. Gather fuel
    // 4. Open furnace
    // 5. Place items
    // 6. Wait for smelting
    // 7. Collect result
    return null;
  }

  isFinished(): boolean {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === this.recipe.output) {
        count += item.count;
      }
    }
    return count >= this.targetCount;
  }
}

/**
 * Create a TaskCatalogue for a bot
 */
export function createTaskCatalogue(bot: Bot): TaskCatalogue {
  return new TaskCatalogue(bot);
}

/**
 * Get acquisition chain for an item (for debugging/display)
 * Returns the chain of items needed to craft something
 */
export function getAcquisitionChain(
  itemName: string,
  visited: Set<string> = new Set()
): string[] {
  const chain: string[] = [itemName];

  // Prevent infinite recursion
  if (visited.has(itemName)) return chain;
  visited.add(itemName);

  // Check if craftable
  const recipe = getRecipe(itemName);
  if (recipe) {
    const ingredients = recipe.getUniqueIngredients();
    for (const ing of ingredients) {
      const ingName = ing.getItemNames()[0]; // Take first alternative
      const subChain = getAcquisitionChain(ingName, visited);
      chain.push(...subChain.map(s => '  ' + s));
    }
  }

  // Check if smeltable
  const smeltRecipe = getSmeltingRecipe(itemName);
  if (smeltRecipe) {
    const inputName = smeltRecipe.input[0];
    const subChain = getAcquisitionChain(inputName, visited);
    chain.push(...subChain.map(s => '  ' + s));
    chain.push('  ' + '(fuel)');
  }

  return chain;
}
