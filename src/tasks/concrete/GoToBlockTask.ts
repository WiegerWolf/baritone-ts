/**
 * GoToBlockTask - Navigate to a specific block position
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import type { ITask } from '../interfaces';
import { Goal, BlockPos } from '../../types';
import { GoalBlock } from '../../goals';
import { GoToTask } from './GoToTask';

export class GoToBlockTask extends GoToTask {
  private target: BlockPos;

  constructor(bot: Bot, x: number, y: number, z: number) {
    super(bot);
    this.target = new BlockPos(x, y, z);
  }

  static fromVec3(bot: Bot, pos: Vec3): GoToBlockTask {
    return new GoToBlockTask(bot, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  }

  static fromBlockPos(bot: Bot, pos: BlockPos): GoToBlockTask {
    return new GoToBlockTask(bot, pos.x, pos.y, pos.z);
  }

  get displayName(): string {
    return `GoToBlock(${this.target.x}, ${this.target.y}, ${this.target.z})`;
  }

  getGoal(): Goal {
    return new GoalBlock(this.target.x, this.target.y, this.target.z);
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GoToBlockTask)) return false;
    return this.target.equals(other.target);
  }
}
