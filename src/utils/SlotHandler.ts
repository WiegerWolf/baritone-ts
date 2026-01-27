/**
 * SlotHandler - Throttled Slot Actions
 * Based on AltoClef's SlotHandler.java
 *
 * Provides inventory manipulation utilities with anti-cheat safety:
 * - Throttled click timing (100ms cooldown)
 * - Window/inventory slot mapping
 * - Click type abstraction
 * - Queue-based action execution
 */

import type { Bot } from 'mineflayer';
import type { Item } from 'prismarine-item';

/**
 * Click types for inventory interactions
 */
export enum ClickType {
  LEFT_CLICK = 'left',
  RIGHT_CLICK = 'right',
  SHIFT_CLICK = 'shift',
  DROP = 'drop',
  DROP_STACK = 'drop_stack',
  SWAP_HOTBAR = 'swap',
}

/**
 * Click mode mapping for mineflayer
 */
interface ClickParams {
  button: 0 | 1;
  mode: 0 | 1 | 4 | 2;
}

const CLICK_PARAMS: Record<ClickType, ClickParams> = {
  [ClickType.LEFT_CLICK]: { button: 0, mode: 0 },
  [ClickType.RIGHT_CLICK]: { button: 1, mode: 0 },
  [ClickType.SHIFT_CLICK]: { button: 0, mode: 1 },
  [ClickType.DROP]: { button: 0, mode: 4 },
  [ClickType.DROP_STACK]: { button: 1, mode: 4 },
  [ClickType.SWAP_HOTBAR]: { button: 0, mode: 2 },
};

/**
 * Slot abstraction for inventory/window mapping
 */
export abstract class Slot {
  abstract getInventorySlot(): number;
  abstract getWindowSlot(): number;
  abstract toString(): string;
}

/**
 * Player inventory slot (0-35 + armor + offhand)
 */
export class PlayerInventorySlot extends Slot {
  constructor(private index: number) {
    super();
  }

  getInventorySlot(): number {
    return this.index;
  }

  getWindowSlot(): number {
    // Map inventory 0-8 (hotbar) → window 36-44
    // Map inventory 9-35 (main) → window 9-35
    if (this.index < 9) return this.index + 36;
    return this.index;
  }

  toString(): string {
    return `PlayerSlot(${this.index} → window ${this.getWindowSlot()})`;
  }
}

/**
 * Armor slot mapping
 */
export class ArmorSlot extends Slot {
  static HELMET = new ArmorSlot(5);
  static CHESTPLATE = new ArmorSlot(6);
  static LEGGINGS = new ArmorSlot(7);
  static BOOTS = new ArmorSlot(8);

  private constructor(private windowSlot: number) {
    super();
  }

  getInventorySlot(): number {
    return this.windowSlot;
  }

  getWindowSlot(): number {
    return this.windowSlot;
  }

  toString(): string {
    const names: Record<number, string> = {
      5: 'Helmet',
      6: 'Chestplate',
      7: 'Leggings',
      8: 'Boots',
    };
    return `ArmorSlot(${names[this.windowSlot]})`;
  }
}

/**
 * Offhand slot
 */
export class OffhandSlot extends Slot {
  static INSTANCE = new OffhandSlot();

  private constructor() {
    super();
  }

  getInventorySlot(): number {
    return 45;
  }

  getWindowSlot(): number {
    return 45;
  }

  toString(): string {
    return 'OffhandSlot';
  }
}

/**
 * Container slot (chest, furnace, etc.)
 */
export class ContainerSlot extends Slot {
  constructor(private windowSlot: number) {
    super();
  }

  getInventorySlot(): number {
    // Container slots are window-relative
    return this.windowSlot;
  }

  getWindowSlot(): number {
    return this.windowSlot;
  }

  toString(): string {
    return `ContainerSlot(${this.windowSlot})`;
  }
}

/**
 * Pending click action in the queue
 */
interface PendingClick {
  slot: number;
  type: ClickType;
  hotbarSlot?: number;
  resolve: (success: boolean) => void;
  reject: (error: Error) => void;
}

/**
 * SlotHandler configuration
 */
export interface SlotHandlerConfig {
  /** Minimum time between clicks (ms) */
  clickCooldown: number;
  /** Maximum retries for failed clicks */
  maxRetries: number;
  /** Timeout for click operations (ms) */
  clickTimeout: number;
}

const DEFAULT_CONFIG: SlotHandlerConfig = {
  clickCooldown: 100, // 100ms = safe for most servers
  maxRetries: 3,
  clickTimeout: 1000,
};

/**
 * SlotHandler - Safe inventory manipulation
 */
export class SlotHandler {
  private bot: Bot;
  private config: SlotHandlerConfig;
  private lastClickTime: number = 0;
  private clickQueue: PendingClick[] = [];
  private processing: boolean = false;

