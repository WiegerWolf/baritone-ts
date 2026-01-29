/**
 * SafeRandomShimmyTask - Random movement to get unstuck
 *
 * When stuck in vines, fences, or other obstacles,
 * this task makes small random movements to escape.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

export class SafeRandomShimmyTask extends Task {
  private duration: number;
  private timer: TimerGame;
  private direction: Vec3 | null = null;

  constructor(bot: Bot, duration: number = 1.5) {
    super(bot);
    this.duration = duration;
    this.timer = new TimerGame(bot, duration);
  }

  get displayName(): string {
    return 'SafeRandomShimmy';
  }

  onStart(): void {
    this.timer.reset();

    // Pick a random direction
    const angle = Math.random() * Math.PI * 2;
    this.direction = new Vec3(Math.cos(angle), 0, Math.sin(angle));
  }

  onTick(): Task | null {
    if (this.timer.elapsed()) {
      return null;
    }

    if (!this.direction) return null;

    // Move in the random direction
    const target = this.bot.entity.position.plus(this.direction.scaled(5));
    this.bot.lookAt(target, true);

    // Alternate controls for shimmy effect
    const elapsed = this.timer.getElapsedTime();
    const phase = Math.floor(elapsed * 4) % 4;

    this.bot.clearControlStates();

    switch (phase) {
      case 0:
        this.bot.setControlState('forward', true);
        this.bot.setControlState('jump', true);
        break;
      case 1:
        this.bot.setControlState('left', true);
        break;
      case 2:
        this.bot.setControlState('back', true);
        this.bot.setControlState('sneak', true);
        break;
      case 3:
        this.bot.setControlState('right', true);
        break;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.timer.elapsed();
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof SafeRandomShimmyTask)) return false;
    return Math.abs(this.duration - other.duration) < 0.1;
  }
}
