/**
 * MineAndCollectTask - Mine Blocks and Collect Drops
 * Based on BaritonePlus's MineAndCollectTask.java
 *
 * WHY: Many resources are obtained by mining blocks - ore, stone, wood.
 * This task handles finding the nearest block, mining it, and collecting
 * the dropped items until the target count is reached.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ResourceTask, ItemTarget, itemTarget } from './ResourceTask';
import { GoToNearTask } from './GoToNearTask';
import { MineBlockTask } from './MineBlockTask';
import { PickupItemTask } from './InventoryTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';

/**
 * State for mine and collect task
 */
enum MineCollectState {
  SEARCHING,
  APPROACHING,
  MINING,
  COLLECTING,
  WANDERING,
  FINISHED,
  FAILED
}

/**
 * Configuration for MineAndCollectTask
 */
export interface MineAndCollectConfig {
  /** Maximum search radius for blocks */
  searchRadius: number;
  /** Timeout before giving up on unreachable block */
  reachTimeout: number;
  /** Prefer dropped items over mining new blocks */
  preferDrops: boolean;
}

const DEFAULT_CONFIG: MineAndCollectConfig = {
  searchRadius: 64,
  reachTimeout: 30,
  preferDrops: true,
};

/**
 * Task to mine blocks and collect the dropped items.
 *
 * WHY: Mining is a core activity - we need blocks for building,
 * items for crafting, and ores for tools. This task handles the
 * full cycle: find block -> approach -> mine -> collect drops.
 *
 * Based on BaritonePlus MineAndCollectTask.java
 */
export class MineAndCollectTask extends ResourceTask {
  private config: MineAndCollectConfig;
  private blocksToMine: string[];
  private state: MineCollectState = MineCollectState.SEARCHING;
  private currentTarget: Vec3 | null = null;
  private progressChecker: MovementProgressChecker;
  private blacklistedPositions: Set<string> = new Set();

  constructor(
    bot: Bot,
    itemTargets: ItemTarget[],
    blocksToMine: string[],
    config: Partial<MineAndCollectConfig> = {}
  ) {
    super(bot, itemTargets);
    this.blocksToMine = blocksToMine;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.progressChecker = new MovementProgressChecker(bot);
  }

  get displayName(): string {
    const blockName = this.blocksToMine.length === 1
      ? this.blocksToMine[0]
      : `${this.blocksToMine.length} types`;
    return `MineAndCollect(${blockName})`;
  }

  protected onResourceStart(): void {
    this.state = MineCollectState.SEARCHING;
    this.currentTarget = null;
    this.blacklistedPositions.clear();
    this.progressChecker.reset();
  }

  protected onResourceTick(): Task | null {
    switch (this.state) {
      case MineCollectState.SEARCHING:
        return this.handleSearching();

      case MineCollectState.APPROACHING:
        return this.handleApproaching();

      case MineCollectState.MINING:
        return this.handleMining();

      case MineCollectState.COLLECTING:
        return this.handleCollecting();

      case MineCollectState.WANDERING:
        return this.handleWandering();

      default:
        return null;
    }
  }

  private handleSearching(): Task | null {
    // Check for nearby dropped items first (if preferDrops is enabled)
    if (this.config.preferDrops) {
      const nearbyDrop = this.findNearbyDrop();
      if (nearbyDrop) {
        this.state = MineCollectState.COLLECTING;
        return null;
      }
    }

    // Find nearest block to mine
    const block = this.findNearestBlock();

    if (!block) {
      // No block found - wander and search
      this.state = MineCollectState.WANDERING;
      return null;
    }

    this.currentTarget = block.position;
    this.state = MineCollectState.APPROACHING;
    this.progressChecker.reset();
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.currentTarget) {
      this.state = MineCollectState.SEARCHING;
      return null;
    }

    // Check if we can reach the block
    const playerPos = this.bot.entity.position;
    const dist = playerPos.distanceTo(this.currentTarget);

    // Check progress
    this.progressChecker.setProgress(playerPos);
    if (this.progressChecker.failed()) {
      // Can't reach this block
      this.blacklistPosition(this.currentTarget);
      this.currentTarget = null;
      this.state = MineCollectState.SEARCHING;
      this.progressChecker.reset();
      return null;
    }

    // Check if block is still valid
    const block = this.bot.blockAt(this.currentTarget);
    if (!block || !this.isTargetBlock(block)) {
      this.currentTarget = null;
      this.state = MineCollectState.SEARCHING;
      return null;
    }

