/**
 * BlockSearchTask - Block Finding and Interaction Tasks
 * Based on BaritonePlus's DoToClosestBlockTask and related movement tasks
 *
 * WHY: Many tasks need to find and interact with specific blocks - crafting
 * tables, furnaces, chests, etc. These tasks handle the search, approach,
 * and interaction logic.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToTask';
import { TimeoutWanderTask } from './MovementUtilTask';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';

/**
 * Block filter predicate type
 */
export type BlockFilter = (block: Block) => boolean;

/**
 * Task factory for blocks
 */
export type BlockTaskFactory = (blockPos: Vec3) => Task;

/**
 * State for block search tasks
 */
enum BlockSearchState {
  SEARCHING,
  APPROACHING,
  EXECUTING,
  WANDERING,
  FINISHED,
  FAILED
}

/**
 * Configuration for DoToClosestBlockTask
 */
export interface DoToClosestBlockConfig {
  /** Block types to search for */
  blockTypes: string[];
  /** Custom block filter */
  blockFilter?: BlockFilter;
  /** Origin position supplier (defaults to player position) */
  originSupplier?: () => Vec3;
  /** Search radius */
  searchRadius: number;
  /** Whether to wander when no block found */
  wanderOnMissing: boolean;
}

const DEFAULT_CONFIG: DoToClosestBlockConfig = {
  blockTypes: [],
  searchRadius: 64,
  wanderOnMissing: true,
};

/**
 * Task to find the closest block and run a task on it.
 *
 * WHY: Many activities require finding blocks - craft at a table,
 * smelt in a furnace, loot a chest. This task handles the common
 * pattern of searching, approaching, and then doing something.
 *
 * Based on BaritonePlus DoToClosestBlockTask.java
 */
export class DoToClosestBlockTask extends Task {
  private config: DoToClosestBlockConfig;
  private taskFactory: BlockTaskFactory;
  private state: BlockSearchState = BlockSearchState.SEARCHING;
  private currentTarget: Vec3 | null = null;
  private currentTask: Task | null = null;
  private blacklistedPositions: Set<string> = new Set();
  private progressChecker: MovementProgressChecker;

  constructor(
    bot: Bot,
    taskFactory: BlockTaskFactory,
    blockTypes: string[],
    config: Partial<DoToClosestBlockConfig> = {}
  ) {
    super(bot);
    this.taskFactory = taskFactory;
    this.config = { ...DEFAULT_CONFIG, ...config, blockTypes };
    this.progressChecker = new MovementProgressChecker(bot);
  }

  get displayName(): string {
    const typeName = this.config.blockTypes.length === 1
      ? this.config.blockTypes[0]
      : `${this.config.blockTypes.length} types`;
    return `DoToClosestBlock(${typeName})`;
  }

  onStart(): void {
    this.state = BlockSearchState.SEARCHING;
    this.currentTarget = null;
    this.currentTask = null;
    this.blacklistedPositions.clear();
    this.progressChecker.reset();
  }

  onTick(): Task | null {
    switch (this.state) {
      case BlockSearchState.SEARCHING:
        return this.handleSearching();

      case BlockSearchState.APPROACHING:
        return this.handleApproaching();

      case BlockSearchState.EXECUTING:
        return this.handleExecuting();

      case BlockSearchState.WANDERING:
        return this.handleWandering();

      default:
        return null;
    }
  }

  private handleSearching(): Task | null {
    const block = this.findClosestBlock();

    if (!block) {
      if (this.config.wanderOnMissing) {
        this.state = BlockSearchState.WANDERING;
        return null;
      } else {
        this.state = BlockSearchState.FAILED;
        return null;
      }
    }

    this.currentTarget = block.position;
    this.state = BlockSearchState.APPROACHING;
    this.progressChecker.reset();
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.currentTarget) {
      this.state = BlockSearchState.SEARCHING;
      return null;
    }

    // Verify block is still valid
    const block = this.bot.blockAt(this.currentTarget);
    if (!block || !this.isValidBlock(block)) {
      this.currentTarget = null;
      this.state = BlockSearchState.SEARCHING;
      return null;
    }