  constructor(bot: Bot, config: Partial<SlotHandlerConfig> = {}) {
    this.bot = bot;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Click a slot with throttling
   * Returns true if click was executed, false if throttled
   */
  async clickSlot(slot: Slot, type: ClickType = ClickType.LEFT_CLICK): Promise<boolean> {
    return this.queueClick(slot.getWindowSlot(), type);
  }

  /**
   * Click a window slot directly
   */
  async clickWindowSlot(windowSlot: number, type: ClickType = ClickType.LEFT_CLICK): Promise<boolean> {
    return this.queueClick(windowSlot, type);
  }

  /**
   * Swap slot with hotbar slot
   */
  async swapWithHotbar(slot: Slot, hotbarSlot: number): Promise<boolean> {
    if (hotbarSlot < 0 || hotbarSlot > 8) {
      throw new Error(`Invalid hotbar slot: ${hotbarSlot}`);
    }
    return this.queueClick(slot.getWindowSlot(), ClickType.SWAP_HOTBAR, hotbarSlot);
  }

  /**
   * Move item to slot (pick up then place)
   */
  async moveItem(from: Slot, to: Slot): Promise<boolean> {
    // Pick up from source
    const pickedUp = await this.clickSlot(from, ClickType.LEFT_CLICK);
    if (!pickedUp) return false;

    // Place in destination
    const placed = await this.clickSlot(to, ClickType.LEFT_CLICK);
    return placed;
  }

  /**
   * Shift-click to quickly move item
   */
  async quickMove(slot: Slot): Promise<boolean> {
    return this.clickSlot(slot, ClickType.SHIFT_CLICK);
  }

  /**
   * Drop item from slot
   */
  async dropItem(slot: Slot, fullStack: boolean = false): Promise<boolean> {
    return this.clickSlot(
      slot,
      fullStack ? ClickType.DROP_STACK : ClickType.DROP
    );
  }

  /**
   * Equip item to hand (hotbar slot 0)
   */
  async equipToHand(item: Item): Promise<boolean> {
    const slot = this.findSlotWithItem(item);
    if (!slot) return false;

    // If already in hotbar, just select it
    if (slot.getInventorySlot() < 9) {
      this.bot.setQuickBarSlot(slot.getInventorySlot());
      return true;
    }

    // Swap with current hotbar slot
    return this.swapWithHotbar(slot, this.bot.quickBarSlot);
  }

  /**
   * Force equip item (move to hotbar slot 0 and select)
   */
  async forceEquipItem(itemName: string): Promise<boolean> {
    const item = this.bot.inventory.items().find(i => i.name === itemName);
    if (!item) return false;

    const slot = new PlayerInventorySlot(item.slot < 9 ? item.slot : item.slot);

    // If in hotbar, just select it
    if (item.slot >= 36 && item.slot <= 44) {
      this.bot.setQuickBarSlot(item.slot - 36);
      return true;
    }

    // Move to first hotbar slot
    const hotbarSlot = new PlayerInventorySlot(0);
    const success = await this.moveItem(slot, hotbarSlot);
    if (success) {
      this.bot.setQuickBarSlot(0);
    }
    return success;
  }

  /**
   * Check if can click (cooldown elapsed)
   */
  canClick(): boolean {
    return Date.now() - this.lastClickTime >= this.config.clickCooldown;
  }

  /**
   * Get time until next click is allowed
   */
  getTimeUntilNextClick(): number {
    const elapsed = Date.now() - this.lastClickTime;
    return Math.max(0, this.config.clickCooldown - elapsed);
  }

  /**
   * Queue a click action
   */
  private queueClick(
    windowSlot: number,
    type: ClickType,
    hotbarSlot?: number
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.clickQueue.push({
        slot: windowSlot,
        type,
        hotbarSlot,
        resolve,
        reject,
      });

      // Start processing if not already
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the click queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.clickQueue.length > 0) {
      const click = this.clickQueue[0];

      // Wait for cooldown
      const waitTime = this.getTimeUntilNextClick();
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }

      try {
        // Execute click
        await this.executeClick(click);
        click.resolve(true);
      } catch (err) {
        click.reject(err instanceof Error ? err : new Error(String(err)));
      }

      this.clickQueue.shift();
    }

    this.processing = false;
  }

  /**
   * Execute a single click
   */
  private async executeClick(click: PendingClick): Promise<void> {
    const params = CLICK_PARAMS[click.type];
    const window = this.bot.currentWindow ?? this.bot.inventory;

    // For swap, use hotbar slot as button
    const button = click.type === ClickType.SWAP_HOTBAR
      ? click.hotbarSlot ?? 0
      : params.button;

    await (window as any).click(click.slot, button, params.mode);
    this.lastClickTime = Date.now();
  }

  /**
   * Find slot containing item
   */
  private findSlotWithItem(item: Item): PlayerInventorySlot | null {
    for (const invItem of this.bot.inventory.items()) {
      if (invItem.name === item.name) {
        // Convert window slot to inventory slot
        const inventorySlot = invItem.slot >= 36
          ? invItem.slot - 36
          : invItem.slot;
        return new PlayerInventorySlot(inventorySlot);
      }
    }
    return null;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear pending clicks
   */
  clearQueue(): void {
    for (const click of this.clickQueue) {
      click.reject(new Error('Queue cleared'));
    }
    this.clickQueue = [];
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.clickQueue.length;
  }
}

/**
 * Create a slot handler for a bot
 */
export function createSlotHandler(bot: Bot, config?: Partial<SlotHandlerConfig>): SlotHandler {
  return new SlotHandler(bot, config);
}
