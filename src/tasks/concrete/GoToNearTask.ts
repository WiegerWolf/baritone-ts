/**
 * GoToNearTask - Get near a position (within a radius)
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import type { ITask } from '../interfaces';
import { Goal, BlockPos } from '../../types';
import { GoalNear } from '../../goals';
import { GoToTask } from './GoToTask';

export class GoToNearTask extends GoToTask {
  private target: BlockPos;
  private radius: number;

  constructor(bot: Bot, x: number, y: number, z: number, radius: number = 3) {
    super(bot);
    this.target = new BlockPos(x, y, z);
    this.radius = radius;
  }

  static fromVec3(bot: Bot, pos: Vec3, radius: number = 3): GoToNearTask {
    return new GoToNearTask(bot, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z), radius);
  }

  get displayName(): string {
    return `GoToNear(${this.target.x}, ${this.target.y}, ${this.target.z}, r=${this.radius})`;
  }

  getGoal(): Goal {
    return new GoalNear(this.target.x, this.target.y, this.target.z, this.radius);
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GoToNearTask)) return false;
    return this.target.equals(other.target) && this.radius === other.radius;
  }
}
