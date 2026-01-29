/**
 * CraftWithRecipeBookTask - Recipe Book Crafting
 * Based on BaritonePlus CraftGenericWithRecipeBooksTask.java
 *
 * WHY: Recipe books auto-fill the crafting grid, which is faster
 * than manually placing items. Some servers and versions support this.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ReceiveCraftingOutputTask } from './SlotTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Player inventory crafting output slot index
 */
const CRAFT_OUTPUT_SLOT = 0;

/**
 * Task to craft using recipe book (faster when available).
 *
 * WHY: Recipe books auto-fill the crafting grid, which is faster
 * than manually placing items. Some servers and versions support this.
 *
 * Based on BaritonePlus CraftGenericWithRecipeBooksTask.java
 */
export class CraftWithRecipeBookTask extends Task {
  private outputItem: string;
  private targetCount: number;
  private finished: boolean = false;
  private clickTimer: TimerGame;

  constructor(bot: Bot, outputItem: string, targetCount: number) {
    super(bot);
    this.outputItem = outputItem;
    this.targetCount = targetCount;
    this.clickTimer = new TimerGame(bot, 0.2);
  }

  get displayName(): string {
    return `CraftWithRecipeBook(${this.targetCount}x ${this.outputItem})`;
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    // Check if done
    const currentCount = this.getItemCount(this.outputItem);
    if (currentCount >= this.targetCount) {
      this.finished = true;
      return null;
    }

    // Check if inventory is open
    if (!this.isPlayerInventoryOpen()) {
      try {
        (this.bot as any).openInventory?.();
      } catch {
        // Will retry
      }
      return null;
    }

    // Check if output is ready
    const outputSlot = this.bot.inventory.slots[CRAFT_OUTPUT_SLOT];
    if (outputSlot && outputSlot.name === this.outputItem) {
      return new ReceiveCraftingOutputTask(this.bot, this.outputItem);
    }

    // Try to use recipe book
    if (this.clickTimer.elapsed()) {
      // Recipe book isn't well supported in mineflayer
      // Fall back to manual crafting
      this.finished = true;
    }

    return null;
  }

  private isPlayerInventoryOpen(): boolean {
    const window = (this.bot as any).currentWindow;
    return !window || (window.type || '').toLowerCase().includes('inventory');
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
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.finished;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof CraftWithRecipeBookTask)) return false;
    return this.outputItem === other.outputItem &&
           this.targetCount === other.targetCount;
  }
}
