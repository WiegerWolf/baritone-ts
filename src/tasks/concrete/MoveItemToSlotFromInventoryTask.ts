/**
 * MoveItemToSlotFromInventoryTask - Move items from player inventory to a slot
 * Based on BaritonePlus MoveItemToSlotFromInventoryTask.java
 *
 * Searches only in player inventory slots (not containers).
 */

import type { Bot } from 'mineflayer';
import { MoveItemsToSlotTask, type ItemMatcher } from './MoveItemsToSlotTask';

/**
 * Move items from player inventory to a slot
 *
 * Based on BaritonePlus MoveItemToSlotFromInventoryTask.java
 * Searches only in player inventory slots (not containers).
 */
export class MoveItemToSlotFromInventoryTask extends MoveItemsToSlotTask {
  constructor(
    bot: Bot,
    itemMatcher: ItemMatcher,
    destSlot: number,
    targetCount: number = 1
  ) {
    super(
      bot,
      itemMatcher,
      destSlot,
      targetCount,
      () => this.getPlayerInventorySlots()
    );
  }

  get displayName(): string {
    return `MoveFromInventory(dest=${this.destSlot}, count=${this.targetCount})`;
  }

  private getPlayerInventorySlots(): number[] {
    // Only player inventory slots (9-44), excluding armor/crafting
    const slots: number[] = [];
    for (let i = 9; i <= 44; i++) {
      slots.push(i);
    }
    return slots;
  }
}
