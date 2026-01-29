/**
 * InteractTask - Interaction Tasks
 * Based on AltoClef's interaction system
 *
 * Tasks for interacting with blocks and entities.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { GetToBlockTask } from './GetToBlockTask';
import { GoToNearTask } from './GoToNearTask';
import { LookHelper } from '../../utils/LookHelper';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for block interaction
 */
enum InteractState {
  GOING_TO_TARGET,
  LOOKING,
  INTERACTING,
  WAITING,
  FINISHED,
  FAILED
}

/**
 * Task to interact with a block (right-click)
 */
export class InteractBlockTask extends Task {
  private target: BlockPos;
  private state: InteractState = InteractState.GOING_TO_TARGET;
  private lookHelper: LookHelper;
  private interactTimer: TimerGame;
  private interacted: boolean = false;

  constructor(bot: Bot, x: number, y: number, z: number) {
    super(bot);
    this.target = new BlockPos(x, y, z);
    this.lookHelper = new LookHelper(bot);
    this.interactTimer = new TimerGame(bot, 0.25);
  }

  static fromVec3(bot: Bot, pos: Vec3): InteractBlockTask {
    return new InteractBlockTask(bot, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  }

  static fromBlockPos(bot: Bot, pos: BlockPos): InteractBlockTask {
    return new InteractBlockTask(bot, pos.x, pos.y, pos.z);
  }

  get displayName(): string {
    return `InteractBlock(${this.target.x}, ${this.target.y}, ${this.target.z})`;
  }

  onStart(): void {
    this.state = InteractState.GOING_TO_TARGET;
    this.interacted = false;
  }

  onTick(): Task | null {
    const block = this.getTargetBlock();
    if (!block) {
      this.state = InteractState.FAILED;
      return null;
    }

    switch (this.state) {
      case InteractState.GOING_TO_TARGET:
        return this.handleGoingToTarget();

      case InteractState.LOOKING:
        return this.handleLooking(block);

      case InteractState.INTERACTING:
        return this.handleInteracting(block);

      case InteractState.WAITING:
        return this.handleWaiting();

      default:
        return null;
    }
  }

  private handleGoingToTarget(): Task | null {
    const dist = this.bot.entity.position.distanceTo(
      new Vec3(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5)
    );

    if (dist <= 4.0) {
      this.state = InteractState.LOOKING;
      return null;
    }

    return new GetToBlockTask(this.bot, this.target.x, this.target.y, this.target.z);
  }

  private handleLooking(block: Block): Task | null {
    const blockCenter = new Vec3(
      this.target.x + 0.5,
      this.target.y + 0.5,
      this.target.z + 0.5
    );

    this.lookHelper.startLookingAt(blockCenter);
    this.state = InteractState.INTERACTING;
    this.interactTimer.reset();
    return null;
  }

  private handleInteracting(block: Block): Task | null {
    if (!this.interactTimer.elapsed()) {
      return null;
    }

    try {
      this.bot.activateBlock(block);
      this.interacted = true;
      this.state = InteractState.WAITING;
      this.interactTimer.reset();
    } catch (err) {
      this.state = InteractState.FAILED;
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

  private getTargetBlock(): Block | null {
    return this.bot.blockAt(new Vec3(this.target.x, this.target.y, this.target.z));
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof InteractBlockTask)) return false;
    return this.target.equals(other.target);
  }
}

/**
 * Task to interact with an entity (right-click)
 */
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

/**
 * Task to attack an entity
 */
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

/**
 * Task to use the currently held item
 */
export class UseItemTask extends Task {
  private useDuration: number;
  private useTimer: TimerGame;
  private started: boolean = false;
  private finished: boolean = false;

  constructor(bot: Bot, useDuration: number = 1.0) {
    super(bot);
    this.useDuration = useDuration;
    this.useTimer = new TimerGame(bot, useDuration);
  }

  get displayName(): string {
    const held = this.bot.heldItem;
    const name = held ? held.name : 'nothing';
    return `UseItem(${name})`;
  }

  onStart(): void {
    this.started = false;
    this.finished = false;
  }

  onTick(): Task | null {
    if (!this.started) {
      // Start using item
      this.bot.activateItem();
      this.started = true;
      this.useTimer.reset();
      return null;
    }

    // Check if done
    if (this.useTimer.elapsed()) {
      this.bot.deactivateItem();
      this.finished = true;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    if (this.started && !this.finished) {
      try {
        this.bot.deactivateItem();
      } catch {
        // Ignore
      }
    }
  }

  isFinished(): boolean {
    return this.finished;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof UseItemTask)) return false;
    return this.useDuration === other.useDuration;
  }
}
