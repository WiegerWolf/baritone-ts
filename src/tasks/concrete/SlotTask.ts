/**
 * SlotTask - Slot Management Tasks
 * Based on AltoClef's slot tasks
 *
 * Tasks for low-level inventory slot manipulation:
 * - ClickSlotTask: Click on a specific slot
 * - EnsureFreeCursorSlotTask: Clear the cursor slot
 * - EnsureFreeInventorySlotTask: Ensure there's free space in inventory
 * - ThrowCursorTask: Throw the item in cursor slot
 *
 * These are building blocks for higher-level inventory operations.
 */

import type { Bot } from 'mineflayer';
import type { Item } from 'prismarine-item';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Slot action types (mirroring Minecraft's SlotActionType)
 */
export enum SlotActionType {
  /** Normal left/right click pickup */
  PICKUP = 0,
  /** Quick move (shift-click) */
  QUICK_MOVE = 1,
  /** Swap with hotbar slot */
  SWAP = 2,
  /** Clone item (creative mode) */
  CLONE = 3,
  /** Throw item */
  THROW = 4,
  /** Quick craft */
  QUICK_CRAFT = 5,
  /** Pick up all of same type */
  PICKUP_ALL = 6,
}

/**
 * Constants for slot indices
 */
export const SlotConstants = {
  /** Crafting output slot */
  CRAFT_OUTPUT: 0,
  /** Crafting grid slots (4 for player, 9 for table) */
  CRAFT_INPUT_START: 1,
  /** Armor slots start */
  ARMOR_START: 5,
  /** Main inventory start (not hotbar) */
  INVENTORY_START: 9,
  /** Main inventory end */
  INVENTORY_END: 35,
  /** Hotbar start */
  HOTBAR_START: 36,
  /** Hotbar end */
  HOTBAR_END: 44,
  /** Off-hand slot */
  OFFHAND: 45,
  /** Special slot for cursor */
  CURSOR: -999,
};

/**
 * Task to click on a specific inventory slot
 *
 * Intent: Provides atomic slot click operations that other tasks can use
 * to build complex inventory manipulations. Essential for crafting, moving
 * items, and managing inventory space.
 */
export class ClickSlotTask extends Task {
  private slot: number;
  private mouseButton: number;
  private actionType: SlotActionType;
  private clicked: boolean = false;
  private cooldown: TimerGame;

  /**
   * Create a slot click task
   * @param bot The mineflayer bot
   * @param slot Slot number to click (-999 for cursor/outside)
   * @param mouseButton 0 for left click, 1 for right click
   * @param actionType The type of slot action
   */
  constructor(
    bot: Bot,
    slot: number,
    mouseButton: number = 0,
    actionType: SlotActionType = SlotActionType.PICKUP
  ) {
    super(bot);
    this.slot = slot;
    this.mouseButton = mouseButton;
    this.actionType = actionType;
    this.cooldown = new TimerGame(bot, 0.05); // 1 tick cooldown
  }

  get displayName(): string {
    return `ClickSlot(${this.slot}, btn=${this.mouseButton})`;
  }

  onStart(): void {
    this.clicked = false;
    this.cooldown.forceElapsed();
  }

  onTick(): Task | null {
    if (this.clicked) return null;
    if (!this.cooldown.elapsed()) return null;

    try {
      // Use mineflayer's window click
      this.bot.clickWindow(this.slot, this.mouseButton, this.actionType);
      this.clicked = true;
    } catch (err) {
      // Failed, will retry next tick
      this.cooldown.reset();
    }

    return null;
  }

  isFinished(): boolean {
    return this.clicked;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ClickSlotTask)) return false;
    return (
      this.slot === other.slot &&
      this.mouseButton === other.mouseButton &&
      this.actionType === other.actionType
    );
  }
}

/**
 * Task to ensure the cursor slot is empty
 *
 * Intent: Many inventory operations require an empty cursor slot first.
 * This task clears the cursor by finding a place to put the item or
 * throwing it away if it's garbage.
 */
export class EnsureFreeCursorSlotTask extends Task {
  private finished: boolean = false;
  private cooldown: TimerGame;

  constructor(bot: Bot) {
    super(bot);
    this.cooldown = new TimerGame(bot, 0.05);
  }

  get displayName(): string {
    return 'EnsureFreeCursorSlot';
  }

  onStart(): void {
    this.finished = false;
    this.cooldown.forceElapsed();
  }

