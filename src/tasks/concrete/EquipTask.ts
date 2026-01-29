/**
 * EquipTask - Equip an item to a slot
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';

/**
 * Equipment slots
 */
export enum EquipmentSlot {
  HAND = 'hand',
  OFF_HAND = 'off-hand',
  HEAD = 'head',
  CHEST = 'torso',
  LEGS = 'legs',
  FEET = 'feet',
}

export class EquipTask extends Task {
  private itemName: string;
  private slot: EquipmentSlot;
  private equipped: boolean = false;

  constructor(bot: Bot, itemName: string, slot: EquipmentSlot = EquipmentSlot.HAND) {
    super(bot);
    this.itemName = itemName;
    this.slot = slot;
  }

  get displayName(): string {
    return `Equip(${this.itemName} to ${this.slot})`;
  }

  onStart(): void {
    this.equipped = false;
  }

  onTick(): Task | null {
    if (this.isItemEquipped()) {
      this.equipped = true;
      return null;
    }

    const item = this.findItem();
    if (!item) {
      return null;
    }

    try {
      this.bot.equip(item, this.slot as any);
      this.equipped = true;
    } catch (err) {
      // Will retry
    }

    return null;
  }

  isFinished(): boolean {
    return this.equipped || this.isItemEquipped();
  }

  private isItemEquipped(): boolean {
    let equippedItem;

    switch (this.slot) {
      case EquipmentSlot.HAND:
        equippedItem = this.bot.heldItem;
        break;
      case EquipmentSlot.OFF_HAND:
        equippedItem = this.bot.inventory.slots[45];
        break;
      case EquipmentSlot.HEAD:
        equippedItem = this.bot.inventory.slots[5];
        break;
      case EquipmentSlot.CHEST:
        equippedItem = this.bot.inventory.slots[6];
        break;
      case EquipmentSlot.LEGS:
        equippedItem = this.bot.inventory.slots[7];
        break;
      case EquipmentSlot.FEET:
        equippedItem = this.bot.inventory.slots[8];
        break;
    }

    return !!(equippedItem && equippedItem.name === this.itemName);
  }

  private findItem(): any {
    for (const item of this.bot.inventory.items()) {
      if (item.name === this.itemName || item.name.includes(this.itemName)) {
        return item;
      }
    }
    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof EquipTask)) return false;
    return this.itemName === other.itemName && this.slot === other.slot;
  }
}
