/**
 * TimerGame - Server Tick Based Timer
 * Based on AltoClef's TimerGame.java
 *
 * Uses server ticks (20 TPS) for timing. This is deterministic and
 * lag-immune - if the server lags, the timer automatically adjusts.
 *
 * Use for:
 * - Game mechanic timing (attack cooldowns, eating, etc.)
 * - Progress checking
 * - Anything that should sync with game state
 */

import type { Bot } from 'mineflayer';
import { BaseTimer } from './BaseTimer';

/**
 * Timer based on server game ticks (20 TPS)
 */
export class TimerGame extends BaseTimer {
  private bot: Bot;

  /**
   * Create a game timer
   * @param bot The mineflayer bot
   * @param intervalSeconds The interval in seconds
   */
  constructor(bot: Bot, intervalSeconds: number) {
    super(intervalSeconds);
    this.bot = bot;
  }

  /**
   * Get current time from server ticks
   * Converts ticks to seconds (divide by 20)
   */
  protected currentTime(): number {
    // bot.time.age is the server tick count
    return this.bot.time.age / 20.0;
  }

  /**
   * Get current time in ticks
   */
  getCurrentTicks(): number {
    return this.bot.time.age;
  }

  /**
   * Get interval in ticks
   */
  getIntervalTicks(): number {
    return Math.floor(this.interval * 20);
  }

  /**
   * Set interval in ticks
   */
  setIntervalTicks(ticks: number): void {
    this.interval = ticks / 20.0;
  }
}
