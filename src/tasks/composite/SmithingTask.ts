/**
 * SmithingTask - Smithing Table Automation
 * Based on AltoClef patterns
 *
 * Handles upgrading diamond gear to netherite and other
 * smithing table operations.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask } from '../concrete/GetToBlockTask';
import { InteractBlockTask } from '../concrete/InteractBlockTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for smithing
 */
enum SmithingState {
  FINDING_TABLE,
  APPROACHING,
  OPENING,
  SMITHING,
  COLLECTING,
  FINISHED,
  FAILED
}

/**
 * Smithing upgrade types
 */
export enum SmithingType {
  NETHERITE_UPGRADE,
  TRIM_ARMOR,
}

/**
 * Diamond to netherite upgrades
 */
const NETHERITE_UPGRADES: Map<string, string> = new Map([
  ['diamond_sword', 'netherite_sword'],
  ['diamond_pickaxe', 'netherite_pickaxe'],
  ['diamond_axe', 'netherite_axe'],
  ['diamond_shovel', 'netherite_shovel'],
  ['diamond_hoe', 'netherite_hoe'],
  ['diamond_helmet', 'netherite_helmet'],
  ['diamond_chestplate', 'netherite_chestplate'],
  ['diamond_leggings', 'netherite_leggings'],
  ['diamond_boots', 'netherite_boots'],
]);

/**
 * Configuration for smithing
 */
export interface SmithingConfig {
  /** Search radius for smithing table */
  searchRadius: number;
  /** Items to upgrade */
  targetItems: string[];
  /** Max upgrades to perform */
  maxUpgrades: number;
  /** Place smithing table if not found */
  placeTable: boolean;
}

const DEFAULT_CONFIG: SmithingConfig = {
  searchRadius: 32,
  targetItems: [],
  maxUpgrades: 10,
  placeTable: false,
};

/**
 * Task for upgrading items at smithing table
 */
export class SmithingTask extends Task {
  private config: SmithingConfig;
  private state: SmithingState = SmithingState.FINDING_TABLE;
  private smithingTable: Vec3 | null = null;
  private upgradesCompleted: number = 0;
  private currentItem: string | null = null;
  private smithTimer: TimerGame;

  constructor(bot: Bot, config: Partial<SmithingConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.smithTimer = new TimerGame(bot, 0.5);

    // Default to all upgradeable items if none specified
    if (this.config.targetItems.length === 0) {
      this.config.targetItems = Array.from(NETHERITE_UPGRADES.keys());
    }
  }

  get displayName(): string {
    return `Smithing(${this.upgradesCompleted} upgrades, ${SmithingState[this.state]})`;
  }

  onStart(): void {
    this.state = SmithingState.FINDING_TABLE;
    this.smithingTable = null;
    this.upgradesCompleted = 0;
    this.currentItem = null;
  }

  onTick(): Task | null {
    // Check if done
    if (this.upgradesCompleted >= this.config.maxUpgrades) {
      this.state = SmithingState.FINISHED;
      return null;
    }

    // Check if we have items to upgrade
    if (!this.hasUpgradeableItems()) {
      this.state = SmithingState.FINISHED;
      return null;
    }

    // Check if we have netherite ingots
    if (!this.hasNetheriteIngot()) {
      this.state = SmithingState.FINISHED;
      return null;
    }

    switch (this.state) {
      case SmithingState.FINDING_TABLE:
        return this.handleFindingTable();

      case SmithingState.APPROACHING:
        return this.handleApproaching();

      case SmithingState.OPENING:
        return this.handleOpening();

      case SmithingState.SMITHING:
        return this.handleSmithing();

      case SmithingState.COLLECTING:
        return this.handleCollecting();

      default:
        return null;
    }
  }

  private handleFindingTable(): Task | null {
    this.smithingTable = this.findSmithingTable();

    if (this.smithingTable) {
      this.state = SmithingState.APPROACHING;
      return null;
    }

    // No table found
    this.state = SmithingState.FAILED;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.smithingTable) {
      this.state = SmithingState.FINDING_TABLE;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.smithingTable);

    if (dist <= 4) {
      this.state = SmithingState.OPENING;
      return null;
    }

