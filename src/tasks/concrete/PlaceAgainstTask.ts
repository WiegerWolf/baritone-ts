/**
 * PlaceAgainstTask - Place a block against an existing block
 *
 * Useful when you just want to extend a platform, etc.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task, GroundedTask } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { PlaceBlockTask } from './PlaceBlockTask';

export class PlaceAgainstTask extends GroundedTask {
  private referencePos: BlockPos;
  private face: Vec3;
  private blockName: string;
  private placed: boolean = false;

  constructor(bot: Bot, referenceX: number, referenceY: number, referenceZ: number,
              face: Vec3, blockName: string) {
    super(bot);
    this.referencePos = new BlockPos(referenceX, referenceY, referenceZ);
    this.face = face;
    this.blockName = blockName;
  }

  get displayName(): string {
    return `PlaceAgainst(${this.blockName})`;
  }

  onTick(): Task | null {
    const reference = this.bot.blockAt(
      new Vec3(this.referencePos.x, this.referencePos.y, this.referencePos.z)
    );

    if (!reference || reference.boundingBox === 'empty') {
      return null; // No reference block
    }

    // Calculate target position
    const targetPos = new BlockPos(
      this.referencePos.x + this.face.x,
      this.referencePos.y + this.face.y,
      this.referencePos.z + this.face.z
    );

    // Delegate to PlaceBlockTask
    return new PlaceBlockTask(
      this.bot,
      targetPos.x,
      targetPos.y,
      targetPos.z,
      this.blockName
    );
  }

  isFinished(): boolean {
    return this.placed;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PlaceAgainstTask)) return false;
    return this.referencePos.equals(other.referencePos) &&
           this.face.equals(other.face) &&
           this.blockName === other.blockName;
  }
}
