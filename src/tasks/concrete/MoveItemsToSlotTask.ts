/**
 * MoveItemsToSlotTask - Move items matching criteria to a slot
 * Based on BaritonePlus MoveItemToSlotTask.java
 *
 * This is more sophisticated than simple slot-to-slot moves - it searches
 * for items matching criteria and moves the appropriate amount.
 */

import type { Bot } from 'mineflayer';
import type { Item } from 'prismarine-item';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ClickSlotTask, SlotActionType } from './ClickSlotTask';
import { EnsureFreeCursorSlotTask } from './EnsureFreeCursorSlotTask';

/**
 * Item matching function type
 */
export type ItemMatcher = (item: Item) => boolean;

/**
 * Create an item matcher for specific item names
 */
export function matchItemNames(...names: string[]): ItemMatcher {
  const nameSet = new Set(names);
  return (item: Item) => nameSet.has(item.name);
}

/**
 * Enhanced task to move items matching criteria to a destination slot
 *
 * Based on BaritonePlus MoveItemToSlotTask.java
 * This is more sophisticated than simple slot-to-slot moves - it searches
 * for items matching criteria and moves the appropriate amount.
 */
export class MoveItemsToSlotTask extends Task {
  protected itemMatcher: ItemMatcher;
  protected destSlot: number;
  protected targetCount: number;
  protected getSourceSlots: () => number[];
  private phase: 'searching' | 'pickup' | 'place' | 'done' = 'searching';
  private currentSourceSlot: number | null = null;

  /**
   * @param bot The mineflayer bot
   * @param itemMatcher Function to check if an item matches
   * @param destSlot Destination slot number
   * @param targetCount How many items to move (1 for single, or total count)
   * @param getSourceSlots Function returning slots to search for items
   */
  constructor(
    bot: Bot,
    itemMatcher: ItemMatcher,
    destSlot: number,
    targetCount: number = 1,
    getSourceSlots?: () => number[]
  ) {
    super(bot);
    this.itemMatcher = itemMatcher;
    this.destSlot = destSlot;
    this.targetCount = targetCount;
    this.getSourceSlots = getSourceSlots ?? (() => this.getAllInventorySlots());
  }

  get displayName(): string {
    return `MoveItemsToSlot(dest=${this.destSlot}, count=${this.targetCount})`;
  }

  onStart(): void {
    this.phase = 'searching';
    this.currentSourceSlot = null;
  }

  onTick(): Task | null {
    switch (this.phase) {
      case 'searching':
        return this.handleSearching();

      case 'pickup':
        return this.handlePickup();

      case 'place':
        return this.handlePlace();

      default:
        return null;
    }
  }

  private handleSearching(): Task | null {
    // Check if destination already has enough
    const destItem = this.bot.inventory.slots[this.destSlot];
    if (destItem && this.itemMatcher(destItem) && destItem.count >= this.targetCount) {
      this.phase = 'done';
      return null;
    }

    // Find best source slot
    const sourceSlots = this.getSourceSlots();
    let bestSlot: number | null = null;
    let bestCount = 0;

    for (const slot of sourceSlots) {
      if (slot === this.destSlot) continue;

      const item = this.bot.inventory.slots[slot];
      if (!item || !this.itemMatcher(item)) continue;

      // Prefer larger stacks
      if (item.count > bestCount) {
        bestCount = item.count;
        bestSlot = slot;
      }
    }

    if (bestSlot === null) {
      // No matching items found
      this.phase = 'done';
      return null;
    }

    this.currentSourceSlot = bestSlot;
    this.phase = 'pickup';
    return null;
  }

  private handlePickup(): Task | null {
    // Ensure cursor is empty first
    const cursor = (this.bot.inventory as any).cursor;
    if (cursor) {
      // If cursor has matching item, go to place
      if (this.itemMatcher(cursor)) {
        this.phase = 'place';
        return null;
      }
      // Otherwise, clear cursor first
      return new EnsureFreeCursorSlotTask(this.bot);
    }

    if (this.currentSourceSlot === null) {
      this.phase = 'searching';
      return null;
    }

    // Pick up from source
    return new ClickSlotTask(this.bot, this.currentSourceSlot, 0, SlotActionType.PICKUP);
  }

  private handlePlace(): Task | null {
    const cursor = (this.bot.inventory as any).cursor;
    if (!cursor) {
      // Placed successfully, check if we need more
      const destItem = this.bot.inventory.slots[this.destSlot];
      const currentCount = destItem?.count ?? 0;

      if (currentCount >= this.targetCount) {
        this.phase = 'done';
      } else {
        this.phase = 'searching'; // Find more items
      }
      return null;
    }

    // Determine if we should place all or just one
    const destItem = this.bot.inventory.slots[this.destSlot];
    const currentCount = destItem?.count ?? 0;
    const needed = this.targetCount - currentCount;
    const cursorCount = cursor.count;

    if (cursorCount <= needed) {
      // Place all (left click)
      return new ClickSlotTask(this.bot, this.destSlot, 0, SlotActionType.PICKUP);
    } else {
      // Place one at a time (right click)
      return new ClickSlotTask(this.bot, this.destSlot, 1, SlotActionType.PICKUP);
    }
  }

  protected getAllInventorySlots(): number[] {
    // Player inventory slots 9-44 (not including armor/crafting)
    const slots: number[] = [];
    for (let i = 9; i <= 44; i++) {
      slots.push(i);
    }
    return slots;
  }

  isFinished(): boolean {
    if (this.phase === 'done') return true;

    // Check if destination has required count
    const destItem = this.bot.inventory.slots[this.destSlot];
    return destItem !== null &&
           destItem !== undefined &&
           this.itemMatcher(destItem) &&
           destItem.count >= this.targetCount;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof MoveItemsToSlotTask)) return false;
    return this.destSlot === other.destSlot &&
           this.targetCount === other.targetCount;
  }
}
