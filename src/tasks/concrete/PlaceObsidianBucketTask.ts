/**
 * PlaceObsidianBucketTask - Create obsidian using bucket casting
 * Based on BaritonePlus's PlaceObsidianBucketTask.java
 *
 * WHY this task matters:
 * - Build cast frame, place lava, pour water to form obsidian
 * - Alternative to mining obsidian with diamond pickaxe
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { DestroyBlockTask, PlaceBlockNearbyTask, ClearLiquidTask } from './ConstructionTask';
import { InteractWithBlockTask, Direction } from './InteractWithBlockTask';
import { TimeoutWanderTask } from './MovementUtilTask';
import { GetToBlockTask } from './GoToTask';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';

/**
 * Cast frame offsets for obsidian bucket placement
 * Relative to lava position
 */
export const OBSIDIAN_CAST_FRAME = [
  new Vec3(0, -1, 0),  // Below lava
  new Vec3(0, 0, -1),  // North
  new Vec3(0, 0, 1),   // South
  new Vec3(-1, 0, 0),  // West
  new Vec3(1, 0, 0),   // East
  new Vec3(1, 1, 0),   // East-up (for water placement)
];

/**
 * State for obsidian bucket task
 */
export enum ObsidianBucketState {
  GETTING_WATER_BUCKET,
  GETTING_LAVA_BUCKET,
  BUILDING_CAST,
  CLEARING_SPACE,
  POSITIONING,
  PLACING_LAVA,
  PLACING_WATER,
  CLEARING_WATER,
  FINISHED,
}

/**
 * Task to place obsidian using bucket casting method.
 *
 * WHY: Creating obsidian without a diamond pickaxe:
 * - Build a cast frame around target position
 * - Place lava in the cast
 * - Pour water on the lava to create obsidian
 * - Useful for nether portal construction
 *
 * Based on BaritonePlus PlaceObsidianBucketTask.java
 */
export class PlaceObsidianBucketTask extends Task {
  private pos: BlockPos;
  private state: ObsidianBucketState = ObsidianBucketState.GETTING_WATER_BUCKET;
  private progressChecker: MovementProgressChecker;
  private currentCastTarget: BlockPos | null = null;
  private currentDestroyTarget: BlockPos | null = null;

  constructor(bot: Bot, pos: BlockPos) {
    super(bot);
    this.pos = pos;
    this.progressChecker = new MovementProgressChecker(bot);
  }

  get displayName(): string {
    return `PlaceObsidianBucket(${this.pos.x}, ${this.pos.y}, ${this.pos.z})`;
  }

  onStart(): void {
    this.state = ObsidianBucketState.GETTING_WATER_BUCKET;
    this.currentCastTarget = null;
    this.currentDestroyTarget = null;
    this.progressChecker.reset();
  }

  onTick(): Task | null {
    // Check for completion
    if (this.isObsidianPlaced() && !this.hasWaterAbove()) {
      this.state = ObsidianBucketState.FINISHED;
      return null;
    }

    // Clear leftover water
    if (this.isObsidianPlaced() && this.hasWaterAbove()) {
      this.state = ObsidianBucketState.CLEARING_WATER;
      const waterPos = new BlockPos(this.pos.x, this.pos.y + 1, this.pos.z);
      return new ClearLiquidTask(this.bot, waterPos.x, waterPos.y, waterPos.z);
    }

    // Make sure we have water bucket
    if (!this.hasItem('water_bucket')) {
      this.state = ObsidianBucketState.GETTING_WATER_BUCKET;
      // Would return task to get water bucket
      return null;
    }

    // Make sure we have lava bucket (unless lava already placed)
    if (!this.hasItem('lava_bucket') && !this.isLavaAtPosition()) {
      this.state = ObsidianBucketState.GETTING_LAVA_BUCKET;
      // Would return task to get lava bucket
      return null;
    }

    // Check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      this.progressChecker.reset();
      return new TimeoutWanderTask(this.bot, 5);
    }

    // Handle current destroy target
    if (this.currentDestroyTarget) {
      if (!this.isSolid(this.currentDestroyTarget)) {
        this.currentDestroyTarget = null;
      } else {
        return new DestroyBlockTask(
          this.bot,
          this.currentDestroyTarget.x,
          this.currentDestroyTarget.y,
          this.currentDestroyTarget.z
        );
      }
    }

    // Handle current cast target
    if (this.currentCastTarget) {
      if (this.isSolid(this.currentCastTarget)) {
        this.currentCastTarget = null;
      } else {
        // Would use PlaceStructureBlockTask, but we'll use PlaceBlockNearbyTask
        this.state = ObsidianBucketState.BUILDING_CAST;
        return new PlaceBlockNearbyTask(this.bot, ['cobblestone', 'stone', 'dirt']);
      }
    }

    // Build cast frame
    for (const offset of OBSIDIAN_CAST_FRAME) {
      const castPos = new BlockPos(
        this.pos.x + offset.x,
        this.pos.y + offset.y,
        this.pos.z + offset.z
      );
      if (!this.isSolid(castPos)) {
        this.currentCastTarget = castPos;
        this.state = ObsidianBucketState.BUILDING_CAST;
        return null;
      }
    }

