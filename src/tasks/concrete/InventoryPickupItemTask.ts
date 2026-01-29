/**
 * PickupItemTask - Pick up dropped items (inventory-style)
 *
 * Note: This is the InventoryTask variant. See also PickupItemTask.ts
 * for the AltoClef-style pickup tasks (GetToEntityTask, PickupDroppedItemTask, etc.)
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import { ItemTarget } from '../../utils/ItemTarget';

enum PickupState {
  SEARCHING,
  GOING_TO_ITEM,
  WAITING,
  FINISHED,
  FAILED
}

export class PickupItemTask extends Task {
  private itemTarget: ItemTarget;
  private state: PickupState = PickupState.SEARCHING;
  private targetEntity: Entity | null = null;
  private waitTimer: TimerGame;
  private pickupRadius: number = 2.0;
  private searchRadius: number = 32;
  private initialCount: number = 0;

  constructor(bot: Bot, items: string | string[] | ItemTarget, count: number = 1) {
    super(bot);
    if (items instanceof ItemTarget) {
      this.itemTarget = items;
    } else {
      this.itemTarget = new ItemTarget(Array.isArray(items) ? items : [items], count);
    }
    this.waitTimer = new TimerGame(bot, 1.0);
  }

  get displayName(): string {
    return `PickupItem(${this.itemTarget.toString()})`;
  }

  onStart(): void {
    this.state = PickupState.SEARCHING;
    this.targetEntity = null;
    this.initialCount = this.getCurrentCount();
  }

  onTick(): Task | null {
    // Check if we've picked up enough
    const pickedUp = this.getCurrentCount() - this.initialCount;
    if (pickedUp >= this.itemTarget.getTargetCount()) {
      this.state = PickupState.FINISHED;
      return null;
    }

    switch (this.state) {
      case PickupState.SEARCHING:
        return this.handleSearching();

      case PickupState.GOING_TO_ITEM:
        return this.handleGoingToItem();

      case PickupState.WAITING:
        return this.handleWaiting();

      default:
        return null;
    }
  }

  private handleSearching(): Task | null {
    this.targetEntity = this.findNearestItemDrop();
    if (!this.targetEntity) {
      this.state = PickupState.FAILED;
      return null;
    }

    this.state = PickupState.GOING_TO_ITEM;
    return null;
  }

  private handleGoingToItem(): Task | null {
    if (!this.targetEntity || !this.targetEntity.isValid) {
      this.state = PickupState.SEARCHING;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.targetEntity.position);
    if (dist <= this.pickupRadius) {
      this.state = PickupState.WAITING;
      this.waitTimer.reset();
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.targetEntity.position.x),
      Math.floor(this.targetEntity.position.y),
      Math.floor(this.targetEntity.position.z),
      1
    );
  }

  private handleWaiting(): Task | null {
    if (!this.waitTimer.elapsed()) {
      return null;
    }

    if (!this.targetEntity || !this.targetEntity.isValid) {
      const pickedUp = this.getCurrentCount() - this.initialCount;
      if (pickedUp >= this.itemTarget.getTargetCount()) {
        this.state = PickupState.FINISHED;
      } else {
        this.state = PickupState.SEARCHING;
      }
      return null;
    }

    this.state = PickupState.SEARCHING;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.targetEntity = null;
  }

  isFinished(): boolean {
    return this.state === PickupState.FINISHED || this.state === PickupState.FAILED;
  }

  isFailed(): boolean {
    return this.state === PickupState.FAILED;
  }

  private getCurrentCount(): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (this.itemTarget.matches(item.name)) {
        count += item.count;
      }
    }
    return count;
  }

  private findNearestItemDrop(): Entity | null {
    const playerPos = this.bot.entity.position;
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name !== 'item' && entity.entityType !== 2) continue;

      const itemName = this.getDroppedItemName(entity);
      if (!itemName || !this.itemTarget.matches(itemName)) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist <= this.searchRadius && dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private getDroppedItemName(entity: Entity): string | null {
    const metadata = (entity as any).metadata;
    if (!metadata) return null;

    for (const entry of metadata) {
      if (entry && typeof entry === 'object' && 'itemId' in entry) {
        const mcData = require('minecraft-data')(this.bot.version);
        const item = mcData.items[entry.itemId];
        return item ? item.name : null;
      }
    }

    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PickupItemTask)) return false;
    return this.itemTarget.toString() === other.itemTarget.toString();
  }
}
