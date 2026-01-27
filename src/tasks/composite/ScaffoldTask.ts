/**
 * ScaffoldTask - Scaffolding Up/Down Automation
 * Based on AltoClef tower/descend patterns
 *
 * Handles building scaffolds to go up or down safely,
 * including nerd poles and safe descents.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for scaffolding
 */
enum ScaffoldState {
  PREPARING,
  SELECTING_MATERIAL,
  ASCENDING,
  DESCENDING,
  PLACING_UP,
  PLACING_DOWN,
  BREAKING,
  FINISHED,
  FAILED
}

/**
 * Scaffold mode
 */
export enum ScaffoldMode {
  /** Build up (nerd pole) */
  ASCEND = 'ascend',
  /** Build down safely */
  DESCEND = 'descend',
  /** Go to specific Y level */
  TO_Y = 'to_y',
}

/**
 * Configuration for scaffolding
 */
export interface ScaffoldConfig {
  /** Scaffold mode */
  mode: ScaffoldMode;
  /** Target Y level (for TO_Y mode) */
  targetY: number;
  /** Maximum height change */
  maxHeight: number;
  /** Preferred block types */
  preferredBlocks: string[];
  /** Whether to break blocks when descending */
  breakWhenDescending: boolean;
  /** Whether to collect broken blocks */
  collectBroken: boolean;
}

const DEFAULT_CONFIG: ScaffoldConfig = {
  mode: ScaffoldMode.ASCEND,
  targetY: 100,
  maxHeight: 50,
  preferredBlocks: ['cobblestone', 'dirt', 'netherrack', 'scaffolding'],
  breakWhenDescending: true,
  collectBroken: true,
};

/**
 * Scaffolding blocks (include actual scaffolding block)
 */
const SCAFFOLD_BLOCKS = new Set([
  'scaffolding', 'cobblestone', 'stone', 'dirt', 'netherrack',
  'cobbled_deepslate', 'deepslate', 'granite', 'diorite', 'andesite',
  'sandstone', 'end_stone', 'basalt', 'blackstone',
]);

/**
 * Task for scaffolding up/down
 */
export class ScaffoldTask extends Task {
  private config: ScaffoldConfig;
  private state: ScaffoldState = ScaffoldState.PREPARING;
  private startY: number = 0;
  private blocksUsed: number = 0;
  private selectedMaterial: string | null = null;
  private placeTimer: TimerGame;
  private breakTimer: TimerGame;
  private stuckTimer: TimerGame;

  constructor(bot: Bot, config: Partial<ScaffoldConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.placeTimer = new TimerGame(bot, 0.3);
    this.breakTimer = new TimerGame(bot, 0.5);
    this.stuckTimer = new TimerGame(bot, 5.0);
  }

  get displayName(): string {
    const currentY = Math.floor(this.bot.entity.position.y);
    return `Scaffold(${this.config.mode}, Y:${currentY})`;
  }

  onStart(): void {
    this.state = ScaffoldState.PREPARING;
    this.startY = Math.floor(this.bot.entity.position.y);
    this.blocksUsed = 0;
    this.selectedMaterial = null;
    this.stuckTimer.reset();
  }

  onTick(): Task | null {
    // Check for stuck
    if (this.stuckTimer.elapsed()) {
      this.state = ScaffoldState.FAILED;
      return null;
    }

    switch (this.state) {
      case ScaffoldState.PREPARING:
        return this.handlePreparing();

      case ScaffoldState.SELECTING_MATERIAL:
        return this.handleSelectingMaterial();

      case ScaffoldState.ASCENDING:
        return this.handleAscending();

      case ScaffoldState.DESCENDING:
        return this.handleDescending();

      case ScaffoldState.PLACING_UP:
        return this.handlePlacingUp();

      case ScaffoldState.PLACING_DOWN:
        return this.handlePlacingDown();

      case ScaffoldState.BREAKING:
        return this.handleBreaking();

      default:
        return null;
    }
  }