  onTick(): Task | null {
    // Check if cursor is already empty
    const cursor = this.getCursorItem();
    if (!cursor) {
      this.finished = true;
      return null;
    }

    if (!this.cooldown.elapsed()) return null;

    // Try to find a slot to put the item
    const emptySlot = this.findEmptySlot();
    if (emptySlot !== null) {
      return new ClickSlotTask(this.bot, emptySlot, 0, SlotActionType.PICKUP);
    }

    // Try to stack with existing items
    const stackSlot = this.findStackableSlot(cursor);
    if (stackSlot !== null) {
      return new ClickSlotTask(this.bot, stackSlot, 0, SlotActionType.PICKUP);
    }

    // If it's garbage, throw it away
    if (this.isGarbage(cursor)) {
      return new ThrowCursorTask(this.bot);
    }

    // Find any garbage slot to swap with
    const garbageSlot = this.findGarbageSlot();
    if (garbageSlot !== null) {
      return new ClickSlotTask(this.bot, garbageSlot, 0, SlotActionType.PICKUP);
    }

    // Last resort: throw it away
    return new ThrowCursorTask(this.bot);
  }

  isFinished(): boolean {
    return this.finished || !this.getCursorItem();
  }

  private getCursorItem(): Item | null {
    // mineflayer stores cursor item in inventory.cursor
    const inv = this.bot.inventory as any;
    return inv.cursor || null;
  }

  private findEmptySlot(): number | null {
    const slot = this.bot.inventory.firstEmptyInventorySlot();
    return slot !== null ? slot : null;
  }

  private findStackableSlot(item: Item): number | null {
    for (const invItem of this.bot.inventory.items()) {
      if (
        invItem.name === item.name &&
        invItem.count < invItem.stackSize
      ) {
        return invItem.slot;
      }
    }
    return null;
  }

  private findGarbageSlot(): number | null {
    const garbageItems = [
      'dirt', 'cobblestone', 'gravel', 'sand', 'rotten_flesh',
      'spider_eye', 'bone', 'string', 'gunpowder',
      'feather', 'wheat_seeds', 'beetroot_seeds',
    ];

    for (const item of this.bot.inventory.items()) {
      if (garbageItems.some(g => item.name.includes(g))) {
        return item.slot;
      }
    }
    return null;
  }

  private isGarbage(item: Item): boolean {
    const garbageItems = [
      'dirt', 'cobblestone', 'gravel', 'sand', 'rotten_flesh',
      'spider_eye', 'poisonous_potato', 'pufferfish',
    ];
    return garbageItems.some(g => item.name.includes(g));
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof EnsureFreeCursorSlotTask;
  }
}

/**
 * Task to ensure there's free space in inventory
 *
 * Intent: Before picking up items or crafting, we need inventory space.
 * This task ensures at least one slot is free by throwing garbage or
 * organizing the inventory.
 */
export class EnsureFreeInventorySlotTask extends Task {
  private finished: boolean = false;
  private preserveItems: string[];

  /**
   * @param bot The mineflayer bot
   * @param preserveItems Item names that should never be thrown away
   */
  constructor(bot: Bot, preserveItems: string[] = []) {
    super(bot);
    this.preserveItems = preserveItems;
  }

  get displayName(): string {
    return 'EnsureFreeInventorySlot';
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    // Check if we already have a free slot
    if (this.bot.inventory.firstEmptyInventorySlot() !== null) {
      this.finished = true;
      return null;
    }

    // First ensure cursor is empty
    const cursor = (this.bot.inventory as any).cursor;
    if (cursor) {
      return new EnsureFreeCursorSlotTask(this.bot);
    }

    // Find garbage to throw
    const garbageSlot = this.findGarbageToThrow();
    if (garbageSlot !== null) {
      // Pick up the garbage then throw it
      return new ClickSlotTask(this.bot, garbageSlot, 0, SlotActionType.PICKUP);
    }

    // No obvious garbage - can't free space without throwing something valuable
    this.finished = true;
    return null;
  }

  isFinished(): boolean {
    return this.finished || this.bot.inventory.firstEmptyInventorySlot() !== null;
  }

  private findGarbageToThrow(): number | null {
    const garbageItems = [
      'dirt', 'cobblestone', 'cobbled_deepslate', 'gravel', 'sand',
      'rotten_flesh', 'spider_eye', 'bone', 'string',
      'feather', 'wheat_seeds', 'beetroot_seeds', 'poisonous_potato',
      'netherrack', 'diorite', 'granite', 'andesite', 'tuff',
    ];

    for (const item of this.bot.inventory.items()) {
      // Skip preserved items
      if (this.preserveItems.some(p => item.name.includes(p))) {
        continue;
      }

      if (garbageItems.some(g => item.name.includes(g))) {
        return item.slot;
      }
    }
    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof EnsureFreeInventorySlotTask)) return false;
    return JSON.stringify(this.preserveItems) === JSON.stringify(other.preserveItems);
  }
}

/**
 * Task to throw the item currently in cursor slot
 *
 * Intent: Dispose of unwanted items by throwing them out of the inventory.
 * Used when cursor needs to be cleared and item is garbage.
 */
export class ThrowCursorTask extends Task {
  private thrown: boolean = false;

  constructor(bot: Bot) {
    super(bot);
  }

  get displayName(): string {
    return 'ThrowCursor';
  }

  onStart(): void {
    this.thrown = false;
  }

