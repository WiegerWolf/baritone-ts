/**
 * EnsureFreePlayerCraftingGridTask - Clear the player's crafting grid
 * Based on AltoClef's slot tasks
 *
 * Before crafting or closing inventory, we should move items
 * out of the crafting grid so they don't get lost.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ClickSlotTask, SlotActionType } from './ClickSlotTask';
import { EnsureFreeCursorSlotTask } from './EnsureFreeCursorSlotTask';

/**
 * Task to ensure the player's 2x2 crafting grid is empty
 *
 * Intent: Before crafting or closing inventory, we should move items
 * out of the crafting grid so they don't get lost.
 */
export class EnsureFreePlayerCraftingGridTask extends Task {
  private finished: boolean = false;

  constructor(bot: Bot) {
    super(bot);
  }

  get displayName(): string {
    return 'EnsureFreeCraftingGrid';
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    // Check crafting slots (1-4 in player inventory)
    let hasItems = false;

    for (let slot = 1; slot <= 4; slot++) {
      const item = this.bot.inventory.slots[slot];
      if (item) {
        hasItems = true;

        // First ensure cursor is empty
        const cursor = (this.bot.inventory as any).cursor;
        if (cursor) {
          return new EnsureFreeCursorSlotTask(this.bot);
        }

        // Pick up the item from crafting slot
        return new ClickSlotTask(this.bot, slot, 0, SlotActionType.QUICK_MOVE);
      }
    }

    this.finished = !hasItems;
    return null;
  }

  isFinished(): boolean {
    return this.finished;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof EnsureFreePlayerCraftingGridTask;
  }
}
