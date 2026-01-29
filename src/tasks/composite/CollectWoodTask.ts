/**
 * CollectWoodTask - Composite Task for Collecting Wood
 * Based on AltoClef's wood collection behavior
 *
 * Finds trees, mines logs, and collects dropped items.
 * Handles the complete wood gathering workflow.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { MineBlockTask } from '../concrete/MineBlockTask';
import { PickupItemTask } from '../concrete/InventoryTask';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { ItemTarget } from '../../utils/ItemTarget';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * All log types in Minecraft
 */
const LOG_TYPES = [
  'oak_log', 'birch_log', 'spruce_log', 'jungle_log',
  'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log',
  'crimson_stem', 'warped_stem',
];

/**
 * State for wood collection
 */
enum CollectState {
  SEARCHING,
  GOING_TO_TREE,
  MINING_LOG,
  COLLECTING_DROPS,
  FINISHED
}

/**
 * Task to collect wood from trees
 */
export class CollectWoodTask extends Task {
  private targetCount: number;
  private preferredTypes: string[];
  private state: CollectState = CollectState.SEARCHING;
  private currentTree: Vec3 | null = null;
  private logsToMine: Vec3[] = [];
  private searchRadius: number = 64;
  private searchTimer: TimerGame;

  constructor(bot: Bot, count: number = 1, preferredTypes?: string[]) {
    super(bot);
    this.targetCount = count;
    this.preferredTypes = preferredTypes || LOG_TYPES;
    this.searchTimer = new TimerGame(bot, 2.0);
  }

  get displayName(): string {
    return `CollectWood(${this.getCurrentCount()}/${this.targetCount})`;
  }

  onStart(): void {
    this.state = CollectState.SEARCHING;
    this.currentTree = null;
    this.logsToMine = [];
  }

  onTick(): Task | null {
    // Check if we have enough
    if (this.getCurrentCount() >= this.targetCount) {
      this.state = CollectState.FINISHED;
      return null;
    }

    switch (this.state) {
      case CollectState.SEARCHING:
        return this.handleSearching();

      case CollectState.GOING_TO_TREE:
        return this.handleGoingToTree();

      case CollectState.MINING_LOG:
        return this.handleMiningLog();

      case CollectState.COLLECTING_DROPS:
        return this.handleCollectingDrops();

      default:
        return null;
    }
  }

  private handleSearching(): Task | null {
    // Find nearest tree
    const tree = this.findNearestTree();
    if (!tree) {
      // No trees found - keep searching periodically
      if (this.searchTimer.elapsed()) {
        this.searchTimer.reset();
      }
      return null;
    }

    this.currentTree = tree.position;
    this.logsToMine = this.findTreeLogs(tree.position);
    this.state = CollectState.GOING_TO_TREE;
    return null;
  }

