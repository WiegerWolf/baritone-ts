/**
 * FleeFromPlayersTask - Flee from player entities
 *
 * Flee from other players. Useful in PvP scenarios or
 * when avoiding specific players.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import type { ITask } from '../interfaces';
import { RunAwayFromEntitiesTask } from './RunAwayFromEntitiesTask';

export class FleeFromPlayersTask extends RunAwayFromEntitiesTask {
  private targetPlayers: string[];
  private detectionRange: number;

  /**
   * @param bot The mineflayer bot
   * @param playerNames Player names to flee from (empty = all players)
   * @param distanceToRun Distance to maintain
   * @param detectionRange Range to detect players
   */
  constructor(
    bot: Bot,
    playerNames: string[] = [],
    distanceToRun: number = 30,
    detectionRange: number = 20
  ) {
    super(
      bot,
      () => this.getPlayerEntities(),
      distanceToRun,
      false,
      2.0 // Higher penalty for players
    );
    this.targetPlayers = playerNames;
    this.detectionRange = detectionRange;
  }

  get displayName(): string {
    const names = this.targetPlayers.length > 0
      ? this.targetPlayers.join(', ')
      : 'all players';
    return `FleePlayers(${names})`;
  }

  private getPlayerEntities(): Entity[] {
    const players: Entity[] = [];
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity === this.bot.entity) continue;
      if (entity.type !== 'player') continue;
      if (entity.isValid === false) continue;

      // Check if specific players only
      if (this.targetPlayers.length > 0) {
        if (!this.targetPlayers.includes(entity.username ?? '')) {
          continue;
        }
      }

      // Check range
      const dist = playerPos.distanceTo(entity.position);
      if (dist <= this.detectionRange) {
        players.push(entity);
      }
    }

    return players;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof FleeFromPlayersTask)) return false;
    return super.isEqual(other) &&
           JSON.stringify(this.targetPlayers) === JSON.stringify(other.targetPlayers);
  }
}
