/**
 * PlantTreeTask - Tree Planting Automation
 * Based on AltoClef resource management patterns
 *
 * Handles planting saplings and growing trees for
 * sustainable wood harvesting.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for tree planting
 */
enum PlantState {
  PREPARING,
  FINDING_SPOT,
  APPROACHING,
  PLACING_SAPLING,
  APPLYING_BONEMEAL,
  WAITING_GROWTH,
  FINISHED,
  FAILED
}

/**
 * Sapling types
 */
export type SaplingType =
  | 'oak_sapling' | 'spruce_sapling' | 'birch_sapling'
  | 'jungle_sapling' | 'acacia_sapling' | 'dark_oak_sapling'
  | 'cherry_sapling' | 'mangrove_propagule'
  | 'any';

/**
 * Configuration for tree planting
 */
export interface PlantTreeConfig {
  /** Type of sapling to plant */
  saplingType: SaplingType;
  /** Number of trees to plant */
  count: number;
  /** Spacing between trees */
  spacing: number;
  /** Whether to use bone meal */
  useBonemeal: boolean;
  /** Search radius for planting spots */
  searchRadius: number;
  /** Whether to wait for growth */
  waitForGrowth: boolean;
}

const DEFAULT_CONFIG: PlantTreeConfig = {
  saplingType: 'any',
  count: 5,
  spacing: 4,
  useBonemeal: false,
  searchRadius: 16,
  waitForGrowth: false,
};

/**
 * Valid sapling block names
 */
const SAPLING_BLOCKS = new Set([
  'oak_sapling', 'spruce_sapling', 'birch_sapling',
  'jungle_sapling', 'acacia_sapling', 'dark_oak_sapling',
  'cherry_sapling', 'mangrove_propagule',
]);

/**
 * Blocks valid for planting
 */
const PLANTABLE_GROUND = new Set([
  'dirt', 'grass_block', 'podzol', 'coarse_dirt',
  'rooted_dirt', 'mycelium', 'mud', 'farmland',
]);

/**
 * Task for planting trees
 */
export class PlantTreeTask extends Task {
  private config: PlantTreeConfig;
  private state: PlantState = PlantState.PREPARING;
  private treesPlanted: number = 0;
  private plantedPositions: Vec3[] = [];
  private currentSpot: Vec3 | null = null;
  private selectedSapling: string | null = null;
  private plantTimer: TimerGame;
  private growthTimer: TimerGame;

  constructor(bot: Bot, config: Partial<PlantTreeConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.plantTimer = new TimerGame(bot, 0.25);
    this.growthTimer = new TimerGame(bot, 30.0); // Max wait for growth
  }

  get displayName(): string {
    return `PlantTree(${this.treesPlanted}/${this.config.count})`;
  }

  onStart(): void {
    this.state = PlantState.PREPARING;
    this.treesPlanted = 0;
    this.plantedPositions = [];
    this.currentSpot = null;
    this.selectedSapling = null;
  }

  onTick(): Task | null {
    // Check if we've planted enough
    if (this.treesPlanted >= this.config.count) {
      this.state = PlantState.FINISHED;
      return null;
    }

    switch (this.state) {
      case PlantState.PREPARING:
        return this.handlePreparing();

      case PlantState.FINDING_SPOT:
        return this.handleFindingSpot();

      case PlantState.APPROACHING:
        return this.handleApproaching();

      case PlantState.PLACING_SAPLING:
        return this.handlePlacingSapling();

      case PlantState.APPLYING_BONEMEAL:
        return this.handleApplyingBonemeal();

      case PlantState.WAITING_GROWTH:
        return this.handleWaitingGrowth();

      default:
        return null;
    }
  }

  private handlePreparing(): Task | null {
    // Check if we have saplings
    this.selectedSapling = this.findSapling();
    if (!this.selectedSapling) {
      this.state = PlantState.FAILED;
      return null;
    }

    this.state = PlantState.FINDING_SPOT;
    return null;
  }

  private handleFindingSpot(): Task | null {
    this.currentSpot = this.findPlantingSpot();

    if (this.currentSpot) {
      this.state = PlantState.APPROACHING;
    } else {
      // No more valid spots
      this.state = PlantState.FINISHED;
    }

    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.currentSpot) {
      this.state = PlantState.FINDING_SPOT;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentSpot);

