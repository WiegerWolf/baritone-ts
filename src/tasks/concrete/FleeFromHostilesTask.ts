/**
 * FleeFromHostilesTask - Flee from hostile mobs (entity-supplier variant)
 *
 * Automatically detect and flee from hostile mobs within range.
 * Useful for survival scenarios when the bot is low on health or resources.
 *
 * Note: This extends RunAwayFromEntitiesTask and uses entity suppliers.
 * See also RunAwayFromHostilesTask.ts for the standalone state-machine variant.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import type { ITask } from '../interfaces';
import { RunAwayFromEntitiesTask } from './RunAwayFromEntitiesTask';
import { isHostileMob } from '../../utils/EntityHelper';

export class FleeFromHostilesTask extends RunAwayFromEntitiesTask {
  private detectionRange: number;

  constructor(bot: Bot, distanceToRun: number = 20, detectionRange: number = 15) {
    super(
      bot,
      () => this.getHostileMobs(),
      distanceToRun,
      false,
      1.5 // Higher penalty for hostiles
    );
    this.detectionRange = detectionRange;
  }

  get displayName(): string {
    return `FleeHostiles(${this.distanceToRun}m)`;
  }

  private getHostileMobs(): Entity[] {
    const hostiles: Entity[] = [];
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity === this.bot.entity) continue;
      if (entity.isValid === false) continue;

      // Check if hostile
      if (!isHostileMob(entity)) continue;

      // Check range
      const dist = playerPos.distanceTo(entity.position);
      if (dist <= this.detectionRange) {
        hostiles.push(entity);
      }
    }

    return hostiles;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof FleeFromHostilesTask)) return false;
    return super.isEqual(other) && Math.abs(this.detectionRange - other.detectionRange) < 1;
  }
}
