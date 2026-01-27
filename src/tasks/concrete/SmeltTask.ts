/**
 * SmeltTask - Furnace Smelting Tasks
 * Based on AltoClef's smelting system
 *
 * Tasks for smelting items in furnaces.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import type { Window } from 'prismarine-windows';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { GetToBlockTask } from './GoToTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Furnace slot indices
 */
const FURNACE_SLOTS = {
  INPUT: 0,
  FUEL: 1,
  OUTPUT: 2,
};

/**
 * Common fuel items and their burn times (in ticks, 20 ticks = 1 second)
 */
const FUEL_BURN_TIMES: Record<string, number> = {
  'lava_bucket': 20000,
  'coal_block': 16000,
  'blaze_rod': 2400,
  'coal': 1600,
  'charcoal': 1600,
  'oak_log': 300,
  'birch_log': 300,
  'spruce_log': 300,
  'jungle_log': 300,
  'acacia_log': 300,
  'dark_oak_log': 300,
  'oak_planks': 300,
  'birch_planks': 300,
  'spruce_planks': 300,
  'jungle_planks': 300,
  'acacia_planks': 300,
  'dark_oak_planks': 300,
  'stick': 100,
  'wooden_sword': 200,
  'wooden_pickaxe': 200,
  'wooden_axe': 200,
  'wooden_shovel': 200,
  'wooden_hoe': 200,
};

/**
 * State for smelting operation
 */
enum SmeltState {
  FINDING_FURNACE,
  GOING_TO_FURNACE,
  OPENING_FURNACE,
  ADDING_INPUT,
  ADDING_FUEL,
  WAITING,
  COLLECTING_OUTPUT,
  FINISHED,
  FAILED
}

/**
 * Task to smelt items in a furnace
 */
export class SmeltTask extends Task {
  private inputItem: string;
  private outputItem: string;
  private count: number;
  private state: SmeltState = SmeltState.FINDING_FURNACE;
  private furnacePos: Vec3 | null = null;
  private furnaceWindow: Window | null = null;
  private waitTimer: TimerGame;
  private smelted: number = 0;

  constructor(bot: Bot, inputItem: string, outputItem: string, count: number = 1) {
    super(bot);
    this.inputItem = inputItem;
    this.outputItem = outputItem;
    this.count = count;
    this.waitTimer = new TimerGame(bot, 0.5);
  }

  get displayName(): string {
    return `Smelt(${this.count}x ${this.inputItem} -> ${this.outputItem})`;
  }

  onStart(): void {
    this.state = SmeltState.FINDING_FURNACE;
    this.furnacePos = null;
    this.furnaceWindow = null;
    this.smelted = 0;
  }

  onTick(): Task | null {
    // Check if we have enough output
    const outputCount = this.getItemCount(this.outputItem);
    if (outputCount >= this.count) {
      this.state = SmeltState.FINISHED;
      return null;
    }

    switch (this.state) {
      case SmeltState.FINDING_FURNACE:
        return this.handleFindingFurnace();

      case SmeltState.GOING_TO_FURNACE:
        return this.handleGoingToFurnace();

      case SmeltState.OPENING_FURNACE:
        return this.handleOpeningFurnace();

      case SmeltState.ADDING_INPUT:
        return this.handleAddingInput();

      case SmeltState.ADDING_FUEL:
        return this.handleAddingFuel();

      case SmeltState.WAITING:
        return this.handleWaiting();

      case SmeltState.COLLECTING_OUTPUT:
        return this.handleCollectingOutput();

      default:
        return null;
    }
  }

  private handleFindingFurnace(): Task | null {
    this.furnacePos = this.findNearestFurnace();
    if (!this.furnacePos) {
      // No furnace found - need to craft or place one
      this.state = SmeltState.FAILED;
      return null;
    }
    this.state = SmeltState.GOING_TO_FURNACE;
    return null;
  }

  private handleGoingToFurnace(): Task | null {
    if (!this.furnacePos) {
      this.state = SmeltState.FAILED;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.furnacePos);
    if (dist <= 4.0) {
      this.state = SmeltState.OPENING_FURNACE;
      return null;
    }

    return new GetToBlockTask(
      this.bot,
      Math.floor(this.furnacePos.x),
      Math.floor(this.furnacePos.y),
      Math.floor(this.furnacePos.z)
    );
  }

  private handleOpeningFurnace(): Task | null {
    if (!this.furnacePos) {
      this.state = SmeltState.FAILED;
      return null;
    }

    const block = this.bot.blockAt(this.furnacePos);
    if (!block || !block.name.includes('furnace')) {
      this.state = SmeltState.FAILED;
      return null;
    }

    // Open the furnace
    try {
      this.bot.activateBlock(block).then(() => {
        // Window should open via event
      });

      // Check if window opened
      if (this.bot.currentWindow) {
        this.furnaceWindow = this.bot.currentWindow;
        this.state = SmeltState.ADDING_INPUT;
      }
    } catch (err) {
      this.state = SmeltState.FAILED;
    }

    return null;
  }

