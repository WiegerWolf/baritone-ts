/**
 * RecipeTarget - Crafting Recipe Target
 * Based on BaritonePlus RecipeTarget.java
 *
 * Wraps a crafting recipe with its output item and target count.
 * Used by crafting tasks to specify what to craft and how many.
 */

import type { CraftingRecipe } from '../tasks/concrete/CraftWithMatchingMaterialsTask';

/**
 * RecipeTarget - Represents a crafting target with recipe
 */
export class RecipeTarget {
  /** The crafting recipe */
  private readonly recipe: CraftingRecipe;

  /** The output item name */
  private readonly outputItem: string;

  /** Number of items to craft */
  private readonly targetCount: number;

  /**
   * Create a recipe target
   * @param outputItem The item name that this recipe produces
   * @param targetCount Number of items to craft
   * @param recipe The crafting recipe to use
   */
  constructor(outputItem: string, targetCount: number, recipe: CraftingRecipe) {
    this.outputItem = outputItem;
    this.targetCount = targetCount;
    this.recipe = recipe;
  }

  /**
   * Get the crafting recipe
   */
  getRecipe(): CraftingRecipe {
    return this.recipe;
  }

  /**
   * Get the output item name
   */
  getOutputItem(): string {
    return this.outputItem;
  }

  /**
   * Get the target count
   */
  getTargetCount(): number {
    return this.targetCount;
  }

  /**
   * Calculate how many crafting operations needed
   */
  getCraftingOperationsNeeded(): number {
    return Math.ceil(this.targetCount / this.recipe.outputCount);
  }

  /**
   * Check if this recipe requires a crafting table (3x3)
   */
  requiresCraftingTable(): boolean {
    return this.recipe.isBig;
  }

  /**
   * Get all input items required for one crafting operation
   */
  getInputItems(): Map<string, number> {
    const inputs = new Map<string, number>();

    for (const slot of this.recipe.slots) {
      if (slot) {
        // For slots with multiple valid items, use the first one as representative
        const item = slot.items[0];
        const current = inputs.get(item) || 0;
        inputs.set(item, current + slot.count);
      }
    }

    return inputs;
  }

  /**
   * Get all input items required for the target count
   */
  getTotalInputItems(): Map<string, number> {
    const inputs = this.getInputItems();
    const operations = this.getCraftingOperationsNeeded();
    const total = new Map<string, number>();

    for (const [item, count] of inputs) {
      total.set(item, count * operations);
    }

    return total;
  }

  /**
   * Create a string representation
   */
  toString(): string {
    return `RecipeTarget(${this.outputItem} x${this.targetCount})`;
  }

  /**
   * Check equality with another RecipeTarget
   */
  equals(other: RecipeTarget): boolean {
    return (
      this.outputItem === other.outputItem &&
      this.targetCount === other.targetCount &&
      this.recipeEquals(other.recipe)
    );
  }

  /**
   * Check if recipes are equal
   */
  private recipeEquals(other: CraftingRecipe): boolean {
    if (this.recipe.outputCount !== other.outputCount) return false;
    if (this.recipe.isBig !== other.isBig) return false;
    if (this.recipe.slots.length !== other.slots.length) return false;

    for (let i = 0; i < this.recipe.slots.length; i++) {
      const a = this.recipe.slots[i];
      const b = other.slots[i];

      if (a === null && b === null) continue;
      if (a === null || b === null) return false;
      if (a.count !== b.count) return false;
      if (a.items.length !== b.items.length) return false;

      const sortedA = [...a.items].sort();
      const sortedB = [...b.items].sort();
      for (let j = 0; j < sortedA.length; j++) {
        if (sortedA[j] !== sortedB[j]) return false;
      }
    }

    return true;
  }
}

/**
 * Create a RecipeTarget for a simple recipe with one input type
 */
export function simpleRecipeTarget(
  outputItem: string,
  targetCount: number,
  inputItem: string,
  inputCount: number,
  outputPerCraft: number = 1,
  isBig: boolean = false
): RecipeTarget {
  const slots: (import('../tasks/concrete/CraftWithMatchingMaterialsTask').CraftingSlot | null)[] = [];
  const gridSize = isBig ? 9 : 4;

  // Fill slots with the input item
  for (let i = 0; i < inputCount; i++) {
    slots.push({ items: [inputItem], count: 1 });
  }

  // Fill remaining with null
  while (slots.length < gridSize) {
    slots.push(null);
  }

  return new RecipeTarget(outputItem, targetCount, {
    slots,
    outputCount: outputPerCraft,
    isBig,
  });
}

export default RecipeTarget;
