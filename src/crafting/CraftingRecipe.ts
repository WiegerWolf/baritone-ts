/**
 * CraftingRecipe - Recipe Representation
 * Based on AltoClef's CraftingRecipe.java
 *
 * Represents a Minecraft crafting recipe with:
 * - Multiple ingredient alternatives (ItemTarget)
 * - 2x2 (inventory) vs 3x3 (crafting table) support
 * - Shaped vs shapeless recipes
 * - Recipe quantity calculations
 */

import { ItemTarget } from '../utils/ItemTarget';

/**
 * Grid size for crafting
 */
export enum CraftingGridSize {
  INVENTORY = 2,  // 2x2 grid in player inventory
  TABLE = 3,      // 3x3 grid in crafting table
}

/**
 * Crafting recipe representation
 */
export class CraftingRecipe {
  /** Result item name */
  readonly result: string;

  /** Number of items produced per craft */
  readonly resultCount: number;

  /** Ingredients for the recipe (can have alternatives via ItemTarget) */
  readonly ingredients: (ItemTarget | null)[];

  /** Recipe width (1-3) */
  readonly width: number;

  /** Recipe height (1-3) */
  readonly height: number;

  /** Whether the recipe is shapeless (order doesn't matter) */
  readonly shapeless: boolean;

  /** Unique recipe key (for vanilla recipe lookup) */
  readonly recipeKey: string;

  constructor(params: {
    result: string;
    resultCount?: number;
    ingredients: (ItemTarget | null | string | string[])[];
    width: number;
    height: number;
    shapeless?: boolean;
    recipeKey?: string;
  }) {
    this.result = params.result;
    this.resultCount = params.resultCount ?? 1;
    this.width = params.width;
    this.height = params.height;
    this.shapeless = params.shapeless ?? false;
    this.recipeKey = params.recipeKey ?? params.result;

    // Normalize ingredients to ItemTarget or null
    this.ingredients = params.ingredients.map(ing => {
      if (ing === null) return null;
      if (ing instanceof ItemTarget) return ing;
      if (typeof ing === 'string') return new ItemTarget([ing]);
      if (Array.isArray(ing)) return new ItemTarget(ing);
      return null;
    });

    // Validate
    const expectedSlots = this.width * this.height;
    if (this.ingredients.length !== expectedSlots) {
      throw new Error(
        `Recipe ${this.result}: expected ${expectedSlots} ingredients, got ${this.ingredients.length}`
      );
    }
  }

  /**
   * Check if recipe can be crafted in player inventory (2x2)
   */
  canCraftInInventory(): boolean {
    return this.width <= 2 && this.height <= 2;
  }

  /**
   * Check if recipe requires crafting table (3x3)
   */
  requiresCraftingTable(): boolean {
    return this.width > 2 || this.height > 2;
  }

  /**
   * Get minimum grid size required
   */
  getMinimumGridSize(): CraftingGridSize {
    return this.requiresCraftingTable()
      ? CraftingGridSize.TABLE
      : CraftingGridSize.INVENTORY;
  }

  /**
   * Get ingredients expanded to full grid (3x3 or 2x2)
   */
  getSlots(gridSize: CraftingGridSize = CraftingGridSize.TABLE): (ItemTarget | null)[] {
    const totalSlots = gridSize * gridSize;
    const result: (ItemTarget | null)[] = new Array(totalSlots).fill(null);

    // Place ingredients in grid
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const srcIndex = y * this.width + x;
        const dstIndex = y * gridSize + x;
        result[dstIndex] = this.ingredients[srcIndex];
      }
    }

    return result;
  }

  /**
   * Get all unique items required (for gathering)
   */
  getUniqueIngredients(): ItemTarget[] {
    const unique: ItemTarget[] = [];
    const seen = new Set<string>();

    for (const ingredient of this.ingredients) {
      if (!ingredient) continue;

      const key = ingredient.getItemNames().sort().join(',');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(ingredient);
      }
    }

    return unique;
  }

  /**
   * Count how many of each ingredient is needed
   */
  getIngredientCounts(): Map<ItemTarget, number> {
    const counts = new Map<ItemTarget, number>();

    for (const ingredient of this.ingredients) {
      if (!ingredient) continue;

      // Find matching ItemTarget in map
      let found = false;
      for (const [key, count] of counts) {
        if (this.targetsMatch(key, ingredient)) {
          counts.set(key, count + 1);
          found = true;
          break;
        }
      }

      if (!found) {
        counts.set(ingredient, 1);
      }
    }

    return counts;
  }

  /**
   * Check if two item targets match the same items
   */
  private targetsMatch(a: ItemTarget, b: ItemTarget): boolean {
    const aNames = a.getItemNames().sort();
    const bNames = b.getItemNames().sort();
    if (aNames.length !== bNames.length) return false;
    return aNames.every((name, i) => name === bNames[i]);
  }

  /**
   * String representation
   */
  toString(): string {
    return `CraftingRecipe(${this.result} x${this.resultCount})`;
  }
}

