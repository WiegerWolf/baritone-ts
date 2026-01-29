/**
 * PlaceBlockNearbyTask - Task to place a block nearby at a valid position
 * Split from ConstructionTask.ts
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { LookHelper } from '../../utils/LookHelper';
import { TimerGame } from '../../utils/timers/TimerGame';
import { BlockPos } from '../../types';

/**
 * State for place block nearby task
 */
enum PlaceNearbyState {
  LOOKING_FOR_SPOT,
  MOVING_TO_SPOT,
  LOOKING_AT_TARGET,
  PLACING,
  WANDERING,
  FINISHED,
  FAILED
}

/**
 * Configuration for PlaceBlockNearbyTask
 */
export interface PlaceBlockNearbyConfig {
  /** Block names to place */
  blocksToPlace: string[];
  /** Predicate to filter valid placement positions */
  canPlaceAt?: (pos: BlockPos) => boolean;
  /** Search radius for placement spots */
  searchRadius: number;
  /** Prefer spots with solid block below */
  preferSolidBelow: boolean;
}

const DEFAULT_PLACE_NEARBY_CONFIG: Omit<PlaceBlockNearbyConfig, 'blocksToPlace'> = {
  searchRadius: 7,
  preferSolidBelow: true,
};

/**
 * Task to place a block nearby at a valid position.
 *
 * WHY: Sometimes we need to place a block but don't care exactly where -
 * for example, placing a crafting table or furnace nearby. This task:
 * - Finds a valid placement position nearby
 * - Moves to reach it if needed
 * - Places the block
 * - Wanders and retries if placement fails
 *
 * Also known as "bear strats" in BaritonePlus.
 * Based on BaritonePlus PlaceBlockNearbyTask.java
 */
export class PlaceBlockNearbyTask extends Task {
  private config: PlaceBlockNearbyConfig;
  private state: PlaceNearbyState = PlaceNearbyState.LOOKING_FOR_SPOT;
  private targetPlacePos: BlockPos | null = null;
  private placedPos: BlockPos | null = null;
  private lookHelper: LookHelper;
  private placeTimer: TimerGame;
  private wanderTimer: TimerGame;
  private attemptCount: number = 0;

  constructor(bot: Bot, blocksToPlace: string[], config: Partial<Omit<PlaceBlockNearbyConfig, 'blocksToPlace'>> = {}) {
    super(bot);
    this.config = { ...DEFAULT_PLACE_NEARBY_CONFIG, ...config, blocksToPlace };
    this.lookHelper = new LookHelper(bot);
    this.placeTimer = new TimerGame(bot, 0.25);
    this.wanderTimer = new TimerGame(bot, 5);
  }

  get displayName(): string {
    return `PlaceBlockNearby(${this.config.blocksToPlace.join(', ')})`;
  }

  onStart(): void {
    this.state = PlaceNearbyState.LOOKING_FOR_SPOT;
    this.targetPlacePos = null;
    this.placedPos = null;
    this.attemptCount = 0;
  }

  onTick(): Task | null {
    // Check if we've placed successfully
    if (this.placedPos && this.isBlockPlaced(this.placedPos)) {
      this.state = PlaceNearbyState.FINISHED;
      return null;
    }

    switch (this.state) {
      case PlaceNearbyState.LOOKING_FOR_SPOT:
        return this.handleLookingForSpot();

      case PlaceNearbyState.MOVING_TO_SPOT:
        return this.handleMovingToSpot();

      case PlaceNearbyState.LOOKING_AT_TARGET:
        return this.handleLookingAtTarget();

      case PlaceNearbyState.PLACING:
        return this.handlePlacing();

      case PlaceNearbyState.WANDERING:
        return this.handleWandering();

      default:
        return null;
    }
  }

  private handleLookingForSpot(): Task | null {
    this.targetPlacePos = this.findPlacementSpot();

    if (!this.targetPlacePos) {
      // No spot found - wander and try again
      this.attemptCount++;
      if (this.attemptCount > 5) {
        this.state = PlaceNearbyState.FAILED;
        return null;
      }
      this.state = PlaceNearbyState.WANDERING;
      this.wanderTimer.reset();
      return null;
    }

    this.state = PlaceNearbyState.MOVING_TO_SPOT;
    return null;
  }

