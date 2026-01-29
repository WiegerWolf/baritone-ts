/**
 * InteractBlockTask - Interact with a block (right-click)
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { GetToBlockTask } from './GetToBlockTask';
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
    this.lookHelper.tick();
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
