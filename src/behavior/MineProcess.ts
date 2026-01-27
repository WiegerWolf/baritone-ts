import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { BaseProcess, ProcessPriority, ProcessTickResult, ProcessState } from './Process';
import { BlockPos, Goal } from '../types';
import { GoalGetToBlock, GoalComposite } from '../goals';

/**
 * MineProcess handles automated block mining
 * Based on Baritone's MineProcess
 *
 * Features:
 * - Find and mine specific block types
 * - Multiple target blocks support
 * - Automatic path recalculation when blocks are mined
 * - Tool selection
 */

/**
 * Mining configuration
 */
export interface MineConfig {
  // Block names to mine
  blockNames: string[];
  // Maximum search radius
  searchRadius: number;
  // Maximum Y level to search
  maxY?: number;
  // Minimum Y level to search
  minY?: number;
  // Maximum blocks to mine (0 = unlimited)
  maxBlocks: number;
  // Require line of sight for initial selection
  requireLineOfSight: boolean;
}

const DEFAULT_CONFIG: MineConfig = {
  blockNames: [],
  searchRadius: 64,
  maxBlocks: 0,
  requireLineOfSight: false
};

export class MineProcess extends BaseProcess {
  readonly displayName = 'Mine';

  private config: MineConfig;
  private targetBlocks: Block[] = [];
  private currentTarget: Block | null = null;
  private blocksMined: number = 0;
  private lastSearchTime: number = 0;
  private searchCooldown: number = 2000; // ms between searches

  constructor(bot: Bot, pathfinder: any, config: Partial<MineConfig> = {}) {
    super(bot, pathfinder, ProcessPriority.NORMAL);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set blocks to mine
   */
  setBlocks(blockNames: string[]): void {
    this.config.blockNames = blockNames;
    this.targetBlocks = [];
    this.currentTarget = null;
  }

  /**
   * Add a block type to mine
   */
  addBlock(blockName: string): void {
    if (!this.config.blockNames.includes(blockName)) {
      this.config.blockNames.push(blockName);
    }
  }

  /**
   * Remove a block type from mining
   */
  removeBlock(blockName: string): void {
    const index = this.config.blockNames.indexOf(blockName);
    if (index !== -1) {
      this.config.blockNames.splice(index, 1);
    }
  }

  /**
   * Set search radius
   */
  setSearchRadius(radius: number): void {
    this.config.searchRadius = radius;
  }

  /**
   * Set max blocks to mine
   */
  setMaxBlocks(max: number): void {
    this.config.maxBlocks = max;
  }

  onActivate(): void {
    super.onActivate();
    this.blocksMined = 0;
    this.findTargetBlocks();
  }

  onDeactivate(): void {
    super.onDeactivate();
    this.currentTarget = null;
    this.targetBlocks = [];
  }

  tick(): ProcessTickResult {
    // Check if we have blocks to mine
    if (this.config.blockNames.length === 0) {
      return this.failedResult('No blocks specified to mine');
    }

    // Check if we've reached max blocks
    if (this.config.maxBlocks > 0 && this.blocksMined >= this.config.maxBlocks) {
      return this.completeResult(`Mined ${this.blocksMined} blocks`);
    }

    // Refresh target list periodically
    const now = Date.now();
    if (now - this.lastSearchTime > this.searchCooldown) {
      this.findTargetBlocks();
      this.lastSearchTime = now;
    }

    // Check if current target is still valid
    if (this.currentTarget) {
      const block = this.bot.blockAt(this.currentTarget.position);
      if (!block || !this.config.blockNames.includes(block.name)) {
        // Target was mined or changed
        this.blocksMined++;
        this.currentTarget = null;
      }
    }

    // Find new target if needed
    if (!this.currentTarget) {
      this.currentTarget = this.selectBestTarget();

      if (!this.currentTarget) {
        // No targets found
        if (this.targetBlocks.length === 0) {
          return this.failedResult('No target blocks found in range');
        }
        // Wait for targets to become available
        return this.waitResult('Searching for blocks...');
      }
    }

    // Create goal to get to the block
    const goal = new GoalGetToBlock(
      this.currentTarget.position.x,
      this.currentTarget.position.y,
      this.currentTarget.position.z
    );

    return this.newGoalResult(goal, `Mining ${this.currentTarget.name}`);
  }

  /**
   * Find all target blocks in range
   */
  private findTargetBlocks(): void {
    this.targetBlocks = [];
    const botPos = this.bot.entity.position;
    const radius = this.config.searchRadius;

    // Use bot's findBlocks function
    const positions = this.bot.findBlocks({
      matching: (block: Block) => this.config.blockNames.includes(block.name),
      maxDistance: radius,
      count: 256 // Limit to prevent lag
    });

    // Convert to blocks and filter by Y if needed
    for (const pos of positions) {
      if (this.config.maxY !== undefined && pos.y > this.config.maxY) continue;
      if (this.config.minY !== undefined && pos.y < this.config.minY) continue;

      const block = this.bot.blockAt(pos);
      if (block) {
        this.targetBlocks.push(block);
      }
    }

    // Sort by distance
    this.targetBlocks.sort((a, b) => {
      const distA = botPos.distanceTo(a.position);
      const distB = botPos.distanceTo(b.position);
      return distA - distB;
    });
  }

  /**
   * Select the best target block to mine
   */
  private selectBestTarget(): Block | null {
    if (this.targetBlocks.length === 0) {
      return null;
    }

    // Simple selection: closest block
    // Could be improved with:
    // - Cluster detection (mine groups of blocks)
    // - Tool efficiency consideration
    // - Ore vein detection

    return this.targetBlocks[0] || null;
  }

  /**
   * Get number of blocks mined
   */
  getBlocksMined(): number {
    return this.blocksMined;
  }

  /**
   * Get current target block
   */
  getCurrentTarget(): Block | null {
    return this.currentTarget;
  }

  /**
   * Get all found target blocks
   */
  getTargetBlocks(): Block[] {
    return [...this.targetBlocks];
  }
}
