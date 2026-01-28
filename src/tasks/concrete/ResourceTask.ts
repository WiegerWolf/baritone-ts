/**
 * ResourceTask - Base Class for Resource Collection Tasks
 * Based on BaritonePlus's ResourceTask.java
 *
 * WHY: Many tasks share the pattern of collecting items until a target
 * count is reached. This base class handles item tracking, count checking,
 * and provides hooks for dimension-specific behavior.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';

/**
 * Represents a target item to collect
 */
export interface ItemTarget {
  /** Item name(s) to match */
  items: string[];
  /** Target count to collect */
  targetCount: number;
}

/**
 * Create an ItemTarget helper
 */
export function itemTarget(item: string | string[], count: number): ItemTarget {
  return {
    items: Array.isArray(item) ? item : [item],
    targetCount: count,
  };
}

/**
 * Dimension enum for dimension-specific behavior
 */
export enum Dimension {
  OVERWORLD = 'minecraft:overworld',
  NETHER = 'minecraft:the_nether',
  END = 'minecraft:the_end',
}

/**
 * Abstract base class for tasks that collect resources.
 *
 * WHY: Resource collection is a common pattern - mine blocks, kill mobs,
 * loot chests until we have enough items. This class handles the common
 * logic of tracking inventory counts and determining when we're done.
 *
 * Based on BaritonePlus ResourceTask.java
 */
export abstract class ResourceTask extends Task {
  protected itemTargets: ItemTarget[];
  private finished: boolean = false;
  private failed: boolean = false;

  constructor(bot: Bot, itemTargets: ItemTarget[]) {
    super(bot);
    this.itemTargets = itemTargets;
  }

  get displayName(): string {
    const targetNames = this.itemTargets.map(t =>
      `${t.items[0]}${t.items.length > 1 ? '...' : ''} x${t.targetCount}`
    ).join(', ');
    return `Resource(${targetNames})`;
  }

  onStart(): void {
    this.finished = false;
    this.failed = false;
    this.onResourceStart();
  }

  onTick(): Task | null {
    // Check if we've collected enough
    if (this.isResourceTaskFinished()) {
      this.finished = true;
      return null;
    }

    return this.onResourceTick();
  }

  onStop(interruptTask: ITask | null): void {
    this.onResourceStop(interruptTask);
  }

  isFinished(): boolean {
    return this.finished || this.isResourceTaskFinished();
  }

  isFailed(): boolean {
    return this.failed;
  }

  // ---- Abstract methods for subclasses ----

  /**
   * Called when the resource task starts
   */
  protected abstract onResourceStart(): void;

  /**
   * Called each tick to continue resource collection
   */
  protected abstract onResourceTick(): Task | null;

  /**
   * Called when the resource task stops
   */
  protected abstract onResourceStop(interruptTask: ITask | null): void;

  /**
   * Check equality for resource task deduplication
   */
  protected abstract isEqualResource(other: ResourceTask): boolean;

  // ---- Helper methods ----

  /**
   * Check if all item targets have been met
   */
  protected isResourceTaskFinished(): boolean {
    for (const target of this.itemTargets) {
      const count = this.getItemCount(target);
      if (count < target.targetCount) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get the current count of items matching a target
   */
  protected getItemCount(target: ItemTarget): number {
    const items = this.bot.inventory.items();
    let count = 0;

    for (const item of items) {
      if (target.items.some(name =>
        item.name === name || item.name.includes(name)
      )) {
        count += item.count;
      }
    }

    return count;
  }

  /**
   * Get total count of all items across all targets
   */
  protected getTotalItemCount(): number {
    let total = 0;
    for (const target of this.itemTargets) {
      total += this.getItemCount(target);
    }
    return total;
  }

  /**
   * Get the remaining count needed for a target
   */
  protected getRemainingCount(target: ItemTarget): number {
    return Math.max(0, target.targetCount - this.getItemCount(target));
  }

  /**
   * Get the current dimension
   */
  protected getCurrentDimension(): Dimension {
    const dimensionName = (this.bot as any).game?.dimension ?? 'minecraft:overworld';
    if (dimensionName.includes('nether')) return Dimension.NETHER;
    if (dimensionName.includes('end')) return Dimension.END;
    return Dimension.OVERWORLD;
  }

  /**
   * Check if in wrong dimension for resource (override in subclass)
   */
  protected isInWrongDimension(): boolean {
    return false;
  }

  /**
   * Mark the task as failed
   */
  protected markFailed(): void {
    this.failed = true;
  }

  /**
   * Mark the task as finished
   */
  protected markFinished(): void {
    this.finished = true;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ResourceTask)) return false;
    return this.isEqualResource(other);
  }
}