  private handleGoingToTree(): Task | null {
    if (!this.currentTree) {
      this.state = CollectState.SEARCHING;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentTree);
    if (dist <= 4.0) {
      this.state = CollectState.MINING_LOG;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.currentTree.x),
      Math.floor(this.currentTree.y),
      Math.floor(this.currentTree.z),
      3
    );
  }

  private handleMiningLog(): Task | null {
    // Check if we have enough
    if (this.getCurrentCount() >= this.targetCount) {
      this.state = CollectState.FINISHED;
      return null;
    }

    // Get next log to mine
    if (this.logsToMine.length === 0) {
      // Tree depleted - collect drops then search for more
      this.state = CollectState.COLLECTING_DROPS;
      return null;
    }

    // Find lowest log still present (mine from bottom up)
    let lowestLog: Vec3 | null = null;
    let lowestY = Infinity;

    for (const logPos of this.logsToMine) {
      const block = this.bot.blockAt(logPos);
      if (block && this.isLog(block.name)) {
        if (logPos.y < lowestY) {
          lowestY = logPos.y;
          lowestLog = logPos;
        }
      }
    }

    if (!lowestLog) {
      // All logs mined
      this.logsToMine = [];
      this.state = CollectState.COLLECTING_DROPS;
      return null;
    }

    // Remove from list and mine it
    this.logsToMine = this.logsToMine.filter(
      pos => !pos.equals(lowestLog!)
    );

    return MineBlockTask.fromVec3(this.bot, lowestLog, true);
  }

  private handleCollectingDrops(): Task | null {
    // Try to pick up any nearby log drops
    const logTarget = new ItemTarget(LOG_TYPES, 1);

    // Check if there are drops nearby
    const hasDrops = this.hasNearbyLogDrops();
    if (hasDrops) {
      return new PickupItemTask(this.bot, logTarget, 1);
    }

    // No drops - search for more trees if needed
    if (this.getCurrentCount() < this.targetCount) {
      this.state = CollectState.SEARCHING;
      this.currentTree = null;
    } else {
      this.state = CollectState.FINISHED;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.currentTree = null;
    this.logsToMine = [];
  }

  isFinished(): boolean {
    return this.state === CollectState.FINISHED ||
           this.getCurrentCount() >= this.targetCount;
  }

  /**
   * Get current log count in inventory
   */
  private getCurrentCount(): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (this.isLog(item.name)) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Check if item name is a log
   */
  private isLog(name: string): boolean {
    return this.preferredTypes.some(type => name === type || name.includes('log') || name.includes('stem'));
  }

  /**
   * Find nearest tree (bottom log block)
   */
  private findNearestTree(): Block | null {
    const playerPos = this.bot.entity.position;
    let nearest: Block | null = null;
    let nearestDist = Infinity;

    // Search for logs
    for (let x = -this.searchRadius; x <= this.searchRadius; x += 2) {
      for (let z = -this.searchRadius; z <= this.searchRadius; z += 2) {
        for (let y = -10; y <= 30; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block || !this.isLog(block.name)) continue;

          // Check if this is the bottom of a tree (has dirt/grass below)
          const below = this.bot.blockAt(pos.offset(0, -1, 0));
          if (!below) continue;

          const isTreeBase = below.name === 'dirt' ||
                            below.name === 'grass_block' ||
                            below.name === 'podzol' ||
                            below.name === 'mycelium' ||
                            below.name === 'rooted_dirt';

          if (!isTreeBase) continue;

          const dist = playerPos.distanceTo(pos);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = block;
          }
        }
      }
    }

    return nearest;
  }

  /**
   * Find all logs belonging to a tree starting from base
   */
  private findTreeLogs(basePos: Vec3): Vec3[] {
    const logs: Vec3[] = [];
    const visited = new Set<string>();
    const toVisit: Vec3[] = [basePos];

    while (toVisit.length > 0) {
      const pos = toVisit.pop()!;
      const key = `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const block = this.bot.blockAt(pos);
      if (!block || !this.isLog(block.name)) continue;

      logs.push(pos.clone());

      // Check adjacent blocks (including diagonals for jungle trees)
      const offsets = [
        [0, 1, 0],  // up
        [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], // cardinal
        [1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1], // up-cardinal
      ];

      for (const [dx, dy, dz] of offsets) {
        toVisit.push(pos.offset(dx, dy, dz));
      }
    }

    return logs;
  }

  /**
   * Check if there are log item drops nearby
   */
  private hasNearbyLogDrops(): boolean {
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name !== 'item' && entity.entityType !== 2) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist > 16) continue;

      // Check if it's a log drop
      const metadata = (entity as any).metadata;
      if (metadata) {
        for (const entry of metadata) {
          if (entry && typeof entry === 'object' && 'itemId' in entry) {
            const mcData = require('minecraft-data')(this.bot.version);
            const item = mcData.items[entry.itemId];
            if (item && this.isLog(item.name)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof CollectWoodTask)) return false;
    return this.targetCount === other.targetCount;
  }
}
