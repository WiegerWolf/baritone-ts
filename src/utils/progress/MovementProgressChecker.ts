/**
 * MovementProgressChecker - Dual Mode Progress (Mining vs Moving)
 * Based on AltoClef's MovementProgressChecker.java
 *
 * Automatically switches between checking movement progress and mining
 * progress based on whether the bot is currently breaking a block.
 * Also pauses progress checking during eating.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import type { IProgressChecker } from './IProgressChecker';
import { DistanceProgressChecker } from './DistanceProgressChecker';
import { LinearProgressChecker } from './LinearProgressChecker';
import { TimerGame } from '../timers/TimerGame';

export class MovementProgressChecker implements IProgressChecker<Vec3> {
  private bot: Bot;
  private distanceChecker: DistanceProgressChecker;
  private miningChecker: LinearProgressChecker;
  private lastMiningProgress: number = 0;

  /**
   * Create a movement progress checker
   * @param bot The mineflayer bot
   * @param moveTimeoutSeconds Timeout for movement progress (default: 6)
   * @param minMoveBlocks Minimum blocks to move per timeout (default: 0.1)
   * @param mineTimeoutSeconds Timeout for mining progress (default: 3)
   * @param minMineProgress Minimum mining progress per timeout (default: 0.01)
   */
  constructor(
    bot: Bot,
    moveTimeoutSeconds: number = 6,
    minMoveBlocks: number = 0.1,
    mineTimeoutSeconds: number = 3,
    minMineProgress: number = 0.01
  ) {
    this.bot = bot;
    this.distanceChecker = new DistanceProgressChecker(
      bot,
      moveTimeoutSeconds,
      minMoveBlocks,
      false
    );
    this.miningChecker = new LinearProgressChecker(
      bot,
      mineTimeoutSeconds,
      minMineProgress
    );
  }

  setProgress(position: Vec3): void {
    // Check if we should pause progress checking
    if (this.shouldPauseChecking()) {
      this.distanceChecker.reset();
      this.miningChecker.reset();
      return;
    }

    // Check if we're currently mining
    if (this.isBreakingBlock()) {
      // Mining mode - check mining progress
      const miningProgress = this.getMiningProgress();
      this.miningChecker.setProgress(miningProgress);

      // Reset movement checker while mining
      this.distanceChecker.reset();
    } else {
      // Movement mode - check distance progress
      this.distanceChecker.setProgress(position);

      // Reset mining checker while moving
      this.miningChecker.reset();
    }
  }

  failed(): boolean {
    // Failed if either checker fails
    if (this.isBreakingBlock()) {
      return this.miningChecker.failed();
    }
    return this.distanceChecker.failed();
  }

  reset(): void {
    this.distanceChecker.reset();
    this.miningChecker.reset();
    this.lastMiningProgress = 0;
  }

  /**
   * Check if progress checking should be paused
   * (e.g., during eating)
   */
  private shouldPauseChecking(): boolean {
    // Pause during eating
    if (this.isEating()) {
      return true;
    }

    // Pause if in a GUI
    if (this.bot.currentWindow) {
      return true;
    }

    return false;
  }

  /**
   * Check if the bot is currently eating
   */
  private isEating(): boolean {
    // Check if using an item that might be food
    const heldItem = this.bot.heldItem;
    if (!heldItem) return false;

    // Check if actively using the item
    return (this.bot.player as any)?.isUsingItem ?? false;
  }

  /**
   * Check if the bot is currently breaking a block
   */
  private isBreakingBlock(): boolean {
    return this.bot.targetDigBlock !== null;
  }

  /**
   * Get current mining progress (0 to 1)
   */
  private getMiningProgress(): number {
    const target = this.bot.targetDigBlock;
    if (!target) return 0;

    // Mineflayer's dig progress if available
    // Otherwise estimate based on dig time
    return (this.bot as any)._digProgress ?? 0;
  }

  /**
   * Get the movement checker (for advanced configuration)
   */
  getDistanceChecker(): DistanceProgressChecker {
    return this.distanceChecker;
  }

  /**
   * Get the mining checker (for advanced configuration)
   */
  getMiningChecker(): LinearProgressChecker {
    return this.miningChecker;
  }
}