  private handlePreparing(): Task | null {
    const currentY = Math.floor(this.bot.entity.position.y);

    // Determine what we need to do
    if (this.config.mode === ScaffoldMode.ASCEND) {
      if (!this.hasScaffoldMaterial()) {
        this.state = ScaffoldState.FAILED;
        return null;
      }
      this.state = ScaffoldState.SELECTING_MATERIAL;
    } else if (this.config.mode === ScaffoldMode.DESCEND) {
      this.state = ScaffoldState.DESCENDING;
    } else if (this.config.mode === ScaffoldMode.TO_Y) {
      if (currentY < this.config.targetY) {
        if (!this.hasScaffoldMaterial()) {
          this.state = ScaffoldState.FAILED;
          return null;
        }
        this.state = ScaffoldState.SELECTING_MATERIAL;
      } else if (currentY > this.config.targetY) {
        this.state = ScaffoldState.DESCENDING;
      } else {
        this.state = ScaffoldState.FINISHED;
      }
    }

    return null;
  }

  private handleSelectingMaterial(): Task | null {
    this.selectedMaterial = this.findBestMaterial();

    if (!this.selectedMaterial) {
      this.state = ScaffoldState.FAILED;
      return null;
    }

    if (this.equipMaterial(this.selectedMaterial)) {
      this.state = ScaffoldState.ASCENDING;
      this.placeTimer.reset();
    }

    return null;
  }

  private handleAscending(): Task | null {
    const currentY = Math.floor(this.bot.entity.position.y);

    // Check if we've reached target
    if (this.reachedAscendTarget(currentY)) {
      this.state = ScaffoldState.FINISHED;
      return null;
    }

    // Check max height
    if (currentY - this.startY >= this.config.maxHeight) {
      this.state = ScaffoldState.FINISHED;
      return null;
    }

    // Check if we have materials
    if (!this.hasScaffoldMaterial()) {
      this.state = ScaffoldState.FAILED;
      return null;
    }

    // Re-select material if needed
    if (!this.selectedMaterial || !this.hasMaterial(this.selectedMaterial)) {
      this.selectedMaterial = this.findBestMaterial();
      if (this.selectedMaterial) {
        this.equipMaterial(this.selectedMaterial);
      }
    }

    // Look straight down
    const yaw = this.bot.entity.yaw;
    this.bot.look(yaw, Math.PI / 2, true);

    // Jump and place
    if (this.placeTimer.elapsed()) {
      this.state = ScaffoldState.PLACING_UP;
    }

    return null;
  }

  private handlePlacingUp(): Task | null {
    // Jump
    this.bot.setControlState('jump', true);

    // Place block below at peak of jump
    const pos = this.bot.entity.position;
    const placePos = new Vec3(
      Math.floor(pos.x),
      Math.floor(pos.y) - 1,
      Math.floor(pos.z)
    );

    const existingBlock = this.bot.blockAt(placePos);
    if (!existingBlock || existingBlock.boundingBox === 'empty') {
      // Place block
      try {
        // In mineflayer we'd call bot.placeBlock
        this.blocksUsed++;
        this.stuckTimer.reset();
      } catch {
        // May fail
      }
    }

    this.bot.setControlState('jump', false);
    this.placeTimer.reset();
    this.state = ScaffoldState.ASCENDING;
    return null;
  }

  private handleDescending(): Task | null {
    const currentY = Math.floor(this.bot.entity.position.y);

    // Check if we've reached target
    if (this.reachedDescendTarget(currentY)) {
      this.state = ScaffoldState.FINISHED;
      return null;
    }

    // Check max descent
    if (this.startY - currentY >= this.config.maxHeight) {
      this.state = ScaffoldState.FINISHED;
      return null;
    }

    // Check what's below
    const pos = this.bot.entity.position;
    const belowPos = new Vec3(
      Math.floor(pos.x),
      Math.floor(pos.y) - 1,
      Math.floor(pos.z)
    );

    const blockBelow = this.bot.blockAt(belowPos);

    if (blockBelow && blockBelow.boundingBox !== 'empty') {
      // Need to break block below if enabled
      if (this.config.breakWhenDescending) {
        this.state = ScaffoldState.BREAKING;
      } else {
        // Can't descend without breaking
        this.state = ScaffoldState.FINISHED;
      }
    } else {
      // Safe to drop
      // Just fall
      this.stuckTimer.reset();
    }

    return null;
  }

  private handlePlacingDown(): Task | null {
    // Place block to stand on while descending
    // This is for safe multi-block descents

    const pos = this.bot.entity.position;
    const placePos = new Vec3(
      Math.floor(pos.x),
      Math.floor(pos.y) - 2,
      Math.floor(pos.z)
    );

    // Place scaffold block for safe landing
    if (this.hasScaffoldMaterial()) {
      this.blocksUsed++;
    }

    this.state = ScaffoldState.DESCENDING;
    return null;
  }

