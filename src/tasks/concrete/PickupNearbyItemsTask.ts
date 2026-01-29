/**
 * PickupNearbyItemsTask - Pick up any items near the player
 *
 * Opportunistically collect any dropped items within range,
 * regardless of type. Useful for general cleanup after combat or mining.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToEntityTask } from './GetToEntityTask';

export class PickupNearbyItemsTask extends Task {
  private range: number;
  private currentTask: Task | null = null;

  constructor(bot: Bot, range: number = 10) {
    super(bot);
    this.range = range;
  }

  get displayName(): string {
    return `PickupNearby(${this.range}m)`;
  }

  onTick(): Task | null {
    // Find closest item within range
    const closest = this.findClosestItem();
    if (!closest) {
      return null;
    }

    // Navigate to it
    if (!this.currentTask || this.currentTask.isFinished()) {
      this.currentTask = new GetToEntityTask(this.bot, closest.id, 1);
    }

    return this.currentTask;
  }

  private findClosestItem(): Entity | null {
    const playerPos = this.bot.entity.position;
    let closest: Entity | null = null;
    let closestDist = this.range;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity.name !== 'item' && (entity as any).objectType !== 'Item') continue;
      if (entity.isValid === false) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist < closestDist) {
        closestDist = dist;
        closest = entity;
      }
    }

    return closest;
  }

  isFinished(): boolean {
    return this.findClosestItem() === null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PickupNearbyItemsTask)) return false;
    return Math.abs(this.range - other.range) < 1;
  }
}
