/**
 * IdleTask - Do nothing
 *
 * A placeholder task that never finishes. Useful for
 * keeping the task system active without doing anything,
 * or for testing purposes.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';

export class IdleTask extends Task {
  constructor(bot: Bot) {
    super(bot);
  }

  get displayName(): string {
    return 'Idle';
  }

  onTick(): Task | null {
    // Do nothing
    return null;
  }

  isFinished(): boolean {
    // Never finish
    return false;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof IdleTask;
  }
}
