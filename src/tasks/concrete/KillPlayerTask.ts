/**
 * KillPlayerTask - Kill a specific player
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { AbstractDoToEntityTask } from './AbstractDoToEntityTask';

/**
 * Task to kill a specific player.
 *
 * WHY: PvP scenarios require targeting and attacking specific players.
 * This task handles finding and attacking a named player.
 */
export class KillPlayerTask extends AbstractDoToEntityTask {
  private targetPlayerName: string;

  constructor(bot: Bot, playerName: string) {
    super(bot, { maintainDistance: 3, reachRange: 4 });
    this.targetPlayerName = playerName;
  }

  get displayName(): string {
    return `KillPlayer(${this.targetPlayerName})`;
  }

  protected getEntityTarget(): Entity | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity.type === 'player' && entity.username === this.targetPlayerName) {
        if (entity.isValid !== false) {
          return entity;
        }
      }
    }
    return null;
  }

  protected onEntityInteract(entity: Entity): Task | null {
    // Check if target is dead
    const target = this.getEntityTarget();
    if (!target || target.isValid === false) {
      this.markFinished();
      return null;
    }

    // Attack the player
    try {
      this.bot.attack(entity);
    } catch (err) {
      // Will retry
    }

    return null;
  }

  isFinished(): boolean {
    // Finished when target player is no longer valid (dead or logged out)
    const target = this.getEntityTarget();
    return !target || target.isValid === false || super.isFinished();
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof KillPlayerTask)) return false;
    return this.targetPlayerName === other.targetPlayerName;
  }
}