/**
 * Recipe target - wraps a recipe with desired output count
 */
export class RecipeTarget {
  readonly recipe: CraftingRecipe;
  readonly targetCount: number;

  constructor(recipe: CraftingRecipe, targetCount: number) {
    this.recipe = recipe;
    this.targetCount = targetCount;
  }

  /**
   * Calculate crafts needed to reach target count
   */
  getCraftsNeeded(currentCount: number = 0): number {
    const need = this.targetCount - currentCount;
    if (need <= 0) return 0;
    return Math.ceil(need / this.recipe.resultCount);
  }

  /**
   * Get total ingredients needed for all crafts
   */
  getTotalIngredients(currentCount: number = 0): Map<ItemTarget, number> {
    const crafts = this.getCraftsNeeded(currentCount);
    const perCraft = this.recipe.getIngredientCounts();
    const total = new Map<ItemTarget, number>();

    for (const [ingredient, count] of perCraft) {
      total.set(ingredient, count * crafts);
    }

    return total;
  }

  /**
   * Check if we have enough ingredients for at least one craft
   */
  canCraftOnce(ingredientChecker: (target: ItemTarget) => number): boolean {
    const counts = this.recipe.getIngredientCounts();

    for (const [ingredient, needed] of counts) {
      const have = ingredientChecker(ingredient);
      if (have < needed) return false;
    }

    return true;
  }

  /**
   * String representation
   */
  toString(): string {
    return `RecipeTarget(${this.recipe.result} x${this.targetCount})`;
  }
}

/**
 * Common crafting recipes
 */
export const COMMON_RECIPES: Record<string, CraftingRecipe> = {};

// Wood processing
COMMON_RECIPES.oak_planks = new CraftingRecipe({
  result: 'oak_planks',
  resultCount: 4,
  ingredients: ['oak_log'],
  width: 1,
  height: 1,
});

COMMON_RECIPES.birch_planks = new CraftingRecipe({
  result: 'birch_planks',
  resultCount: 4,
  ingredients: ['birch_log'],
  width: 1,
  height: 1,
});

COMMON_RECIPES.spruce_planks = new CraftingRecipe({
  result: 'spruce_planks',
  resultCount: 4,
  ingredients: ['spruce_log'],
  width: 1,
  height: 1,
});

COMMON_RECIPES.stick = new CraftingRecipe({
  result: 'stick',
  resultCount: 4,
  ingredients: [
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
  ],
  width: 1,
  height: 2,
});

// Crafting table
COMMON_RECIPES.crafting_table = new CraftingRecipe({
  result: 'crafting_table',
  resultCount: 1,
  ingredients: [
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
  ],
  width: 2,
  height: 2,
});

// Furnace
COMMON_RECIPES.furnace = new CraftingRecipe({
  result: 'furnace',
  resultCount: 1,
  ingredients: [
    'cobblestone', 'cobblestone', 'cobblestone',
    'cobblestone', null, 'cobblestone',
    'cobblestone', 'cobblestone', 'cobblestone',
  ],
  width: 3,
  height: 3,
});

// Chest
COMMON_RECIPES.chest = new CraftingRecipe({
  result: 'chest',
  resultCount: 1,
  ingredients: [
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    null,
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
  ],
  width: 3,
  height: 3,
});

// Wooden pickaxe
COMMON_RECIPES.wooden_pickaxe = new CraftingRecipe({
  result: 'wooden_pickaxe',
  resultCount: 1,
  ingredients: [
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    null, 'stick', null,
    null, 'stick', null,
  ],
  width: 3,
  height: 3,
});

