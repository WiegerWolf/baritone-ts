/**
 * DropItemTask - Drop items from inventory
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';

export class DropItemTask extends Task {
  private itemName: string;
  private count: number;
  private dropped: number = 0;

  constructor(bot: Bot, itemName: string, count: number = 1) {
    super(bot);
    this.itemName = itemName;
    this.count = count;
  }

  get displayName(): string {
    return `Drop(${this.count}x ${this.itemName})`;
  }

  onStart(): void {
    this.dropped = 0;
  }

  onTick(): Task | null {
    if (this.dropped >= this.count) {
      return null;
    }

    const item = this.findItem();
    if (!item) {
      return null;
    }

    try {
      const toDrop = Math.min(item.count, this.count - this.dropped);
      this.bot.tossStack(item);
      this.dropped += toDrop;
    } catch (err) {
      // Will retry
    }

    return null;
  }

  isFinished(): boolean {
    return this.dropped >= this.count || !this.findItem();
  }

  private findItem(): any {
    for (const item of this.bot.inventory.items()) {
      if (item.name === this.itemName) {
        return item;
      }
    }
    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof DropItemTask)) return false;
    return this.itemName === other.itemName && this.count === other.count;
  }
}
