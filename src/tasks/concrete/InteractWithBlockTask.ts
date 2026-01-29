/**
 * InteractWithBlockTask - Enhanced Block Interaction
 * Based on BaritonePlus's InteractWithBlockTask.java
 *
 * WHY: Many tasks need to interact with blocks in specific ways:
 * - Using a specific item (e.g., placing water with bucket)
 * - From a specific direction (e.g., placing blocks against sides)
 * - With shift-click (e.g., placing on interactable blocks)
 * - Left or right click (mining vs using)
 *
 * This task handles all the complexity of reaching the block from the
 * right direction, equipping the right item, and handling stuck scenarios.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import type { Item } from 'prismarine-item';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { GetToBlockTask } from './GetToBlockTask';
import { GoToNearTask } from './GoToNearTask';
import { SafeRandomShimmyTask } from './SafeRandomShimmyTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { LookHelper } from '../../utils/LookHelper';
import { TimerGame } from '../../utils/timers/TimerGame';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';

/**
 * Direction enum for block interaction
 */
export enum Direction {
  DOWN = 'down',
  UP = 'up',
  NORTH = 'north',
  SOUTH = 'south',
  WEST = 'west',
  EAST = 'east',
}

/**
 * Input type for interaction
 */
export enum InteractInput {
  LEFT_CLICK = 'left',
  RIGHT_CLICK = 'right',
}

/**
 * Click response from interaction attempt
 */
export enum ClickResponse {
  CANT_REACH = 'cant_reach',
  WAIT_FOR_CLICK = 'wait_for_click',
  CLICK_ATTEMPTED = 'click_attempted',
}

/**
 * Interaction state
 */
enum InteractWithBlockState {
  MOVING_TO_BLOCK,
  ESCAPING_PORTAL,
  GETTING_UNSTUCK,
  WAITING_FOR_CLICK,
  CLICKING,
  WANDERING,
  FINISHED,
  FAILED,
}

/**
 * Configuration for InteractWithBlockTask
 */
export interface InteractWithBlockConfig {
  /** Target block position */
  target: BlockPos;
  /** Item(s) to use for interaction (null = any) */
  itemToUse?: string | string[] | null;
  /** Direction to interact from (null = any) */
  direction?: Direction | null;
  /** Input type (left or right click) */
  input?: InteractInput;
  /** Whether to walk into the block position */
  walkInto?: boolean;
  /** Interaction offset from block center */
  interactOffset?: Vec3;
  /** Whether to shift-click */
  shiftClick?: boolean;
  /** Reach distance */
  reachDistance?: number;
  /** Click timeout before wandering */
  clickTimeout?: number;
}

const DEFAULT_CONFIG: InteractWithBlockConfig = {
  target: new BlockPos(0, 0, 0),
  itemToUse: null,
  direction: null,
  input: InteractInput.RIGHT_CLICK,
  walkInto: false,
  interactOffset: new Vec3(0, 0, 0),
  shiftClick: true,
  reachDistance: 4,
  clickTimeout: 5,
};

/**
 * Annoying blocks that can cause stuck situations
 */
const ANNOYING_BLOCKS = [
  'vine', 'nether_sprouts', 'cave_vines', 'cave_vines_plant',
  'twisting_vines', 'twisting_vines_plant', 'weeping_vines_plant',
  'ladder', 'big_dripleaf', 'big_dripleaf_stem', 'small_dripleaf',
  'tall_grass', 'grass', 'short_grass', 'sweet_berry_bush',
];

/**
 * Task to interact with a block from a specific direction using a specific item.
 *
 * WHY: This is a fundamental building block for many tasks:
 * - Placing blocks (right-click with block in hand)
 * - Using buckets (right-click with bucket)
 * - Opening doors/chests (right-click)
 * - Mining specific blocks (left-click)
 *
 * The task handles:
 * 1. Moving to the correct position based on direction
 * 2. Equipping the required item
 * 3. Looking at the block
 * 4. Performing the interaction
 * 5. Detecting and escaping from stuck situations
 */
