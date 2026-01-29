/**
 * FleeFromCreepersTask - Specific task for fleeing from creepers (entity-supplier variant)
 *
 * Creepers are especially dangerous due to explosions.
 * This task maintains extra distance and has higher priority.
 *
 * Note: This extends RunAwayFromEntitiesTask and uses entity suppliers.
 * See also RunAwayFromCreepersTask.ts for the standalone state-machine variant.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import type { ITask } from '../interfaces';
import { RunAwayFromEntitiesTask } from './RunAwayFromEntitiesTask';

export class FleeFromCreepersTask extends RunAwayFromEntitiesTask {
  private detectionRange: number;

  constructor(bot: Bot, distanceToRun: number = 10, detectionRange: number = 8) {
    super(
      bot,
      () => this.getCreepers(),
      distanceToRun,
      false,
      3.0 // Very high penalty for creepers
    );
    this.detectionRange = detectionRange;
  }

  get displayName(): string {
    return 'FleeCreepers';
  }

  private getCreepers(): Entity[] {
    const creepers: Entity[] = [];
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity.name !== 'creeper') continue;
      if (entity.isValid === false) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist <= this.detectionRange) {
        creepers.push(entity);
      }
    }

    return creepers;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof FleeFromCreepersTask)) return false;
    return super.isEqual(other);
  }
}
