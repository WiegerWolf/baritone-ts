/**
 * EnsureFreeCursorSlotTask - Clear the cursor slot
 * Based on AltoClef's slot tasks
 *
 * Many inventory operations require an empty cursor slot first.
 * This task clears the cursor by finding a place to put the item or
 * throwing it away if it's garbage.
 */

import type { Bot } from 'mineflayer';
import type { Item } from 'prismarine-item';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';
import { ClickSlotTask, SlotActionType } from './ClickSlotTask';
import { ThrowCursorTask } from './ThrowCursorTask';

/**
 * Task to ensure the cursor slot is empty
 *
 * Intent: Many inventory operations require an empty cursor slot first.
 * This task clears the cursor by finding a place to put the item or
 * throwing it away if it's garbage.
 */
export class EnsureFreeCursorSlotTask extends Task {
  private finished: boolean = false;
  private cooldown: TimerGame;

  constructor(bot: Bot) {
    super(bot);
    this.cooldown = new TimerGame(bot, 0.05);
  }

  get displayName(): string {
    return 'EnsureFreeCursorSlot';
  }

  onStart(): void {
    this.finished = false;
    this.cooldown.forceElapsed();
  }

  onTick(): Task | null {
    // Check if cursor is already empty
    const cursor = this.getCursorItem();
    if (!cursor) {
      this.finished = true;
      return null;
    }

    if (!this.cooldown.elapsed()) return null;

    // Try to find a slot to put the item
    const emptySlot = this.findEmptySlot();
    if (emptySlot !== null) {
      return new ClickSlotTask(this.bot, emptySlot, 0, SlotActionType.PICKUP);
    }

    // Try to stack with existing items
    const stackSlot = this.findStackableSlot(cursor);
    if (stackSlot !== null) {
      return new ClickSlotTask(this.bot, stackSlot, 0, SlotActionType.PICKUP);
    }

    // If it's garbage, throw it away
    if (this.isGarbage(cursor)) {
      return new ThrowCursorTask(this.bot);
    }

    // Find any garbage slot to swap with
    const garbageSlot = this.findGarbageSlot();
    if (garbageSlot !== null) {
      return new ClickSlotTask(this.bot, garbageSlot, 0, SlotActionType.PICKUP);
    }

    // Last resort: throw it away
    return new ThrowCursorTask(this.bot);
  }

  isFinished(): boolean {
    return this.finished || !this.getCursorItem();
  }

  private getCursorItem(): Item | null {
    // mineflayer stores cursor item in inventory.cursor
    const inv = this.bot.inventory as any;
    return inv.cursor || null;
  }

  private findEmptySlot(): number | null {
    const slot = this.bot.inventory.firstEmptyInventorySlot();
    return slot !== null ? slot : null;
  }

  private findStackableSlot(item: Item): number | null {
    for (const invItem of this.bot.inventory.items()) {
      if (
        invItem.name === item.name &&
        invItem.count < invItem.stackSize
      ) {
        return invItem.slot;
      }
    }
    return null;
  }

  private findGarbageSlot(): number | null {
    const garbageItems = [
      'dirt', 'cobblestone', 'gravel', 'sand', 'rotten_flesh',
      'spider_eye', 'bone', 'string', 'gunpowder',
      'feather', 'wheat_seeds', 'beetroot_seeds',
    ];

    for (const item of this.bot.inventory.items()) {
      if (garbageItems.some(g => item.name.includes(g))) {
        return item.slot;
      }
    }
    return null;
  }

  private isGarbage(item: Item): boolean {
    const garbageItems = [
      'dirt', 'cobblestone', 'gravel', 'sand', 'rotten_flesh',
      'spider_eye', 'poisonous_potato', 'pufferfish',
    ];
    return garbageItems.some(g => item.name.includes(g));
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof EnsureFreeCursorSlotTask;
  }
}
