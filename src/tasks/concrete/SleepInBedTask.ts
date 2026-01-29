/**
 * SleepInBedTask - Simple Sleep Task
 * Based on BaritonePlus's bed sleeping logic
 *
 * WHY: Sleeping in a bed skips the night and prevents hostile mob spawns.
 * This is a simpler alternative to PlaceBedAndSetSpawnTask when a bed
 * already exists nearby.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { BED_BLOCKS } from './PlaceBedAndSetSpawnTask';

/**
 * Simple task to sleep in a bed
 */
export class SleepInBedTask extends Task {
  private finished: boolean = false;
  private failed: boolean = false;
  private bedPos: Vec3 | null = null;

  constructor(bot: Bot) {
    super(bot);
  }

  get displayName(): string {
    return 'SleepInBed';
  }

  onStart(): void {
    this.finished = false;
    this.failed = false;
  }

  onTick(): Task | null {
    // Already sleeping?
    if ((this.bot as any).isSleeping) {
      this.finished = true;
      return null;
    }

    // Find nearest bed
    if (!this.bedPos) {
      this.bedPos = this.findNearestBed();
      if (!this.bedPos) {
        this.failed = true;
        return null;
      }
    }

    // Go to bed
    const dist = this.bot.entity.position.distanceTo(this.bedPos);
    if (dist > 3) {
      return new GoToNearTask(
        this.bot,
        Math.floor(this.bedPos.x),
        Math.floor(this.bedPos.y),
        Math.floor(this.bedPos.z),
        2
      );
    }

    // Try to sleep
    const block = this.bot.blockAt(this.bedPos);
    if (block) {
      try {
        this.bot.activateBlock(block);
      } catch {
        this.failed = true;
      }
    }

    return null;
  }

  private findNearestBed(): Vec3 | null {
    const playerPos = this.bot.entity.position;

    for (let r = 1; r <= 40; r++) {
      for (let x = -r; x <= r; x++) {
        for (let y = -8; y <= 8; y++) {
          for (let z = -r; z <= r; z++) {
            if (Math.abs(x) !== r && Math.abs(y) !== r && Math.abs(z) !== r) continue;

            const checkPos = new Vec3(
              Math.floor(playerPos.x) + x,
              Math.floor(playerPos.y) + y,
              Math.floor(playerPos.z) + z
            );

            const block = this.bot.blockAt(checkPos);
            if (block && BED_BLOCKS.includes(block.name)) {
              return checkPos;
            }
          }
        }
      }
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.finished;
  }

  isFailed(): boolean {
    return this.failed;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return other instanceof SleepInBedTask;
  }
}

/**
 * Helper to sleep in a bed
 */
export function sleepInBed(bot: Bot): SleepInBedTask {
  return new SleepInBedTask(bot);
}
