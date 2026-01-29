/**
 * GoToXZTask - Go to XZ coordinates (any Y level)
 */

import type { Bot } from 'mineflayer';
import type { ITask } from '../interfaces';
import { Goal } from '../../types';
import { GoalXZ } from '../../goals';
import { GoToTask } from './GoToTask';

export class GoToXZTask extends GoToTask {
  private x: number;
  private z: number;

  constructor(bot: Bot, x: number, z: number) {
    super(bot);
    this.x = x;
    this.z = z;
  }

  get displayName(): string {
    return `GoToXZ(${this.x}, ${this.z})`;
  }

  getGoal(): Goal {
    return new GoalXZ(this.x, this.z);
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GoToXZTask)) return false;
    return this.x === other.x && this.z === other.z;
  }
}
