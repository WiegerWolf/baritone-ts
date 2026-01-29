/**
 * EnchantTask - Enchanting Workflow Automation
 * Based on AltoClef's enchanting behavior
 *
 * Handles finding enchanting tables, placing items,
 * and selecting enchantments.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask } from '../concrete/GetToBlockTask';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { InteractBlockTask } from '../concrete/InteractBlockTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Enchantment slot (0, 1, or 2 for levels 1, 2, 3)
 */
type EnchantSlot = 0 | 1 | 2;

/**
 * State for enchanting
 */
enum EnchantState {
  FINDING_TABLE,
  APPROACHING,
  OPENING_TABLE,
  PLACING_ITEM,
  PLACING_LAPIS,
  SELECTING_ENCHANT,
  ENCHANTING,
  RETRIEVING,
  CLOSING,
  FINISHED,
  FAILED
}

/**
 * Configuration for enchanting
 */
export interface EnchantConfig {
  /** Item to enchant */
  itemToEnchant: string;
  /** Preferred enchantment slot (0=cheapest, 2=best) */
  preferredSlot: EnchantSlot;
  /** Minimum level requirement (will wait if not met) */
  minLevel: number;
  /** Search radius for enchanting table */
  searchRadius: number;
  /** Only enchant if specific enchantment available */
  targetEnchantments: string[];
}

const DEFAULT_CONFIG: EnchantConfig = {
  itemToEnchant: '',
  preferredSlot: 2,
  minLevel: 30,
  searchRadius: 32,
  targetEnchantments: [],
};

/**
 * Task for enchanting items
 */
export class EnchantTask extends Task {
  private config: EnchantConfig;
  private state: EnchantState = EnchantState.FINDING_TABLE;
  private enchantingTable: Block | null = null;
  private selectedSlot: EnchantSlot = 2;
  private enchantTimer: TimerGame;
  private windowOpen: boolean = false;

  constructor(bot: Bot, config: Partial<EnchantConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.enchantTimer = new TimerGame(bot, 0.5);
  }

  get displayName(): string {
    return `Enchant(${this.config.itemToEnchant || 'any'}, slot: ${this.selectedSlot})`;
  }

  onStart(): void {
    this.state = EnchantState.FINDING_TABLE;
    this.enchantingTable = null;
    this.selectedSlot = this.config.preferredSlot;
    this.windowOpen = false;
  }

  onTick(): Task | null {
    switch (this.state) {
      case EnchantState.FINDING_TABLE:
        return this.handleFindingTable();

      case EnchantState.APPROACHING:
        return this.handleApproaching();

      case EnchantState.OPENING_TABLE:
        return this.handleOpeningTable();

      case EnchantState.PLACING_ITEM:
        return this.handlePlacingItem();

      case EnchantState.PLACING_LAPIS:
        return this.handlePlacingLapis();

      case EnchantState.SELECTING_ENCHANT:
        return this.handleSelectingEnchant();

      case EnchantState.ENCHANTING:
        return this.handleEnchanting();

      case EnchantState.RETRIEVING:
        return this.handleRetrieving();

      case EnchantState.CLOSING:
        return this.handleClosing();

      default:
        return null;
    }
  }

  private handleFindingTable(): Task | null {
    this.enchantingTable = this.findEnchantingTable();
    if (!this.enchantingTable) {
      this.state = EnchantState.FAILED;
      return null;
    }

    this.state = EnchantState.APPROACHING;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.enchantingTable) {
      this.state = EnchantState.FINDING_TABLE;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.enchantingTable.position);
    if (dist <= 4.0) {
      this.state = EnchantState.OPENING_TABLE;
      return null;
    }

