/**
 * MoveItemTask - Move items within inventory
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';

export class MoveItemTask extends Task {
  private itemName: string;
  private targetSlot: number;
  private moved: boolean = false;

  constructor(bot: Bot, itemName: string, targetSlot: number) {
    super(bot);
    this.itemName = itemName;
    this.targetSlot = targetSlot;
  }

  get displayName(): string {
    return `MoveItem(${this.itemName} to slot ${this.targetSlot})`;
  }

  onStart(): void {
    this.moved = false;
  }

  onTick(): Task | null {
    const slotItem = this.bot.inventory.slots[this.targetSlot];
    if (slotItem && slotItem.name === this.itemName) {
      this.moved = true;
      return null;
    }

    const item = this.findItem();
    if (!item) {
      return null;
    }

    try {
      this.bot.clickWindow(item.slot, 0, 0);
      this.bot.clickWindow(this.targetSlot, 0, 0);
      this.moved = true;
    } catch (err) {
      // Will retry
    }

    return null;
  }

  isFinished(): boolean {
    return this.moved;
  }

  private findItem(): any {
    for (const item of this.bot.inventory.items()) {
      if (item.name === this.itemName && item.slot !== this.targetSlot) {
        return item;
      }
    }
    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof MoveItemTask)) return false;
    return this.itemName === other.itemName && this.targetSlot === other.targetSlot;
  }
}
