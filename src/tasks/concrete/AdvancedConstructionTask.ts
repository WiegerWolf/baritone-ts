/**
 * AdvancedConstructionTask - Advanced Construction Tasks
 * Based on BaritonePlus's construction tasks
 *
 * WHY: Advanced construction enables complex building and terrain modification:
 * - PlaceSignTask: Leave messages for players or mark locations
 * - ClearRegionTask: Clear a 3D region of all blocks (excavation)
 * - CoverWithBlocksTask: Cover lava with blocks for safe passage in Nether
 * - ConstructIronGolemTask: Build an iron golem for defense/farming
 *
 * These tasks automate tedious building operations that would take
 * many manual clicks and careful positioning.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { DestroyBlockTask, PlaceBlockNearbyTask } from './ConstructionTask';
import { PlaceBlockTask } from './PlaceBlockTask';
import { InteractWithBlockTask, Direction } from './InteractWithBlockTask';
import { MineAndCollectTask } from './MineAndCollectTask';
import { GoToDimensionTask } from './PortalTask';
import { TimeoutWanderTask } from './MovementUtilTask';
import { BlockPos } from '../../types';
import { BlockRange } from '../../utils/BlockRange';
import { Dimension, itemTarget } from './ResourceTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * All wood sign types
 */
const WOOD_SIGNS = [
  'oak_sign',
  'spruce_sign',
  'birch_sign',
  'jungle_sign',
  'acacia_sign',
  'dark_oak_sign',
  'mangrove_sign',
  'cherry_sign',
  'bamboo_sign',
  'crimson_sign',
  'warped_sign',
];

/**
 * State for sign placement
 */
enum PlaceSignState {
  GETTING_SIGN,
  CLEARING_POSITION,
  PLACING_SIGN,
  EDITING_SIGN,
  FINISHED,
}

/**
 * Task to place a sign with a message.
 *
 * WHY: Signs are useful for:
 * - Leaving messages for other players
 * - Marking important locations
 * - Creating waypoint markers
 * - Labeling chests and builds
 *
 * Based on BaritonePlus PlaceSignTask.java
 */
export class PlaceSignTask extends Task {
  private position: BlockPos | null;
  private message: string;
  private state: PlaceSignState = PlaceSignState.GETTING_SIGN;
  private finished: boolean = false;

  constructor(bot: Bot, message: string, position: BlockPos | null = null) {
    super(bot);
    this.message = message;
    this.position = position;
  }

  get displayName(): string {
    if (this.position) {
      return `PlaceSign("${this.message.substring(0, 20)}..." at ${this.position.x},${this.position.y},${this.position.z})`;
    }
    return `PlaceSign("${this.message.substring(0, 20)}..." anywhere)`;
  }

  onStart(): void {
    this.state = PlaceSignState.GETTING_SIGN;
    this.finished = false;
  }

  onTick(): Task | null {
    // Check if we have a sign
    if (!this.hasSign()) {
      this.state = PlaceSignState.GETTING_SIGN;
      // In full implementation, would return task to get a sign
      return null;
    }

    // Place sign at specific position or nearby
    if (this.position) {
      // Check if position is clear
      const block = this.bot.blockAt(
        new Vec3(this.position.x, this.position.y, this.position.z)
      );

      if (block && !this.isAirOrLiquid(block.name)) {
        this.state = PlaceSignState.CLEARING_POSITION;
        return new DestroyBlockTask(
          this.bot,
          this.position.x,
          this.position.y,
          this.position.z
        );
      }

      // Place sign
      this.state = PlaceSignState.PLACING_SIGN;
      return new InteractWithBlockTask(this.bot, {
        target: new BlockPos(this.position.x, this.position.y - 1, this.position.z),
        direction: Direction.UP,
        itemToUse: this.getSignName(),
      });
    } else {
      // Place anywhere
      this.state = PlaceSignState.PLACING_SIGN;
      return new PlaceBlockNearbyTask(this.bot, WOOD_SIGNS);
    }
  }

  /**
   * Check if player has a sign
   */
  private hasSign(): boolean {
    return this.bot.inventory.items().some((item) =>
      WOOD_SIGNS.some((sign) => item.name.includes(sign))
    );
  }

  /**
   * Get the name of a sign we have
   */
  private getSignName(): string | undefined {
    const sign = this.bot.inventory.items().find((item) =>
      WOOD_SIGNS.some((s) => item.name.includes(s))
    );
    return sign?.name;
  }

