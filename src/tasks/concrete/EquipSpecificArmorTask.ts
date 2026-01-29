/**
 * EquipSpecificArmorTask - Equip Specific Armor Items
 * Based on BaritonePlus's EquipArmorTask.java
 *
 * WHY: Sometimes we need to equip specific armor items rather than
 * the best available. This task takes a list of armor item names
 * and equips them to the appropriate slots.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';

/**
 * Task to equip specific armor items
 */
export class EquipSpecificArmorTask extends Task {
  private armorItems: string[];
  private finished: boolean = false;

  constructor(bot: Bot, ...armorItems: string[]) {
    super(bot);
    this.armorItems = armorItems;
  }

  get displayName(): string {
    return `EquipArmor(${this.armorItems.join(', ')})`;
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    const inventoryItems = this.bot.inventory.items();

    for (const armorName of this.armorItems) {
      const item = inventoryItems.find(i => i.name === armorName);
      if (item) {
        try {
          const slot = this.getSlotForArmor(armorName);
          if (slot) {
            this.bot.equip(item, slot as any);
          }
        } catch {
          // Continue to next item
        }
      }
    }

    this.finished = true;
    return null;
  }

  private getSlotForArmor(armorName: string): string | null {
    if (armorName.includes('helmet') || armorName === 'turtle_helmet') return 'head';
    if (armorName.includes('chestplate') || armorName === 'elytra') return 'torso';
    if (armorName.includes('leggings')) return 'legs';
    if (armorName.includes('boots')) return 'feet';
    if (armorName === 'shield') return 'off-hand';
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.finished;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof EquipSpecificArmorTask)) return false;
    return JSON.stringify(this.armorItems) === JSON.stringify(other.armorItems);
  }
}

/**
 * Helper to equip specific armor items
 */
export function equipArmor(bot: Bot, ...armorItems: string[]): EquipSpecificArmorTask {
  return new EquipSpecificArmorTask(bot, ...armorItems);
}
