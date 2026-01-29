/**
 * LootDesertTempleTask - Desert Temple Looting
 * Based on BaritonePlus's LootDesertTempleTask.java
 *
 * WHY: Desert temples contain 4 chests with valuable loot:
 * - Diamonds, emeralds, gold, iron
 * - Enchanted books, golden apples
 * - Saddles, horse armor
 * - TNT (used in speedruns for crafting minecarts)
 *
 * IMPORTANT: Desert temples have a TNT trap triggered by a
 * stone pressure plate in the center. This task safely disarms
 * it before looting the chests.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { DestroyBlockTask } from './ConstructionTask';
import { LootContainerTask } from './LootContainerTask';
import { BlockPos } from '../../types';

/**
 * Relative positions of chests from the temple center (blue terracotta floor)
 */
const CHEST_POSITIONS_RELATIVE: Vec3[] = [
  new Vec3(2, 0, 0),
  new Vec3(-2, 0, 0),
  new Vec3(0, 0, 2),
  new Vec3(0, 0, -2),
];

/**
 * State for temple looting
 */
enum TempleLootState {
  CHECKING_TRAP,
  DISARMING_TRAP,
  LOOTING_CHEST,
  FINISHED,
}

/**
 * Configuration for LootDesertTempleTask
 */
export interface LootDesertTempleConfig {
  /** Items to look for in chests (empty = take everything) */
  wantedItems: string[];
  /** Whether to disarm the pressure plate first */
  disarmTrap: boolean;
}

const DEFAULT_CONFIG: LootDesertTempleConfig = {
  wantedItems: [],
  disarmTrap: true,
};

/**
 * Task to safely loot a desert temple.
 *
 * WHY: Desert temples are valuable early-game structures containing
 * 4 chests of loot. However, they have a TNT trap that will destroy
 * the loot and kill the player if triggered.
 *
 * This task:
 * 1. Identifies the temple center (pressure plate location)
 * 2. Safely destroys the pressure plate to disarm the trap
 * 3. Loots all 4 chests systematically
 *
 * Based on BaritonePlus LootDesertTempleTask.java
 */
export class LootDesertTempleTask extends Task {
  private templeCenter: BlockPos;
  private config: LootDesertTempleConfig;
  private state: TempleLootState = TempleLootState.CHECKING_TRAP;
  private currentChest: number = 0;
  private lootTask: LootContainerTask | null = null;

  constructor(bot: Bot, templeCenter: BlockPos, config: Partial<LootDesertTempleConfig> = {}) {
    super(bot);
    this.templeCenter = templeCenter;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create task to loot temple at position
   */
  static at(bot: Bot, x: number, y: number, z: number): LootDesertTempleTask {
    return new LootDesertTempleTask(bot, new BlockPos(x, y, z));
  }

  /**
   * Create task to loot temple at Vec3
   */
  static atVec3(bot: Bot, pos: Vec3): LootDesertTempleTask {
    return new LootDesertTempleTask(
      bot,
      new BlockPos(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z))
    );
  }

  get displayName(): string {
    return `LootDesertTemple(${this.templeCenter.x}, ${this.templeCenter.y}, ${this.templeCenter.z})`;
  }

  onStart(): void {
    this.state = TempleLootState.CHECKING_TRAP;
    this.currentChest = 0;
    this.lootTask = null;
  }

  onTick(): Task | null {
    // Check if all chests are looted
    if (this.currentChest >= 4) {
      this.state = TempleLootState.FINISHED;
      return null;
    }

    // Handle current loot task
    if (this.lootTask && !this.lootTask.isFinished()) {
      this.state = TempleLootState.LOOTING_CHEST;
      return this.lootTask;
    }

    // If loot task finished, move to next chest
    if (this.lootTask) {
      this.currentChest++;
      this.lootTask = null;
      return null; // Will loop back
    }

    // Check for pressure plate (trap)
    if (this.config.disarmTrap) {
      const centerBlock = this.bot.blockAt(
        new Vec3(this.templeCenter.x, this.templeCenter.y, this.templeCenter.z)
      );

      if (centerBlock && centerBlock.name === 'stone_pressure_plate') {
        this.state = TempleLootState.DISARMING_TRAP;
        return new DestroyBlockTask(
          this.bot,
          this.templeCenter.x,
          this.templeCenter.y,
          this.templeCenter.z
        );
      }
    }

    // Loot the next chest
    if (this.currentChest < 4) {
      const chestOffset = CHEST_POSITIONS_RELATIVE[this.currentChest];
      const chestPos = new BlockPos(
        this.templeCenter.x + Math.floor(chestOffset.x),
        this.templeCenter.y + Math.floor(chestOffset.y),
        this.templeCenter.z + Math.floor(chestOffset.z)
      );

      this.state = TempleLootState.LOOTING_CHEST;

      // Create item filter from wanted items
      const wantedSet = new Set(this.config.wantedItems);
      const itemFilter = this.config.wantedItems.length > 0
        ? (itemName: string) => wantedSet.has(itemName)
        : () => true; // Take everything

      this.lootTask = new LootContainerTask(this.bot, chestPos, itemFilter);

      return this.lootTask;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.lootTask = null;
  }

  isFinished(): boolean {
    return this.state === TempleLootState.FINISHED || this.currentChest >= 4;
  }

  /**
   * Get current state
   */
  getState(): TempleLootState {
    return this.state;
  }

  /**
   * Get number of chests looted
   */
  getChestsLooted(): number {
    return this.currentChest;
  }

  /**
   * Get temple position
   */
  getTempleCenter(): BlockPos {
    return this.templeCenter;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof LootDesertTempleTask)) return false;
    return this.templeCenter.equals(other.templeCenter);
  }
}

/**
 * Convenience function to loot desert temple
 */
export function lootDesertTemple(bot: Bot, x: number, y: number, z: number): LootDesertTempleTask {
  return LootDesertTempleTask.at(bot, x, y, z);
}

/**
 * Convenience function to loot desert temple with specific items
 */
export function lootDesertTempleFor(
  bot: Bot,
  x: number,
  y: number,
  z: number,
  wantedItems: string[]
): LootDesertTempleTask {
  return new LootDesertTempleTask(bot, new BlockPos(x, y, z), { wantedItems });
}

export { TempleLootState };
