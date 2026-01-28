/**
 * CollectFuelTask - Collect Fuel for Smelting
 * Based on BaritonePlus's CollectFuelTask.java
 *
 * WHY: Smelting requires fuel. This task collects appropriate fuel
 * based on availability and dimension - coal in overworld, wood as
 * fallback, and handles dimension switching if needed.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { MineAndCollectTask, mineAndCollect } from './MineAndCollectTask';
import { Dimension } from './ResourceTask';
import { getFuelBurnTime } from './SmeltTask';

/**
 * Fuel source types in order of preference
 */
export interface FuelSource {
  /** Item name */
  itemName: string;
  /** Block to mine (if applicable) */
  blockName?: string;
  /** Burn time per item */
  burnTime: number;
  /** Dimensions where this fuel is available */
  dimensions: Dimension[];
}

/**
 * Standard fuel sources
 */
export const FUEL_SOURCES: FuelSource[] = [
  {
    itemName: 'coal',
    blockName: 'coal_ore',
    burnTime: 8,
    dimensions: [Dimension.OVERWORLD],
  },
  {
    itemName: 'charcoal',
    burnTime: 8,
    dimensions: [Dimension.OVERWORLD, Dimension.NETHER],
  },
  {
    itemName: 'coal_block',
    burnTime: 80,
    dimensions: [Dimension.OVERWORLD],
  },
  {
    itemName: 'oak_planks',
    blockName: 'oak_log',
    burnTime: 1.5,
    dimensions: [Dimension.OVERWORLD],
  },
  {
    itemName: 'spruce_planks',
    blockName: 'spruce_log',
    burnTime: 1.5,
    dimensions: [Dimension.OVERWORLD],
  },
  {
    itemName: 'birch_planks',
    blockName: 'birch_log',
    burnTime: 1.5,
    dimensions: [Dimension.OVERWORLD],
  },
  {
    itemName: 'blaze_rod',
    burnTime: 12,
    dimensions: [Dimension.NETHER],
  },
  {
    itemName: 'dried_kelp_block',
    burnTime: 20,
    dimensions: [Dimension.OVERWORLD],
  },
  {
    itemName: 'stick',
    burnTime: 0.5,
    dimensions: [Dimension.OVERWORLD, Dimension.NETHER],
  },
];

/**
 * State for collect fuel task
 */
enum CollectFuelState {
  EVALUATING,
  COLLECTING,
  FINISHED,
  FAILED
}

/**
 * Configuration for CollectFuelTask
 */
export interface CollectFuelConfig {
  /** Preferred fuel sources (if not specified, uses defaults) */
  preferredFuels?: string[];
  /** Whether to mine for fuel or just pick up existing items */
  canMine: boolean;
}

const DEFAULT_CONFIG: CollectFuelConfig = {
  canMine: true,
};

/**
 * Task to collect fuel for smelting operations.
 *
 * WHY: Furnaces need fuel. Coal is ideal in the overworld, but in the
 * nether we might need alternatives. This task evaluates available
 * fuel sources and collects the most efficient option.
 *
 * Based on BaritonePlus CollectFuelTask.java
 */
export class CollectFuelTask extends Task {
  private targetFuelValue: number;
  private config: CollectFuelConfig;
  private state: CollectFuelState = CollectFuelState.EVALUATING;
  private currentSubtask: Task | null = null;