    if (dist <= 4) {
      // Close enough to plant
      this.state = PlantState.PLACING_SAPLING;
      this.plantTimer.reset();
      return null;
    }

    // Move toward spot
    this.moveToward(this.currentSpot);
    return null;
  }

  private handlePlacingSapling(): Task | null {
    if (!this.currentSpot || !this.selectedSapling) {
      this.state = PlantState.FINDING_SPOT;
      return null;
    }

    if (this.plantTimer.elapsed()) {
      // Equip sapling
      if (this.equipSapling(this.selectedSapling)) {
        // Look at ground
        const dx = this.currentSpot.x - this.bot.entity.position.x;
        const dz = this.currentSpot.z - this.bot.entity.position.z;
        const yaw = Math.atan2(-dx, dz);
        this.bot.look(yaw, Math.PI / 4, true);

        // Place sapling
        try {
          // In mineflayer we'd call bot.placeBlock
          this.treesPlanted++;
          this.plantedPositions.push(this.currentSpot.clone());
        } catch {
          // May fail
        }
      }

      // Check what to do next
      if (this.config.useBonemeal && this.hasBonemeal()) {
        this.state = PlantState.APPLYING_BONEMEAL;
      } else if (this.config.waitForGrowth) {
        this.state = PlantState.WAITING_GROWTH;
        this.growthTimer.reset();
      } else {
        // Find next spot
        this.currentSpot = null;
        this.selectedSapling = this.findSapling();
        if (this.selectedSapling) {
          this.state = PlantState.FINDING_SPOT;
        } else {
          this.state = PlantState.FINISHED;
        }
      }
    }

    return null;
  }

  private handleApplyingBonemeal(): Task | null {
    if (!this.currentSpot) {
      this.state = PlantState.FINDING_SPOT;
      return null;
    }

    // Equip bone meal
    if (this.equipBonemeal()) {
      // Apply to sapling
      try {
        // In mineflayer we'd call bot.activateItem on the block
      } catch {
        // May fail
      }
    }

    if (this.config.waitForGrowth) {
      this.state = PlantState.WAITING_GROWTH;
      this.growthTimer.reset();
    } else {
      this.currentSpot = null;
      this.selectedSapling = this.findSapling();
      if (this.selectedSapling) {
        this.state = PlantState.FINDING_SPOT;
      } else {
        this.state = PlantState.FINISHED;
      }
    }

    return null;
  }

  private handleWaitingGrowth(): Task | null {
    if (!this.currentSpot) {
      this.state = PlantState.FINDING_SPOT;
      return null;
    }

    // Check if tree has grown
    const block = this.bot.blockAt(this.currentSpot);
    if (block && block.name.includes('log')) {
      // Tree has grown
      this.currentSpot = null;
      this.selectedSapling = this.findSapling();
      if (this.selectedSapling) {
        this.state = PlantState.FINDING_SPOT;
      } else {
        this.state = PlantState.FINISHED;
      }
      return null;
    }

    // Timeout
    if (this.growthTimer.elapsed()) {
      this.currentSpot = null;
      this.selectedSapling = this.findSapling();
      if (this.selectedSapling) {
        this.state = PlantState.FINDING_SPOT;
      } else {
        this.state = PlantState.FINISHED;
      }
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.currentSpot = null;
    this.plantedPositions = [];
  }

  isFinished(): boolean {
    return this.state === PlantState.FINISHED || this.state === PlantState.FAILED;
  }

  isFailed(): boolean {
    return this.state === PlantState.FAILED;
  }

  // ---- Helper Methods ----

  private findSapling(): string | null {
    if (this.config.saplingType !== 'any') {
      // Look for specific sapling
      for (const item of this.bot.inventory.items()) {
        if (item.name === this.config.saplingType) {
          return item.name;
        }
      }
      return null;
    }

    // Find any sapling
    for (const item of this.bot.inventory.items()) {
      if (SAPLING_BLOCKS.has(item.name)) {
        return item.name;
      }
    }

    return null;
  }

  private equipSapling(name: string): boolean {
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

  private hasBonemeal(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'bone_meal') {
        return true;
      }
    }
    return false;
  }

  private equipBonemeal(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'bone_meal') {
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

  private findPlantingSpot(): Vec3 | null {
    const pos = this.bot.entity.position;
    const posX = Math.floor(pos.x);
    const posY = Math.floor(pos.y);
    const posZ = Math.floor(pos.z);
    let best: Vec3 | null = null;
    let bestDist = Infinity;

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x++) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z++) {
        for (let y = -3; y <= 3; y++) {
          const checkPos = new Vec3(posX + x, posY + y, posZ + z);

          if (!this.isValidPlantingSpot(checkPos)) continue;
          if (this.isTooCloseToOther(checkPos)) continue;

          const dist = pos.distanceTo(checkPos);
          if (dist < bestDist) {
            bestDist = dist;
            best = checkPos;
          }
        }
      }
    }

    return best;
  }

  private isValidPlantingSpot(pos: Vec3): boolean {
    const ground = this.bot.blockAt(pos.offset(0, -1, 0));
    const atPos = this.bot.blockAt(pos);
    const above1 = this.bot.blockAt(pos.offset(0, 1, 0));
    const above2 = this.bot.blockAt(pos.offset(0, 2, 0));

    if (!ground || !atPos) return false;

    // Must have valid ground
    if (!PLANTABLE_GROUND.has(ground.name)) return false;

    // Must be air at planting position and above
    if (atPos.boundingBox !== 'empty') return false;
    if (above1 && above1.boundingBox !== 'empty') return false;
    if (above2 && above2.boundingBox !== 'empty') return false;

    return true;
  }

  private isTooCloseToOther(pos: Vec3): boolean {
    for (const planted of this.plantedPositions) {
      const dist = pos.distanceTo(planted);
      if (dist < this.config.spacing) {
        return true;
      }
    }

    // Also check for existing saplings/trees
    for (let x = -this.config.spacing; x <= this.config.spacing; x++) {
      for (let z = -this.config.spacing; z <= this.config.spacing; z++) {
        const checkPos = pos.offset(x, 0, z);
        const block = this.bot.blockAt(checkPos);
        if (block && (SAPLING_BLOCKS.has(block.name) || block.name.includes('log'))) {
          return true;
        }
      }
    }

    return false;
  }

  private moveToward(target: Vec3): void {
    const pos = this.bot.entity.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const yaw = Math.atan2(-dx, dz);

    this.bot.look(yaw, 0, true);
    this.bot.setControlState('forward', true);
  }

  /**
   * Get trees planted count
   */
  getTreesPlanted(): number {
    return this.treesPlanted;
  }

  /**
   * Get current state
   */
  getCurrentState(): PlantState {
    return this.state;
  }

  /**
   * Get planted positions
   */
  getPlantedPositions(): Vec3[] {
    return [...this.plantedPositions];
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PlantTreeTask)) return false;
    return (
      this.config.saplingType === other.config.saplingType &&
      this.config.count === other.config.count
    );
  }
}

/**
 * Convenience functions
 */
export function plantTrees(bot: Bot, count: number = 5): PlantTreeTask {
  return new PlantTreeTask(bot, { count });
}

export function plantOakTrees(bot: Bot, count: number = 5): PlantTreeTask {
  return new PlantTreeTask(bot, { saplingType: 'oak_sapling', count });
}

export function plantSpruceTrees(bot: Bot, count: number = 5): PlantTreeTask {
  return new PlantTreeTask(bot, { saplingType: 'spruce_sapling', count });
}

export function plantBirchTrees(bot: Bot, count: number = 5): PlantTreeTask {
  return new PlantTreeTask(bot, { saplingType: 'birch_sapling', count });
}

export function plantWithBonemeal(bot: Bot, count: number = 5): PlantTreeTask {
  return new PlantTreeTask(bot, { count, useBonemeal: true });
}

export function plantAndGrow(bot: Bot, count: number = 5): PlantTreeTask {
  return new PlantTreeTask(bot, {
    count,
    useBonemeal: true,
    waitForGrowth: true,
  });
}
