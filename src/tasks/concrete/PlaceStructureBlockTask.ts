/**
 * PlaceStructureBlockTask - Place any throwaway block at a position
 * Based on BaritonePlus's construction tasks
 *
 * WHY: Used in construction when specific block type doesn't matter.
 * Pillar up, bridge across, fill gaps with whatever blocks are available.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { PlaceBlockTask } from './PlaceBlockTask';
import { BlockPos } from '../../types';

/**
 * Throwaway block types for covering
 */
const THROWAWAY_BLOCKS = [
  'cobblestone',
  'dirt',
  'netherrack',
  'stone',
  'granite',
  'diorite',
  'andesite',
  'deepslate',
  'tuff',
  'blackstone',
];

/**
 * State for structure block placement
 */
export enum PlaceStructureBlockState {
  GETTING_BLOCK,
  PLACING,
  FINISHED,
  FAILED,
}

/**
 * PlaceStructureBlockTask - Place any throwaway block at a position
 *
 * WHY this task matters:
 * - Used in construction when specific block type doesn't matter
 * - Pillar up, bridge across, fill gaps with whatever blocks are available
 * - Simplifies construction logic by not requiring specific materials
 *
 * Inherits PlaceBlockTask behavior but auto-selects from available throwaway blocks.
 */
export class PlaceStructureBlockTask extends Task {
  private pos: BlockPos;
  private state: PlaceStructureBlockState = PlaceStructureBlockState.GETTING_BLOCK;
  private selectedBlock: string | null = null;

  constructor(bot: Bot, pos: BlockPos) {
    super(bot);
    this.pos = pos;
  }

  static fromCoords(bot: Bot, x: number, y: number, z: number): PlaceStructureBlockTask {
    return new PlaceStructureBlockTask(bot, new BlockPos(x, y, z));
  }

  get displayName(): string {
    return `PlaceStructureBlock(${this.pos.x}, ${this.pos.y}, ${this.pos.z})`;
  }

  /**
   * Get the position where the block will be placed
   */
  getPosition(): BlockPos {
    return this.pos;
  }

  /**
   * Get the current state
   */
  getState(): PlaceStructureBlockState {
    return this.state;
  }

  /**
   * Get the selected block type (after selection)
   */
  getSelectedBlock(): string | null {
    return this.selectedBlock;
  }

  onStart(): void {
    this.state = PlaceStructureBlockState.GETTING_BLOCK;
    this.selectedBlock = null;
  }

  onTick(): Task | null {
    // Check if already placed
    const block = this.bot.blockAt(new Vec3(this.pos.x, this.pos.y, this.pos.z));
    if (block && block.boundingBox !== 'empty') {
      this.state = PlaceStructureBlockState.FINISHED;
      return null;
    }

    switch (this.state) {
      case PlaceStructureBlockState.GETTING_BLOCK:
        return this.handleGettingBlock();

      case PlaceStructureBlockState.PLACING:
        return this.handlePlacing();

      default:
        return null;
    }
  }

  private handleGettingBlock(): Task | null {
    // Find any throwaway block in inventory
    const items = this.bot.inventory.items();
    for (const item of items) {
      if (THROWAWAY_BLOCKS.includes(item.name)) {
        this.selectedBlock = item.name;
        this.state = PlaceStructureBlockState.PLACING;
        return null;
      }
    }

    // No throwaway blocks available - task cannot complete
    this.state = PlaceStructureBlockState.FAILED;
    return null;
  }

  private handlePlacing(): Task | null {
    if (!this.selectedBlock) {
      this.state = PlaceStructureBlockState.FAILED;
      return null;
    }

    // Delegate to PlaceBlockTask
    return PlaceBlockTask.fromBlockPos(this.bot, this.pos, this.selectedBlock);
  }

  onStop(): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.state === PlaceStructureBlockState.FINISHED ||
           this.state === PlaceStructureBlockState.FAILED;
  }

  isFailed(): boolean {
    return this.state === PlaceStructureBlockState.FAILED;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PlaceStructureBlockTask)) return false;
    return this.pos.equals(other.pos);
  }
}

/**
 * Convenience function to create a structure block placement task
 */
export function placeStructureBlock(bot: Bot, pos: BlockPos): PlaceStructureBlockTask {
  return new PlaceStructureBlockTask(bot, pos);
}

/**
 * Convenience function to create a structure block placement task from coordinates
 */
export function placeStructureBlockAt(bot: Bot, x: number, y: number, z: number): PlaceStructureBlockTask {
  return PlaceStructureBlockTask.fromCoords(bot, x, y, z);
}
