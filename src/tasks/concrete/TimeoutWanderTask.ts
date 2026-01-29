/**
 * TimeoutWanderTask - Wander away from current position
 *
 * When the bot is stuck or in a bad position, this task
 * makes it wander away to a better location. Used as a fallback
 * when other navigation fails.
 *
 * Key behaviors:
 * - Walks a specified distance from starting position
 * - Can increase range on repeated failures
 * - Detects and escapes from annoying blocks (vines, etc.)
 * - Gives up after too many failures
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { defaultGroundedShouldForce } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';
import { SafeRandomShimmyTask } from './SafeRandomShimmyTask';

/**
 * Blocks that can get the bot stuck
 */
const ANNOYING_BLOCKS = [
  'vine', 'nether_sprouts', 'cave_vines', 'cave_vines_plant',
  'twisting_vines', 'twisting_vines_plant', 'weeping_vines',
  'weeping_vines_plant', 'ladder', 'big_dripleaf', 'big_dripleaf_stem',
  'small_dripleaf', 'tall_grass', 'grass', 'short_grass', 'sweet_berry_bush',
  'scaffolding', 'cobweb',
];

/**
 * Interface for tasks that require being grounded
 */
interface ITaskRequiresGroundedLocal {
  readonly requiresGrounded: boolean;
  shouldForce(interruptingCandidate: ITask | null): boolean;
}

export class TimeoutWanderTask extends Task implements ITaskRequiresGroundedLocal {
  readonly requiresGrounded = true;

  private distanceToWander: number;
  private increaseRange: boolean;
  private forceExplore: boolean;

  private origin: Vec3 | null = null;
  private progressChecker: MovementProgressChecker;
  private stuckCheck: MovementProgressChecker;
  private timer: TimerGame;

  private failCounter: number = 0;
  private wanderDistanceExtension: number = 0;
  private maxFails: number = 10;

  /**
   * Implementation of ITaskRequiresGrounded.shouldForce
   */
  shouldForce(interruptingCandidate: ITask | null): boolean {
    return defaultGroundedShouldForce(this.bot, interruptingCandidate);
  }

  /**
   * @param bot The mineflayer bot
   * @param distanceToWander Distance to wander (Infinity for continuous)
   * @param increaseRange Whether to increase range on completion
   */
  constructor(bot: Bot, distanceToWander: number = Infinity, increaseRange: boolean = false) {
    super(bot);
    this.distanceToWander = distanceToWander;
    this.increaseRange = increaseRange;
    this.forceExplore = !isFinite(distanceToWander);
    this.progressChecker = new MovementProgressChecker(bot);
    this.stuckCheck = new MovementProgressChecker(bot);
    this.timer = new TimerGame(bot, 60);
  }

  get displayName(): string {
    const dist = isFinite(this.distanceToWander)
      ? `${(this.distanceToWander + this.wanderDistanceExtension).toFixed(1)}m`
      : 'infinite';
    return `Wander(${dist})`;
  }

  onStart(): void {
    this.timer.reset();
    this.origin = this.bot.entity.position.clone();
    this.progressChecker.reset();
    this.stuckCheck.reset();
    this.failCounter = 0;

    // Clear any cursor items
    const cursor = (this.bot.inventory as any).cursor;
    if (cursor) {
      // Try to store or throw cursor item
      const emptySlot = this.bot.inventory.firstEmptyInventorySlot();
      if (emptySlot !== null) {
        this.bot.clickWindow(emptySlot, 0, 0).catch(() => {});
      }
    }
  }

  onTick(): Task | null {
    // Check for nether portal escape
    if (this.isInNetherPortal()) {
      this.setDebugState('Escaping nether portal');
      this.bot.setControlState('sneak', true);
      this.bot.setControlState('forward', true);
      return null;
    } else {
      this.bot.setControlState('sneak', false);
    }

    // Check if stuck in annoying blocks
    const stuckBlock = this.getStuckBlock();
    if (stuckBlock) {
      this.setDebugState('Stuck in block, shimmying');
      this.stuckCheck.reset();
      return new SafeRandomShimmyTask(this.bot);
    }

    // Update and check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    this.stuckCheck.setProgress(this.bot.entity.position);

    if (this.progressChecker.failed() || this.stuckCheck.failed()) {
      this.failCounter++;
      this.progressChecker.reset();
      this.stuckCheck.reset();

      if (this.failCounter > this.maxFails) {
        // Give up
        return null;
      }
    }

    // Move in a random direction
    this.setDebugState('Wandering');
    this.moveRandomly();

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();

    if (this.isFinished() && this.increaseRange) {
      this.wanderDistanceExtension += this.distanceToWander;
    }
  }

  isFinished(): boolean {
    if (!isFinite(this.distanceToWander)) return false;

    // Fail after too many attempts
    if (this.failCounter > this.maxFails) return true;

    // Check if we've wandered far enough
    if (!this.origin) return false;
    if (!this.bot.entity.onGround && !(this.bot.entity as any).isInWater) return false;

    const sqDist = this.bot.entity.position.distanceSquared(this.origin);
    const toWander = this.distanceToWander + this.wanderDistanceExtension;
    return sqDist > toWander * toWander;
  }

  /**
   * Reset the wander distance extension
   */
  resetWander(): void {
    this.wanderDistanceExtension = 0;
  }

  private isInNetherPortal(): boolean {
    const pos = this.bot.entity.position;
    const block = this.bot.blockAt(pos);
    return block?.name === 'nether_portal';
  }

  private getStuckBlock(): Vec3 | null {
    const pos = this.bot.entity.position;
    const blockPos = pos.floored();

    // Check current position and above
    const positions = [
      blockPos,
      blockPos.offset(0, 1, 0),
      // Check adjacent blocks
      blockPos.offset(1, 0, 0),
      blockPos.offset(-1, 0, 0),
      blockPos.offset(0, 0, 1),
      blockPos.offset(0, 0, -1),
      blockPos.offset(1, 1, 0),
      blockPos.offset(-1, 1, 0),
      blockPos.offset(0, 1, 1),
      blockPos.offset(0, 1, -1),
    ];

    for (const p of positions) {
      const block = this.bot.blockAt(p);
      if (block && this.isAnnoyingBlock(block.name)) {
        return p;
      }
    }

    return null;
  }

  private isAnnoyingBlock(name: string): boolean {
    return ANNOYING_BLOCKS.some(b => name.includes(b)) ||
           name.includes('door') ||
           name.includes('fence') ||
           name.includes('gate');
  }

  private moveRandomly(): void {
    // Random direction
    const angle = Math.random() * Math.PI * 2;
    const dir = new Vec3(Math.cos(angle), 0, Math.sin(angle));

    // Look in that direction
    const target = this.bot.entity.position.plus(dir.scaled(10));
    this.bot.lookAt(target, true);

    // Move forward
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', Math.random() > 0.3);

    // Occasionally jump
    if (Math.random() > 0.9) {
      this.bot.setControlState('jump', true);
    } else {
      this.bot.setControlState('jump', false);
    }
  }

  private setDebugState(state: string): void {
    // Could emit debug event here
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof TimeoutWanderTask)) return false;

    if (!isFinite(this.distanceToWander) || !isFinite(other.distanceToWander)) {
      return !isFinite(this.distanceToWander) === !isFinite(other.distanceToWander);
    }

    return Math.abs(this.distanceToWander - other.distanceToWander) < 0.5;
  }
}
