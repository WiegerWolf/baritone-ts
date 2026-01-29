/**
 * ReceiveCraftingOutputTask - Receive crafting output
 * Based on AltoClef's slot tasks
 *
 * After setting up a recipe in the crafting grid, this task
 * clicks the output slot to retrieve the crafted item.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { SlotActionType } from './ClickSlotTask';
import { EnsureFreeCursorSlotTask } from './EnsureFreeCursorSlotTask';

/**
 * Task to receive crafting output from crafting grid
 *
 * Intent: After setting up a recipe in the crafting grid, this task
 * clicks the output slot to retrieve the crafted item.
 */
export class ReceiveCraftingOutputTask extends Task {
  private received: boolean = false;
  private targetItem: string | null;

  /**
   * @param bot The mineflayer bot
   * @param targetItem Optional item name to verify (if null, accepts any output)
   */
  constructor(bot: Bot, targetItem: string | null = null) {
    super(bot);
    this.targetItem = targetItem;
  }

  get displayName(): string {
    return `ReceiveCraftOutput(${this.targetItem ?? 'any'})`;
  }

  onStart(): void {
    this.received = false;
  }

  onTick(): Task | null {
    // Check if there's an output
    const outputSlot = this.bot.inventory.slots[0];
    if (!outputSlot) {
      // No output ready
      return null;
    }

    // Verify item if specified
    if (this.targetItem && outputSlot.name !== this.targetItem) {
      return null;
    }

    // First ensure cursor is empty
    const cursor = (this.bot.inventory as any).cursor;
    if (cursor) {
      return new EnsureFreeCursorSlotTask(this.bot);
    }

    // Shift-click to move to inventory
    try {
      this.bot.clickWindow(0, 0, SlotActionType.QUICK_MOVE);
      this.received = true;
    } catch (err) {
      // Will retry
    }

    return null;
  }

  isFinished(): boolean {
    return this.received;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ReceiveCraftingOutputTask)) return false;
    return this.targetItem === other.targetItem;
  }
}
