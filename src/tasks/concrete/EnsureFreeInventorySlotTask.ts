/**
 * EnsureFreeInventorySlotTask - Ensure free space in inventory
 * Based on AltoClef's slot tasks
 *
 * Before picking up items or crafting, we need inventory space.
 * This task ensures at least one slot is free by throwing garbage or
 * organizing the inventory.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ClickSlotTask, SlotActionType } from './ClickSlotTask';
import { EnsureFreeCursorSlotTask } from './EnsureFreeCursorSlotTask';

/**
 * Task to ensure there's free space in inventory
 *
 * Intent: Before picking up items or crafting, we need inventory space.
 * This task ensures at least one slot is free by throwing garbage or
 * organizing the inventory.
 */
export class EnsureFreeInventorySlotTask extends Task {
  private finished: boolean = false;
  private preserveItems: string[];

  /**
   * @param bot The mineflayer bot
   * @param preserveItems Item names that should never be thrown away
   */
  constructor(bot: Bot, preserveItems: string[] = []) {
    super(bot);
    this.preserveItems = preserveItems;
  }

  get displayName(): string {
    return 'EnsureFreeInventorySlot';
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    // Check if we already have a free slot
    if (this.bot.inventory.firstEmptyInventorySlot() !== null) {
      this.finished = true;
      return null;
    }

    // First ensure cursor is empty
    const cursor = (this.bot.inventory as any).cursor;
    if (cursor) {
      return new EnsureFreeCursorSlotTask(this.bot);
    }

    // Find garbage to throw
    const garbageSlot = this.findGarbageToThrow();
    if (garbageSlot !== null) {
      // Pick up the garbage then throw it
      return new ClickSlotTask(this.bot, garbageSlot, 0, SlotActionType.PICKUP);
    }

    // No obvious garbage - can't free space without throwing something valuable
    this.finished = true;
    return null;
  }

  isFinished(): boolean {
    return this.finished || this.bot.inventory.firstEmptyInventorySlot() !== null;
  }

  private findGarbageToThrow(): number | null {
    const garbageItems = [
      'dirt', 'cobblestone', 'cobbled_deepslate', 'gravel', 'sand',
      'rotten_flesh', 'spider_eye', 'bone', 'string',
      'feather', 'wheat_seeds', 'beetroot_seeds', 'poisonous_potato',
      'netherrack', 'diorite', 'granite', 'andesite', 'tuff',
    ];

    for (const item of this.bot.inventory.items()) {
      // Skip preserved items
      if (this.preserveItems.some(p => item.name.includes(p))) {
        continue;
      }

      if (garbageItems.some(g => item.name.includes(g))) {
        return item.slot;
      }
    }
    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof EnsureFreeInventorySlotTask)) return false;
    return JSON.stringify(this.preserveItems) === JSON.stringify(other.preserveItems);
  }
}
