/**
 * MineLayerTask - Layer Mining Automation
 * Based on AltoClef strip mining patterns
 *
 * Handles mining entire layers at specific Y levels,
 * useful for branch mining and clearing areas.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for layer mining
 */
enum MineLayerState {
  PREPARING,
  GOING_TO_START,
  MINING_ROW,
  ADVANCING_ROW,
  TURNING,
  COLLECTING_DROPS,
  FINISHED,
  FAILED
}

/**
 * Mining pattern
 */
export enum MinePattern {
  /** Mine in straight lines back and forth */
  STRIP = 'strip',
  /** Mine in expanding spiral */
  SPIRAL = 'spiral',
  /** Mine in a grid pattern */
  GRID = 'grid',
}

/**
 * Configuration for layer mining
 */
export interface MineLayerConfig {
  /** Y level to mine at */
  yLevel: number;
  /** Width of mining area */
  width: number;
  /** Length of mining area */
  length: number;
  /** Mining pattern */
  pattern: MinePattern;
  /** Mine 2 blocks high (for player access) */
  twoBlockHigh: boolean;
  /** Place torches every N blocks */
  torchInterval: number;
  /** Blocks to prioritize (ores) */
  priorityBlocks: string[];
  /** Whether to collect drops */
  collectDrops: boolean;
}

const DEFAULT_CONFIG: MineLayerConfig = {
  yLevel: -59, // Diamond level
  width: 16,
  length: 32,
  pattern: MinePattern.STRIP,
  twoBlockHigh: true,
  torchInterval: 8,
  priorityBlocks: ['diamond_ore', 'deepslate_diamond_ore', 'iron_ore', 'deepslate_iron_ore', 'gold_ore', 'deepslate_gold_ore'],
  collectDrops: true,
};

/**
 * Blocks to skip (air, water, lava)
 */
const SKIP_BLOCKS = new Set([
  'air', 'cave_air', 'void_air', 'water', 'lava',
  'flowing_water', 'flowing_lava',
]);

/**
 * Task for mining layers
 */
export class MineLayerTask extends Task {
  private config: MineLayerConfig;
  private state: MineLayerState = MineLayerState.PREPARING;
  private startPosition: Vec3 | null = null;
  private currentRow: number = 0;
  private currentCol: number = 0;
  private direction: number = 1; // 1 or -1
  private blocksMined: number = 0;
  private oresFound: Map<string, number> = new Map();
  private mineTimer: TimerGame;
  private stuckTimer: TimerGame;
  private torchCounter: number = 0;

  constructor(bot: Bot, config: Partial<MineLayerConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mineTimer = new TimerGame(bot, 0.3);
    this.stuckTimer = new TimerGame(bot, 10.0);
  }

  get displayName(): string {
    return `MineLayer(Y:${this.config.yLevel}, ${this.blocksMined} mined)`;
  }

  onStart(): void {
    this.state = MineLayerState.PREPARING;
    this.startPosition = null;
    this.currentRow = 0;
    this.currentCol = 0;
    this.direction = 1;
    this.blocksMined = 0;
    this.oresFound.clear();
    this.torchCounter = 0;
    this.stuckTimer.reset();
  }

  onTick(): Task | null {
    // Check for stuck
    if (this.stuckTimer.elapsed()) {
      // Try to unstick or fail
      this.state = MineLayerState.FAILED;
      return null;
    }

    switch (this.state) {
      case MineLayerState.PREPARING:
        return this.handlePreparing();

      case MineLayerState.GOING_TO_START:
        return this.handleGoingToStart();

      case MineLayerState.MINING_ROW:
        return this.handleMiningRow();

      case MineLayerState.ADVANCING_ROW:
        return this.handleAdvancingRow();

      case MineLayerState.TURNING:
        return this.handleTurning();

      case MineLayerState.COLLECTING_DROPS:
        return this.handleCollectingDrops();

      default:
        return null;
    }
  }