  /**
   * Check if block is air or liquid
   */
  private isAirOrLiquid(blockName: string): boolean {
    return blockName === 'air' || blockName === 'water' || blockName === 'lava';
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.finished;
  }

  /**
   * Get current state
   */
  getState(): PlaceSignState {
    return this.state;
  }

  /**
   * Get the message to write
   */
  getMessage(): string {
    return this.message;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PlaceSignTask)) return false;
    if (other.message !== this.message) return false;
    if ((other.position === null) !== (this.position === null)) return false;
    if (other.position && this.position) {
      return other.position.equals(this.position);
    }
    return true;
  }
}

/**
 * State for region clearing
 */
enum ClearRegionState {
  SCANNING,
  DESTROYING,
  FINISHED,
}

/**
 * Task to clear all blocks in a 3D region.
 *
 * WHY: Region clearing is essential for:
 * - Excavation for underground bases
 * - Flattening terrain for building
 * - Creating farms or mob spawners
 * - Removing unwanted structures
 *
 * Based on BaritonePlus ClearRegionTask.java
 */
export class ClearRegionTask extends Task {
  private from: BlockPos;
  private to: BlockPos;
  private state: ClearRegionState = ClearRegionState.SCANNING;
  private currentTarget: BlockPos | null = null;

  constructor(bot: Bot, from: BlockPos, to: BlockPos) {
    super(bot);
    // Normalize coordinates
    this.from = new BlockPos(
      Math.min(from.x, to.x),
      Math.min(from.y, to.y),
      Math.min(from.z, to.z)
    );
    this.to = new BlockPos(
      Math.max(from.x, to.x),
      Math.max(from.y, to.y),
      Math.max(from.z, to.z)
    );
  }

  get displayName(): string {
    return `ClearRegion(${this.from.x},${this.from.y},${this.from.z} -> ${this.to.x},${this.to.y},${this.to.z})`;
  }

  onStart(): void {
    this.state = ClearRegionState.SCANNING;
    this.currentTarget = null;
  }

  onTick(): Task | null {
    // Find next block to destroy
    const nextBlock = this.findNextBlock();

    if (nextBlock === null) {
      this.state = ClearRegionState.FINISHED;
      return null;
    }

    this.state = ClearRegionState.DESTROYING;
    this.currentTarget = nextBlock;
    return new DestroyBlockTask(this.bot, nextBlock.x, nextBlock.y, nextBlock.z);
  }