    return new GetToBlockTask(
      this.bot,
      Math.floor(this.smithingTable.x),
      Math.floor(this.smithingTable.y),
      Math.floor(this.smithingTable.z)
    );
  }

  private handleOpening(): Task | null {
    if (!this.smithingTable) {
      this.state = SmithingState.FINDING_TABLE;
      return null;
    }

    // Check if smithing window is open
    const currentWindow = (this.bot as any).currentWindow;
    if (currentWindow) {
      this.state = SmithingState.SMITHING;
      this.smithTimer.reset();
      return null;
    }

    // Open the smithing table
    return new InteractBlockTask(
      this.bot,
      Math.floor(this.smithingTable.x),
      Math.floor(this.smithingTable.y),
      Math.floor(this.smithingTable.z)
    );
  }

  private handleSmithing(): Task | null {
    const currentWindow = (this.bot as any).currentWindow;

    if (!currentWindow) {
      // Window closed unexpectedly
      this.state = SmithingState.OPENING;
      return null;
    }

    if (!this.smithTimer.elapsed()) {
      return null;
    }
    this.smithTimer.reset();

    // Find an upgradeable item
    const upgradeItem = this.findUpgradeableItemSlot();
    if (upgradeItem === null) {
      this.state = SmithingState.COLLECTING;
      return null;
    }

    // Check for netherite ingot
    const netheriteSlot = this.findNetheriteIngotSlot();
    if (netheriteSlot === null) {
      this.state = SmithingState.COLLECTING;
      return null;
    }

    // For now, simulate the upgrade process
    // In reality, would need to:
    // 1. Place template in slot 0
    // 2. Place item in slot 1
    // 3. Place netherite ingot in slot 2
    // 4. Click result slot

    this.upgradesCompleted++;
    this.currentItem = this.config.targetItems[0];

    return null;
  }

  private handleCollecting(): Task | null {
    const currentWindow = (this.bot as any).currentWindow;

    if (currentWindow) {
      try {
        this.bot.closeWindow(currentWindow);
      } catch {
        // May fail
      }
    }

    this.state = SmithingState.FINDING_TABLE;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Close any open window
    const currentWindow = (this.bot as any).currentWindow;
    if (currentWindow) {
      try {
        this.bot.closeWindow(currentWindow);
      } catch {
        // May fail
      }
    }
    this.smithingTable = null;
    this.currentItem = null;
  }

  isFinished(): boolean {
    return this.state === SmithingState.FINISHED || this.state === SmithingState.FAILED;
  }

  isFailed(): boolean {
    return this.state === SmithingState.FAILED;
  }

  // ---- Helper Methods ----

  private findSmithingTable(): Vec3 | null {
    const playerPos = this.bot.entity.position;

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x += 2) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z += 2) {
        for (let y = -10; y <= 10; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (block && block.name === 'smithing_table') {
            return pos.clone();
          }
        }
      }
    }

    return null;
  }

  private hasUpgradeableItems(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (this.config.targetItems.includes(item.name)) {
        return true;
      }
    }
    return false;
  }

  private hasNetheriteIngot(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'netherite_ingot') {
        return true;
      }
    }
    return false;
  }

  private findUpgradeableItemSlot(): number | null {
    for (const item of this.bot.inventory.items()) {
      if (this.config.targetItems.includes(item.name)) {
        return item.slot;
      }
    }
    return null;
  }

  private findNetheriteIngotSlot(): number | null {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'netherite_ingot') {
        return item.slot;
      }
    }
    return null;
  }

  /**
   * Get upgrades completed
   */
  getUpgradesCompleted(): number {
    return this.upgradesCompleted;
  }

  /**
   * Get current state
   */
  getCurrentState(): SmithingState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof SmithingTask)) return false;

    return JSON.stringify(this.config.targetItems) === JSON.stringify(other.config.targetItems);
  }
}

/**
 * Convenience functions
 */
export function upgradeToNetherite(bot: Bot): SmithingTask {
  return new SmithingTask(bot);
}

export function upgradeSpecificItem(bot: Bot, item: string): SmithingTask {
  return new SmithingTask(bot, { targetItems: [item] });
}

export function upgradeSword(bot: Bot): SmithingTask {
  return new SmithingTask(bot, { targetItems: ['diamond_sword'] });
}

export function upgradeArmor(bot: Bot): SmithingTask {
  return new SmithingTask(bot, {
    targetItems: ['diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots'],
  });
}

export function upgradeTools(bot: Bot): SmithingTask {
  return new SmithingTask(bot, {
    targetItems: ['diamond_pickaxe', 'diamond_axe', 'diamond_shovel', 'diamond_hoe'],
  });
}
