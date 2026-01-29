/**
 * MoveItemToSlotFromContainerTask - Move items from container to a slot
 * Based on BaritonePlus MoveItemToSlotFromContainerTask.java
 *
 * Searches only in container slots (chest, furnace, etc.).
 */

import type { Bot } from 'mineflayer';
import { MoveItemsToSlotTask, type ItemMatcher } from './MoveItemsToSlotTask';

/**
 * Move items from container slots to a slot
 *
 * Based on BaritonePlus MoveItemToSlotFromContainerTask.java
 * Searches only in container slots (chest, furnace, etc.).
 */
export class MoveItemToSlotFromContainerTask extends MoveItemsToSlotTask {
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
      () => this.getContainerSlots()
    );
  }

  get displayName(): string {
    return `MoveFromContainer(dest=${this.destSlot}, count=${this.targetCount})`;
  }

  private getContainerSlots(): number[] {
    // Container slots depend on current window
    // In mineflayer, container slots start at 0 and go up to
    // (window.inventoryStart - 1) when a container is open
    const window = (this.bot as any).currentWindow;
    if (!window) return [];

    const slots: number[] = [];
    const containerEnd = window.inventoryStart ?? 0;

    for (let i = 0; i < containerEnd; i++) {
      slots.push(i);
    }

    return slots;
  }
}
