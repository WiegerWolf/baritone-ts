/**
 * ConstructionTask - Construction and Block Manipulation Tasks
 * Based on BaritonePlus's construction system
 *
 * Tasks for destroying blocks, placing blocks nearby, clearing areas,
 * and other construction-related operations.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask, GoToNearTask } from './GoToTask';
import { SafeRandomShimmyTask, TimeoutWanderTask } from './MovementUtilTask';
import { LookHelper } from '../../utils/LookHelper';
import { TimerGame } from '../../utils/timers/TimerGame';
import { BlockPos } from '../../types';

/**
 * Blocks that can trap the player and should be handled specially
 */
const ANNOYING_BLOCKS = [
  'vine', 'nether_sprouts', 'cave_vines', 'cave_vines_plant',
  'twisting_vines', 'twisting_vines_plant', 'weeping_vines_plant',
  'ladder', 'big_dripleaf', 'big_dripleaf_stem', 'small_dripleaf',
  'tall_grass', 'grass', 'short_grass', 'sweet_berry_bush', 'cobweb'
];

/**
 * Check if a block is "annoying" (can trap the player)
 */
function isAnnoyingBlock(blockName: string): boolean {
  return ANNOYING_BLOCKS.some(b => blockName === b || blockName.includes(b)) ||
         blockName.includes('door') ||
         blockName.includes('fence') ||
         blockName.includes('gate') ||
         blockName.includes('flower');
}

/**
 * State for destroy block task
 */
enum DestroyState {
  CHECKING_STUCK,
  MOVING_TO_BLOCK,
  POSITIONING,
  LOOKING_AT_BLOCK,
  MINING,
  FINISHED,
  FAILED,
  UNREACHABLE
}

/**
 * Configuration for DestroyBlockTask
 */
export interface DestroyBlockConfig {
  /** Whether to equip the best tool automatically */
  equipBestTool: boolean;
  /** Maximum time to spend trying to reach the block */
  maxReachTimeout: number;
  /** Whether to run away if standing on the block */
  avoidStandingOn: boolean;
}

const DEFAULT_DESTROY_CONFIG: DestroyBlockConfig = {
  equipBestTool: true,
  maxReachTimeout: 30,
  avoidStandingOn: true,
};

/**
 * Task to destroy a block at a specific position.
 *
 * WHY: This is a fundamental task for any construction or resource gathering.
 * It handles:
 * - Getting unstuck from blocking vegetation
 * - Moving to reach the target block
 * - Looking at the block and mining it
 * - Avoiding dangerous positions (like standing on the block to mine)
 *
 * Based on BaritonePlus DestroyBlockTask.java
 */
export class DestroyBlockTask extends Task {
  private target: BlockPos;
  private config: DestroyBlockConfig;
  private state: DestroyState = DestroyState.CHECKING_STUCK;
  private lookHelper: LookHelper;
  private miningTimer: TimerGame;
  private stuckTimer: TimerGame;
  private moveCheckTimer: TimerGame;
  private isMining: boolean = false;
  private lastPosition: Vec3 | null = null;
  private stuckCount: number = 0;

  constructor(bot: Bot, x: number, y: number, z: number, config: Partial<DestroyBlockConfig> = {}) {
    super(bot);
    this.target = new BlockPos(x, y, z);
    this.config = { ...DEFAULT_DESTROY_CONFIG, ...config };
    this.lookHelper = new LookHelper(bot);
    this.miningTimer = new TimerGame(bot, 0.1);
    this.stuckTimer = new TimerGame(bot, 2);
    this.moveCheckTimer = new TimerGame(bot, 5);
  }

  static fromBlockPos(bot: Bot, pos: BlockPos, config: Partial<DestroyBlockConfig> = {}): DestroyBlockTask {
    return new DestroyBlockTask(bot, pos.x, pos.y, pos.z, config);
  }

