/**
 * PickupItemTask - Pick Up Dropped Items
 * Based on AltoClef/BaritonePlus PickupDroppedItemTask.java
 *
 * Tasks for collecting dropped items from the ground:
 * - PickupDroppedItemTask: Pick up items matching criteria
 * - GetToEntityTask: Navigate to an entity
 *
 * These tasks handle the common scenario of picking up resources,
 * loot, or items that were dropped.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { defaultGroundedShouldForce } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { SafeRandomShimmyTask } from './SafeRandomShimmyTask';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';
import { ItemTarget, ItemTargets } from '../../utils/ItemTarget';
import { isSolid } from '../../utils/WorldHelper';

/**
 * Interface for tasks that require being grounded
 */
interface ITaskRequiresGroundedLocal {
  readonly requiresGrounded: boolean;
  shouldForce(interruptingCandidate: ITask | null): boolean;
}

/**
 * Blocks that can get the bot stuck when navigating to items
 */
const ANNOYING_BLOCKS = [
  'vine', 'nether_sprouts', 'cave_vines', 'cave_vines_plant',
  'twisting_vines', 'twisting_vines_plant', 'weeping_vines',
  'weeping_vines_plant', 'ladder', 'big_dripleaf', 'big_dripleaf_stem',
  'small_dripleaf', 'tall_grass', 'grass', 'short_grass',
];

/**
 * GetToEntityTask - Navigate to an entity's position
 *
 * Intent: Get the bot close enough to an entity to interact with it.
 * Used for approaching dropped items, mobs, players, etc.
 */
export class GetToEntityTask extends Task implements ITaskRequiresGroundedLocal {
  readonly requiresGrounded = true;

  private entityId: number;
  private closeEnoughDist: number;
  private progressChecker: MovementProgressChecker;

  constructor(bot: Bot, entityId: number, closeEnoughDist: number = 1.5) {
    super(bot);
    this.entityId = entityId;
    this.closeEnoughDist = closeEnoughDist;
    this.progressChecker = new MovementProgressChecker(bot);
  }

  shouldForce(interruptingCandidate: ITask | null): boolean {
    return defaultGroundedShouldForce(this.bot, interruptingCandidate);
  }

  get displayName(): string {
    const entity = this.bot.entities[this.entityId];
    const name = entity?.name ?? 'unknown';
    return `GetToEntity(${name})`;
  }

  onStart(): void {
    this.progressChecker.reset();
  }

  onTick(): Task | null {
    const entity = this.bot.entities[this.entityId];
    if (!entity || entity.isValid === false) {
      return null;
    }

    // Check distance
    const dist = this.bot.entity.position.distanceTo(entity.position);
    if (dist <= this.closeEnoughDist) {
      return null; // Close enough
    }

    // Check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      // Not making progress
      this.progressChecker.reset();
      return new TimeoutWanderTask(this.bot, 5, true);
    }

    // Navigate to entity position
    const pos = entity.position;
    return new GoToNearTask(
      this.bot,
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z),
      Math.ceil(this.closeEnoughDist)
    );
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    const entity = this.bot.entities[this.entityId];
    if (!entity || entity.isValid === false) {
      return true; // Entity gone
    }

    const dist = this.bot.entity.position.distanceTo(entity.position);
    return dist <= this.closeEnoughDist;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetToEntityTask)) return false;
    return this.entityId === other.entityId;
  }
}

/**
 * PickupDroppedItemTask - Pick up dropped item entities
 *
 * Intent: Navigate to and pick up items on the ground that match
 * the specified item targets. Handles stuck situations and blacklists
 * unreachable items.
 *
 * Based on BaritonePlus PickupDroppedItemTask.java
 */
export class PickupDroppedItemTask extends Task implements ITaskRequiresGroundedLocal {
  readonly requiresGrounded = true;

  private itemTargets: ItemTarget[];
  private freeInventoryIfFull: boolean;

  private wanderTask: TimeoutWanderTask;
  private progressChecker: MovementProgressChecker;
  private stuckCheck: MovementProgressChecker;

  private blacklist: Set<number> = new Set();
  private currentDrop: Entity | null = null;
  private unstuckTask: Task | null = null;

