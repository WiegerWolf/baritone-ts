/**
 * PlaceSignTask - Place a sign with a message
 * Based on BaritonePlus's construction tasks
 *
 * WHY: Signs are useful for leaving messages, marking locations,
 * creating waypoint markers, and labeling chests and builds.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { DestroyBlockTask, PlaceBlockNearbyTask } from './ConstructionTask';
import { InteractWithBlockTask, Direction } from './InteractWithBlockTask';
import { BlockPos } from '../../types';

/**
 * All wood sign types
 */
export const WOOD_SIGNS = [
  'oak_sign',
  'spruce_sign',
  'birch_sign',
  'jungle_sign',
  'acacia_sign',
  'dark_oak_sign',
  'mangrove_sign',
  'cherry_sign',
  'bamboo_sign',
  'crimson_sign',
  'warped_sign',
];

/**
 * State for sign placement
 */
export enum PlaceSignState {
  GETTING_SIGN,
  CLEARING_POSITION,
  PLACING_SIGN,
  EDITING_SIGN,
  FINISHED,
}

/**
 * Task to place a sign with a message.
 *
 * WHY: Signs are useful for:
 * - Leaving messages for other players
 * - Marking important locations
 * - Creating waypoint markers
 * - Labeling chests and builds
 *
 * Based on BaritonePlus PlaceSignTask.java
 */
export class PlaceSignTask extends Task {
  private position: BlockPos | null;
  private message: string;
  private state: PlaceSignState = PlaceSignState.GETTING_SIGN;
  private finished: boolean = false;

  constructor(bot: Bot, message: string, position: BlockPos | null = null) {
    super(bot);
    this.message = message;
    this.position = position;
  }

  get displayName(): string {
    if (this.position) {
      return `PlaceSign("${this.message.substring(0, 20)}..." at ${this.position.x},${this.position.y},${this.position.z})`;
    }
    return `PlaceSign("${this.message.substring(0, 20)}..." anywhere)`;
  }

  onStart(): void {
    this.state = PlaceSignState.GETTING_SIGN;
    this.finished = false;
  }

  onTick(): Task | null {
    // Check if we have a sign
    if (!this.hasSign()) {
      this.state = PlaceSignState.GETTING_SIGN;
      // In full implementation, would return task to get a sign
      return null;
    }

    // Place sign at specific position or nearby
    if (this.position) {
      // Check if position is clear
      const block = this.bot.blockAt(
        new Vec3(this.position.x, this.position.y, this.position.z)
      );

      if (block && !this.isAirOrLiquid(block.name)) {
        this.state = PlaceSignState.CLEARING_POSITION;
        return new DestroyBlockTask(
          this.bot,
          this.position.x,
          this.position.y,
          this.position.z
        );
      }

      // Place sign
      this.state = PlaceSignState.PLACING_SIGN;
      return new InteractWithBlockTask(this.bot, {
        target: new BlockPos(this.position.x, this.position.y - 1, this.position.z),
        direction: Direction.UP,
        itemToUse: this.getSignName(),
      });
    } else {
      // Place anywhere
      this.state = PlaceSignState.PLACING_SIGN;
      return new PlaceBlockNearbyTask(this.bot, WOOD_SIGNS);
    }
  }

  /**
   * Check if player has a sign
   */
  private hasSign(): boolean {
    return this.bot.inventory.items().some((item) =>
      WOOD_SIGNS.some((sign) => item.name.includes(sign))
    );
  }

  /**
   * Get the name of a sign we have
   */
  private getSignName(): string | undefined {
    const sign = this.bot.inventory.items().find((item) =>
      WOOD_SIGNS.some((s) => item.name.includes(s))
    );
    return sign?.name;
  }

  /**
   * Check if block is air or liquid
   */
  private isAirOrLiquid(blockName: string): boolean {
    return blockName === 'air' || blockName === 'water' || blockName === 'lava';
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.finished;
  }

  /**
   * Get current state
   */
  getState(): PlaceSignState {
    return this.state;
  }

  /**
   * Get the message to write
   */
  getMessage(): string {
    return this.message;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PlaceSignTask)) return false;
    if (other.message !== this.message) return false;
    if ((other.position === null) !== (this.position === null)) return false;
    if (other.position && this.position) {
      return other.position.equals(this.position);
    }
    return true;
  }
}

/**
 * Convenience function to place a sign
 */
export function placeSign(bot: Bot, message: string, position?: BlockPos): PlaceSignTask {
  return new PlaceSignTask(bot, message, position || null);
}