    return new GetToBlockTask(
      this.bot,
      Math.floor(this.enchantingTable.position.x),
      Math.floor(this.enchantingTable.position.y),
      Math.floor(this.enchantingTable.position.z)
    );
  }

  private handleOpeningTable(): Task | null {
    if (!this.enchantingTable) {
      this.state = EnchantState.FINDING_TABLE;
      return null;
    }

    // Check if enchant window is already open
    const window = (this.bot as any).currentWindow;
    if (window && window.type === 'minecraft:enchantment') {
      this.windowOpen = true;
      this.state = EnchantState.PLACING_ITEM;
      return null;
    }

    // Right-click enchanting table
    return new InteractBlockTask(
      this.bot,
      Math.floor(this.enchantingTable.position.x),
      Math.floor(this.enchantingTable.position.y),
      Math.floor(this.enchantingTable.position.z)
    );
  }

  private handlePlacingItem(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (!window || window.type !== 'minecraft:enchantment') {
      this.windowOpen = false;
      this.state = EnchantState.OPENING_TABLE;
      return null;
    }

    // Check if item is already in enchant slot
    const enchantSlot = window.slots[0];
    if (enchantSlot && this.isEnchantableItem(enchantSlot.name)) {
      this.state = EnchantState.PLACING_LAPIS;
      return null;
    }

    // Find item to enchant
    const item = this.findItemToEnchant();
    if (!item) {
      this.state = EnchantState.FAILED;
      return null;
    }

    // Move item to enchant slot
    try {
      this.bot.clickWindow(item.slot, 0, 0); // Pick up
      this.bot.clickWindow(0, 0, 0); // Place in enchant slot
    } catch {
      // Will retry
    }

    return null;
  }

  private handlePlacingLapis(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (!window) {
      this.state = EnchantState.OPENING_TABLE;
      return null;
    }

    // Check if lapis is already in lapis slot
    const lapisSlot = window.slots[1];
    if (lapisSlot && lapisSlot.name === 'lapis_lazuli' && lapisSlot.count >= 3) {
      this.state = EnchantState.SELECTING_ENCHANT;
      return null;
    }

    // Find lapis in inventory
    const lapis = this.findItem('lapis_lazuli');
    if (!lapis || lapis.count < 3) {
      this.state = EnchantState.FAILED;
      return null;
    }

    // Move lapis to lapis slot
    try {
      this.bot.clickWindow(lapis.slot, 0, 0); // Pick up
      this.bot.clickWindow(1, 0, 0); // Place in lapis slot
    } catch {
      // Will retry
    }

    return null;
  }

  private handleSelectingEnchant(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (!window) {
      this.state = EnchantState.OPENING_TABLE;
      return null;
    }

    // Check player level
    const playerLevel = (this.bot as any).experience?.level ?? 0;
    if (playerLevel < this.config.minLevel) {
      // Not enough levels, wait or fail
      this.state = EnchantState.FAILED;
      return null;
    }

    // Get available enchantments
    const enchants = this.getAvailableEnchants(window);

    // Select best slot
    this.selectedSlot = this.selectBestSlot(enchants, playerLevel);

    if (this.selectedSlot === -1 as any) {
      this.state = EnchantState.FAILED;
      return null;
    }

    this.state = EnchantState.ENCHANTING;
    this.enchantTimer.reset();
    return null;
  }

  private handleEnchanting(): Task | null {
    if (!this.enchantTimer.elapsed()) {
      return null;
    }

    const window = (this.bot as any).currentWindow;
    if (!window) {
      this.state = EnchantState.OPENING_TABLE;
      return null;
    }

    // Click the enchant button (slots 2, 3, 4 for enchant options)
    const enchantButtonSlot = 2 + this.selectedSlot;
    try {
      this.bot.clickWindow(enchantButtonSlot, 0, 0);
    } catch {
      // Will retry
    }

    this.state = EnchantState.RETRIEVING;
    this.enchantTimer.reset();
    return null;
  }

  private handleRetrieving(): Task | null {
    if (!this.enchantTimer.elapsed()) {
      return null;
    }

    const window = (this.bot as any).currentWindow;
    if (!window) {
      this.state = EnchantState.FINISHED;
      return null;
    }

    // Get enchanted item from slot 0
    const enchantedItem = window.slots[0];
    if (enchantedItem) {
      try {
        // Shift-click to move to inventory
        this.bot.clickWindow(0, 0, 1);
      } catch {
        // Will retry
      }
    }

    this.state = EnchantState.CLOSING;
    return null;
  }

  private handleClosing(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (window) {
      try {
        this.bot.closeWindow(window);
      } catch {
        // Ignore
      }
    }

    this.windowOpen = false;
    this.state = EnchantState.FINISHED;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    const window = (this.bot as any).currentWindow;
    if (window) {
      try {
        this.bot.closeWindow(window);
      } catch {
        // Ignore
      }
    }
    this.enchantingTable = null;
    this.windowOpen = false;
  }

  isFinished(): boolean {
    return this.state === EnchantState.FINISHED || this.state === EnchantState.FAILED;
  }

  isFailed(): boolean {
    return this.state === EnchantState.FAILED;
  }

  // ---- Helper Methods ----

  private findEnchantingTable(): Block | null {
    const playerPos = this.bot.entity.position;
    let nearest: Block | null = null;
    let nearestDist = Infinity;

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x += 2) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z += 2) {
        for (let y = -10; y <= 10; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block || block.name !== 'enchanting_table') continue;

          const dist = playerPos.distanceTo(pos);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = block;
          }
        }
      }
    }

    return nearest;
  }

  private isEnchantableItem(itemName: string): boolean {
    // Check if item matches target
    if (this.config.itemToEnchant) {
      return itemName === this.config.itemToEnchant ||
             itemName.includes(this.config.itemToEnchant);
    }

    // General enchantable items
    const enchantable = [
      'sword', 'pickaxe', 'axe', 'shovel', 'hoe',
      'helmet', 'chestplate', 'leggings', 'boots',
      'bow', 'crossbow', 'trident', 'fishing_rod',
      'shears', 'flint_and_steel', 'book',
    ];

    return enchantable.some(type => itemName.includes(type));
  }

  private findItemToEnchant(): any | null {
    for (const item of this.bot.inventory.items()) {
      if (this.isEnchantableItem(item.name)) {
        // Skip already enchanted items (unless it's a book)
        if (item.nbt && item.name !== 'book') continue;
        return item;
      }
    }
    return null;
  }

  private findItem(itemName: string): any | null {
    return this.bot.inventory.items().find(item => item.name === itemName) ?? null;
  }

  private getAvailableEnchants(window: any): Array<{ slot: number; level: number; enchant?: string }> {
    const enchants: Array<{ slot: number; level: number; enchant?: string }> = [];

    // Enchant data is usually in window properties or slots 2-4
    for (let i = 0; i < 3; i++) {
      const levelRequired = window.enchantments?.[i]?.level ?? (i + 1) * 10;
      const enchantment = window.enchantments?.[i]?.enchant ?? undefined;

      enchants.push({
        slot: i as EnchantSlot,
        level: levelRequired,
        enchant: enchantment,
      });
    }

    return enchants;
  }

  private selectBestSlot(
    enchants: Array<{ slot: number; level: number; enchant?: string }>,
    playerLevel: number
  ): EnchantSlot {
    // Filter to affordable enchants
    const affordable = enchants.filter(e => e.level <= playerLevel);

    if (affordable.length === 0) return -1 as any;

    // If target enchantments specified, look for them
    if (this.config.targetEnchantments.length > 0) {
      for (const e of affordable) {
        if (e.enchant && this.config.targetEnchantments.includes(e.enchant)) {
          return e.slot as EnchantSlot;
        }
      }
    }

    // Prefer highest level we can afford
    const sorted = affordable.sort((a, b) => b.slot - a.slot);
    return sorted[0].slot as EnchantSlot;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof EnchantTask)) return false;

    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Convenience functions
 */
export function enchantItem(bot: Bot, itemName: string): EnchantTask {
  return new EnchantTask(bot, { itemToEnchant: itemName });
}

export function enchantBestAvailable(bot: Bot): EnchantTask {
  return new EnchantTask(bot, { preferredSlot: 2 });
}

export function enchantCheap(bot: Bot): EnchantTask {
  return new EnchantTask(bot, { preferredSlot: 0 });
}
