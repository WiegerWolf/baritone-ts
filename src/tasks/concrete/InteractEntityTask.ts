/**
 * InteractEntityTask - Interact with an entity (right-click)
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { LookHelper } from '../../utils/LookHelper';
import { TimerGame } from '../../utils/timers/TimerGame';

enum InteractState {
  GOING_TO_TARGET,
  LOOKING,
  INTERACTING,
  WAITING,
  FINISHED,
  FAILED
}

export class InteractEntityTask extends Task {
  private entityId: number;
  private state: InteractState = InteractState.GOING_TO_TARGET;
  private lookHelper: LookHelper;
  private interactTimer: TimerGame;
  private interactDistance: number = 3.0;
  private interacted: boolean = false;

  constructor(bot: Bot, entityId: number) {
    super(bot);
    this.entityId = entityId;
    this.lookHelper = new LookHelper(bot);
    this.interactTimer = new TimerGame(bot, 0.25);
  }

  get displayName(): string {
    const entity = this.getEntity();
    const name = entity ? (entity.username || entity.name || 'entity') : 'unknown';
    return `InteractEntity(${name})`;
  }

  onStart(): void {
    this.state = InteractState.GOING_TO_TARGET;
    this.interacted = false;
  }

  onTick(): Task | null {
    const entity = this.getEntity();
    if (!entity) {
      this.state = InteractState.FAILED;
      return null;
    }

    switch (this.state) {
      case InteractState.GOING_TO_TARGET:
        return this.handleGoingToTarget(entity);

      case InteractState.LOOKING:
        return this.handleLooking(entity);

      case InteractState.INTERACTING:
        return this.handleInteracting(entity);

      case InteractState.WAITING:
        return this.handleWaiting();

      default:
        return null;
    }
  }

  private handleGoingToTarget(entity: Entity): Task | null {
    const dist = this.bot.entity.position.distanceTo(entity.position);

    if (dist <= this.interactDistance) {
      this.state = InteractState.LOOKING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(entity.position.x),
      Math.floor(entity.position.y),
      Math.floor(entity.position.z),
      Math.floor(this.interactDistance)
    );
  }

  private handleLooking(entity: Entity): Task | null {
    this.lookHelper.startLookingAt(entity.position.offset(0, entity.height / 2, 0));
    this.state = InteractState.INTERACTING;
    this.interactTimer.reset();
    return null;
  }

  private handleInteracting(entity: Entity): Task | null {
    if (!this.interactTimer.elapsed()) {
      return null;
    }

    try {
      // Use entity - mineflayer provides useOn method for some entities
      this.bot.useOn(entity);
      this.interacted = true;
      this.state = InteractState.WAITING;
      this.interactTimer.reset();
    } catch (err) {
      // Try activating instead
      try {
        (this.bot as any).activateEntity(entity);
        this.interacted = true;
        this.state = InteractState.WAITING;
        this.interactTimer.reset();
      } catch {
        this.state = InteractState.FAILED;
      }
    }

    return null;
  }

  private handleWaiting(): Task | null {
    if (!this.interactTimer.elapsed()) {
      return null;
    }

    this.state = InteractState.FINISHED;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.lookHelper.stopLooking();
  }

  isFinished(): boolean {
    return this.state === InteractState.FINISHED || this.state === InteractState.FAILED;
  }

  isFailed(): boolean {
    return this.state === InteractState.FAILED;
  }

  private getEntity(): Entity | null {
    return this.bot.entities[this.entityId] || null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof InteractEntityTask)) return false;
    return this.entityId === other.entityId;
  }
}
