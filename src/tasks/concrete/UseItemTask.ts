/**
 * UseItemTask - Use the currently held item
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

export class UseItemTask extends Task {
  private useDuration: number;
  private useTimer: TimerGame;
  private started: boolean = false;
  private finished: boolean = false;

  constructor(bot: Bot, useDuration: number = 1.0) {
    super(bot);
    this.useDuration = useDuration;
    this.useTimer = new TimerGame(bot, useDuration);
  }

  get displayName(): string {
    const held = this.bot.heldItem;
    const name = held ? held.name : 'nothing';
    return `UseItem(${name})`;
  }

  onStart(): void {
    this.started = false;
    this.finished = false;
  }

  onTick(): Task | null {
    if (!this.started) {
      // Start using item
      this.bot.activateItem();
      this.started = true;
      this.useTimer.reset();
      return null;
    }

    // Check if done
    if (this.useTimer.elapsed()) {
      this.bot.deactivateItem();
      this.finished = true;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    if (this.started && !this.finished) {
      try {
        this.bot.deactivateItem();
      } catch {
        // Ignore
      }
    }
  }

  isFinished(): boolean {
    return this.finished;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof UseItemTask)) return false;
    return this.useDuration === other.useDuration;
  }
}
