/**
 * EntityLocateBlacklist - Entity Blacklisting
 * Based on AltoClef/BaritonePlus EntityLocateBlacklist.java
 *
 * Blacklist for entities that have proven unreachable.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { AbstractObjectBlacklist } from './AbstractObjectBlacklist';

/**
 * Blacklist for entity objects
 */
export class EntityLocateBlacklist extends AbstractObjectBlacklist<Entity> {
  constructor(bot: Bot) {
    super(bot);
  }

  protected getPos(item: Entity): Vec3 {
    return item.position;
  }

  protected getKey(item: Entity): string {
    // Use entity ID as unique key
    return `entity_${item.id}`;
  }

  /**
   * Blacklist by entity ID directly
   */
  blacklistEntityId(entityId: number, failuresAllowed: number = 3): void {
    const entity = this.bot.entities[entityId];
    if (entity) {
      this.blacklistItem(entity, failuresAllowed);
    }
  }

  /**
   * Check if entity ID is unreachable
   */
  isEntityUnreachable(entityId: number): boolean {
    const entity = this.bot.entities[entityId];
    if (!entity) return false;
    return this.unreachable(entity);
  }

  /**
   * Clear blacklist for entity ID
   */
  clearEntityId(entityId: number): void {
    const entity = this.bot.entities[entityId];
    if (entity) {
      this.clearItem(entity);
    }
  }
}

export default EntityLocateBlacklist;
