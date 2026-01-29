/**
 * MLGBucketMonitorTask - Continuous Fall Damage Monitoring
 *
 * WHY: This wraps the MLG logic to continuously monitor for dangerous falls
 * rather than requiring manual activation.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { MLGBucketTask, DEFAULT_CONFIG } from './MLGBucketTask';
import type { MLGConfig } from './MLGBucketTask';

/**
 * Task to check if MLG bucket is needed and perform it.
 *
 * WHY: This wraps the MLG logic to continuously monitor for dangerous falls
 * rather than requiring manual activation.
 */
export class MLGBucketMonitorTask extends Task {
  private config: MLGConfig;
  private monitorActive: boolean = false;
  private mlgTask: MLGBucketTask | null = null;
  private lastGroundY: number = 0;

  constructor(bot: Bot, config: Partial<MLGConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get displayName(): string {
    return 'MLGBucketMonitor';
  }

  onStart(): void {
    this.monitorActive = true;
    this.mlgTask = null;
    this.lastGroundY = this.bot.entity.position.y;
  }

  onTick(): Task | null {
    // Update last ground position when on ground
    if (this.bot.entity.onGround) {
      this.lastGroundY = this.bot.entity.position.y;
      this.mlgTask = null;
      return null;
    }

    // Check if we're in a dangerous fall
    const fallDistance = this.lastGroundY - this.bot.entity.position.y;
    const velocity = this.bot.entity.velocity;

    if (velocity.y < -0.5 && fallDistance > this.config.minFallDistance) {
      // We're falling dangerously
      if (!this.mlgTask) {
        // Check if we have water bucket
        const hasWater = this.bot.inventory.items().some(
          item => item.name === 'water_bucket'
        );

        if (hasWater) {
          this.mlgTask = new MLGBucketTask(this.bot, this.config);
          return this.mlgTask;
        }
      } else {
        return this.mlgTask;
      }
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.monitorActive = false;
    this.mlgTask = null;
  }

  isFinished(): boolean {
    return !this.monitorActive;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return other instanceof MLGBucketMonitorTask;
  }
}

/**
 * Helper to create MLG monitor task
 */
export function monitorForMLG(bot: Bot, minFallDistance: number = 4): MLGBucketMonitorTask {
  return new MLGBucketMonitorTask(bot, { minFallDistance });
}