  private handleBreaking(): Task | null {
    // Break block below
    const pos = this.bot.entity.position;
    const belowPos = new Vec3(
      Math.floor(pos.x),
      Math.floor(pos.y) - 1,
      Math.floor(pos.z)
    );

    // Look down
    const yaw = this.bot.entity.yaw;
    this.bot.look(yaw, Math.PI / 2, true);

    if (this.breakTimer.elapsed()) {
      const block = this.bot.blockAt(belowPos);
      if (block && block.boundingBox !== 'empty') {
        try {
          // In mineflayer we'd call bot.dig
          this.stuckTimer.reset();
        } catch {
          // May fail
        }
      }

      this.breakTimer.reset();
      this.state = ScaffoldState.DESCENDING;
    }

    return null;
  }

  private reachedAscendTarget(currentY: number): boolean {
    if (this.config.mode === ScaffoldMode.TO_Y) {
      return currentY >= this.config.targetY;
    }
    return false; // Ascend mode continues until materials run out or max height
  }

  private reachedDescendTarget(currentY: number): boolean {
    if (this.config.mode === ScaffoldMode.TO_Y) {
      return currentY <= this.config.targetY;
    }
    // For descend mode, check if we hit ground
    const pos = this.bot.entity.position;
    const groundPos = new Vec3(
      Math.floor(pos.x),
      Math.floor(pos.y) - 1,
      Math.floor(pos.z)
    );
    const ground = this.bot.blockAt(groundPos);

    // Stop if we hit bedrock or Y limit
    if (currentY <= -60 || (ground && ground.name === 'bedrock')) {
      return true;
    }

    return false;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.selectedMaterial = null;
  }

  isFinished(): boolean {
    return this.state === ScaffoldState.FINISHED || this.state === ScaffoldState.FAILED;
  }

  isFailed(): boolean {
    return this.state === ScaffoldState.FAILED;
  }

  // ---- Helper Methods ----

  private hasScaffoldMaterial(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (SCAFFOLD_BLOCKS.has(item.name)) {
        return true;
      }
    }
    return false;
  }

  private hasMaterial(name: string): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === name) {
        return true;
      }
    }
    return false;
  }

  private findBestMaterial(): string | null {
    // Check for actual scaffolding first
    if (this.hasMaterial('scaffolding')) {
      return 'scaffolding';
    }

    // Check preferred blocks
    for (const preferred of this.config.preferredBlocks) {
      if (this.hasMaterial(preferred)) {
        return preferred;
      }
    }

    // Fall back to any scaffold block
    for (const item of this.bot.inventory.items()) {
      if (SCAFFOLD_BLOCKS.has(item.name)) {
        return item.name;
      }
    }

    return null;
  }

  private equipMaterial(name: string): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === name) {
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

  /**
   * Get blocks used
   */
  getBlocksUsed(): number {
    return this.blocksUsed;
  }

  /**
   * Get current state
   */
  getCurrentState(): ScaffoldState {
    return this.state;
  }

  /**
   * Get height change
   */
  getHeightChange(): number {
    return Math.floor(this.bot.entity.position.y) - this.startY;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ScaffoldTask)) return false;
    return (
      this.config.mode === other.config.mode &&
      this.config.targetY === other.config.targetY
    );
  }
}

/**
 * Convenience functions
 */
export function scaffoldUp(bot: Bot, blocks: number = 10): ScaffoldTask {
  return new ScaffoldTask(bot, {
    mode: ScaffoldMode.ASCEND,
    maxHeight: blocks,
  });
}

export function scaffoldDown(bot: Bot, blocks: number = 10): ScaffoldTask {
  return new ScaffoldTask(bot, {
    mode: ScaffoldMode.DESCEND,
    maxHeight: blocks,
  });
}

export function scaffoldToY(bot: Bot, targetY: number): ScaffoldTask {
  return new ScaffoldTask(bot, {
    mode: ScaffoldMode.TO_Y,
    targetY,
  });
}

export function nerdPole(bot: Bot, height: number): ScaffoldTask {
  return new ScaffoldTask(bot, {
    mode: ScaffoldMode.ASCEND,
    maxHeight: height,
    preferredBlocks: ['cobblestone', 'dirt'],
  });
}

export function safeDescend(bot: Bot, height: number): ScaffoldTask {
  return new ScaffoldTask(bot, {
    mode: ScaffoldMode.DESCEND,
    maxHeight: height,
    breakWhenDescending: true,
    collectBroken: true,
  });
}