  static fromVec3(bot: Bot, pos: Vec3, config: Partial<DestroyBlockConfig> = {}): DestroyBlockTask {
    return new DestroyBlockTask(bot, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z), config);
  }

  get displayName(): string {
    return `DestroyBlock(${this.target.x}, ${this.target.y}, ${this.target.z})`;
  }

  onStart(): void {
    this.state = DestroyState.CHECKING_STUCK;
    this.isMining = false;
    this.lastPosition = null;
    this.stuckCount = 0;
    this.stuckTimer.reset();
    this.moveCheckTimer.reset();
  }

  onTick(): Task | null {
    // Check if block is already air
    if (this.isBlockDestroyed()) {
      this.state = DestroyState.FINISHED;
      return null;
    }

    switch (this.state) {
      case DestroyState.CHECKING_STUCK:
        return this.handleCheckingStuck();

      case DestroyState.MOVING_TO_BLOCK:
        return this.handleMovingToBlock();

      case DestroyState.POSITIONING:
        return this.handlePositioning();

      case DestroyState.LOOKING_AT_BLOCK:
        return this.handleLookingAtBlock();

      case DestroyState.MINING:
        return this.handleMining();

      case DestroyState.UNREACHABLE:
        return this.handleUnreachable();

      default:
        return null;
    }
  }

  private handleCheckingStuck(): Task | null {
    // Check if stuck in annoying block
    const stuckBlock = this.getStuckInBlock();
    if (stuckBlock) {
      // Try to escape
      this.stuckCount++;
      if (this.stuckCount > 5) {
        // Give up if stuck too many times
        this.state = DestroyState.FAILED;
        return null;
      }
      return new SafeRandomShimmyTask(this.bot);
    }

    this.state = DestroyState.MOVING_TO_BLOCK;
    return null;
  }

  private handleMovingToBlock(): Task | null {
    // Check progress
    if (this.moveCheckTimer.elapsed()) {
      this.moveCheckTimer.reset();
      if (this.lastPosition) {
        const moved = this.bot.entity.position.distanceTo(this.lastPosition);
        if (moved < 0.5) {
          // Not moving - might be stuck
          this.stuckCount++;
          if (this.stuckCount > 3) {
            this.state = DestroyState.UNREACHABLE;
            return null;
          }
        } else {
          this.stuckCount = 0;
        }
      }
      this.lastPosition = this.bot.entity.position.clone();
    }

    // Check if can reach
    const targetVec = new Vec3(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
    const dist = this.bot.entity.position.distanceTo(targetVec);

    if (dist <= 4.5) {
      this.state = DestroyState.POSITIONING;
      return null;
    }

    return new GetToBlockTask(this.bot, this.target.x, this.target.y, this.target.z);
  }

  private handlePositioning(): Task | null {
    // Check if we're standing on the block we want to mine (dangerous)
    if (this.config.avoidStandingOn && this.isStandingOnTarget()) {
      // Check if dangerous below
      if (this.isDangerousBelow()) {
        // Move away first
        return new GoToNearTask(
          this.bot,
          this.target.x,
          this.target.y + 1,
          this.target.z,
          3
        );
      }
    }

    this.state = DestroyState.LOOKING_AT_BLOCK;
    return null;
  }

  private handleLookingAtBlock(): Task | null {
    const targetVec = new Vec3(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
    this.lookHelper.startLookingAt(targetVec);

    // Check if looking at the block
    const lookingAt = this.isLookingAtTarget();
    if (lookingAt) {
      this.state = DestroyState.MINING;
      this.miningTimer.reset();
    }

    return null;
  }

  private handleMining(): Task | null {
    const block = this.getTargetBlock();
    if (!block) {
      this.state = DestroyState.FINISHED;
      return null;
    }

    // Make sure we're still looking at it
    const targetVec = new Vec3(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
    this.lookHelper.startLookingAt(targetVec);

    if (!this.isLookingAtTarget()) {
      this.state = DestroyState.LOOKING_AT_BLOCK;
      return null;
    }

    // Equip best tool if configured
    if (this.config.equipBestTool) {
      this.equipBestToolForBlock(block);
    }

    // Start/continue mining
    if (!this.isMining) {
      try {
        this.bot.dig(block, true);
        this.isMining = true;
      } catch (err) {
        // May already be mining or error
      }
    }

    return null;
  }

  private handleUnreachable(): Task | null {
    // Try wandering and retrying
    this.stuckCount = 0;
    this.state = DestroyState.MOVING_TO_BLOCK;
    return new TimeoutWanderTask(this.bot, 10);
  }

  onStop(interruptTask: ITask | null): void {
    this.lookHelper.stopLooking();
    // Stop mining
    try {
      this.bot.stopDigging();
    } catch {
      // Ignore
    }
    this.isMining = false;
  }

  isFinished(): boolean {
    return this.state === DestroyState.FINISHED || this.state === DestroyState.FAILED;
  }

  isFailed(): boolean {
    return this.state === DestroyState.FAILED;
  }

  // ---- Helper methods ----

  private getTargetBlock(): Block | null {
    return this.bot.blockAt(new Vec3(this.target.x, this.target.y, this.target.z));
  }

  private isBlockDestroyed(): boolean {
    const block = this.getTargetBlock();
    return !block || block.name === 'air' || block.name === 'cave_air' || block.name === 'void_air';
  }

  private getStuckInBlock(): BlockPos | null {
    const playerPos = this.bot.entity.position;
    const blockPos = new BlockPos(
      Math.floor(playerPos.x),
      Math.floor(playerPos.y),
      Math.floor(playerPos.z)
    );

    // Check current and adjacent blocks
    const positions = [
      blockPos,
      new BlockPos(blockPos.x, blockPos.y + 1, blockPos.z),
      new BlockPos(blockPos.x + 1, blockPos.y, blockPos.z),
      new BlockPos(blockPos.x - 1, blockPos.y, blockPos.z),
      new BlockPos(blockPos.x, blockPos.y, blockPos.z + 1),
      new BlockPos(blockPos.x, blockPos.y, blockPos.z - 1),
    ];

    for (const pos of positions) {
      const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
      if (block && isAnnoyingBlock(block.name)) {
        return pos;
      }
    }

    return null;
  }

  private isStandingOnTarget(): boolean {
    const playerPos = this.bot.entity.position;
    const footBlockY = Math.floor(playerPos.y - 0.1);
    return footBlockY === this.target.y &&
           Math.floor(playerPos.x) === this.target.x &&
           Math.floor(playerPos.z) === this.target.z;
  }

  private isDangerousBelow(): boolean {
    // Check block below target for danger
    const below = this.bot.blockAt(new Vec3(this.target.x, this.target.y - 1, this.target.z));
    if (!below) return true; // Unknown = dangerous

    const dangerous = ['lava', 'fire', 'magma', 'cactus'];
    return dangerous.some(d => below.name.includes(d)) || below.name === 'air';
  }

  private isLookingAtTarget(): boolean {
    const rayBlock = this.bot.blockAtCursor(5);
    if (!rayBlock) return false;

    return rayBlock.position.x === this.target.x &&
           rayBlock.position.y === this.target.y &&
           rayBlock.position.z === this.target.z;
  }

  private equipBestToolForBlock(block: Block): void {
    // Find best tool in inventory
    const tools = this.bot.inventory.items().filter(item =>
      item.name.includes('pickaxe') ||
      item.name.includes('axe') ||
      item.name.includes('shovel') ||
      item.name.includes('hoe') ||
      item.name.includes('shears')
    );

    if (tools.length === 0) return;

    // Determine best tool for this block type
    let bestTool = tools[0];
    let bestMaterial = this.getToolMaterialLevel(tools[0].name);

    // Check what tool type is best for this block
    const needsPick = block.material?.includes('rock') || block.material?.includes('metal');
    const needsAxe = block.material?.includes('wood');
    const needsShovel = block.material?.includes('dirt') || block.material?.includes('sand');

    for (const tool of tools) {
      const materialLevel = this.getToolMaterialLevel(tool.name);
      const isCorrectType =
        (needsPick && tool.name.includes('pickaxe')) ||
        (needsAxe && tool.name.includes('axe')) ||
        (needsShovel && tool.name.includes('shovel')) ||
        (!needsPick && !needsAxe && !needsShovel);

      if (isCorrectType && materialLevel > bestMaterial) {
        bestTool = tool;
        bestMaterial = materialLevel;
      }
    }

    // Equip if not already equipped
    const held = this.bot.heldItem;
    if (!held || held.name !== bestTool.name) {
      try {
        this.bot.equip(bestTool, 'hand');
      } catch {
        // Ignore
      }
    }
  }

  private getToolMaterialLevel(toolName: string): number {
    if (toolName.includes('netherite')) return 5;
    if (toolName.includes('diamond')) return 4;
    if (toolName.includes('iron')) return 3;
    if (toolName.includes('stone')) return 2;
    if (toolName.includes('gold')) return 1;
    if (toolName.includes('wooden')) return 0;
    return 0;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof DestroyBlockTask)) return false;
    return this.target.equals(other.target);
  }
}

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

