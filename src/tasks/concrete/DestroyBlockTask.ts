/**
 * DestroyBlockTask - Task to destroy a block at a specific position
 * Split from ConstructionTask.ts
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask } from './GetToBlockTask';
import { GoToNearTask } from './GoToNearTask';
import { SafeRandomShimmyTask } from './SafeRandomShimmyTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
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
        // Move to an adjacent block, not on top of target
        // Pick the cardinal direction furthest from block center
        const pos = this.bot.entity.position;
        const dx = pos.x - (this.target.x + 0.5);
        const dz = pos.z - (this.target.z + 0.5);
        const offsetX = Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? 2 : -2) : 0;
        const offsetZ = Math.abs(dz) > Math.abs(dx) ? (dz >= 0 ? 2 : -2) : 0;
        return new GoToNearTask(
          this.bot,
          this.target.x + offsetX,
          this.target.y + 1,
          this.target.z + offsetZ,
          1
        );
      }
    }

    this.state = DestroyState.LOOKING_AT_BLOCK;
    return null;
  }

  private handleLookingAtBlock(): Task | null {
    const targetVec = new Vec3(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
    this.lookHelper.startLookingAt(targetVec);
    this.lookHelper.tick();

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
    this.lookHelper.tick();

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
      this.isMining = true;
      this.bot.dig(block, true).catch(() => {
        // Mining failed (block broken, moved away, etc.)
        this.isMining = false;
      });
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
    if (dangerous.some(d => below.name.includes(d))) return true;

    // Air below: only dangerous if fall > 3 blocks (would cause damage)
    if (below.name === 'air' || below.name === 'cave_air' || below.name === 'void_air') {
      for (let y = this.target.y - 2; y >= this.target.y - 4; y--) {
        const block = this.bot.blockAt(new Vec3(this.target.x, y, this.target.z));
        if (!block) return true; // Unknown = dangerous
        if (block.name !== 'air' && block.name !== 'cave_air' && block.name !== 'void_air') {
          return false; // Solid ground within 3 blocks — safe short fall
        }
      }
      return true; // 4+ block fall — dangerous
    }

    return false;
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
