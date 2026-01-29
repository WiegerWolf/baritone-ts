/**
 * GoInDirectionXZTask - Move in a specific XZ direction
 *
 * WHY: Sometimes we need to move in a general direction without a specific
 * target - exploring, fleeing, or reaching a distant goal. This task moves
 * the player along an XZ direction vector.
 *
 * Based on BaritonePlus GoInDirectionXZTask.java
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';

export class GoInDirectionXZTask extends Task {
  private origin: Vec3;
  private direction: Vec3;
  private sidePenalty: number;
  private distanceTraveled: number = 0;
  private targetDistance: number;

  constructor(
    bot: Bot,
    origin: Vec3,
    direction: Vec3,
    distance: number = 100,
    sidePenalty: number = 3
  ) {
    super(bot);
    this.origin = origin;
    this.direction = this.normalizeXZ(direction);
    this.targetDistance = distance;
    this.sidePenalty = sidePenalty;
  }

  get displayName(): string {
    return `GoInDirection(${this.direction.x.toFixed(2)},${this.direction.z.toFixed(2)})`;
  }

  onStart(): void {
    this.distanceTraveled = 0;
  }

  onTick(): Task | null {
    // Calculate target point along direction
    const targetPoint = new Vec3(
      this.origin.x + this.direction.x * (this.distanceTraveled + 20),
      this.bot.entity.position.y,
      this.origin.z + this.direction.z * (this.distanceTraveled + 20)
    );

    // Update distance traveled
    const currentPos = this.bot.entity.position;
    const projected = this.projectOntoDirection(currentPos);
    this.distanceTraveled = Math.max(this.distanceTraveled, projected);

    // Check if we've reached target distance
    if (this.distanceTraveled >= this.targetDistance) {
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(targetPoint.x),
      Math.floor(targetPoint.y),
      Math.floor(targetPoint.z),
      5
    );
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.distanceTraveled >= this.targetDistance;
  }

  // ---- Helper methods ----

  private normalizeXZ(vec: Vec3): Vec3 {
    const len = Math.sqrt(vec.x * vec.x + vec.z * vec.z);
    if (len < 0.001) return new Vec3(1, 0, 0); // Default direction
    return new Vec3(vec.x / len, 0, vec.z / len);
  }

  private projectOntoDirection(pos: Vec3): number {
    const diff = new Vec3(
      pos.x - this.origin.x,
      0,
      pos.z - this.origin.z
    );
    return diff.x * this.direction.x + diff.z * this.direction.z;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GoInDirectionXZTask)) return false;

    const originClose = this.origin.distanceTo(other.origin) < 0.1;
    const dirClose = Math.abs(this.direction.x - other.direction.x) < 0.01 &&
                     Math.abs(this.direction.z - other.direction.z) < 0.01;

    return originClose && dirClose;
  }
}

/**
 * Helper to move in a direction
 */
export function goInDirection(
  bot: Bot,
  dirX: number,
  dirZ: number,
  distance: number = 100
): GoInDirectionXZTask {
  return new GoInDirectionXZTask(
    bot,
    bot.entity.position,
    new Vec3(dirX, 0, dirZ),
    distance
  );
}