  constructor(
    bot: Bot,
    itemTargets: ItemTarget | ItemTarget[],
    freeInventoryIfFull: boolean = true
  ) {
    super(bot);
    this.itemTargets = Array.isArray(itemTargets) ? itemTargets : [itemTargets];
    this.freeInventoryIfFull = freeInventoryIfFull;
    this.wanderTask = new TimeoutWanderTask(bot, 5, true);
    this.progressChecker = new MovementProgressChecker(bot);
    this.stuckCheck = new MovementProgressChecker(bot);
  }

  /**
   * Create from item name(s)
   */
  static fromItems(bot: Bot, items: string | string[], count: number = 1): PickupDroppedItemTask {
    const names = Array.isArray(items) ? items : [items];
    const targets = names.map(name => new ItemTarget(name, count));
    return new PickupDroppedItemTask(bot, targets);
  }

  shouldForce(interruptingCandidate: ITask | null): boolean {
    return defaultGroundedShouldForce(this.bot, interruptingCandidate);
  }

  get displayName(): string {
    const itemNames = this.itemTargets.map(t => t.getItemNames().join('|')).join(', ');
    return `PickupDropped(${itemNames})`;
  }

  onStart(): void {
    this.wanderTask.resetWander();
    this.progressChecker.reset();
    this.stuckCheck.reset();
    this.blacklist.clear();
    this.currentDrop = null;
  }

  onTick(): Task | null {
    // Check if wander task is active
    if (this.wanderTask.isActive() && !this.wanderTask.isFinished()) {
      return this.wanderTask;
    }

    // Check for stuck in blocks
    const stuckBlock = this.getStuckBlock();
    if (stuckBlock && this.unstuckTask && !this.unstuckTask.isFinished()) {
      this.stuckCheck.reset();
      return this.unstuckTask;
    }

    // Update progress
    this.progressChecker.setProgress(this.bot.entity.position);
    this.stuckCheck.setProgress(this.bot.entity.position);

    if (this.progressChecker.failed() || this.stuckCheck.failed()) {
      const blockStuck = this.getStuckBlock();
      if (blockStuck) {
        this.unstuckTask = new SafeRandomShimmyTask(this.bot);
        return this.unstuckTask;
      }
      this.stuckCheck.reset();
    }

    // Not making progress toward drop
    if (this.progressChecker.failed()) {
      if (this.currentDrop) {
        // Mark as unreachable
        this.blacklist.add(this.currentDrop.id);
        this.currentDrop = null;
        return this.wanderTask;
      }
    }

    // Find closest matching drop
    const closestDrop = this.getClosestDrop();
    if (!closestDrop) {
      // No drops found - finished or wander
      return null;
    }

    // Track current drop
    if (this.currentDrop !== closestDrop) {
      this.currentDrop = closestDrop;
      this.progressChecker.reset();
    }

    // Check if touching the item
    const dist = this.bot.entity.position.distanceTo(closestDrop.position);
    if (dist < 1.5) {
      // Should auto-pickup when close enough
      // Check if inventory is full
      if (this.freeInventoryIfFull) {
        const emptySlot = this.bot.inventory.firstEmptyInventorySlot();
        if (emptySlot === null) {
          // Inventory full - need to make space
          // For now, just return null
          return null;
        }
      }
      // Just wait for auto-pickup
      return null;
    }

    // Navigate to the drop
    return new GetToEntityTask(this.bot, closestDrop.id, 1);
  }

  private getClosestDrop(): Entity | null {
    const playerPos = this.bot.entity.position;
    let closest: Entity | null = null;
    let closestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity.type !== 'object' || (entity as any).objectType !== 'Item') {
        // Check by name
        if (entity.name !== 'item') continue;
      }

      // Check if blacklisted
      if (this.blacklist.has(entity.id)) continue;

      // Check if valid
      if (entity.isValid === false) continue;

      // Check if matches target items
      const itemStack = (entity as any).getDroppedItem?.() ?? (entity as any).metadata?.[8];
      if (itemStack) {
        const itemName = typeof itemStack === 'object' ? itemStack.name : String(itemStack);
        if (!this.matchesTargets(itemName)) continue;
      }