  private handleAddingInput(): Task | null {
    if (!this.furnaceWindow) {
      this.state = SmeltState.OPENING_FURNACE;
      return null;
    }

    // Check if input slot is empty or has same item
    const inputSlot = this.furnaceWindow.slots[FURNACE_SLOTS.INPUT];
    if (inputSlot && inputSlot.name !== this.inputItem) {
      // Different item in input - wait or fail
      this.state = SmeltState.WAITING;
      return null;
    }

    // Find input item in inventory
    const inputItemSlot = this.findItemSlot(this.inputItem);
    if (inputItemSlot === null) {
      // No input items
      this.state = SmeltState.FAILED;
      return null;
    }

    // Move item to furnace input
    try {
      // Click to pick up, then click on furnace input slot
      this.bot.clickWindow(inputItemSlot, 0, 0);
      this.bot.clickWindow(FURNACE_SLOTS.INPUT, 0, 0);
      this.state = SmeltState.ADDING_FUEL;
    } catch (err) {
      // Will retry
    }

    return null;
  }

  private handleAddingFuel(): Task | null {
    if (!this.furnaceWindow) {
      this.state = SmeltState.OPENING_FURNACE;
      return null;
    }

    // Check if fuel slot needs fuel
    const fuelSlot = this.furnaceWindow.slots[FURNACE_SLOTS.FUEL];
    if (fuelSlot && FUEL_BURN_TIMES[fuelSlot.name]) {
      // Has fuel
      this.state = SmeltState.WAITING;
      return null;
    }

    // Find fuel in inventory
    const fuelItemSlot = this.findFuelSlot();
    if (fuelItemSlot === null) {
      // No fuel - fail
      this.state = SmeltState.FAILED;
      return null;
    }

    // Move fuel to furnace
    try {
      this.bot.clickWindow(fuelItemSlot, 0, 0);
      this.bot.clickWindow(FURNACE_SLOTS.FUEL, 0, 0);
      this.state = SmeltState.WAITING;
    } catch (err) {
      // Will retry
    }

    return null;
  }

  private handleWaiting(): Task | null {
    if (!this.waitTimer.elapsed()) {
      return null;
    }

    // Check if there's output to collect
    if (this.furnaceWindow) {
      const outputSlot = this.furnaceWindow.slots[FURNACE_SLOTS.OUTPUT];
      if (outputSlot && outputSlot.name === this.outputItem) {
        this.state = SmeltState.COLLECTING_OUTPUT;
        return null;
      }

      // Check if still smelting (has input)
      const inputSlot = this.furnaceWindow.slots[FURNACE_SLOTS.INPUT];
      if (!inputSlot || inputSlot.count === 0) {
        // Input depleted - check if we need more
        const have = this.getItemCount(this.outputItem);
        if (have >= this.count) {
          this.state = SmeltState.FINISHED;
        } else {
          // Need more input
          this.state = SmeltState.ADDING_INPUT;
        }
      }
    }

    this.waitTimer.reset();
    return null;
  }

  private handleCollectingOutput(): Task | null {
    if (!this.furnaceWindow) {
      this.state = SmeltState.OPENING_FURNACE;
      return null;
    }

    // Shift-click to collect all output
    try {
      this.bot.clickWindow(FURNACE_SLOTS.OUTPUT, 0, 1); // Shift-click
      this.state = SmeltState.WAITING;
    } catch (err) {
      // Will retry
    }

    this.waitTimer.reset();
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Close furnace window if open
    try {
      if (this.bot.currentWindow) {
        this.bot.closeWindow(this.bot.currentWindow);
      }
    } catch {
      // Ignore
    }
    this.furnaceWindow = null;
  }

  isFinished(): boolean {
    return this.state === SmeltState.FINISHED || this.state === SmeltState.FAILED;
  }

  isFailed(): boolean {
    return this.state === SmeltState.FAILED;
  }

  /**
   * Get count of item in inventory
   */
  private getItemCount(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Find item slot in inventory
   */
  private findItemSlot(itemName: string): number | null {
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName) {
        return item.slot;
      }
    }
    return null;
  }

  /**
   * Find fuel slot in inventory
   */
  private findFuelSlot(): number | null {
    // Prioritize better fuels
    const fuelPriority = Object.entries(FUEL_BURN_TIMES)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    for (const fuelName of fuelPriority) {
      const slot = this.findItemSlot(fuelName);
      if (slot !== null) {
        return slot;
      }
    }
    return null;
  }

  /**
   * Find nearest furnace
   */
  private findNearestFurnace(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const maxRange = 32;

    let nearest: Vec3 | null = null;
    let nearestDist = Infinity;

    for (let x = -maxRange; x <= maxRange; x += 2) {
      for (let y = -maxRange; y <= maxRange; y += 2) {
        for (let z = -maxRange; z <= maxRange; z += 2) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (block && (block.name === 'furnace' || block.name === 'blast_furnace' || block.name === 'smoker')) {
            const dist = playerPos.distanceTo(pos);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = pos;
            }
          }
        }
      }
    }

    return nearest;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof SmeltTask)) return false;
    return this.inputItem === other.inputItem &&
           this.outputItem === other.outputItem &&
           this.count === other.count;
  }
}

/**
 * Check if an item is valid fuel
 */
export function isFuel(itemName: string): boolean {
  return itemName in FUEL_BURN_TIMES;
}

/**
 * Get burn time for a fuel item
 */
export function getFuelBurnTime(itemName: string): number {
  return FUEL_BURN_TIMES[itemName] || 0;
}