    // Cast frame built - place lava
    if (!this.isLavaAtPosition()) {
      // Position player safely before placing lava
      const safePos = new BlockPos(this.pos.x - 1, this.pos.y + 1, this.pos.z);
      const playerPos = this.bot.entity.position;
      const atSafePos = Math.abs(playerPos.x - safePos.x) < 1 &&
                        Math.abs(playerPos.z - safePos.z) < 1;

      if (!atSafePos && this.hasItem('lava_bucket')) {
        this.state = ObsidianBucketState.POSITIONING;
        return new GetToBlockTask(this.bot, safePos.x, safePos.y, safePos.z);
      }

      // Clear space if needed
      if (this.isSolid(this.pos)) {
        this.currentDestroyTarget = this.pos;
        this.state = ObsidianBucketState.CLEARING_SPACE;
        return null;
      }

      // Clear above
      const abovePos = new BlockPos(this.pos.x, this.pos.y + 1, this.pos.z);
      if (this.isSolid(abovePos)) {
        this.currentDestroyTarget = abovePos;
        this.state = ObsidianBucketState.CLEARING_SPACE;
        return null;
      }

      // Place lava
      this.state = ObsidianBucketState.PLACING_LAVA;
      const placeTarget = new BlockPos(this.pos.x + 1, this.pos.y, this.pos.z);
      return new InteractWithBlockTask(this.bot, {
        target: placeTarget,
        direction: Direction.WEST,
        itemToUse: 'lava_bucket',
      });
    }

    // Lava placed - place water
    const waterCheckPos = new BlockPos(this.pos.x, this.pos.y + 1, this.pos.z);
    if (!this.isWaterAtPosition(waterCheckPos)) {
      // Position player safely
      const safePos = new BlockPos(this.pos.x - 1, this.pos.y + 1, this.pos.z);
      const playerPos = this.bot.entity.position;
      const atSafePos = Math.abs(playerPos.x - safePos.x) < 1 &&
                        Math.abs(playerPos.z - safePos.z) < 1;

      if (!atSafePos && this.hasItem('water_bucket')) {
        this.state = ObsidianBucketState.POSITIONING;
        return new GetToBlockTask(this.bot, safePos.x, safePos.y, safePos.z);
      }

      // Clear space if needed
      if (this.isSolid(waterCheckPos)) {
        this.currentDestroyTarget = waterCheckPos;
        this.state = ObsidianBucketState.CLEARING_SPACE;
        return null;
      }

      // Place water
      this.state = ObsidianBucketState.PLACING_WATER;
      const placeTarget = new BlockPos(this.pos.x + 1, this.pos.y + 1, this.pos.z);
      return new InteractWithBlockTask(this.bot, {
        target: placeTarget,
        direction: Direction.WEST,
        itemToUse: 'water_bucket',
      });
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Clean up
  }

  /**
   * Check if obsidian is at position
   */
  private isObsidianPlaced(): boolean {
    const block = this.bot.blockAt(new Vec3(this.pos.x, this.pos.y, this.pos.z));
    return block !== null && block.name === 'obsidian';
  }

  /**
   * Check if water is above position
   */
  private hasWaterAbove(): boolean {
    const block = this.bot.blockAt(new Vec3(this.pos.x, this.pos.y + 1, this.pos.z));
    return block !== null && block.name === 'water';
  }

  /**
   * Check if lava is at position
   */
  private isLavaAtPosition(): boolean {
    const block = this.bot.blockAt(new Vec3(this.pos.x, this.pos.y, this.pos.z));
    return block !== null && block.name === 'lava';
  }

  /**
   * Check if water is at position
   */
  private isWaterAtPosition(pos: BlockPos): boolean {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    return block !== null && block.name === 'water';
  }

  /**
   * Check if block is solid
   */
  private isSolid(pos: BlockPos): boolean {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    if (!block) return false;
    return block.name !== 'air' && block.name !== 'water' && block.name !== 'lava';
  }

  /**
   * Check if player has item
   */
  private hasItem(itemName: string): boolean {
    return this.bot.inventory.items().some(item => item.name.includes(itemName));
  }

  /**
   * Get current state
   */
  getState(): ObsidianBucketState {
    return this.state;
  }

  /**
   * Get target position
   */
  getPosition(): BlockPos {
    return this.pos;
  }

  isFinished(): boolean {
    return this.isObsidianPlaced() && !this.hasWaterAbove();
  }

  isEqual(other: ITask | null): boolean {
    if (other instanceof PlaceObsidianBucketTask) {
      return this.pos.x === other.pos.x &&
             this.pos.y === other.pos.y &&
             this.pos.z === other.pos.z;
    }
    return false;
  }
}

/**
 * Convenience function to create PlaceObsidianBucketTask
 */
export function placeObsidianWithBucket(bot: Bot, pos: BlockPos): PlaceObsidianBucketTask {
  return new PlaceObsidianBucketTask(bot, pos);
}
