/**
 * InteractWithEntityTask - Right-click interact with an entity
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { AbstractDoToEntityTask } from './AbstractDoToEntityTask';

/**
 * Task to approach and interact with an entity (right-click).
 *
 * WHY: Many entity interactions use right-click (trading with villagers,
 * mounting horses, etc.). This task handles approach and interaction.
 */
export class InteractWithEntityTask extends AbstractDoToEntityTask {
  private entityId: number;
  private interacted: boolean = false;

  constructor(bot: Bot, entityId: number) {
    super(bot, { maintainDistance: 2, reachRange: 3 });
    this.entityId = entityId;
  }

  get displayName(): string {
    const entity = this.bot.entities[this.entityId];
    const name = entity?.name ?? 'unknown';
    return `InteractWithEntity(${name})`;
  }

  onStart(): void {
    super.onStart();
    this.interacted = false;
  }

  protected getEntityTarget(): Entity | null {
    return this.bot.entities[this.entityId] ?? null;
  }

  protected onEntityInteract(entity: Entity): Task | null {
    if (this.interacted) {
      this.markFinished();
      return null;
    }

    try {
      this.bot.useOn(entity);
      this.interacted = true;
    } catch (err) {
      // Try activateEntity as fallback
      try {
        (this.bot as any).activateEntity?.(entity);
        this.interacted = true;
      } catch {
        this.markFailed();
      }
    }

    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof InteractWithEntityTask)) return false;
    return this.entityId === other.entityId;
  }
}
