/**
 * PlaceBlockTask - Block Placement Tasks
 * Based on AltoClef's PlaceBlockTask
 *
 * Tasks for placing blocks at specific positions.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task, GroundedTask } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { GetToBlockTask } from './GetToBlockTask';
import { LookHelper } from '../../utils/LookHelper';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Directions for block placement
 */
const PLACE_DIRECTIONS: Vec3[] = [
  new Vec3(0, -1, 0),  // bottom
  new Vec3(0, 1, 0),   // top
  new Vec3(-1, 0, 0),  // west
  new Vec3(1, 0, 0),   // east
  new Vec3(0, 0, -1),  // north
  new Vec3(0, 0, 1),   // south
];

/**
 * State for placement operation
 */
enum PlaceState {
  GOING_TO_POSITION,
  EQUIPPING_BLOCK,
  PLACING,
  VERIFYING,
  FINISHED,
  FAILED
}

/**
 * Task to place a block at a position
 */
export class PlaceBlockTask extends GroundedTask {
  private target: BlockPos;
  private blockName: string;
  private state: PlaceState = PlaceState.GOING_TO_POSITION;
  private lookHelper: LookHelper;
  private placeTimer: TimerGame;
  private attempts: number = 0;
  private maxAttempts: number = 5;

  constructor(bot: Bot, x: number, y: number, z: number, blockName: string) {
    super(bot);
    this.target = new BlockPos(x, y, z);
    this.blockName = blockName;
    this.lookHelper = new LookHelper(bot);
    this.placeTimer = new TimerGame(bot, 0.25); // Quarter second between attempts
  }

  static fromVec3(bot: Bot, pos: Vec3, blockName: string): PlaceBlockTask {
    return new PlaceBlockTask(bot, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z), blockName);
  }

  static fromBlockPos(bot: Bot, pos: BlockPos, blockName: string): PlaceBlockTask {
    return new PlaceBlockTask(bot, pos.x, pos.y, pos.z, blockName);
  }

  get displayName(): string {
    return `PlaceBlock(${this.blockName} at ${this.target.x}, ${this.target.y}, ${this.target.z})`;
  }

  onStart(): void {
    this.state = PlaceState.GOING_TO_POSITION;
    this.attempts = 0;
    this.placeTimer.reset();
  }

  onTick(): Task | null {
    // Check if block is already placed
    const existingBlock = this.getTargetBlock();
    if (existingBlock && existingBlock.name === this.blockName) {
      this.state = PlaceState.FINISHED;
      return null;
    }

    // Check if position is not air (something else in the way)
    if (existingBlock && existingBlock.name !== 'air' &&
        existingBlock.name !== 'cave_air' && existingBlock.name !== 'void_air') {
      // Block in the way - might need to mine it first
      this.state = PlaceState.FAILED;
      return null;
    }

    switch (this.state) {
      case PlaceState.GOING_TO_POSITION:
        return this.handleGoingToPosition();

      case PlaceState.EQUIPPING_BLOCK:
        return this.handleEquippingBlock();

      case PlaceState.PLACING:
        return this.handlePlacing();

      case PlaceState.VERIFYING:
        return this.handleVerifying();

      default:
        return null;
    }
  }

  private handleGoingToPosition(): Task | null {
    // Check if we're in range
    const playerPos = this.bot.entity.position;
    const targetCenter = new Vec3(
      this.target.x + 0.5,
      this.target.y + 0.5,
      this.target.z + 0.5
    );

    const distance = playerPos.distanceTo(targetCenter);
    const placeDistance = 4.0; // Slightly shorter than reach

    // Find a reference block we can place against
    const referenceBlock = this.findReferenceBlock();
    if (!referenceBlock) {
      // No adjacent block to place against
      this.state = PlaceState.FAILED;
      return null;
    }

    if (distance <= placeDistance) {
      this.state = PlaceState.EQUIPPING_BLOCK;
      return null;
    }

    // Need to get closer - go to any adjacent block
    return new GetToBlockTask(this.bot, this.target.x, this.target.y, this.target.z);
  }

  private handleEquippingBlock(): Task | null {
    // Find the block in inventory
    const slot = this.findBlockSlot();
    if (slot === null) {
      this.state = PlaceState.FAILED;
      return null;
    }

    // Equip it
    const hotbarSlot = slot >= 36 && slot < 45 ? slot - 36 : -1;
    if (hotbarSlot >= 0) {
      this.bot.setQuickBarSlot(hotbarSlot);
    } else {
      // Need to move to hotbar - for now, fail
      this.state = PlaceState.FAILED;
      return null;
    }

    this.state = PlaceState.PLACING;
    this.placeTimer.reset();
    return null;
  }

  private handlePlacing(): Task | null {
    if (!this.placeTimer.elapsed()) {
      return null; // Wait between attempts
    }

    this.attempts++;
    if (this.attempts > this.maxAttempts) {
      this.state = PlaceState.FAILED;
      return null;
    }

    // Find reference block and face
    const reference = this.findReferenceBlock();
    if (!reference) {
      this.state = PlaceState.FAILED;
      return null;
    }

    const { block, face } = reference;

    // Look at the face of the reference block
    const lookTarget = new Vec3(
      block.position.x + 0.5 + face.x * 0.5,
      block.position.y + 0.5 + face.y * 0.5,
      block.position.z + 0.5 + face.z * 0.5
    );

    // Use startLookingAt for non-blocking smooth look
    this.lookHelper.startLookingAt(lookTarget);
    this.lookHelper.tick();

    // Place the block
    try {
      this.bot.placeBlock(block, face);
      this.state = PlaceState.VERIFYING;
      this.placeTimer.reset();
    } catch (err) {
      // Placement failed, will retry
    }

    this.placeTimer.reset();
    return null;
  }

  private handleVerifying(): Task | null {
    if (!this.placeTimer.elapsed()) {
      return null; // Wait for server update
    }

    const block = this.getTargetBlock();
    if (block && block.name === this.blockName) {
      this.state = PlaceState.FINISHED;
    } else {
      // Try again
      this.state = PlaceState.PLACING;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.state === PlaceState.FINISHED || this.state === PlaceState.FAILED;
  }

  /**
   * Check if placement failed
   */
  isFailed(): boolean {
    return this.state === PlaceState.FAILED;
  }

  /**
   * Get the target block
   */
  private getTargetBlock(): Block | null {
    return this.bot.blockAt(new Vec3(this.target.x, this.target.y, this.target.z));
  }

  /**
   * Find an adjacent solid block to place against
   * Returns the block and the face direction to click
   */
  private findReferenceBlock(): { block: Block; face: Vec3 } | null {
    for (const dir of PLACE_DIRECTIONS) {
      const checkPos = new Vec3(
        this.target.x + dir.x,
        this.target.y + dir.y,
        this.target.z + dir.z
      );

      const block = this.bot.blockAt(checkPos);
      if (block && block.boundingBox !== 'empty') {
        // This block is solid - use opposite direction as face
        const face = new Vec3(-dir.x, -dir.y, -dir.z);
        return { block, face };
      }
    }

    return null;
  }

  /**
   * Find the block in inventory
   * Returns inventory slot number
   */
  private findBlockSlot(): number | null {
    const items = this.bot.inventory.items();
    for (const item of items) {
      if (item.name === this.blockName || item.name.includes(this.blockName)) {
        return item.slot;
      }
    }
    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PlaceBlockTask)) return false;
    return this.target.equals(other.target) && this.blockName === other.blockName;
  }
}