    // In range to mine?
    if (dist <= 4.5) {
      this.state = MineCollectState.MINING;
      this.progressChecker.reset();
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

  private handleMining(): Task | null {
    if (!this.currentTarget) {
      this.state = MineCollectState.SEARCHING;
      return null;
    }

    const block = this.bot.blockAt(this.currentTarget);

    // Block mined or changed
    if (!block || !this.isTargetBlock(block)) {
      this.currentTarget = null;
      this.state = MineCollectState.COLLECTING;
      return null;
    }

    // Check progress while mining
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      // Stuck mining - blacklist and move on
      this.blacklistPosition(this.currentTarget);
      this.currentTarget = null;
      this.state = MineCollectState.SEARCHING;
      this.progressChecker.reset();
      return null;
    }

    // Continue mining
    return new MineBlockTask(
      this.bot,
      Math.floor(this.currentTarget.x),
      Math.floor(this.currentTarget.y),
      Math.floor(this.currentTarget.z)
    );
  }

  private handleCollecting(): Task | null {
    // Look for dropped items matching our targets
    const nearbyDrop = this.findNearbyDrop();

    if (!nearbyDrop) {
      // No more drops, continue searching
      this.state = MineCollectState.SEARCHING;
      return null;
    }

    // Find the item name to pick up
    const itemName = this.itemTargets[0]?.items[0] ?? this.blocksToMine[0];

    return new PickupItemTask(this.bot, itemName);
  }

  private handleWandering(): Task | null {
    // Wander to find more blocks
    const subtask = new TimeoutWanderTask(this.bot, 15);

    // Check if we found a block while wandering
    const block = this.findNearestBlock();
    if (block) {
      this.currentTarget = block.position;
      this.state = MineCollectState.APPROACHING;
      return null;
    }

    return subtask;
  }

  protected onResourceStop(interruptTask: ITask | null): void {
    this.currentTarget = null;
    this.blacklistedPositions.clear();
  }

  protected isEqualResource(other: ResourceTask): boolean {
    if (!(other instanceof MineAndCollectTask)) return false;
    return JSON.stringify(this.blocksToMine) === JSON.stringify(other.blocksToMine);
  }

  // ---- Helper methods ----

  private findNearestBlock(): Block | null {
    const playerPos = this.bot.entity.position;
    const radius = this.config.searchRadius;

    let nearest: Block | null = null;
    let nearestDist = Infinity;

    // Search in expanding cubes
    for (let r = 1; r <= radius; r++) {
      for (let x = -r; x <= r; x++) {
        for (let y = -Math.min(r, 32); y <= Math.min(r, 32); y++) {
          for (let z = -r; z <= r; z++) {
            // Only check outer shell
            if (Math.abs(x) !== r && Math.abs(y) !== r && Math.abs(z) !== r) continue;

            const checkPos = new Vec3(
              Math.floor(playerPos.x) + x,
              Math.floor(playerPos.y) + y,
              Math.floor(playerPos.z) + z
            );

            // Skip blacklisted positions
            if (this.isBlacklisted(checkPos)) continue;

            const block = this.bot.blockAt(checkPos);
            if (block && this.isTargetBlock(block)) {
              const dist = playerPos.distanceTo(checkPos);
              if (dist < nearestDist) {
                nearestDist = dist;
                nearest = block;
              }
            }
          }
        }
      }

      // Found a block in this radius
      if (nearest) break;
    }

    return nearest;
  }

  private isTargetBlock(block: Block): boolean {
    return this.blocksToMine.some(name =>
      block.name === name || block.name.includes(name)
    );
  }

  private findNearbyDrop(): any | null {
    // Get nearby entities that are items
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity.type !== 'object') continue;

      // Check if it's an item entity
      const itemEntity = entity as any;
      if (itemEntity.objectType !== 'Item' && itemEntity.entityType !== 'item') continue;

      // Check distance
      const dist = playerPos.distanceTo(entity.position);
      if (dist > 32) continue;

      // Check if item matches our targets
      const itemName = itemEntity.metadata?.[8]?.itemId ?? '';
      if (this.itemTargets.some(target =>
        target.items.some(name => itemName.includes(name))
      )) {
        return entity;
      }
    }

    return null;
  }

  private blacklistPosition(pos: Vec3): void {
    this.blacklistedPositions.add(`${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`);
  }

  private isBlacklisted(pos: Vec3): boolean {
    return this.blacklistedPositions.has(`${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`);
  }
}

/**
 * Helper function to create a mine and collect task
 */
export function mineAndCollect(
  bot: Bot,
  itemName: string,
  count: number,
  blockNames?: string[]
): MineAndCollectTask {
  const blocks = blockNames ?? [itemName];
  return new MineAndCollectTask(
    bot,
    [itemTarget(itemName, count)],
    blocks
  );
}

/**
 * Mine ore and collect the drops
 */
export function mineOre(
  bot: Bot,
  oreName: string,
  dropName: string,
  count: number
): MineAndCollectTask {
  return new MineAndCollectTask(
    bot,
    [itemTarget(dropName, count)],
    [oreName]
  );
}