    // Check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      this.blacklistPosition(this.currentTarget);
      this.currentTarget = null;
      this.state = BlockSearchState.SEARCHING;
      this.progressChecker.reset();
      return null;
    }

    // Check if in range
    const dist = this.bot.entity.position.distanceTo(this.currentTarget);
    if (dist <= 4.5) {
      // Create the task for this block
      this.currentTask = this.taskFactory(this.currentTarget);
      this.state = BlockSearchState.EXECUTING;
      return null;
    }

    // Move toward block
    return new GoToNearTask(
      this.bot,
      Math.floor(this.currentTarget.x),
      Math.floor(this.currentTarget.y),
      Math.floor(this.currentTarget.z),
      3
    );
  }

  private handleExecuting(): Task | null {
    if (!this.currentTask) {
      this.state = BlockSearchState.FINISHED;
      return null;
    }

    if (this.currentTask.isFinished()) {
      this.state = BlockSearchState.FINISHED;
      return null;
    }

    return this.currentTask;
  }

  private handleWandering(): Task | null {
    // Check for blocks while wandering
    const block = this.findClosestBlock();
    if (block) {
      this.currentTarget = block.position;
      this.state = BlockSearchState.APPROACHING;
      return null;
    }

    return new TimeoutWanderTask(this.bot, 15);
  }

  onStop(interruptTask: ITask | null): void {
    this.currentTarget = null;
    this.currentTask = null;
    this.blacklistedPositions.clear();
  }

  isFinished(): boolean {
    return this.state === BlockSearchState.FINISHED ||
           this.state === BlockSearchState.FAILED;
  }

  isFailed(): boolean {
    return this.state === BlockSearchState.FAILED;
  }

  // ---- Helper methods ----

  private findClosestBlock(): Block | null {
    const origin = this.config.originSupplier
      ? this.config.originSupplier()
      : this.bot.entity.position;

    let nearest: Block | null = null;
    let nearestDist = Infinity;

    for (let r = 1; r <= this.config.searchRadius; r++) {
      for (let x = -r; x <= r; x++) {
        for (let y = -Math.min(r, 32); y <= Math.min(r, 32); y++) {
          for (let z = -r; z <= r; z++) {
            if (Math.abs(x) !== r && Math.abs(y) !== r && Math.abs(z) !== r) continue;

            const checkPos = new Vec3(
              Math.floor(origin.x) + x,
              Math.floor(origin.y) + y,
              Math.floor(origin.z) + z
            );

            if (this.isBlacklisted(checkPos)) continue;

            const block = this.bot.blockAt(checkPos);
            if (block && this.isValidBlock(block)) {
              const dist = origin.distanceTo(checkPos);
              if (dist < nearestDist) {
                nearestDist = dist;
                nearest = block;
              }
            }
          }
        }
      }

      if (nearest) break;
    }

    return nearest;
  }

  private isValidBlock(block: Block): boolean {
    // Check type
    if (!this.config.blockTypes.some(name =>
      block.name === name || block.name.includes(name)
    )) {
      return false;
    }

    // Check custom filter
    if (this.config.blockFilter && !this.config.blockFilter(block)) {
      return false;
    }

    return true;
  }

  private blacklistPosition(pos: Vec3): void {
    this.blacklistedPositions.add(`${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`);
  }

  private isBlacklisted(pos: Vec3): boolean {
    return this.blacklistedPositions.has(`${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`);
  }

  /**
   * Mark current target as unreachable
   */
  markCurrentUnreachable(): void {
    if (this.currentTarget) {
      this.blacklistPosition(this.currentTarget);
      this.currentTarget = null;
      this.currentTask = null;
      this.state = BlockSearchState.SEARCHING;
    }
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof DoToClosestBlockTask)) return false;
    return JSON.stringify(this.config.blockTypes) === JSON.stringify(other.config.blockTypes);
  }
}

/**
 * Task to get within a certain range of a block.
 *
 * WHY: Some tasks just need to be near a block, not at it exactly.
 * This task navigates to be within a specified distance of a target block.
 *
 * Based on BaritonePlus GetWithinRangeOfBlockTask.java
 */
export class GetWithinRangeOfBlockTask extends Task {
  private targetPos: Vec3;
  private range: number;
  private finished: boolean = false;

  constructor(bot: Bot, x: number, y: number, z: number, range: number) {
    super(bot);
    this.targetPos = new Vec3(x, y, z);
    this.range = range;
  }

