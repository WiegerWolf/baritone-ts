/**
 * LookAtBlockTask - Look at a specific block position
 *
 * Orient the player to look at a block, useful before
 * interaction or as a prerequisite for other tasks.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';

export class LookAtBlockTask extends Task {
  private target: Vec3;
  private looked: boolean = false;

  private blockX: number;
  private blockY: number;
  private blockZ: number;

  constructor(bot: Bot, x: number, y: number, z: number) {
    super(bot);
    this.blockX = x;
    this.blockY = y;
    this.blockZ = z;
    this.target = new Vec3(x + 0.5, y + 0.5, z + 0.5); // Center of block
  }

  get displayName(): string {
    return `LookAt(${this.blockX}, ${this.blockY}, ${this.blockZ})`;
  }

  onStart(): void {
    this.looked = false;
  }

  onTick(): Task | null {
    this.bot.lookAt(this.target, true);
    this.looked = true;
    return null;
  }

  isFinished(): boolean {
    return this.looked;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof LookAtBlockTask)) return false;
    return this.target.equals(other.target);
  }
}
