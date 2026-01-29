/**
 * AttackEntityTask - Attack an entity
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { LookHelper } from '../../utils/LookHelper';
import { TimerGame } from '../../utils/timers/TimerGame';

export class AttackEntityTask extends Task {
  private entityId: number;
  private lookHelper: LookHelper;
  private attackTimer: TimerGame;
  private attackDistance: number = 3.5;
  private targetDead: boolean = false;

  constructor(bot: Bot, entityId: number) {
    super(bot);
    this.entityId = entityId;
    this.lookHelper = new LookHelper(bot);
    this.attackTimer = new TimerGame(bot, 0.5); // Attack cooldown
  }

  get displayName(): string {
    const entity = this.getEntity();
    const name = entity ? (entity.username || entity.name || 'entity') : 'unknown';
    return `Attack(${name})`;
  }

  onStart(): void {
    this.targetDead = false;
    this.attackTimer.forceElapsed(); // Can attack immediately
  }

  onTick(): Task | null {
    const entity = this.getEntity();
    if (!entity || !entity.isValid) {
      this.targetDead = true;
      return null;
    }

    // Check distance
    const dist = this.bot.entity.position.distanceTo(entity.position);
    if (dist > this.attackDistance) {
      // Need to get closer
      return new GoToNearTask(
        this.bot,
        Math.floor(entity.position.x),
        Math.floor(entity.position.y),
        Math.floor(entity.position.z),
        Math.floor(this.attackDistance) - 1
      );
    }

    // Look at entity
    const eyePos = entity.position.offset(0, entity.height * 0.8, 0);
    this.lookHelper.startLookingAt(eyePos);

    // Attack if cooldown elapsed
    if (this.attackTimer.elapsed()) {
      try {
        this.bot.attack(entity);
        this.attackTimer.reset();
      } catch (err) {
        // Will retry
      }
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.lookHelper.stopLooking();
  }

  isFinished(): boolean {
    return this.targetDead;
  }

  private getEntity(): Entity | null {
    return this.bot.entities[this.entityId] || null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof AttackEntityTask)) return false;
    return this.entityId === other.entityId;
  }
}
