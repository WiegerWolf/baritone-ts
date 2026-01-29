/**
 * GiveItemToPlayerTask - Give items to a player entity
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { AbstractDoToEntityTask } from './AbstractDoToEntityTask';

/**
 * Task to give an item to a player entity.
 *
 * WHY: Trading, gifting, or handing items to other players requires
 * approaching them and dropping the item near them.
 */
export class GiveItemToPlayerTask extends AbstractDoToEntityTask {
  private itemName: string;
  private amount: number;
  private targetPlayerName: string;
  private given: boolean = false;

  constructor(bot: Bot, playerName: string, itemName: string, amount: number = 1) {
    super(bot, { maintainDistance: 2, reachRange: 3 });
    this.targetPlayerName = playerName;
    this.itemName = itemName;
    this.amount = amount;
  }

  get displayName(): string {
    return `GiveItem(${this.itemName} x${this.amount} to ${this.targetPlayerName})`;
  }

  onStart(): void {
    super.onStart();
    this.given = false;
  }

  protected getEntityTarget(): Entity | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity.type === 'player' && entity.username === this.targetPlayerName) {
        return entity;
      }
    }
    return null;
  }

  protected onEntityInteract(entity: Entity): Task | null {
    if (this.given) {
      this.markFinished();
      return null;
    }

    // Find the item in inventory
    const item = this.bot.inventory.items().find(i =>
      i.name === this.itemName || i.name.includes(this.itemName)
    );

    if (!item) {
      // Don't have the item
      this.markFailed();
      return null;
    }

    // Drop the item toward the player
    try {
      this.bot.toss(item.type, null, Math.min(item.count, this.amount));
      this.given = true;
    } catch (err) {
      this.markFailed();
    }

    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GiveItemToPlayerTask)) return false;
    return this.targetPlayerName === other.targetPlayerName &&
           this.itemName === other.itemName &&
           this.amount === other.amount;
  }
}
