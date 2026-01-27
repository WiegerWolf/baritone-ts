/**
 * MovementUtilTask - Movement Utility Tasks
 * Based on AltoClef's movement tasks
 *
 * Utility tasks for movement situations:
 * - TimeoutWanderTask: Wander away from current position
 * - IdleTask: Do nothing (placeholder task)
 * - GetToYTask: Get to a specific Y level
 * - SafeRandomShimmyTask: Shimmy to escape stuck situations
 *
 * These are used when the bot needs to escape bad situations
 * or wait for something.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { defaultGroundedShouldForce } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';

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
 * Interface for tasks that require being grounded (simplified for this file)
 */
interface ITaskRequiresGroundedLocal {
  readonly requiresGrounded: boolean;
  shouldForce(interruptingCandidate: ITask | null): boolean;
}

/**
 * TimeoutWanderTask - Wander away from current position
 *
 * Intent: When the bot is stuck or in a bad position, this task
 * makes it wander away to a better location. Used as a fallback
 * when other navigation fails.
 *
 * Key behaviors:
 * - Walks a specified distance from starting position
 * - Can increase range on repeated failures
 * - Detects and escapes from annoying blocks (vines, etc.)
 * - Gives up after too many failures
 */
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

/**
 * IdleTask - Do nothing
 *
 * Intent: A placeholder task that never finishes. Useful for
 * keeping the task system active without doing anything,
 * or for testing purposes.
 */
export class IdleTask extends Task {
  constructor(bot: Bot) {
    super(bot);
  }

  get displayName(): string {
    return 'Idle';
  }

  onTick(): Task | null {
    // Do nothing
    return null;
  }

  isFinished(): boolean {
    // Never finish
    return false;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof IdleTask;
  }
}

/**
 * GetToYTask - Navigate to a specific Y level
 *
 * Intent: Get the bot to a specific altitude, useful for
 * reaching mining levels or escaping caves.
 */
export class GetToYTask extends Task implements ITaskRequiresGroundedLocal {
  readonly requiresGrounded = true;

  private targetY: number;
  private tolerance: number;
  private progressChecker: MovementProgressChecker;

  constructor(bot: Bot, targetY: number, tolerance: number = 2) {
    super(bot);
    this.targetY = targetY;
    this.tolerance = tolerance;
    this.progressChecker = new MovementProgressChecker(bot);
  }

  /**
   * Implementation of ITaskRequiresGrounded.shouldForce
   */
  shouldForce(interruptingCandidate: ITask | null): boolean {
    return defaultGroundedShouldForce(this.bot, interruptingCandidate);
  }

  get displayName(): string {
    return `GetToY(${this.targetY})`;
  }

  onStart(): void {
    this.progressChecker.reset();
  }

  onTick(): Task | null {
    const currentY = this.bot.entity.position.y;

    // Check if at target level
    if (Math.abs(currentY - this.targetY) <= this.tolerance) {
      return null;
    }

    // Update and check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      // Stuck - try wandering
      this.progressChecker.reset();
      return new TimeoutWanderTask(this.bot, 5);
    }

    // Need to go up
    if (currentY < this.targetY) {
      // Try to find upward path
      this.bot.setControlState('jump', true);
      this.bot.setControlState('forward', true);
    } else {
      // Need to go down - just walk around and look for downward paths
      this.bot.setControlState('forward', true);
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    const currentY = this.bot.entity.position.y;
    return Math.abs(currentY - this.targetY) <= this.tolerance;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetToYTask)) return false;
    return this.targetY === other.targetY;
  }
}

/**
 * SafeRandomShimmyTask - Random movement to get unstuck
 *
 * Intent: When stuck in vines, fences, or other obstacles,
 * this task makes small random movements to escape.
 */
export class SafeRandomShimmyTask extends Task {
  private duration: number;
  private timer: TimerGame;
  private direction: Vec3 | null = null;

  constructor(bot: Bot, duration: number = 1.5) {
    super(bot);
    this.duration = duration;
    this.timer = new TimerGame(bot, duration);
  }

  get displayName(): string {
    return 'SafeRandomShimmy';
  }

  onStart(): void {
    this.timer.reset();

    // Pick a random direction
    const angle = Math.random() * Math.PI * 2;
    this.direction = new Vec3(Math.cos(angle), 0, Math.sin(angle));
  }

  onTick(): Task | null {
    if (this.timer.elapsed()) {
      return null;
    }

    if (!this.direction) return null;

    // Move in the random direction
    const target = this.bot.entity.position.plus(this.direction.scaled(5));
    this.bot.lookAt(target, true);

    // Alternate controls for shimmy effect
    const elapsed = this.timer.getElapsedTime();
    const phase = Math.floor(elapsed * 4) % 4;

    this.bot.clearControlStates();

    switch (phase) {
      case 0:
        this.bot.setControlState('forward', true);
        this.bot.setControlState('jump', true);
        break;
      case 1:
        this.bot.setControlState('left', true);
        break;
      case 2:
        this.bot.setControlState('back', true);
        this.bot.setControlState('sneak', true);
        break;
      case 3:
        this.bot.setControlState('right', true);
        break;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.timer.elapsed();
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof SafeRandomShimmyTask)) return false;
    return Math.abs(this.duration - other.duration) < 0.1;
  }
}

/**
 * WaitTask - Wait for a duration
 *
 * Intent: Simply wait for a specified duration before completing.
 * Useful for cooldowns or waiting for events.
 */
export class WaitTask extends Task {
  private duration: number;
  private timer: TimerGame;

  constructor(bot: Bot, durationSeconds: number) {
    super(bot);
    this.duration = durationSeconds;
    this.timer = new TimerGame(bot, durationSeconds);
  }

  get displayName(): string {
    return `Wait(${this.duration}s)`;
  }

  onStart(): void {
    this.timer.reset();
  }

  onTick(): Task | null {
    return null; // Just wait
  }

  isFinished(): boolean {
    return this.timer.elapsed();
  }

  /**
   * Get remaining time
   */
  getRemainingTime(): number {
    return this.timer.getRemainingTime();
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof WaitTask)) return false;
    return Math.abs(this.duration - other.duration) < 0.1;
  }
}

/**
 * LookAtBlockTask - Look at a specific block position
 *
 * Intent: Orient the player to look at a block, useful before
 * interaction or as a prerequisite for other tasks.
 */
export class LookAtBlockTask extends Task {
  private target: Vec3;
  private looked: boolean = false;

  private blockX: number;
  private blockY: number;
  private blockZ: number;

  constructor(bot: Bot, x: number, y: number, z: number) {
    super(bot);
    this.blockX = x;
    this.blockY = y;
    this.blockZ = z;
    this.target = new Vec3(x + 0.5, y + 0.5, z + 0.5); // Center of block
  }

  get displayName(): string {
    return `LookAt(${this.blockX}, ${this.blockY}, ${this.blockZ})`;
  }

  onStart(): void {
    this.looked = false;
  }

  onTick(): Task | null {
    this.bot.lookAt(this.target, true);
    this.looked = true;
    return null;
  }

  isFinished(): boolean {
    return this.looked;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof LookAtBlockTask)) return false;
    return this.target.equals(other.target);
  }
}
