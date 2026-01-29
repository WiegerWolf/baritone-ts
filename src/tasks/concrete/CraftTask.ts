/**
 * CraftTask - Crafting Tasks
 * Based on AltoClef's crafting system
 *
 * Tasks for crafting items at crafting tables or in inventory.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { GetToBlockTask } from './GetToBlockTask';
import { CraftingRecipe, getRecipe, RecipeTarget, CraftingGridSize } from '../../crafting/CraftingRecipe';
import { ItemTarget } from '../../utils/ItemTarget';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for crafting operation
 */
enum CraftState {
  CHECKING_INGREDIENTS,
  GOING_TO_TABLE,
  OPENING_TABLE,
  CRAFTING,
  COLLECTING,
  FINISHED,
  FAILED
}

/**
 * Task to craft an item
 */
export class CraftTask extends Task {
  private itemName: string;
  private count: number;
  private recipe: CraftingRecipe | null;
  private state: CraftState = CraftState.CHECKING_INGREDIENTS;
  private craftingTimer: TimerGame;
  private craftingTablePos: Vec3 | null = null;
  private crafted: number = 0;

  constructor(bot: Bot, itemName: string, count: number = 1) {
    super(bot);
    this.itemName = itemName;
    this.count = count;
    this.recipe = getRecipe(itemName);
    this.craftingTimer = new TimerGame(bot, 0.5);
  }

  get displayName(): string {
    return `Craft(${this.count}x ${this.itemName})`;
  }

  onStart(): void {
    this.state = CraftState.CHECKING_INGREDIENTS;
    this.crafted = 0;
    this.craftingTablePos = null;
  }

  onTick(): Task | null {
    // Check if we have enough
    const currentCount = this.getItemCount(this.itemName);
    if (currentCount >= this.count) {
      this.state = CraftState.FINISHED;
      return null;
    }

    // Check if recipe exists
    if (!this.recipe) {
      this.state = CraftState.FAILED;
      return null;
    }

    switch (this.state) {
      case CraftState.CHECKING_INGREDIENTS:
        return this.handleCheckingIngredients();

      case CraftState.GOING_TO_TABLE:
        return this.handleGoingToTable();

      case CraftState.OPENING_TABLE:
        return this.handleOpeningTable();

      case CraftState.CRAFTING:
        return this.handleCrafting();

      case CraftState.COLLECTING:
        return this.handleCollecting();

      default:
        return null;
    }
  }

  private handleCheckingIngredients(): Task | null {
    if (!this.recipe) {
      this.state = CraftState.FAILED;
      return null;
    }

    // Check if we have all ingredients
    const recipeTarget = new RecipeTarget(this.recipe, this.count);
    const neededCount = this.count - this.getItemCount(this.itemName);
    const craftsNeeded = recipeTarget.getCraftsNeeded(this.getItemCount(this.itemName));

    for (const [ingredient, countPerCraft] of this.recipe.getIngredientCounts()) {
      const have = this.getIngredientCount(ingredient);
      const need = countPerCraft * craftsNeeded;

      if (have < need) {
        // Don't have enough - task should be abandoned
        // Parent task should gather ingredients
        this.state = CraftState.FAILED;
        return null;
      }
    }

    // Check if we need a crafting table
    if (this.recipe.requiresCraftingTable()) {
      this.craftingTablePos = this.findNearestCraftingTable();
      if (!this.craftingTablePos) {
        // No crafting table - need to make or find one
        this.state = CraftState.FAILED;
        return null;
      }
      this.state = CraftState.GOING_TO_TABLE;
    } else {
      // Can craft in inventory
      this.state = CraftState.CRAFTING;
    }

    return null;
  }

  private handleGoingToTable(): Task | null {
    if (!this.craftingTablePos) {
      this.state = CraftState.FAILED;
      return null;
    }

    // Check if we're close enough
    const dist = this.bot.entity.position.distanceTo(this.craftingTablePos);
    if (dist <= 4.0) {
      this.state = CraftState.OPENING_TABLE;
      return null;
    }

    // Go to the crafting table
    return new GetToBlockTask(
      this.bot,
      Math.floor(this.craftingTablePos.x),
      Math.floor(this.craftingTablePos.y),
      Math.floor(this.craftingTablePos.z)
    );
  }

