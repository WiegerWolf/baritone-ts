/**
 * ClearRegionTask - Clear all blocks in a 3D region
 * Based on BaritonePlus's construction tasks
 *
 * WHY: Region clearing is essential for excavation, flattening terrain,
 * creating farms or mob spawners, and removing unwanted structures.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { DestroyBlockTask } from './ConstructionTask';
import { BlockPos } from '../../types';

/**
 * State for region clearing
 */
export enum ClearRegionState {
  SCANNING,
  DESTROYING,
  FINISHED,
}

/**
 * Task to clear all blocks in a 3D region.
 *
 * WHY: Region clearing is essential for:
 * - Excavation for underground bases
 * - Flattening terrain for building
 * - Creating farms or mob spawners
 * - Removing unwanted structures
 *
 * Based on BaritonePlus ClearRegionTask.java
 */
export class ClearRegionTask extends Task {
  private from: BlockPos;
  private to: BlockPos;
  private state: ClearRegionState = ClearRegionState.SCANNING;
  private currentTarget: BlockPos | null = null;

  constructor(bot: Bot, from: BlockPos, to: BlockPos) {
    super(bot);
    // Normalize coordinates
    this.from = new BlockPos(
      Math.min(from.x, to.x),
      Math.min(from.y, to.y),
      Math.min(from.z, to.z)
    );
    this.to = new BlockPos(
      Math.max(from.x, to.x),
      Math.max(from.y, to.y),
      Math.max(from.z, to.z)
    );
  }

  get displayName(): string {
    return `ClearRegion(${this.from.x},${this.from.y},${this.from.z} -> ${this.to.x},${this.to.y},${this.to.z})`;
  }

  onStart(): void {
    this.state = ClearRegionState.SCANNING;
    this.currentTarget = null;
  }

  onTick(): Task | null {
    // Find next block to destroy
    const nextBlock = this.findNextBlock();

    if (nextBlock === null) {
      this.state = ClearRegionState.FINISHED;
      return null;
    }

    this.state = ClearRegionState.DESTROYING;
    this.currentTarget = nextBlock;
    return new DestroyBlockTask(this.bot, nextBlock.x, nextBlock.y, nextBlock.z);
  }

  /**
   * Find next non-air block in region
   */
  private findNextBlock(): BlockPos | null {
    // Iterate from top to bottom (safer for gravity-affected blocks)
    for (let y = this.to.y; y >= this.from.y; y--) {
      for (let x = this.from.x; x <= this.to.x; x++) {
        for (let z = this.from.z; z <= this.to.z; z++) {
          const pos = new Vec3(x, y, z);
          const block = this.bot.blockAt(pos);

          if (block && block.name !== 'air') {
            return new BlockPos(x, y, z);
          }
        }
      }
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.currentTarget = null;
  }

  isFinished(): boolean {
    // Check if all blocks in region are air
    for (let x = this.from.x; x <= this.to.x; x++) {
      for (let y = this.from.y; y <= this.to.y; y++) {
        for (let z = this.from.z; z <= this.to.z; z++) {
          const block = this.bot.blockAt(new Vec3(x, y, z));
          if (block && block.name !== 'air') {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Get current state
   */
  getState(): ClearRegionState {
    return this.state;
  }

  /**
   * Get the region being cleared
   */
  getRegion(): { from: BlockPos; to: BlockPos } {
    return { from: this.from, to: this.to };
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ClearRegionTask)) return false;
    return other.from.equals(this.from) && other.to.equals(this.to);
  }
}

/**
 * Convenience function to clear a region
 */
export function clearRegion(bot: Bot, from: BlockPos, to: BlockPos): ClearRegionTask {
  return new ClearRegionTask(bot, from, to);
}