  private handlePreparing(): Task | null {
    // Check if we have a pickaxe
    if (!this.hasPickaxe()) {
      this.state = MineLayerState.FAILED;
      return null;
    }

    // Equip pickaxe
    this.equipPickaxe();

    // Set start position
    const pos = this.bot.entity.position;
    this.startPosition = new Vec3(
      Math.floor(pos.x),
      this.config.yLevel,
      Math.floor(pos.z)
    );

    // Check if we need to go to start position
    if (Math.floor(pos.y) !== this.config.yLevel) {
      this.state = MineLayerState.GOING_TO_START;
    } else {
      this.state = MineLayerState.MINING_ROW;
    }

    return null;
  }

  private handleGoingToStart(): Task | null {
    // For now, just start mining from current position
    // In full implementation, would navigate to start
    this.state = MineLayerState.MINING_ROW;
    return null;
  }

  private handleMiningRow(): Task | null {
    // Check if row is complete
    if (this.currentCol >= this.config.length) {
      this.state = MineLayerState.ADVANCING_ROW;
      return null;
    }

    // Check if entire area is done
    if (this.currentRow >= this.config.width) {
      this.state = MineLayerState.FINISHED;
      return null;
    }

    // Get current mining position
    const minePos = this.getCurrentMinePosition();
    if (!minePos) {
      this.state = MineLayerState.FAILED;
      return null;
    }

    // Mine the block
    const block = this.bot.blockAt(minePos);
    if (block && !SKIP_BLOCKS.has(block.name)) {
      // Check if it's an ore
      if (this.config.priorityBlocks.includes(block.name)) {
        const count = this.oresFound.get(block.name) || 0;
        this.oresFound.set(block.name, count + 1);
      }

      // Mine block
      if (this.mineTimer.elapsed()) {
        try {
          // In mineflayer we'd call bot.dig
          this.blocksMined++;
          this.torchCounter++;
          this.stuckTimer.reset();
        } catch {
          // May fail
        }
        this.mineTimer.reset();
      }
    }

    // Also mine block above if two-block high mode
    if (this.config.twoBlockHigh) {
      const abovePos = minePos.offset(0, 1, 0);
      const aboveBlock = this.bot.blockAt(abovePos);
      if (aboveBlock && !SKIP_BLOCKS.has(aboveBlock.name)) {
        // Mine above block too
        this.blocksMined++;
      }
    }

    // Place torch if needed
    if (this.config.torchInterval > 0 && this.torchCounter >= this.config.torchInterval) {
      this.placeTorchIfNeeded(minePos);
      this.torchCounter = 0;
    }

    // Advance position
    this.currentCol++;
    return null;
  }

  private handleAdvancingRow(): Task | null {
    // Move to next row
    this.currentRow++;
    this.currentCol = 0;
    this.direction *= -1; // Reverse direction for serpentine pattern

    if (this.currentRow >= this.config.width) {
      this.state = MineLayerState.FINISHED;
    } else {
      this.state = MineLayerState.TURNING;
    }

    return null;
  }

  private handleTurning(): Task | null {
    // Turn and continue mining
    this.state = MineLayerState.MINING_ROW;
    return null;
  }

  private handleCollectingDrops(): Task | null {
    // Collect nearby drops
    // Would use PickupItemTask in full implementation
    this.state = MineLayerState.MINING_ROW;
    return null;
  }

  private getCurrentMinePosition(): Vec3 | null {
    if (!this.startPosition) return null;

    let x: number, z: number;

    switch (this.config.pattern) {
      case MinePattern.STRIP:
        x = this.startPosition.x + this.currentRow;
        z = this.startPosition.z + (this.direction > 0 ? this.currentCol : this.config.length - 1 - this.currentCol);
        break;

      case MinePattern.SPIRAL:
        // Spiral pattern calculation
        const layer = Math.floor(Math.max(this.currentRow, this.currentCol) / 2);
        x = this.startPosition.x + this.currentRow;
        z = this.startPosition.z + this.currentCol;
        break;

      case MinePattern.GRID:
        x = this.startPosition.x + this.currentRow;
        z = this.startPosition.z + this.currentCol;
        break;

      default:
        x = this.startPosition.x + this.currentRow;
        z = this.startPosition.z + this.currentCol;
    }

    return new Vec3(x, this.config.yLevel, z);
  }