  private handleOpeningTable(): Task | null {
    if (!this.craftingTablePos) {
      this.state = CraftState.FAILED;
      return null;
    }

    // Open crafting table
    const block = this.bot.blockAt(this.craftingTablePos);
    if (!block || block.name !== 'crafting_table') {
      this.state = CraftState.FAILED;
      return null;
    }

    try {
      // Activate the crafting table
      this.bot.activateBlock(block);
      this.state = CraftState.CRAFTING;
      this.craftingTimer.reset();
    } catch (err) {
      this.state = CraftState.FAILED;
    }

    return null;
  }

  private handleCrafting(): Task | null {
    if (!this.craftingTimer.elapsed()) {
      return null; // Wait between craft attempts
    }

    if (!this.recipe) {
      this.state = CraftState.FAILED;
      return null;
    }

    const currentCount = this.getItemCount(this.itemName);
    if (currentCount >= this.count) {
      this.state = CraftState.FINISHED;
      return null;
    }

    // Try to craft using mineflayer-crafting patterns
    try {
      // Get the mineflayer recipe format
      const mcData = require('minecraft-data')(this.bot.version);
      const itemData = mcData.itemsByName[this.itemName];
      if (!itemData) {
        this.state = CraftState.FAILED;
        return null;
      }

      // recipesFor takes (itemType, metadata, minResultCount, craftingTable)
      const craftingTable = this.craftingTablePos ?
        this.bot.blockAt(this.craftingTablePos) : null;

      const recipes = this.bot.recipesFor(itemData.id, null, 1, craftingTable ?? false);

      if (recipes && recipes.length > 0) {
        // bot.craft returns a promise
        this.bot.craft(recipes[0], 1, craftingTable || undefined).then(() => {
          this.crafted++;
        }).catch(() => {
          // Will retry
        });
      } else {
        // No recipe found in mineflayer
        this.state = CraftState.FAILED;
        return null;
      }
    } catch (err) {
      // Crafting failed
      this.state = CraftState.FAILED;
      return null;
    }

    this.craftingTimer.reset();

    // Check if done
    if (this.getItemCount(this.itemName) >= this.count) {
      this.state = CraftState.FINISHED;
    }

    return null;
  }

  private handleCollecting(): Task | null {
    // Close crafting window if open
    try {
      if (this.bot.currentWindow) {
        this.bot.closeWindow(this.bot.currentWindow);
      }
    } catch {
      // Ignore
    }

    this.state = CraftState.FINISHED;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Close any open windows
    try {
      if (this.bot.currentWindow) {
        this.bot.closeWindow(this.bot.currentWindow);
      }
    } catch {
      // Ignore
    }
  }

  isFinished(): boolean {
    return this.state === CraftState.FINISHED || this.state === CraftState.FAILED;
  }

  /**
   * Check if crafting failed
   */
  isFailed(): boolean {
    return this.state === CraftState.FAILED;
  }

  /**
   * Get count of item in inventory
   */
  private getItemCount(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName || item.name.includes(itemName)) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Get count of items matching an ItemTarget
   */
  private getIngredientCount(ingredient: ItemTarget): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (ingredient.matches(item.name)) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Find nearest crafting table
   */
  private findNearestCraftingTable(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const maxRange = 32;

    let nearest: Vec3 | null = null;
    let nearestDist = Infinity;

    for (let x = -maxRange; x <= maxRange; x += 4) {
      for (let y = -maxRange; y <= maxRange; y += 4) {
        for (let z = -maxRange; z <= maxRange; z += 4) {
          // Check a smaller area within this chunk
          for (let dx = 0; dx < 4; dx++) {
            for (let dy = 0; dy < 4; dy++) {
              for (let dz = 0; dz < 4; dz++) {
                const pos = playerPos.offset(x + dx, y + dy, z + dz);
                const block = this.bot.blockAt(pos);

                if (block && block.name === 'crafting_table') {
                  const dist = playerPos.distanceTo(pos);
                  if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = pos;
                  }
                }
              }
            }
          }
        }
      }
    }

    return nearest;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof CraftTask)) return false;
    return this.itemName === other.itemName && this.count === other.count;
  }
}
