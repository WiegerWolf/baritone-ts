/**
 * GetToBlockTask - Get within reach of a block (for mining/interaction)
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import type { ITask } from '../interfaces';
import { Goal, BlockPos } from '../../types';
import { GoalGetToBlock } from '../../goals';
import { GoToTask } from './GoToTask';

export class GetToBlockTask extends GoToTask {
  private target: BlockPos;

  constructor(bot: Bot, x: number, y: number, z: number) {
    super(bot);
    this.target = new BlockPos(x, y, z);
  }

  static fromVec3(bot: Bot, pos: Vec3): GetToBlockTask {
    return new GetToBlockTask(bot, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  }

  static fromBlockPos(bot: Bot, pos: BlockPos): GetToBlockTask {
    return new GetToBlockTask(bot, pos.x, pos.y, pos.z);
  }

  get displayName(): string {
    return `GetToBlock(${this.target.x}, ${this.target.y}, ${this.target.z})`;
  }

  getGoal(): Goal {
    return new GoalGetToBlock(this.target.x, this.target.y, this.target.z);
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetToBlockTask)) return false;
    return this.target.equals(other.target);
  }
}
