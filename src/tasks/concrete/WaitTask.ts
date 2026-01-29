/**
 * WaitTask - Wait for a duration
 *
 * Simply wait for a specified duration before completing.
 * Useful for cooldowns or waiting for events.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

export class WaitTask extends Task {
  private duration: number;
  private timer: TimerGame;

  constructor(bot: Bot, durationSeconds: number) {
    super(bot);
    this.duration = durationSeconds;
    this.timer = new TimerGame(bot, durationSeconds);
  }

  get displayName(): string {
    return `Wait(${this.duration}s)`;
  }

  onStart(): void {
    this.timer.reset();
  }

  onTick(): Task | null {
    return null; // Just wait
  }

  isFinished(): boolean {
    return this.timer.elapsed();
  }

  /**
   * Get remaining time
   */
  getRemainingTime(): number {
    return this.timer.getRemainingTime();
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof WaitTask)) return false;
    return Math.abs(this.duration - other.duration) < 0.1;
  }
}
