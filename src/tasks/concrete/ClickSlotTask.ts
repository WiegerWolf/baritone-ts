/**
 * ClickSlotTask - Atomic slot click operations
 * Based on AltoClef's slot tasks
 *
 * Provides the lowest-level inventory slot click operation that other
 * slot tasks build upon.
 */

import type { Bot } from 'mineflayer';
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