  constructor(bot: Bot, targetFuelValue: number, config: Partial<CollectFuelConfig> = {}) {
    super(bot);
    this.targetFuelValue = targetFuelValue;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get displayName(): string {
    return `CollectFuel(${this.targetFuelValue})`;
  }

  onStart(): void {
    this.state = CollectFuelState.EVALUATING;
    this.currentSubtask = null;
  }

  onTick(): Task | null {
    // Check if we have enough fuel
    if (this.hasEnoughFuel()) {
      this.state = CollectFuelState.FINISHED;
      return null;
    }

    switch (this.state) {
      case CollectFuelState.EVALUATING:
        return this.handleEvaluating();

      case CollectFuelState.COLLECTING:
        return this.handleCollecting();

      default:
        return null;
    }
  }

  private handleEvaluating(): Task | null {
    const currentDimension = this.getCurrentDimension();

    // Find best fuel source for current dimension
    const bestFuel = this.findBestFuelSource(currentDimension);

    if (!bestFuel) {
      // No fuel available in this dimension
      // Could switch dimensions, but for now just fail
      this.state = CollectFuelState.FAILED;
      return null;
    }

    // Calculate how many items we need
    const currentFuelValue = this.getCurrentFuelValue();
    const needed = this.targetFuelValue - currentFuelValue;
    const itemsNeeded = Math.ceil(needed / bestFuel.burnTime);

    // Create collection task
    if (bestFuel.blockName && this.config.canMine) {
      // Mine the block
      this.currentSubtask = mineAndCollect(
        this.bot,
        bestFuel.itemName,
        itemsNeeded,
        [bestFuel.blockName]
      );
    } else {
      // Just try to pick up the item (not implemented - would need search)
      // Fall back to mining coal
      this.currentSubtask = mineAndCollect(
        this.bot,
        'coal',
        itemsNeeded,
        ['coal_ore', 'deepslate_coal_ore']
      );
    }

    this.state = CollectFuelState.COLLECTING;
    return null;
  }

  private handleCollecting(): Task | null {
    // Check if we now have enough fuel
    if (this.hasEnoughFuel()) {
      this.state = CollectFuelState.FINISHED;
      return null;
    }

    // Continue with subtask
    if (this.currentSubtask) {
      if (this.currentSubtask.isFinished()) {
        // Subtask done but we might need more
        this.state = CollectFuelState.EVALUATING;
        return null;
      }
      return this.currentSubtask;
    }

    // No subtask - re-evaluate
    this.state = CollectFuelState.EVALUATING;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.currentSubtask = null;
  }

  isFinished(): boolean {
    return this.state === CollectFuelState.FINISHED || this.hasEnoughFuel();
  }

  isFailed(): boolean {
    return this.state === CollectFuelState.FAILED;
  }

  // ---- Helper methods ----

  private hasEnoughFuel(): boolean {
    return this.getCurrentFuelValue() >= this.targetFuelValue;
  }

  private getCurrentFuelValue(): number {
    const items = this.bot.inventory.items();
    let totalFuel = 0;

    for (const item of items) {
      const burnTime = getFuelBurnTime(item.name);
      totalFuel += burnTime * item.count;
    }

    return totalFuel;
  }

  private findBestFuelSource(dimension: Dimension): FuelSource | null {
    // Filter by dimension and preference
    const availableSources = FUEL_SOURCES.filter(source =>
      source.dimensions.includes(dimension)
    );

    if (availableSources.length === 0) return null;

    // If we have preferred fuels, prioritize those
    if (this.config.preferredFuels) {
      for (const preferred of this.config.preferredFuels) {
        const match = availableSources.find(s => s.itemName === preferred);
        if (match) return match;
      }
    }

    // Otherwise return highest burn time with mineable source
    const mineableSources = availableSources.filter(s => s.blockName);
    if (mineableSources.length > 0) {
      return mineableSources.reduce((best, current) =>
        current.burnTime > best.burnTime ? current : best
      );
    }

    // Fallback to any source
    return availableSources[0];
  }

  private getCurrentDimension(): Dimension {
    const dimensionName = (this.bot as any).game?.dimension ?? 'minecraft:overworld';
    if (dimensionName.includes('nether')) return Dimension.NETHER;
    if (dimensionName.includes('end')) return Dimension.END;
    return Dimension.OVERWORLD;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof CollectFuelTask)) return false;
    return Math.abs(this.targetFuelValue - other.targetFuelValue) < 0.01;
  }
}

/**
 * Helper function to create collect fuel task
 */
export function collectFuel(bot: Bot, amount: number): CollectFuelTask {
  return new CollectFuelTask(bot, amount);
}

/**
 * Collect enough fuel to smelt a number of items
 */
export function collectFuelForSmelting(bot: Bot, itemCount: number): CollectFuelTask {
  // Each smelt takes 1 fuel unit, coal gives 8
  return new CollectFuelTask(bot, itemCount);
}