// Stone pickaxe
COMMON_RECIPES.stone_pickaxe = new CraftingRecipe({
  result: 'stone_pickaxe',
  resultCount: 1,
  ingredients: [
    ['cobblestone', 'blackstone', 'cobbled_deepslate'],
    ['cobblestone', 'blackstone', 'cobbled_deepslate'],
    ['cobblestone', 'blackstone', 'cobbled_deepslate'],
    null, 'stick', null,
    null, 'stick', null,
  ],
  width: 3,
  height: 3,
});

// Iron pickaxe
COMMON_RECIPES.iron_pickaxe = new CraftingRecipe({
  result: 'iron_pickaxe',
  resultCount: 1,
  ingredients: [
    'iron_ingot', 'iron_ingot', 'iron_ingot',
    null, 'stick', null,
    null, 'stick', null,
  ],
  width: 3,
  height: 3,
});

// Diamond pickaxe
COMMON_RECIPES.diamond_pickaxe = new CraftingRecipe({
  result: 'diamond_pickaxe',
  resultCount: 1,
  ingredients: [
    'diamond', 'diamond', 'diamond',
    null, 'stick', null,
    null, 'stick', null,
  ],
  width: 3,
  height: 3,
});

// Wooden sword
COMMON_RECIPES.wooden_sword = new CraftingRecipe({
  result: 'wooden_sword',
  resultCount: 1,
  ingredients: [
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    'stick',
  ],
  width: 1,
  height: 3,
});

// Stone sword
COMMON_RECIPES.stone_sword = new CraftingRecipe({
  result: 'stone_sword',
  resultCount: 1,
  ingredients: [
    ['cobblestone', 'blackstone', 'cobbled_deepslate'],
    ['cobblestone', 'blackstone', 'cobbled_deepslate'],
    'stick',
  ],
  width: 1,
  height: 3,
});

// Iron sword
COMMON_RECIPES.iron_sword = new CraftingRecipe({
  result: 'iron_sword',
  resultCount: 1,
  ingredients: [
    'iron_ingot',
    'iron_ingot',
    'stick',
  ],
  width: 1,
  height: 3,
});

// Diamond sword
COMMON_RECIPES.diamond_sword = new CraftingRecipe({
  result: 'diamond_sword',
  resultCount: 1,
  ingredients: [
    'diamond',
    'diamond',
    'stick',
  ],
  width: 1,
  height: 3,
});

// Torch
COMMON_RECIPES.torch = new CraftingRecipe({
  result: 'torch',
  resultCount: 4,
  ingredients: [
    ['coal', 'charcoal'],
    'stick',
  ],
  width: 1,
  height: 2,
});

// Bucket
COMMON_RECIPES.bucket = new CraftingRecipe({
  result: 'bucket',
  resultCount: 1,
  ingredients: [
    'iron_ingot', null, 'iron_ingot',
    null, 'iron_ingot', null,
  ],
  width: 3,
  height: 2,
});

// Shield
COMMON_RECIPES.shield = new CraftingRecipe({
  result: 'shield',
  resultCount: 1,
  ingredients: [
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    'iron_ingot',
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    null,
    ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
    null,
  ],
  width: 3,
  height: 3,
});

// Bread
COMMON_RECIPES.bread = new CraftingRecipe({
  result: 'bread',
  resultCount: 1,
  ingredients: ['wheat', 'wheat', 'wheat'],
  width: 3,
  height: 1,
});

// Boat
COMMON_RECIPES.oak_boat = new CraftingRecipe({
  result: 'oak_boat',
  resultCount: 1,
  ingredients: [
    'oak_planks', null, 'oak_planks',
    'oak_planks', 'oak_planks', 'oak_planks',
  ],
  width: 3,
  height: 2,
});

/**
 * Get recipe by item name
 */
export function getRecipe(itemName: string): CraftingRecipe | null {
  return COMMON_RECIPES[itemName] ?? null;
}

/**
 * Check if item is craftable
 */
export function isCraftable(itemName: string): boolean {
  return itemName in COMMON_RECIPES;
}

/**
 * Register a custom recipe
 */
export function registerRecipe(recipe: CraftingRecipe): void {
  COMMON_RECIPES[recipe.result] = recipe;
}
