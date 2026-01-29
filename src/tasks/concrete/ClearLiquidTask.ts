/**
 * ClearLiquidTask - Task to clear a liquid at a position by placing a block
 * Split from ConstructionTask.ts
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { PlaceBlockNearbyTask } from './PlaceBlockNearbyTask';

/**
 * Task to clear a liquid (water/lava) at a position by placing a block.
 *
 * WHY: Liquids need to be dealt with differently than solid blocks.
 * We can't mine them - we need to place a block to displace them.
 */
export class ClearLiquidTask extends Task {
  private target: BlockPos;
  private blockToPlace: string;
  private placeTask: PlaceBlockNearbyTask | null = null;
  private finished: boolean = false;

  constructor(bot: Bot, x: number, y: number, z: number, blockToPlace: string = 'cobblestone') {
    super(bot);
    this.target = new BlockPos(x, y, z);
    this.blockToPlace = blockToPlace;
  }

  get displayName(): string {
    return `ClearLiquid(${this.target.x}, ${this.target.y}, ${this.target.z})`;
  }

  onStart(): void {
    this.finished = false;
    this.placeTask = null;
  }

  onTick(): Task | null {
    // Check if liquid is cleared
    const block = this.bot.blockAt(new Vec3(this.target.x, this.target.y, this.target.z));
    if (!block || (!block.name.includes('water') && !block.name.includes('lava'))) {
      this.finished = true;
      return null;
    }

    // Place a block at the liquid position
    if (!this.placeTask) {
      this.placeTask = new PlaceBlockNearbyTask(this.bot, [this.blockToPlace], {
        canPlaceAt: (pos) => pos.equals(this.target),
        searchRadius: 1,
      });
    }

    return this.placeTask;
  }

  isFinished(): boolean {
    return this.finished || (this.placeTask !== null && this.placeTask.isFinished());
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ClearLiquidTask)) return false;
    return this.target.equals(other.target);
  }
}
