/**
 * ThrowCursorTask - Throw the item in cursor slot
 * Based on AltoClef's slot tasks
 *
 * Dispose of unwanted items by throwing them out of the inventory.
 * Used when cursor needs to be cleared and item is garbage.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { SlotActionType, SlotConstants } from './ClickSlotTask';

/**
 * Task to throw the item currently in cursor slot
 *
 * Intent: Dispose of unwanted items by throwing them out of the inventory.
 * Used when cursor needs to be cleared and item is garbage.
 */
export class ThrowCursorTask extends Task {
  private thrown: boolean = false;

  constructor(bot: Bot) {
    super(bot);
  }

  get displayName(): string {
    return 'ThrowCursor';
  }

  onStart(): void {
    this.thrown = false;
  }

  onTick(): Task | null {
    const cursor = (this.bot.inventory as any).cursor;
    if (!cursor) {
      this.thrown = true;
      return null;
    }

    try {
      // Click outside inventory to throw
      this.bot.clickWindow(SlotConstants.CURSOR, 0, SlotActionType.PICKUP);
      this.thrown = true;
    } catch (err) {
      // Will retry
    }

    return null;
  }

  isFinished(): boolean {
    return this.thrown || !(this.bot.inventory as any).cursor;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof ThrowCursorTask;
  }
}