/**
 * Task to clear a liquid (water/lava) at a position by placing a block.
 *
 * WHY: Liquids need to be dealt with differently than solid blocks.
 * We can't mine them - we need to place a block to displace them.
 */
export class ClearLiquidTask extends Task {
  private target: BlockPos;
  private blockToPlace: string;
  private placeTask: PlaceBlockNearbyTask | null = null;
  private finished: boolean = false;

  constructor(bot: Bot, x: number, y: number, z: number, blockToPlace: string = 'cobblestone') {
    super(bot);
    this.target = new BlockPos(x, y, z);
    this.blockToPlace = blockToPlace;
  }

  get displayName(): string {
    return `ClearLiquid(${this.target.x}, ${this.target.y}, ${this.target.z})`;
  }

  onStart(): void {
    this.finished = false;
    this.placeTask = null;
  }

  onTick(): Task | null {
    // Check if liquid is cleared
    const block = this.bot.blockAt(new Vec3(this.target.x, this.target.y, this.target.z));
    if (!block || (!block.name.includes('water') && !block.name.includes('lava'))) {
      this.finished = true;
      return null;
    }

    // Place a block at the liquid position
    if (!this.placeTask) {
      this.placeTask = new PlaceBlockNearbyTask(this.bot, [this.blockToPlace], {
        canPlaceAt: (pos) => pos.equals(this.target),
        searchRadius: 1,
      });
    }

    return this.placeTask;
  }

  isFinished(): boolean {
    return this.finished || (this.placeTask !== null && this.placeTask.isFinished());
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ClearLiquidTask)) return false;
    return this.target.equals(other.target);
  }
}

/**
 * Task to put out fire at a position.
 *
 * WHY: Fire can spread and cause damage. We need to extinguish it
 * by breaking it or placing water.
 */
export class PutOutFireTask extends Task {
  private target: BlockPos;
  private finished: boolean = false;

  constructor(bot: Bot, x: number, y: number, z: number) {
    super(bot);
    this.target = new BlockPos(x, y, z);
  }

  get displayName(): string {
    return `PutOutFire(${this.target.x}, ${this.target.y}, ${this.target.z})`;
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    const block = this.bot.blockAt(new Vec3(this.target.x, this.target.y, this.target.z));
    if (!block || block.name !== 'fire') {
      this.finished = true;
      return null;
    }

    // Fire can be broken like a normal block
    return DestroyBlockTask.fromBlockPos(this.bot, this.target);
  }

  isFinished(): boolean {
    return this.finished;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PutOutFireTask)) return false;
    return this.target.equals(other.target);
  }
}