  private handleMovingToSpot(): Task | null {
    if (!this.targetPlacePos) {
      this.state = PlaceNearbyState.LOOKING_FOR_SPOT;
      return null;
    }

    const targetVec = new Vec3(
      this.targetPlacePos.x + 0.5,
      this.targetPlacePos.y + 0.5,
      this.targetPlacePos.z + 0.5
    );
    const dist = this.bot.entity.position.distanceTo(targetVec);

    if (dist <= 4.5) {
      this.state = PlaceNearbyState.LOOKING_AT_TARGET;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      this.targetPlacePos.x,
      this.targetPlacePos.y,
      this.targetPlacePos.z,
      3
    );
  }

  private handleLookingAtTarget(): Task | null {
    if (!this.targetPlacePos) {
      this.state = PlaceNearbyState.LOOKING_FOR_SPOT;
      return null;
    }

    // Find a face to place against
    const placeAgainst = this.findPlaceAgainstBlock();
    if (!placeAgainst) {
      // No valid surface to place against
      this.targetPlacePos = null;
      this.state = PlaceNearbyState.LOOKING_FOR_SPOT;
      return null;
    }

    // Look at the face
    const targetVec = new Vec3(
      placeAgainst.block.position.x + 0.5 + placeAgainst.face.x * 0.5,
      placeAgainst.block.position.y + 0.5 + placeAgainst.face.y * 0.5,
      placeAgainst.block.position.z + 0.5 + placeAgainst.face.z * 0.5
    );
    this.lookHelper.startLookingAt(targetVec);

    this.state = PlaceNearbyState.PLACING;
    this.placeTimer.reset();
    return null;
  }

  private handlePlacing(): Task | null {
    if (!this.placeTimer.elapsed()) {
      return null;
    }

    // Equip block to place
    if (!this.equipBlockToPlace()) {
      // Don't have block
      this.state = PlaceNearbyState.FAILED;
      return null;
    }

    // Find place against block
    const placeAgainst = this.findPlaceAgainstBlock();
    if (!placeAgainst) {
      this.targetPlacePos = null;
      this.state = PlaceNearbyState.LOOKING_FOR_SPOT;
      return null;
    }

    // Place the block
    try {
      this.bot.placeBlock(placeAgainst.block, placeAgainst.face);
      this.placedPos = this.targetPlacePos;
      // Wait a moment and check if placed
      this.placeTimer.reset();
      return null;
    } catch (err) {
      // Failed to place - try another spot
      this.targetPlacePos = null;
      this.state = PlaceNearbyState.LOOKING_FOR_SPOT;
      return null;
    }
  }

  private handleWandering(): Task | null {
    if (this.wanderTimer.elapsed()) {
      this.state = PlaceNearbyState.LOOKING_FOR_SPOT;
      return null;
    }

    return new TimeoutWanderTask(this.bot, 10);
  }

  onStop(interruptTask: ITask | null): void {
    this.lookHelper.stopLooking();
  }

  isFinished(): boolean {
    return this.state === PlaceNearbyState.FINISHED || this.state === PlaceNearbyState.FAILED;
  }

  isFailed(): boolean {
    return this.state === PlaceNearbyState.FAILED;
  }

  /**
   * Get the position where we placed (if successful)
   */
  getPlacedPosition(): BlockPos | null {
    return this.placedPos;
  }

  // ---- Helper methods ----

