/**
 * InventoryTask - Inventory Management Tasks
 * Based on AltoClef's inventory handling
 *
 * Tasks for managing inventory: picking up items, equipping, dropping.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import { ItemTarget } from '../../utils/ItemTarget';

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

/**
 * State for pickup operation
 */
enum PickupState {
  SEARCHING,
  GOING_TO_ITEM,
  WAITING,
  FINISHED,
  FAILED
}

/**
 * Task to pick up dropped items
 */
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
    // Find nearest matching item entity
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
      // Entity gone - search again
      this.state = PickupState.SEARCHING;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.targetEntity.position);
    if (dist <= this.pickupRadius) {
      // Close enough - wait for pickup
      this.state = PickupState.WAITING;
      this.waitTimer.reset();
      return null;
    }

    // Move towards item
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

    // Check if item was picked up
    if (!this.targetEntity || !this.targetEntity.isValid) {
      // Item picked up or despawned - check if we need more
      const pickedUp = this.getCurrentCount() - this.initialCount;
      if (pickedUp >= this.itemTarget.getTargetCount()) {
        this.state = PickupState.FINISHED;
      } else {
        this.state = PickupState.SEARCHING;
      }
      return null;
    }

    // Still waiting - item might be unreachable
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

  /**
   * Get current count of target items in inventory
   */
  private getCurrentCount(): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (this.itemTarget.matches(item.name)) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Find nearest item drop matching our target
   */
  private findNearestItemDrop(): Entity | null {
    const playerPos = this.bot.entity.position;
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      // Check if it's an item drop
      if (entity.name !== 'item' && entity.entityType !== 2) continue;

      // Check if it matches our target
      const itemName = this.getDroppedItemName(entity);
      if (!itemName || !this.itemTarget.matches(itemName)) continue;

      // Check distance
      const dist = playerPos.distanceTo(entity.position);
      if (dist <= this.searchRadius && dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  /**
   * Get item name from dropped item entity
   */
  private getDroppedItemName(entity: Entity): string | null {
    // Item entities have metadata with item info
    const metadata = (entity as any).metadata;
    if (!metadata) return null;

    // Try to get item from metadata
    for (const entry of metadata) {
      if (entry && typeof entry === 'object' && 'itemId' in entry) {
        // This is the item slot metadata
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

/**
 * Task to equip an item to a slot
 */
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
    // Check if already equipped
    if (this.isItemEquipped()) {
      this.equipped = true;
      return null;
    }

    // Find item in inventory
    const item = this.findItem();
    if (!item) {
      // Don't have the item
      return null;
    }

    // Equip it
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

  /**
   * Check if item is already equipped in slot
   */
  private isItemEquipped(): boolean {
    let equippedItem;

    switch (this.slot) {
      case EquipmentSlot.HAND:
        equippedItem = this.bot.heldItem;
        break;
      case EquipmentSlot.OFF_HAND:
        equippedItem = this.bot.inventory.slots[45]; // Off-hand slot
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

  /**
   * Find item in inventory
   */
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

/**
 * Task to drop items from inventory
 */
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

    // Find item to drop
    const item = this.findItem();
    if (!item) {
      // No more items to drop
      return null;
    }

    // Drop it
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

  /**
   * Find item in inventory
   */
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

/**
 * Task to move items within inventory
 */
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
    // Check if item is already in target slot
    const slotItem = this.bot.inventory.slots[this.targetSlot];
    if (slotItem && slotItem.name === this.itemName) {
      this.moved = true;
      return null;
    }

    // Find item
    const item = this.findItem();
    if (!item) {
      return null;
    }

    // Move it (click source, click target)
    try {
      // Use window click to move
      this.bot.clickWindow(item.slot, 0, 0); // Pick up
      this.bot.clickWindow(this.targetSlot, 0, 0); // Place
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
