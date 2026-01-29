/**
 * MineBlockTask - Block Mining Tasks
 * Based on AltoClef's DestroyBlockTask
 *
 * Tasks for mining specific blocks or block types.
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
 * State for mining operation
 */
enum MineState {
  GOING_TO_BLOCK,
  EQUIPPING_TOOL,
  MINING,
  WAITING_FOR_DROP,
  FINISHED,
  FAILED
}

/**
 * Task to mine a specific block at a position
 */
export class MineBlockTask extends GroundedTask {
  private target: BlockPos;
  private state: MineState = MineState.GOING_TO_BLOCK;
  private miningTimer: TimerGame;
  private dropWaitTimer: TimerGame;
  private lookHelper: LookHelper;
  private maxMiningTicks: number = 300; // 15 seconds max mining time
  private miningTicks: number = 0;
  private collectDrop: boolean;

  constructor(bot: Bot, x: number, y: number, z: number, collectDrop: boolean = true) {
    super(bot);
    this.target = new BlockPos(x, y, z);
    this.miningTimer = new TimerGame(bot, 0.5); // Check every 0.5 seconds
    this.dropWaitTimer = new TimerGame(bot, 2.0); // Wait 2 seconds for drop
    this.lookHelper = new LookHelper(bot);
    this.collectDrop = collectDrop;
  }

