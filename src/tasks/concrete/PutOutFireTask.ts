/**
 * PutOutFireTask - Task to put out fire at a position
 * Split from ConstructionTask.ts
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { DestroyBlockTask } from './DestroyBlockTask';

/**
 * Task to put out fire at a position.
 *
 * WHY: Fire can spread and cause damage. We need to extinguish it
 * by breaking it or placing water.
 */
export class PutOutFireTask extends Task {
  private target: BlockPos;
  private finished: boolean = false;

  constructor(bot: Bot, x: number, y: number, z: number) {
    super(bot);
    this.target = new BlockPos(x, y, z);
  }

  get displayName(): string {
    return `PutOutFire(${this.target.x}, ${this.target.y}, ${this.target.z})`;
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    const block = this.bot.blockAt(new Vec3(this.target.x, this.target.y, this.target.z));
    if (!block || block.name !== 'fire') {
      this.finished = true;
      return null;
    }

    // Fire can be broken like a normal block
    return DestroyBlockTask.fromBlockPos(this.bot, this.target);
  }

  isFinished(): boolean {
    return this.finished;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PutOutFireTask)) return false;
    return this.target.equals(other.target);
  }
}