  private placeTorchIfNeeded(pos: Vec3): void {
    // Check if we have torches
    if (!this.hasTorches()) return;

    // Place torch on wall or floor
    try {
      // In mineflayer we'd call bot.placeBlock
    } catch {
      // May fail
    }
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.state === MineLayerState.FINISHED || this.state === MineLayerState.FAILED;
  }

  isFailed(): boolean {
    return this.state === MineLayerState.FAILED;
  }

  // ---- Helper Methods ----

  private hasPickaxe(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name.includes('pickaxe')) {
        return true;
      }
    }
    return false;
  }

  private equipPickaxe(): boolean {
    // Find best pickaxe
    const pickaxeTiers = ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'];

    for (const tier of pickaxeTiers) {
      for (const item of this.bot.inventory.items()) {
        if (item.name === tier) {
          try {
            this.bot.equip(item, 'hand');
            return true;
          } catch {
            // May fail
          }
        }
      }
    }

    // Fall back to any pickaxe
    for (const item of this.bot.inventory.items()) {
      if (item.name.includes('pickaxe')) {
        try {
          this.bot.equip(item, 'hand');
          return true;
        } catch {
          // May fail
        }
      }
    }

    return false;
  }

  private hasTorches(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'torch') {
        return true;
      }
    }
    return false;
  }

  /**
   * Get blocks mined
   */
  getBlocksMined(): number {
    return this.blocksMined;
  }

  /**
   * Get ores found
   */
  getOresFound(): Map<string, number> {
    return new Map(this.oresFound);
  }

  /**
   * Get current state
   */
  getCurrentState(): MineLayerState {
    return this.state;
  }

  /**
   * Get progress (0-1)
   */
  getProgress(): number {
    const totalBlocks = this.config.width * this.config.length;
    const minedBlocks = this.currentRow * this.config.length + this.currentCol;
    return minedBlocks / totalBlocks;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof MineLayerTask)) return false;
    return (
      this.config.yLevel === other.config.yLevel &&
      this.config.width === other.config.width &&
      this.config.length === other.config.length
    );
  }
}

/**
 * Convenience functions
 */
export function mineLayer(bot: Bot, yLevel: number): MineLayerTask {
  return new MineLayerTask(bot, { yLevel });
}

export function stripMine(bot: Bot, yLevel: number, length: number): MineLayerTask {
  return new MineLayerTask(bot, {
    yLevel,
    width: 1,
    length,
    pattern: MinePattern.STRIP,
    twoBlockHigh: true,
  });
}

export function branchMine(bot: Bot, yLevel: number = -59): MineLayerTask {
  return new MineLayerTask(bot, {
    yLevel,
    width: 16,
    length: 32,
    pattern: MinePattern.STRIP,
    twoBlockHigh: true,
    torchInterval: 8,
  });
}

export function clearArea(bot: Bot, width: number, length: number, yLevel: number): MineLayerTask {
  return new MineLayerTask(bot, {
    yLevel,
    width,
    length,
    pattern: MinePattern.GRID,
    twoBlockHigh: false,
    torchInterval: 0,
  });
}

export function diamondMine(bot: Bot): MineLayerTask {
  return new MineLayerTask(bot, {
    yLevel: -59,
    width: 16,
    length: 64,
    pattern: MinePattern.STRIP,
    twoBlockHigh: true,
    torchInterval: 8,
    priorityBlocks: ['diamond_ore', 'deepslate_diamond_ore'],
  });
}