  private findPlacementSpot(): BlockPos | null {
    const playerPos = this.bot.entity.position;
    const radius = this.config.searchRadius;

    let best: BlockPos | null = null;
    let bestScore = Infinity;

    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        for (let y = -3; y <= 3; y++) {
          const pos = new BlockPos(
            Math.floor(playerPos.x) + x,
            Math.floor(playerPos.y) + y,
            Math.floor(playerPos.z) + z
          );

          // Check if we can place here
          if (!this.canPlaceAt(pos)) continue;

          // Calculate score (lower is better)
          const dist = Math.sqrt(x * x + y * y + z * z);
          const hasBelow = this.hasSolidBelow(pos);

          let score = dist;
          if (!hasBelow && this.config.preferSolidBelow) score += 10;

          // Avoid placing inside player
          if (this.isInsidePlayer(pos)) continue;

          if (score < bestScore) {
            bestScore = score;
            best = pos;
          }
        }
      }
    }

    return best;
  }

  private canPlaceAt(pos: BlockPos): boolean {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));

    // Must be air or replaceable
    if (block && block.name !== 'air' && block.name !== 'cave_air' &&
        !block.name.includes('water') && !block.name.includes('grass')) {
      return false;
    }

    // Check custom predicate
    if (this.config.canPlaceAt && !this.config.canPlaceAt(pos)) {
      return false;
    }

    // Must have an adjacent solid block to place against
    const hasAdjacent = this.hasAdjacentSolid(pos);
    if (!hasAdjacent) return false;

    return true;
  }

  private hasAdjacentSolid(pos: BlockPos): boolean {
    const offsets = [
      new Vec3(0, -1, 0), new Vec3(0, 1, 0),
      new Vec3(-1, 0, 0), new Vec3(1, 0, 0),
      new Vec3(0, 0, -1), new Vec3(0, 0, 1)
    ];

    for (const offset of offsets) {
      const adj = this.bot.blockAt(new Vec3(pos.x + offset.x, pos.y + offset.y, pos.z + offset.z));
      if (adj && adj.boundingBox === 'block') {
        return true;
      }
    }

    return false;
  }

  private hasSolidBelow(pos: BlockPos): boolean {
    const below = this.bot.blockAt(new Vec3(pos.x, pos.y - 1, pos.z));
    return below !== null && below.boundingBox === 'block';
  }

  private isInsidePlayer(pos: BlockPos): boolean {
    const playerPos = this.bot.entity.position;
    const playerBlockX = Math.floor(playerPos.x);
    const playerBlockY = Math.floor(playerPos.y);
    const playerBlockZ = Math.floor(playerPos.z);

    return pos.x === playerBlockX && pos.z === playerBlockZ &&
           (pos.y === playerBlockY || pos.y === playerBlockY + 1);
  }

  private findPlaceAgainstBlock(): { block: Block, face: Vec3 } | null {
    if (!this.targetPlacePos) return null;

    const offsets: { offset: Vec3, face: Vec3 }[] = [
      { offset: new Vec3(0, -1, 0), face: new Vec3(0, 1, 0) },   // Below -> place up
      { offset: new Vec3(0, 1, 0), face: new Vec3(0, -1, 0) },   // Above -> place down
      { offset: new Vec3(-1, 0, 0), face: new Vec3(1, 0, 0) },   // West -> place east
      { offset: new Vec3(1, 0, 0), face: new Vec3(-1, 0, 0) },   // East -> place west
      { offset: new Vec3(0, 0, -1), face: new Vec3(0, 0, 1) },   // North -> place south
      { offset: new Vec3(0, 0, 1), face: new Vec3(0, 0, -1) },   // South -> place north
    ];

    for (const { offset, face } of offsets) {
      const blockPos = new Vec3(
        this.targetPlacePos.x + offset.x,
        this.targetPlacePos.y + offset.y,
        this.targetPlacePos.z + offset.z
      );
      const block = this.bot.blockAt(blockPos);

      if (block && block.boundingBox === 'block') {
        return { block, face };
      }
    }

    return null;
  }

  private equipBlockToPlace(): boolean {
    // Find matching block in inventory
    for (const item of this.bot.inventory.items()) {
      if (this.config.blocksToPlace.some(b => item.name === b || item.name.includes(b))) {
        // Equip it
        const held = this.bot.heldItem;
        if (!held || held.name !== item.name) {
          try {
            this.bot.equip(item, 'hand');
            return true;
          } catch {
            // Failed to equip
          }
        }
        return true;
      }
    }

    return false;
  }

  private isBlockPlaced(pos: BlockPos): boolean {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    if (!block) return false;

    return this.config.blocksToPlace.some(b => block.name === b || block.name.includes(b));
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PlaceBlockNearbyTask)) return false;
    return JSON.stringify(this.config.blocksToPlace) === JSON.stringify(other.config.blocksToPlace);
  }
}