      // Get position (adjust for falling items)
      let pos = entity.position;
      if (!entity.onGround && !(entity as any).isInWater) {
        // Assume item will land lower
        const checkPos = pos.floored();
        if (!isSolid(this.bot, checkPos.offset(0, -3, 0))) {
          pos = pos.offset(0, -2, 0);
        } else {
          pos = pos.offset(0, -1, 0);
        }
      }

      const dist = playerPos.distanceTo(pos);
      if (dist < closestDist) {
        closestDist = dist;
        closest = entity;
      }
    }

    return closest;
  }

  private matchesTargets(itemName: string): boolean {
    for (const target of this.itemTargets) {
      if (target.matches(itemName)) {
        return true;
      }
    }
    return false;
  }

  private getStuckBlock(): Vec3 | null {
    const pos = this.bot.entity.position;
    const blockPos = pos.floored();

    const positions = [
      blockPos,
      blockPos.offset(0, 1, 0),
      blockPos.offset(1, 0, 0),
      blockPos.offset(-1, 0, 0),
      blockPos.offset(0, 0, 1),
      blockPos.offset(0, 0, -1),
    ];

    for (const p of positions) {
      const block = this.bot.blockAt(p);
      if (block && this.isAnnoyingBlock(block.name)) {
        return p;
      }
    }

    return null;
  }

  private isAnnoyingBlock(name: string): boolean {
    return ANNOYING_BLOCKS.some(b => name.includes(b)) ||
           name.includes('door') ||
           name.includes('fence') ||
           name.includes('gate');
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    // Check if we have enough of all target items
    for (const target of this.itemTargets) {
      const count = this.getInventoryCount(target.getItemNames());
      if (count < target.getTargetCount()) {
        // Check if there are any more drops
        const drop = this.getClosestDrop();
        if (drop) return false;
      }
    }
    return true;
  }

  private getInventoryCount(itemNames: readonly string[]): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (itemNames.includes(item.name)) {
        count += item.count;
      }
    }
    return count;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PickupDroppedItemTask)) return false;
    if (this.itemTargets.length !== other.itemTargets.length) return false;
    for (let i = 0; i < this.itemTargets.length; i++) {
      const thisNames = this.itemTargets[i].getItemNames();
      const otherNames = other.itemTargets[i].getItemNames();
      if (JSON.stringify(thisNames) !== JSON.stringify(otherNames)) return false;
      if (this.itemTargets[i].getTargetCount() !== other.itemTargets[i].getTargetCount()) return false;
    }
    return this.freeInventoryIfFull === other.freeInventoryIfFull;
  }
}

/**
 * PickupNearbyItemsTask - Pick up any items near the player
 *
 * Intent: Opportunistically collect any dropped items within range,
 * regardless of type. Useful for general cleanup after combat or mining.
 */
export class PickupNearbyItemsTask extends Task {
  private range: number;
  private currentTask: Task | null = null;

  constructor(bot: Bot, range: number = 10) {
    super(bot);
    this.range = range;
  }

  get displayName(): string {
    return `PickupNearby(${this.range}m)`;
  }

  onTick(): Task | null {
    // Find closest item within range
    const closest = this.findClosestItem();
    if (!closest) {
      return null;
    }

    // Navigate to it
    if (!this.currentTask || this.currentTask.isFinished()) {
      this.currentTask = new GetToEntityTask(this.bot, closest.id, 1);
    }

    return this.currentTask;
  }

  private findClosestItem(): Entity | null {
    const playerPos = this.bot.entity.position;
    let closest: Entity | null = null;
    let closestDist = this.range;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity.name !== 'item' && (entity as any).objectType !== 'Item') continue;
      if (entity.isValid === false) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist < closestDist) {
        closestDist = dist;
        closest = entity;
      }
    }

    return closest;
  }

  isFinished(): boolean {
    return this.findClosestItem() === null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PickupNearbyItemsTask)) return false;
    return Math.abs(this.range - other.range) < 1;
  }
}

export default {
  GetToEntityTask,
  PickupDroppedItemTask,
  PickupNearbyItemsTask,
};