  get displayName(): string {
    return `GetWithinRange(${this.targetPos.x},${this.targetPos.y},${this.targetPos.z} r=${this.range})`;
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    const dist = this.bot.entity.position.distanceTo(this.targetPos);

    if (dist <= this.range) {
      this.finished = true;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.targetPos.x),
      Math.floor(this.targetPos.y),
      Math.floor(this.targetPos.z),
      this.range
    );
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.finished ||
           this.bot.entity.position.distanceTo(this.targetPos) <= this.range;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetWithinRangeOfBlockTask)) return false;
    return this.targetPos.equals(other.targetPos) && this.range === other.range;
  }
}

/**
 * Task to move in a specific XZ direction.
 *
 * WHY: Sometimes we need to move in a general direction without a specific
 * target - exploring, fleeing, or reaching a distant goal. This task moves
 * the player along an XZ direction vector.
 *
 * Based on BaritonePlus GoInDirectionXZTask.java
 */
export class GoInDirectionXZTask extends Task {
  private origin: Vec3;
  private direction: Vec3;
  private sidePenalty: number;
  private distanceTraveled: number = 0;
  private targetDistance: number;

  constructor(
    bot: Bot,
    origin: Vec3,
    direction: Vec3,
    distance: number = 100,
    sidePenalty: number = 3
  ) {
    super(bot);
    this.origin = origin;
    this.direction = this.normalizeXZ(direction);
    this.targetDistance = distance;
    this.sidePenalty = sidePenalty;
  }

  get displayName(): string {
    return `GoInDirection(${this.direction.x.toFixed(2)},${this.direction.z.toFixed(2)})`;
  }

  onStart(): void {
    this.distanceTraveled = 0;
  }

  onTick(): Task | null {
    // Calculate target point along direction
    const targetPoint = new Vec3(
      this.origin.x + this.direction.x * (this.distanceTraveled + 20),
      this.bot.entity.position.y,
      this.origin.z + this.direction.z * (this.distanceTraveled + 20)
    );

    // Update distance traveled
    const currentPos = this.bot.entity.position;
    const projected = this.projectOntoDirection(currentPos);
    this.distanceTraveled = Math.max(this.distanceTraveled, projected);

    // Check if we've reached target distance
    if (this.distanceTraveled >= this.targetDistance) {
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(targetPoint.x),
      Math.floor(targetPoint.y),
      Math.floor(targetPoint.z),
      5
    );
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.distanceTraveled >= this.targetDistance;
  }

  // ---- Helper methods ----

  private normalizeXZ(vec: Vec3): Vec3 {
    const len = Math.sqrt(vec.x * vec.x + vec.z * vec.z);
    if (len < 0.001) return new Vec3(1, 0, 0); // Default direction
    return new Vec3(vec.x / len, 0, vec.z / len);
  }

  private projectOntoDirection(pos: Vec3): number {
    const diff = new Vec3(
      pos.x - this.origin.x,
      0,
      pos.z - this.origin.z
    );
    return diff.x * this.direction.x + diff.z * this.direction.z;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GoInDirectionXZTask)) return false;

    const originClose = this.origin.distanceTo(other.origin) < 0.1;
    const dirClose = Math.abs(this.direction.x - other.direction.x) < 0.01 &&
                     Math.abs(this.direction.z - other.direction.z) < 0.01;

    return originClose && dirClose;
  }
}

/**
 * Helper function to create DoToClosestBlockTask
 */
export function doToClosestBlock(
  bot: Bot,
  taskFactory: BlockTaskFactory,
  ...blockTypes: string[]
): DoToClosestBlockTask {
  return new DoToClosestBlockTask(bot, taskFactory, blockTypes);
}

/**
 * Helper to get within range of a block
 */
export function getWithinRangeOf(
  bot: Bot,
  x: number,
  y: number,
  z: number,
  range: number
): GetWithinRangeOfBlockTask {
  return new GetWithinRangeOfBlockTask(bot, x, y, z, range);
}

/**
 * Helper to move in a direction
 */
export function goInDirection(
  bot: Bot,
  dirX: number,
  dirZ: number,
  distance: number = 100
): GoInDirectionXZTask {
  return new GoInDirectionXZTask(
    bot,
    bot.entity.position,
    new Vec3(dirX, 0, dirZ),
    distance
  );
}