export class InteractWithBlockTask extends Task {
  private config: InteractWithBlockConfig;
  private state: InteractWithBlockState = InteractWithBlockState.MOVING_TO_BLOCK;
  private moveChecker: MovementProgressChecker;
  private stuckChecker: MovementProgressChecker;
  private lookHelper: LookHelper;
  private clickTimer: TimerGame;
  private wanderTask: TimeoutWanderTask;
  private unstuckTask: Task | null = null;
  private cachedClickStatus: ClickResponse = ClickResponse.CANT_REACH;
  private interacted: boolean = false;

  constructor(bot: Bot, config: Partial<InteractWithBlockConfig> & { target: BlockPos }) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.moveChecker = new MovementProgressChecker(bot);
    this.stuckChecker = new MovementProgressChecker(bot);
    this.lookHelper = new LookHelper(bot);
    this.clickTimer = new TimerGame(bot, this.config.clickTimeout!);
    this.wanderTask = new TimeoutWanderTask(bot, 5, true);
  }

  /**
   * Create task to interact with block using an item
   */
  static withItem(bot: Bot, target: BlockPos, itemName: string, direction?: Direction): InteractWithBlockTask {
    return new InteractWithBlockTask(bot, {
      target,
      itemToUse: itemName,
      direction,
    });
  }

  /**
   * Create task to right-click a block (no specific item)
   */
  static rightClick(bot: Bot, target: BlockPos): InteractWithBlockTask {
    return new InteractWithBlockTask(bot, {
      target,
      input: InteractInput.RIGHT_CLICK,
    });
  }

  /**
   * Create task to left-click a block
   */
  static leftClick(bot: Bot, target: BlockPos): InteractWithBlockTask {
    return new InteractWithBlockTask(bot, {
      target,
      input: InteractInput.LEFT_CLICK,
    });
  }

  get displayName(): string {
    const item = this.config.itemToUse
      ? (Array.isArray(this.config.itemToUse) ? this.config.itemToUse[0] : this.config.itemToUse)
      : 'hand';
    const dir = this.config.direction ? ` from ${this.config.direction}` : '';
    return `InteractWithBlock(${item} at ${this.config.target.x},${this.config.target.y},${this.config.target.z}${dir})`;
  }

  onStart(): void {
    this.state = InteractWithBlockState.MOVING_TO_BLOCK;
    this.moveChecker.reset();
    this.stuckChecker.reset();
    this.wanderTask.resetWander();
    this.clickTimer.reset();
    this.unstuckTask = null;
    this.interacted = false;
    this.cachedClickStatus = ClickResponse.CANT_REACH;
  }

  onTick(): Task | null {
    // Check for nether portal
    if (this.isInNetherPortal()) {
      this.state = InteractWithBlockState.ESCAPING_PORTAL;
      return this.handleEscapingPortal();
    }

    // Handle stuck in annoying blocks
    const stuckBlock = this.getStuckInBlock();
    if (stuckBlock) {
      if (this.unstuckTask && !this.unstuckTask.isFinished()) {
        this.state = InteractWithBlockState.GETTING_UNSTUCK;
        this.stuckChecker.reset();
        return this.unstuckTask;
      }
      // Check if stuck by setting progress and checking failure
      this.stuckChecker.setProgress(this.bot.entity.position);
      if (this.stuckChecker.failed()) {
        this.unstuckTask = new SafeRandomShimmyTask(this.bot);
        return this.unstuckTask;
      }
    }

    switch (this.state) {
      case InteractWithBlockState.MOVING_TO_BLOCK:
        return this.handleMovingToBlock();

      case InteractWithBlockState.ESCAPING_PORTAL:
        return this.handleEscapingPortal();

      case InteractWithBlockState.GETTING_UNSTUCK:
        return this.handleGettingUnstuck();

      case InteractWithBlockState.WAITING_FOR_CLICK:
      case InteractWithBlockState.CLICKING:
        return this.handleClicking();

      case InteractWithBlockState.WANDERING:
        return this.handleWandering();

      default:
        return null;
    }
  }

  private handleMovingToBlock(): Task | null {
    // Check if we need to get the item first
    if (this.config.itemToUse && !this.hasRequiredItem()) {
      // Would need to get the item - for now just fail
      // Parent task should ensure item is available
      this.state = InteractWithBlockState.FAILED;
      return null;
    }

    // Try clicking
    this.cachedClickStatus = this.tryInteract();

    switch (this.cachedClickStatus) {
      case ClickResponse.CANT_REACH:
        // Check movement progress
        this.moveChecker.setProgress(this.bot.entity.position);
        if (this.moveChecker.failed()) {
          // Failed to make progress - wander
          this.state = InteractWithBlockState.WANDERING;
          return null;
        }
        // Navigate to block
        return this.createMoveGoal();

      case ClickResponse.WAIT_FOR_CLICK:
        this.state = InteractWithBlockState.WAITING_FOR_CLICK;
        this.clickTimer.reset();
        return null;

      case ClickResponse.CLICK_ATTEMPTED:
        this.state = InteractWithBlockState.CLICKING;
        this.interacted = true;
        return null;
    }
  }

  private handleEscapingPortal(): Task | null {
    // Sneak forward to escape portal
    this.bot.setControlState('sneak', true);
    this.bot.setControlState('forward', true);
    return null;
  }

  private handleGettingUnstuck(): Task | null {
    if (!this.unstuckTask || this.unstuckTask.isFinished()) {
      this.state = InteractWithBlockState.MOVING_TO_BLOCK;
      this.unstuckTask = null;
    }
    return this.unstuckTask;
  }

  private handleClicking(): Task | null {
    this.cachedClickStatus = this.tryInteract();

    switch (this.cachedClickStatus) {
      case ClickResponse.CANT_REACH:
        this.state = InteractWithBlockState.MOVING_TO_BLOCK;
        this.moveChecker.reset();
        return null;

      case ClickResponse.WAIT_FOR_CLICK:
        this.clickTimer.reset();
        return null;

      case ClickResponse.CLICK_ATTEMPTED:
        this.interacted = true;
        if (this.clickTimer.elapsed()) {
          // Clicked but nothing happened - wander
          this.state = InteractWithBlockState.WANDERING;
          this.clickTimer.reset();
        }
        return null;
    }
  }

  private handleWandering(): Task | null {
    if (this.wanderTask.isFinished()) {
      this.state = InteractWithBlockState.MOVING_TO_BLOCK;
      this.moveChecker.reset();
      this.wanderTask.resetWander();
      return null;
    }
    return this.wanderTask;
  }

  private tryInteract(): ClickResponse {
    // Can't interact if eating or blocking
    if (this.bot.food < 20 && this.bot.heldItem?.name.includes('food')) {
      return ClickResponse.WAIT_FOR_CLICK;
    }

    // Close any open screens first
    const window = (this.bot as any).currentWindow;
    if (window) {
      try {
        this.bot.closeWindow(window);
      } catch {
        // Ignore
      }
      return ClickResponse.WAIT_FOR_CLICK;
    }

    // Check if we can reach the block
    const targetVec = new Vec3(
      this.config.target.x + 0.5 + this.config.interactOffset!.x,
      this.config.target.y + 0.5 + this.config.interactOffset!.y,
      this.config.target.z + 0.5 + this.config.interactOffset!.z
    );

    const dist = this.bot.entity.position.distanceTo(targetVec);
    if (dist > this.config.reachDistance!) {
      return ClickResponse.CANT_REACH;
    }

    // Check direction if specified
    if (this.config.direction && !this.isOnCorrectSide()) {
      return ClickResponse.CANT_REACH;
    }

    // Look at block
    this.lookHelper.startLookingAt(targetVec);
    this.lookHelper.tick();

    // Check if looking at block
    if (!this.isLookingAtTarget()) {
      return ClickResponse.WAIT_FOR_CLICK;
    }

    // Equip item if needed
    if (this.config.itemToUse) {
      const equipped = this.equipRequiredItem();
      if (!equipped) {
        return ClickResponse.WAIT_FOR_CLICK;
      }
    }

    // Perform interaction
    const block = this.bot.blockAt(new Vec3(
      this.config.target.x,
      this.config.target.y,
      this.config.target.z
    ));

    if (!block) {
      return ClickResponse.CANT_REACH;
    }

    // Set shift if needed
    if (this.config.shiftClick) {
      this.bot.setControlState('sneak', true);
    }

    // Perform click
    if (this.config.input === InteractInput.LEFT_CLICK) {
      // Left click - dig/attack
      try {
        this.bot.dig(block, 'ignore');
      } catch {
        // Will retry
      }
    } else {
      // Right click - activate
      try {
        this.bot.activateBlock(block);
      } catch {
        // Will retry
      }
    }

    return ClickResponse.CLICK_ATTEMPTED;
  }

  private createMoveGoal(): Task {
    const target = this.config.target;
    const offset = this.getDirectionOffset();

    if (this.config.walkInto) {
      return new GetToBlockTask(this.bot, target.x, target.y, target.z);
    }

    // Move to side of block based on direction
    const goalX = target.x + offset.x;
    const goalY = target.y + Math.min(0, offset.y); // Go below if direction is down
    const goalZ = target.z + offset.z;

    return new GoToNearTask(this.bot, goalX, goalY, goalZ, this.config.reachDistance! - 1);
  }

  private getDirectionOffset(): Vec3 {
    if (!this.config.direction) {
      return new Vec3(0, 0, 0);
    }

    switch (this.config.direction) {
      case Direction.DOWN:
        return new Vec3(0, -2, 0); // Stand 2 below
      case Direction.UP:
        return new Vec3(0, 1, 0);
      case Direction.NORTH:
        return new Vec3(0, 0, -1);
      case Direction.SOUTH:
        return new Vec3(0, 0, 1);
      case Direction.WEST:
        return new Vec3(-1, 0, 0);
      case Direction.EAST:
        return new Vec3(1, 0, 0);
      default:
        return new Vec3(0, 0, 0);
    }
  }

  private isOnCorrectSide(): boolean {
    if (!this.config.direction) return true;

    const playerPos = this.bot.entity.position;
    const targetPos = new Vec3(
      this.config.target.x + 0.5,
      this.config.target.y + 0.5,
      this.config.target.z + 0.5
    );

    const diff = playerPos.minus(targetPos);

    switch (this.config.direction) {
      case Direction.DOWN:
        return diff.y < -0.5;
      case Direction.UP:
        return diff.y > 0.5;
      case Direction.NORTH:
        return diff.z < -0.5;
      case Direction.SOUTH:
        return diff.z > 0.5;
      case Direction.WEST:
        return diff.x < -0.5;
      case Direction.EAST:
        return diff.x > 0.5;
      default:
        return true;
    }
  }

  private isLookingAtTarget(): boolean {
    const block = this.bot.blockAtCursor(this.config.reachDistance!);
    if (!block) return false;

    const pos = block.position;
    return pos.x === this.config.target.x &&
           pos.y === this.config.target.y &&
           pos.z === this.config.target.z;
  }

  private hasRequiredItem(): boolean {
    if (!this.config.itemToUse) return true;

    const items = Array.isArray(this.config.itemToUse)
      ? this.config.itemToUse
      : [this.config.itemToUse];

    return this.bot.inventory.items().some(item =>
      items.some(name => item.name === name || item.name.includes(name))
    );
  }

  private equipRequiredItem(): boolean {
    if (!this.config.itemToUse) return true;

    const items = Array.isArray(this.config.itemToUse)
      ? this.config.itemToUse
      : [this.config.itemToUse];

    // Check if already holding
    const held = this.bot.heldItem;
    if (held && items.some(name => held.name === name || held.name.includes(name))) {
      return true;
    }

    // Find and equip
    const item = this.bot.inventory.items().find(item =>
      items.some(name => item.name === name || item.name.includes(name))
    );

    if (!item) return false;

    // Equip it (async but we'll check next tick)
    this.bot.equip(item, 'hand').catch(() => {});
    return false; // Will be true next tick
  }

  private isInNetherPortal(): boolean {
    const block = this.bot.blockAt(this.bot.entity.position);
    return block?.name === 'nether_portal';
  }

  private getStuckInBlock(): BlockPos | null {
    const pos = this.bot.entity.position;
    const playerBlockPos = new BlockPos(
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z)
    );

    // Check current position and above
    for (const checkPos of [playerBlockPos, new BlockPos(playerBlockPos.x, playerBlockPos.y + 1, playerBlockPos.z)]) {
      if (this.isAnnoyingBlock(checkPos)) {
        return checkPos;
      }
    }

    // Check surrounding blocks
    const offsets = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];

    for (const [dx, dz] of offsets) {
      const checkPos = new BlockPos(playerBlockPos.x + dx, playerBlockPos.y, playerBlockPos.z + dz);
      if (this.isAnnoyingBlock(checkPos)) {
        return checkPos;
      }
      const checkPosHigh = new BlockPos(playerBlockPos.x + dx, playerBlockPos.y + 1, playerBlockPos.z + dz);
      if (this.isAnnoyingBlock(checkPosHigh)) {
        return checkPosHigh;
      }
    }

    return null;
  }

  private isAnnoyingBlock(pos: BlockPos): boolean {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    if (!block) return false;

    const name = block.name;
    return ANNOYING_BLOCKS.some(annoying => name.includes(annoying)) ||
           name.includes('door') ||
           name.includes('fence') ||
           name.includes('flower');
  }

  onStop(interruptTask: ITask | null): void {
    this.lookHelper.stopLooking();
    this.bot.setControlState('sneak', false);
    this.bot.setControlState('forward', false);
  }

  isFinished(): boolean {
    // This task doesn't finish itself - it's meant to be used once
    // The caller should check if the interaction succeeded
    return this.interacted || this.state === InteractWithBlockState.FAILED;
  }

  isFailed(): boolean {
    return this.state === InteractWithBlockState.FAILED;
  }

  /**
   * Check if the interaction was attempted
   */
  wasInteractionAttempted(): boolean {
    return this.interacted;
  }

  /**
   * Get the last click status
   */
  getClickStatus(): ClickResponse {
    return this.cachedClickStatus;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof InteractWithBlockTask)) return false;
    if (!this.config.target.equals(other.config.target)) return false;
    if (this.config.direction !== other.config.direction) return false;
    if (this.config.input !== other.config.input) return false;
    if (JSON.stringify(this.config.itemToUse) !== JSON.stringify(other.config.itemToUse)) return false;
    return this.config.walkInto === other.config.walkInto;
  }
}

/**
 * Convenience function to interact with a block using an item
 */
export function interactWithBlock(
  bot: Bot,
  target: BlockPos,
  itemName?: string,
  direction?: Direction
): InteractWithBlockTask {
  return new InteractWithBlockTask(bot, {
    target,
    itemToUse: itemName,
    direction,
  });
}

/**
 * Convenience function to place a block at a position from a direction
 */
export function placeBlockAt(
  bot: Bot,
  target: BlockPos,
  blockName: string,
  direction: Direction
): InteractWithBlockTask {
  return new InteractWithBlockTask(bot, {
    target,
    itemToUse: blockName,
    direction,
    shiftClick: true,
  });
}