  static fromVec3(bot: Bot, pos: Vec3, collectDrop: boolean = true): MineBlockTask {
    return new MineBlockTask(bot, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z), collectDrop);
  }

  static fromBlockPos(bot: Bot, pos: BlockPos, collectDrop: boolean = true): MineBlockTask {
    return new MineBlockTask(bot, pos.x, pos.y, pos.z, collectDrop);
  }

  get displayName(): string {
    return `MineBlock(${this.target.x}, ${this.target.y}, ${this.target.z})`;
  }

  onStart(): void {
    this.state = MineState.GOING_TO_BLOCK;
    this.miningTicks = 0;
    this.miningTimer.reset();
    this.dropWaitTimer.reset();
  }

  onTick(): Task | null {
    const block = this.getTargetBlock();

    // Check if block is gone (already mined)
    if (!block || block.name === 'air' || block.name === 'cave_air' || block.name === 'void_air') {
      if (this.state === MineState.MINING) {
        this.state = this.collectDrop ? MineState.WAITING_FOR_DROP : MineState.FINISHED;
        this.dropWaitTimer.reset();
      } else if (this.state === MineState.WAITING_FOR_DROP) {
        if (this.dropWaitTimer.elapsed()) {
          this.state = MineState.FINISHED;
        }
      } else {
        this.state = MineState.FINISHED;
      }
      return null;
    }

    switch (this.state) {
      case MineState.GOING_TO_BLOCK:
        return this.handleGoingToBlock(block);

      case MineState.EQUIPPING_TOOL:
        return this.handleEquippingTool(block);

      case MineState.MINING:
        return this.handleMining(block);

      case MineState.WAITING_FOR_DROP:
        if (this.dropWaitTimer.elapsed()) {
          this.state = MineState.FINISHED;
        }
        return null;

      default:
        return null;
    }
  }

  private handleGoingToBlock(block: Block): Task | null {
    // Check if we're in range
    const playerPos = this.bot.entity.position;
    const blockCenter = new Vec3(
      this.target.x + 0.5,
      this.target.y + 0.5,
      this.target.z + 0.5
    );

    const distance = playerPos.distanceTo(blockCenter);
    const reachDistance = 4.5; // Minecraft reach distance

    if (distance <= reachDistance && this.canSeeBlock()) {
      this.state = MineState.EQUIPPING_TOOL;
      return null;
    }

    // Need to get closer
    return new GetToBlockTask(this.bot, this.target.x, this.target.y, this.target.z);
  }

  private handleEquippingTool(block: Block): Task | null {
    // Select best tool for block
    const bestTool = this.findBestTool(block);
    if (bestTool !== null) {
      this.bot.setQuickBarSlot(bestTool);
    }

    this.state = MineState.MINING;
    return null;
  }

  private handleMining(block: Block): Task | null {
    this.miningTicks++;

    // Check timeout
    if (this.miningTicks > this.maxMiningTicks) {
      this.state = MineState.FAILED;
      return null;
    }

    // Look at block
    const blockCenter = new Vec3(
      this.target.x + 0.5,
      this.target.y + 0.5,
      this.target.z + 0.5
    );
    // Use startLookingAt for non-blocking smooth look
    this.lookHelper.startLookingAt(blockCenter);
    this.lookHelper.tick();

    // Start/continue digging
    try {
      // Check if not already digging
      if (!(this.bot as any).targetDigBlock ||
          (this.bot as any).targetDigBlock.position.x !== this.target.x ||
          (this.bot as any).targetDigBlock.position.y !== this.target.y ||
          (this.bot as any).targetDigBlock.position.z !== this.target.z) {
        this.bot.dig(block, false);
      }
    } catch (err) {
      // Dig might throw if block changed
      this.state = MineState.FINISHED;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Stop digging
    try {
      this.bot.stopDigging();
    } catch {
      // Ignore errors
    }
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.state === MineState.FINISHED || this.state === MineState.FAILED;
  }

  /**
   * Check if mining failed
   */
  isFailed(): boolean {
    return this.state === MineState.FAILED;
  }

  /**
   * Get the target block
   */
  private getTargetBlock(): Block | null {
    return this.bot.blockAt(new Vec3(this.target.x, this.target.y, this.target.z));
  }

  /**
   * Check if we can see the target block
   */
  private canSeeBlock(): boolean {
    const block = this.getTargetBlock();
    if (!block) return false;

    // Simple check - just verify distance for now
    // TODO: Add raycast visibility check
    return true;
  }

  /**
   * Find best tool for mining block
   * Returns hotbar slot (0-8) or null if bare hands
   */
  private findBestTool(block: Block): number | null {
    const items = this.bot.inventory.items();
    let bestSlot: number | null = null;
    let bestSpeed = 1.0; // Bare hands speed

    // Check hotbar slots
    for (let slot = 0; slot < 9; slot++) {
      const item = this.bot.inventory.slots[slot + 36]; // Hotbar starts at slot 36
      if (!item) continue;

      const speed = this.getToolSpeed(item.name, block);
      if (speed > bestSpeed) {
        bestSpeed = speed;
        bestSlot = slot;
      }
    }

    return bestSlot;
  }

  /**
   * Get tool mining speed for block
   */
  private getToolSpeed(toolName: string, block: Block): number {
    // Tool categories and their effective blocks
    const pickaxeBlocks = ['stone', 'cobblestone', 'ore', 'deepslate', 'netherrack', 'obsidian', 'terracotta'];
    const axeBlocks = ['log', 'wood', 'planks', 'fence', 'sign'];
    const shovelBlocks = ['dirt', 'sand', 'gravel', 'clay', 'soul', 'snow'];

    const blockName = block.name.toLowerCase();

    // Check tool effectiveness
    if (toolName.includes('pickaxe')) {
      if (pickaxeBlocks.some(b => blockName.includes(b))) {
        return this.getToolTier(toolName) * 2;
      }
    }

    if (toolName.includes('axe') && !toolName.includes('pickaxe')) {
      if (axeBlocks.some(b => blockName.includes(b))) {
        return this.getToolTier(toolName) * 2;
      }
    }

    if (toolName.includes('shovel')) {
      if (shovelBlocks.some(b => blockName.includes(b))) {
        return this.getToolTier(toolName) * 2;
      }
    }

    return 1.0; // Default speed
  }

  /**
   * Get tool tier multiplier
   */
  private getToolTier(toolName: string): number {
    if (toolName.includes('netherite')) return 9;
    if (toolName.includes('diamond')) return 8;
    if (toolName.includes('iron')) return 6;
    if (toolName.includes('stone')) return 4;
    if (toolName.includes('golden')) return 12; // Fast but low durability
    if (toolName.includes('wooden')) return 2;
    return 1;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof MineBlockTask)) return false;
    return this.target.equals(other.target);
  }
}