  /**
   * Find next non-air block in region
   */
  private findNextBlock(): BlockPos | null {
    // Iterate from top to bottom (safer for gravity-affected blocks)
    for (let y = this.to.y; y >= this.from.y; y--) {
      for (let x = this.from.x; x <= this.to.x; x++) {
        for (let z = this.from.z; z <= this.to.z; z++) {
          const pos = new Vec3(x, y, z);
          const block = this.bot.blockAt(pos);

          if (block && block.name !== 'air') {
            return new BlockPos(x, y, z);
          }
        }
      }
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.currentTarget = null;
  }

  isFinished(): boolean {
    // Check if all blocks in region are air
    for (let x = this.from.x; x <= this.to.x; x++) {
      for (let y = this.from.y; y <= this.to.y; y++) {
        for (let z = this.from.z; z <= this.to.z; z++) {
          const block = this.bot.blockAt(new Vec3(x, y, z));
          if (block && block.name !== 'air') {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Get current state
   */
  getState(): ClearRegionState {
    return this.state;
  }

  /**
   * Get the region being cleared
   */
  getRegion(): { from: BlockPos; to: BlockPos } {
    return { from: this.from, to: this.to };
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ClearRegionTask)) return false;
    return other.from.equals(this.from) && other.to.equals(this.to);
  }
}

/**
 * Throwaway block types for covering
 */
const THROWAWAY_BLOCKS = [
  'cobblestone',
  'dirt',
  'netherrack',
  'stone',
  'granite',
  'diorite',
  'andesite',
  'deepslate',
  'tuff',
  'blackstone',
];

/**
 * State for lava covering
 */
enum CoverWithBlocksState {
  GETTING_BLOCKS,
  GOING_TO_NETHER,
  SEARCHING_LAVA,
  COVERING,
}

/**
 * Task to cover lava with blocks for safe passage.
 *
 * WHY: Covering lava is essential for Nether safety:
 * - Prevents falling into lava lakes
 * - Creates safe pathways across dangerous terrain
 * - Enables exploration of lava-filled areas
 * - Protects from fire damage
 *
 * Based on BaritonePlus CoverWithBlocksTask.java
 */
export class CoverWithBlocksTask extends Task {
  private state: CoverWithBlocksState = CoverWithBlocksState.GETTING_BLOCKS;
  private currentLavaPos: BlockPos | null = null;
  private timer: TimerGame;

  constructor(bot: Bot) {
    super(bot);
    this.timer = new TimerGame(bot, 30);
  }

  get displayName(): string {
    return `CoverWithBlocks(state: ${CoverWithBlocksState[this.state]})`;
  }

  onStart(): void {
    this.state = CoverWithBlocksState.GETTING_BLOCKS;
    this.currentLavaPos = null;
    this.timer.reset();
  }

  onTick(): Task | null {
    const throwawayCount = this.getThrowawayCount();

    // Get more blocks if needed
    if (throwawayCount < 128) {
      this.state = CoverWithBlocksState.GETTING_BLOCKS;
      this.timer.reset();

      // Try to collect blocks
      const blockToCollect = this.findCollectableBlock();
      if (blockToCollect) {
        return new MineAndCollectTask(
          this.bot,
          [itemTarget(blockToCollect, 128)],
          [blockToCollect],
          {}
        );
      }

      // Switch dimensions to find blocks
      const dimension = this.getCurrentDimension();
      if (dimension === 'overworld') {
        return new GoToDimensionTask(this.bot, Dimension.NETHER);
      } else if (dimension === 'nether') {
        return new GoToDimensionTask(this.bot, Dimension.OVERWORLD);
      }

      return null;
    }

    // Make sure we're in the Nether
    if (this.getCurrentDimension() !== 'nether') {
      this.state = CoverWithBlocksState.GOING_TO_NETHER;
      this.timer.reset();
      return new GoToDimensionTask(this.bot, Dimension.NETHER);
    }

    // Find lava to cover
    const lavaPos = this.findLavaToCover();
    if (!lavaPos) {
      this.state = CoverWithBlocksState.SEARCHING_LAVA;
      this.timer.reset();
      return new TimeoutWanderTask(this.bot, 10);
    }

    // Cover the lava
    this.state = CoverWithBlocksState.COVERING;
    this.currentLavaPos = lavaPos;

    const throwawayBlock = this.getThrowawayBlock();
    if (throwawayBlock) {
      return new PlaceBlockTask(this.bot, lavaPos.x, lavaPos.y, lavaPos.z, throwawayBlock);
    }

    return null;
  }

  /**
   * Get current dimension
   */
  private getCurrentDimension(): string {
    const dimName = (this.bot as any).game?.dimension || 'overworld';
    if (dimName.includes('nether')) return 'nether';
    if (dimName.includes('end')) return 'the_end';
    return 'overworld';
  }

  /**
   * Count throwaway blocks in inventory
   */
  private getThrowawayCount(): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (THROWAWAY_BLOCKS.includes(item.name)) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Find a block type we can collect
   */
  private findCollectableBlock(): string | null {
    const playerPos = this.bot.entity.position;

    for (let x = -16; x <= 16; x++) {
      for (let z = -16; z <= 16; z++) {
        for (let y = -8; y <= 8; y++) {
          const block = this.bot.blockAt(playerPos.offset(x, y, z));
          if (block && THROWAWAY_BLOCKS.includes(block.name)) {
            return block.name;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get a throwaway block from inventory
   */
  private getThrowawayBlock(): string | null {
    for (const item of this.bot.inventory.items()) {
      if (THROWAWAY_BLOCKS.includes(item.name)) {
        return item.name;
      }
    }
    return null;
  }

  /**
   * Find lava source to cover
   */
  private findLavaToCover(): BlockPos | null {
    const playerPos = this.bot.entity.position;
    let nearest: BlockPos | null = null;
    let nearestDist = Infinity;

    for (let x = -32; x <= 32; x++) {
      for (let z = -32; z <= 32; z++) {
        for (let y = -8; y <= 8; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (block && block.name === 'lava') {
            // Check if it's a valid lava to cover
            if (this.isValidLavaToCover(pos)) {
              const dist = playerPos.distanceTo(pos);
              if (dist < nearestDist) {
                nearestDist = dist;
                nearest = new BlockPos(
                  Math.floor(pos.x),
                  Math.floor(pos.y),
                  Math.floor(pos.z)
                );
              }
            }
          }
        }
      }
    }

    return nearest;
  }

  /**
   * Check if lava position is valid to cover
   */
  private isValidLavaToCover(pos: Vec3): boolean {
    // Air must be above the lava
    const aboveBlock = this.bot.blockAt(pos.offset(0, 1, 0));
    if (!aboveBlock || aboveBlock.name !== 'air') {
      return false;
    }

    // At least one adjacent block should not be lava (edge of pool)
    const adjacents = [
      pos.offset(1, 0, 0),
      pos.offset(-1, 0, 0),
      pos.offset(0, 0, 1),
      pos.offset(0, 0, -1),
    ];

    for (const adj of adjacents) {
      const adjBlock = this.bot.blockAt(adj);
      if (!adjBlock || adjBlock.name !== 'lava') {
        return true;
      }
    }

    return false;
  }

  onStop(interruptTask: ITask | null): void {
    this.currentLavaPos = null;
  }

  isFinished(): boolean {
    // This task runs continuously until interrupted
    return false;
  }

  /**
   * Get current state
   */
  getState(): CoverWithBlocksState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof CoverWithBlocksTask;
  }
}

/**
 * State for iron golem construction
 */
enum ConstructIronGolemState {
  GETTING_MATERIALS,
  FINDING_POSITION,
  PLACING_BASE,
  PLACING_CENTER,
  PLACING_ARMS,
  CLEARING_AREA,
  PLACING_HEAD,
  FINISHED,
}

/**
 * Task to construct an iron golem.
 *
 * WHY: Iron golems are useful for:
 * - Defending villages and bases
 * - Iron farming (iron farm designs)
 * - Killing hostile mobs
 * - Protecting players
 *
 * Construction pattern:
 *     [P]        (pumpkin head)
 *   [I][I][I]    (iron block arms)
 *     [I]        (iron block base)
 *
 * Based on BaritonePlus ConstructIronGolemTask.java
 */
export class ConstructIronGolemTask extends Task {
  private position: BlockPos | null;
  private state: ConstructIronGolemState = ConstructIronGolemState.GETTING_MATERIALS;
  private canBeFinished: boolean = false;

  constructor(bot: Bot, position: BlockPos | null = null) {
    super(bot);
    this.position = position;
  }

  get displayName(): string {
    return `ConstructIronGolem(state: ${ConstructIronGolemState[this.state]})`;
  }

  onStart(): void {
    this.state = ConstructIronGolemState.GETTING_MATERIALS;
    this.canBeFinished = false;
  }

  onTick(): Task | null {
    // Check if we have materials
    const ironBlocksNeeded = this.getIronBlocksNeeded();
    const hasPumpkin = this.hasItem('carved_pumpkin');

    if (this.getItemCount('iron_block') < ironBlocksNeeded || !hasPumpkin) {
      this.state = ConstructIronGolemState.GETTING_MATERIALS;
      // Would return task to get materials
      return null;
    }

    // Find position if not set
    if (!this.position) {
      this.state = ConstructIronGolemState.FINDING_POSITION;
      this.position = this.findBuildPosition();
      if (!this.position) {
        this.position = new BlockPos(
          Math.floor(this.bot.entity.position.x),
          Math.floor(this.bot.entity.position.y),
          Math.floor(this.bot.entity.position.z)
        );
      }
    }

    // Place base iron block
    if (!this.isBlock(this.position, 'iron_block')) {
      if (!this.isAir(this.position)) {
        this.state = ConstructIronGolemState.PLACING_BASE;
        return new DestroyBlockTask(this.bot, this.position.x, this.position.y, this.position.z);
      }
      this.state = ConstructIronGolemState.PLACING_BASE;
      return new PlaceBlockTask(this.bot, this.position.x, this.position.y, this.position.z, 'iron_block');
    }

    // Place center iron block (above base)
    const centerPos = this.position.offset(0, 1, 0);
    if (!this.isBlock(centerPos, 'iron_block')) {
      if (!this.isAir(centerPos)) {
        this.state = ConstructIronGolemState.PLACING_CENTER;
        return new DestroyBlockTask(this.bot, centerPos.x, centerPos.y, centerPos.z);
      }
      this.state = ConstructIronGolemState.PLACING_CENTER;
      return new PlaceBlockTask(this.bot, centerPos.x, centerPos.y, centerPos.z, 'iron_block');
    }

    // Place east arm
    const eastPos = centerPos.offset(1, 0, 0);
    if (!this.isBlock(eastPos, 'iron_block')) {
      if (!this.isAir(eastPos)) {
        this.state = ConstructIronGolemState.PLACING_ARMS;
        return new DestroyBlockTask(this.bot, eastPos.x, eastPos.y, eastPos.z);
      }
      this.state = ConstructIronGolemState.PLACING_ARMS;
      return new PlaceBlockTask(this.bot, eastPos.x, eastPos.y, eastPos.z, 'iron_block');
    }

    // Place west arm
    const westPos = centerPos.offset(-1, 0, 0);
    if (!this.isBlock(westPos, 'iron_block')) {
      if (!this.isAir(westPos)) {
        this.state = ConstructIronGolemState.PLACING_ARMS;
        return new DestroyBlockTask(this.bot, westPos.x, westPos.y, westPos.z);
      }
      this.state = ConstructIronGolemState.PLACING_ARMS;
      return new PlaceBlockTask(this.bot, westPos.x, westPos.y, westPos.z, 'iron_block');
    }

    // Clear area around base for golem to spawn
    const clearEast = this.position.offset(1, 0, 0);
    if (!this.isAir(clearEast)) {
      this.state = ConstructIronGolemState.CLEARING_AREA;
      return new DestroyBlockTask(this.bot, clearEast.x, clearEast.y, clearEast.z);
    }

    const clearWest = this.position.offset(-1, 0, 0);
    if (!this.isAir(clearWest)) {
      this.state = ConstructIronGolemState.CLEARING_AREA;
      return new DestroyBlockTask(this.bot, clearWest.x, clearWest.y, clearWest.z);
    }

    // Place pumpkin head (this spawns the golem!)
    const headPos = this.position.offset(0, 2, 0);
    if (!this.isAir(headPos)) {
      this.state = ConstructIronGolemState.PLACING_HEAD;
      return new DestroyBlockTask(this.bot, headPos.x, headPos.y, headPos.z);
    }

    this.canBeFinished = true;
    this.state = ConstructIronGolemState.PLACING_HEAD;
    return new PlaceBlockTask(this.bot, headPos.x, headPos.y, headPos.z, 'carved_pumpkin');
  }

  /**
   * Check if position has specific block
   */
  private isBlock(pos: BlockPos, blockName: string): boolean {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    return block !== null && block.name === blockName;
  }

  /**
   * Check if position is air
   */
  private isAir(pos: BlockPos): boolean {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    return block === null || block.name === 'air';
  }

  /**
   * Check if player has item
   */
  private hasItem(itemName: string): boolean {
    return this.bot.inventory.items().some((item) => item.name.includes(itemName));
  }

  /**
   * Get count of item in inventory
   */
  private getItemCount(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Calculate iron blocks needed
   */
  private getIronBlocksNeeded(): number {
    if (!this.position) return 4;

    let needed = 0;
    if (!this.isBlock(this.position, 'iron_block')) needed++;
    if (!this.isBlock(this.position.offset(0, 1, 0), 'iron_block')) needed++;
    if (!this.isBlock(this.position.offset(1, 1, 0), 'iron_block')) needed++;
    if (!this.isBlock(this.position.offset(-1, 1, 0), 'iron_block')) needed++;

    return needed;
  }

  /**
   * Find a suitable position to build the golem
   */
  private findBuildPosition(): BlockPos | null {
    const playerPos = this.bot.entity.position;

    // Search for air space
    for (let y = 64; y <= 128; y++) {
      const pos = new Vec3(playerPos.x, y, playerPos.z);
      const block = this.bot.blockAt(pos);
      if (block && block.name === 'air') {
        return new BlockPos(
          Math.floor(pos.x),
          Math.floor(pos.y),
          Math.floor(pos.z)
        );
      }
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    if (!this.position || !this.canBeFinished) return false;

    // Check if an iron golem spawned nearby
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'iron_golem') {
        const dist = entity.position.distanceTo(
          new Vec3(this.position.x, this.position.y, this.position.z)
        );
        if (dist < 3) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get current state
   */
  getState(): ConstructIronGolemState {
    return this.state;
  }

  /**
   * Get build position
   */
  getPosition(): BlockPos | null {
    return this.position;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof ConstructIronGolemTask;
  }
}

/**
 * Convenience function to place a sign
 */
export function placeSign(bot: Bot, message: string, position?: BlockPos): PlaceSignTask {
  return new PlaceSignTask(bot, message, position || null);
}

/**
 * Convenience function to clear a region
 */
export function clearRegion(bot: Bot, from: BlockPos, to: BlockPos): ClearRegionTask {
  return new ClearRegionTask(bot, from, to);
}

/**
 * Convenience function to cover lava with blocks
 */
export function coverWithBlocks(bot: Bot): CoverWithBlocksTask {
  return new CoverWithBlocksTask(bot);
}

/**
 * Convenience function to construct an iron golem
 */
export function constructIronGolem(bot: Bot, position?: BlockPos): ConstructIronGolemTask {
  return new ConstructIronGolemTask(bot, position || null);
}

/**
 * State for structure block placement
 */
enum PlaceStructureBlockState {
  GETTING_BLOCK,
  PLACING,
  FINISHED,
  FAILED,
}

/**
 * PlaceStructureBlockTask - Place any throwaway block at a position
 *
 * WHY this task matters:
 * - Used in construction when specific block type doesn't matter
 * - Pillar up, bridge across, fill gaps with whatever blocks are available
 * - Simplifies construction logic by not requiring specific materials
 *
 * Inherits PlaceBlockTask behavior but auto-selects from available throwaway blocks.
 */
export class PlaceStructureBlockTask extends Task {
  private pos: BlockPos;
  private state: PlaceStructureBlockState = PlaceStructureBlockState.GETTING_BLOCK;
  private selectedBlock: string | null = null;

  constructor(bot: Bot, pos: BlockPos) {
    super(bot);
    this.pos = pos;
  }

  static fromCoords(bot: Bot, x: number, y: number, z: number): PlaceStructureBlockTask {
    return new PlaceStructureBlockTask(bot, new BlockPos(x, y, z));
  }

  get displayName(): string {
    return `PlaceStructureBlock(${this.pos.x}, ${this.pos.y}, ${this.pos.z})`;
  }

  /**
   * Get the position where the block will be placed
   */
  getPosition(): BlockPos {
    return this.pos;
  }

  /**
   * Get the current state
   */
  getState(): PlaceStructureBlockState {
    return this.state;
  }

  /**
   * Get the selected block type (after selection)
   */
  getSelectedBlock(): string | null {
    return this.selectedBlock;
  }

  onStart(): void {
    this.state = PlaceStructureBlockState.GETTING_BLOCK;
    this.selectedBlock = null;
  }

  onTick(): Task | null {
    // Check if already placed
    const block = this.bot.blockAt(new Vec3(this.pos.x, this.pos.y, this.pos.z));
    if (block && block.boundingBox !== 'empty') {
      this.state = PlaceStructureBlockState.FINISHED;
      return null;
    }

    switch (this.state) {
      case PlaceStructureBlockState.GETTING_BLOCK:
        return this.handleGettingBlock();

      case PlaceStructureBlockState.PLACING:
        return this.handlePlacing();

      default:
        return null;
    }
  }

  private handleGettingBlock(): Task | null {
    // Find any throwaway block in inventory
    const items = this.bot.inventory.items();
    for (const item of items) {
      if (THROWAWAY_BLOCKS.includes(item.name)) {
        this.selectedBlock = item.name;
        this.state = PlaceStructureBlockState.PLACING;
        return null;
      }
    }

    // No throwaway blocks available - task cannot complete
    this.state = PlaceStructureBlockState.FAILED;
    return null;
  }

  private handlePlacing(): Task | null {
    if (!this.selectedBlock) {
      this.state = PlaceStructureBlockState.FAILED;
      return null;
    }

    // Delegate to PlaceBlockTask
    return PlaceBlockTask.fromBlockPos(this.bot, this.pos, this.selectedBlock);
  }

  onStop(): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.state === PlaceStructureBlockState.FINISHED ||
           this.state === PlaceStructureBlockState.FAILED;
  }

  isFailed(): boolean {
    return this.state === PlaceStructureBlockState.FAILED;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PlaceStructureBlockTask)) return false;
    return this.pos.equals(other.pos);
  }
}

/**
 * Convenience function to create a structure block placement task
 */
export function placeStructureBlock(bot: Bot, pos: BlockPos): PlaceStructureBlockTask {
  return new PlaceStructureBlockTask(bot, pos);
}

/**
 * Convenience function to create a structure block placement task from coordinates
 */
export function placeStructureBlockAt(bot: Bot, x: number, y: number, z: number): PlaceStructureBlockTask {
  return PlaceStructureBlockTask.fromCoords(bot, x, y, z);
}

export {
  PlaceSignState,
  ClearRegionState,
  CoverWithBlocksState,
  ConstructIronGolemState,
  PlaceStructureBlockState,
  WOOD_SIGNS,
  THROWAWAY_BLOCKS,
};
