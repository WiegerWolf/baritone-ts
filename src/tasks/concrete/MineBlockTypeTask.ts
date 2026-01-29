/**
 * MineBlockTypeTask - Mine the nearest block of a type
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { MineBlockTask } from './MineBlockTask';

export class MineBlockTypeTask extends Task {
  private blockTypes: string[];
  private maxRange: number;
  private count: number;
  private mined: number = 0;

  constructor(bot: Bot, blockTypes: string | string[], count: number = 1, maxRange: number = 64) {
    super(bot);
    this.blockTypes = Array.isArray(blockTypes) ? blockTypes : [blockTypes];
    this.count = count;
    this.maxRange = maxRange;
  }

  get displayName(): string {
    const types = this.blockTypes.length === 1 ? this.blockTypes[0] : `${this.blockTypes.length} types`;
    return `MineBlockType(${types}, ${this.mined}/${this.count})`;
  }

  onStart(): void {
    this.mined = 0;
  }

  onTick(): Task | null {
    // Find nearest matching block
    const block = this.findNearestBlock();
    if (!block) {
      return null; // No block found - keep searching
    }

    // Create mining task for this block
    return MineBlockTask.fromVec3(this.bot, block.position);
  }

  isFinished(): boolean {
    return this.mined >= this.count;
  }

  private findNearestBlock(): Block | null {
    const playerPos = this.bot.entity.position;

    for (let radius = 1; radius <= this.maxRange; radius += 4) {
      const block = this.findBlockInRadius(playerPos, radius);
      if (block) return block;
    }

    return null;
  }

  private findBlockInRadius(center: Vec3, radius: number): Block | null {
    let nearest: Block | null = null;
    let nearestDist = Infinity;

    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        for (let z = -radius; z <= radius; z++) {
          const pos = center.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block) continue;
          if (!this.blockTypes.some(t => block.name.includes(t))) continue;

          const dist = center.distanceTo(pos);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = block;
          }
        }
      }
    }

    return nearest;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof MineBlockTypeTask)) return false;
    return this.blockTypes.join(',') === other.blockTypes.join(',') && this.count === other.count;
  }
}
