/**
 * EnsureItemTask - Ensure Item Availability
 *
 * Task to ensure we have enough of an item, crafting if necessary.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { getRecipe } from '../../crafting/CraftingRecipe';
import { CraftTask } from './CraftTask';

/**
 * Task to ensure we have enough of an item, crafting if necessary
 */
export class EnsureItemTask extends Task {
  private itemName: string;
  private count: number;

  constructor(bot: Bot, itemName: string, count: number = 1) {
    super(bot);
    this.itemName = itemName;
    this.count = count;
  }

  get displayName(): string {
    return `EnsureItem(${this.count}x ${this.itemName})`;
  }

  onTick(): Task | null {
    const have = this.getItemCount(this.itemName);
    if (have >= this.count) {
      return null; // Done
    }

    // Try to craft
    const recipe = getRecipe(this.itemName);
    if (recipe) {
      return new CraftTask(this.bot, this.itemName, this.count);
    }

    return null; // Can't craft - need other method
  }

  isFinished(): boolean {
    return this.getItemCount(this.itemName) >= this.count;
  }

  private getItemCount(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName) {
        count += item.count;
      }
    }
    return count;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof EnsureItemTask)) return false;
    return this.itemName === other.itemName && this.count === other.count;
  }
}
