/**
 * GoToDimensionTask - Dimension Navigation
 * Based on BaritonePlus GoToDimensionTask.java
 *
 * High-level task that navigates to a target dimension
 * by using the appropriate portal type.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { Dimension } from './PortalTask';
import { EnterNetherPortalTask } from './EnterNetherPortalTask';

/**
 * Task to go to a specific dimension.
 * Based on BaritonePlus GoToDimensionTask.java
 */
export class GoToDimensionTask extends Task {
  private targetDimension: Dimension;
  private finished: boolean = false;

  constructor(bot: Bot, targetDimension: Dimension) {
    super(bot);
    this.targetDimension = targetDimension;
  }

  get displayName(): string {
    const dimName = this.targetDimension === Dimension.NETHER ? 'Nether'
      : this.targetDimension === Dimension.END ? 'End'
      : 'Overworld';
    return `GoToDimension(${dimName})`;
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    const current = this.getCurrentDimension();

    if (current === this.targetDimension) {
      this.finished = true;
      return null;
    }

    if (this.targetDimension === Dimension.END) {
      // End portal logic would require finding stronghold
      // For now, fail gracefully
      this.finished = true;
      return null;
    }

    return new EnterNetherPortalTask(this.bot, this.targetDimension);
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.finished || this.getCurrentDimension() === this.targetDimension;
  }

  private getCurrentDimension(): Dimension {
    const dimensionName = (this.bot as any).game?.dimension ?? 'minecraft:overworld';
    if (dimensionName.includes('nether')) return Dimension.NETHER;
    if (dimensionName.includes('end')) return Dimension.END;
    return Dimension.OVERWORLD;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GoToDimensionTask)) return false;
    return this.targetDimension === other.targetDimension;
  }
}

/**
 * Helper to go to a dimension
 */
export function goToDimension(bot: Bot, dimension: Dimension): GoToDimensionTask {
  return new GoToDimensionTask(bot, dimension);
}