  onTick(): Task | null {
    const cursor = (this.bot.inventory as any).cursor;
    if (!cursor) {
      this.thrown = true;
      return null;
    }

    try {
      // Click outside inventory to throw
      this.bot.clickWindow(SlotConstants.CURSOR, 0, SlotActionType.PICKUP);
      this.thrown = true;
    } catch (err) {
      // Will retry
    }

    return null;
  }

  isFinished(): boolean {
    return this.thrown || !(this.bot.inventory as any).cursor;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof ThrowCursorTask;
  }
}

/**
 * Task to ensure the player's 2x2 crafting grid is empty
 *
 * Intent: Before crafting or closing inventory, we should move items
 * out of the crafting grid so they don't get lost.
 */
export class EnsureFreePlayerCraftingGridTask extends Task {
  private finished: boolean = false;

  constructor(bot: Bot) {
    super(bot);
  }

  get displayName(): string {
    return 'EnsureFreeCraftingGrid';
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    // Check crafting slots (1-4 in player inventory)
    let hasItems = false;

    for (let slot = 1; slot <= 4; slot++) {
      const item = this.bot.inventory.slots[slot];
      if (item) {
        hasItems = true;

        // First ensure cursor is empty
        const cursor = (this.bot.inventory as any).cursor;
        if (cursor) {
          return new EnsureFreeCursorSlotTask(this.bot);
        }

        // Pick up the item from crafting slot
        return new ClickSlotTask(this.bot, slot, 0, SlotActionType.QUICK_MOVE);
      }
    }

    this.finished = !hasItems;
    return null;
  }

  isFinished(): boolean {
    return this.finished;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof EnsureFreePlayerCraftingGridTask;
  }
}

/**
 * Task to receive crafting output from crafting grid
 *
 * Intent: After setting up a recipe in the crafting grid, this task
 * clicks the output slot to retrieve the crafted item.
 */
export class ReceiveCraftingOutputTask extends Task {
  private received: boolean = false;
  private targetItem: string | null;

  /**
   * @param bot The mineflayer bot
   * @param targetItem Optional item name to verify (if null, accepts any output)
   */
  constructor(bot: Bot, targetItem: string | null = null) {
    super(bot);
    this.targetItem = targetItem;
  }

  get displayName(): string {
    return `ReceiveCraftOutput(${this.targetItem ?? 'any'})`;
  }

  onStart(): void {
    this.received = false;
  }

  onTick(): Task | null {
    // Check if there's an output
    const outputSlot = this.bot.inventory.slots[0];
    if (!outputSlot) {
      // No output ready
      return null;
    }

    // Verify item if specified
    if (this.targetItem && outputSlot.name !== this.targetItem) {
      return null;
    }

    // First ensure cursor is empty
    const cursor = (this.bot.inventory as any).cursor;
    if (cursor) {
      return new EnsureFreeCursorSlotTask(this.bot);
    }

    // Shift-click to move to inventory
    try {
      this.bot.clickWindow(0, 0, SlotActionType.QUICK_MOVE);
      this.received = true;
    } catch (err) {
      // Will retry
    }

    return null;
  }

  isFinished(): boolean {
    return this.received;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ReceiveCraftingOutputTask)) return false;
    return this.targetItem === other.targetItem;
  }
}

/**
 * Task to move item from one slot to another
 *
 * Intent: Move a specific item from source slot to destination slot.
 * Handles the full pick-up and place sequence.
 */
export class MoveItemToSlotTask extends Task {
  private sourceSlot: number;
  private destSlot: number;
  private phase: 'pickup' | 'place' | 'done' = 'pickup';

  constructor(bot: Bot, sourceSlot: number, destSlot: number) {
    super(bot);
    this.sourceSlot = sourceSlot;
    this.destSlot = destSlot;
  }

  get displayName(): string {
    return `MoveSlot(${this.sourceSlot} -> ${this.destSlot})`;
  }

  onStart(): void {
    this.phase = 'pickup';
  }

  onTick(): Task | null {
    switch (this.phase) {
      case 'pickup': {
        const cursor = (this.bot.inventory as any).cursor;
        if (cursor) {
          // Already have something in cursor
          this.phase = 'place';
          return null;
        }
        // Pick up from source
        return new ClickSlotTask(this.bot, this.sourceSlot, 0, SlotActionType.PICKUP);
      }

      case 'place': {
        const cursor = (this.bot.inventory as any).cursor;
        if (!cursor) {
          // Nothing to place
          this.phase = 'done';
          return null;
        }
        // Place at destination
        return new ClickSlotTask(this.bot, this.destSlot, 0, SlotActionType.PICKUP);
      }

      default:
        return null;
    }
  }

  isFinished(): boolean {
    return this.phase === 'done';
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof MoveItemToSlotTask)) return false;
    return this.sourceSlot === other.sourceSlot && this.destSlot === other.destSlot;
  }
}
