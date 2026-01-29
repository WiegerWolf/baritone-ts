/**
 * FishingTask - Automated Fishing
 * Based on AltoClef patterns
 *
 * Handles finding water, casting fishing rod,
 * and collecting caught items.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { EquipTask, EquipmentSlot } from '../concrete/EquipTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for fishing
 */
enum FishingState {
  FINDING_WATER,
  APPROACHING,
  EQUIPPING_ROD,
  CASTING,
  WAITING,
  REELING,
  COLLECTING,
  FINISHED,
  FAILED
}

/**
 * Configuration for fishing
 */
export interface FishingConfig {
  /** Target number of fish to catch */
  targetCount: number;
  /** Search radius for water */
  searchRadius: number;
  /** Maximum time to wait for a bite (seconds) */
  maxWaitTime: number;
  /** Collect dropped items after catching */
  collectItems: boolean;
  /** Specific items to fish for (empty = any) */
  targetItems: string[];
}

const DEFAULT_CONFIG: FishingConfig = {
  targetCount: 10,
  searchRadius: 32,
  maxWaitTime: 45,
  collectItems: true,
  targetItems: [],
};

/**
 * Task for automated fishing
 */
export class FishingTask extends Task {
  private config: FishingConfig;
  private state: FishingState = FishingState.FINDING_WATER;
  private waterPos: Vec3 | null = null;
  private castTimer: TimerGame;
  private waitTimer: TimerGame;
  private caughtCount: number = 0;
  private isFishing: boolean = false;

  constructor(bot: Bot, config: Partial<FishingConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.castTimer = new TimerGame(bot, 1.0);
    this.waitTimer = new TimerGame(bot, this.config.maxWaitTime);
  }

  get displayName(): string {
    return `Fishing(${this.caughtCount}/${this.config.targetCount}, ${FishingState[this.state]})`;
  }

  onStart(): void {
    this.state = FishingState.FINDING_WATER;
    this.waterPos = null;
    this.caughtCount = 0;
    this.isFishing = false;
  }

  onTick(): Task | null {
    // Check if we've caught enough
    if (this.caughtCount >= this.config.targetCount) {
      this.state = FishingState.FINISHED;
      return null;
    }

    switch (this.state) {
      case FishingState.FINDING_WATER:
        return this.handleFindingWater();

      case FishingState.APPROACHING:
        return this.handleApproaching();

      case FishingState.EQUIPPING_ROD:
        return this.handleEquippingRod();

      case FishingState.CASTING:
        return this.handleCasting();

      case FishingState.WAITING:
        return this.handleWaiting();

      case FishingState.REELING:
        return this.handleReeling();

      case FishingState.COLLECTING:
        return this.handleCollecting();

      default:
        return null;
    }
  }

  private handleFindingWater(): Task | null {
    this.waterPos = this.findDeepWater();
    if (!this.waterPos) {
      this.state = FishingState.FAILED;
      return null;
    }

    this.state = FishingState.APPROACHING;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.waterPos) {
      this.state = FishingState.FINDING_WATER;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.waterPos);
    if (dist <= 4.0) {
      this.state = FishingState.EQUIPPING_ROD;
      return null;
    }

    // Get to shore near water
    return new GoToNearTask(
      this.bot,
      Math.floor(this.waterPos.x),
      Math.floor(this.waterPos.y) + 1,
      Math.floor(this.waterPos.z),
      3
    );
  }

  private handleEquippingRod(): Task | null {
    const heldItem = this.bot.heldItem;
    if (heldItem && heldItem.name === 'fishing_rod') {
      this.state = FishingState.CASTING;
      this.castTimer.reset();
      return null;
    }

    const rod = this.findItem('fishing_rod');
    if (!rod) {
      this.state = FishingState.FAILED;
      return null;
    }

    return new EquipTask(this.bot, 'fishing_rod', EquipmentSlot.HAND);
  }

  private handleCasting(): Task | null {
    if (!this.castTimer.elapsed()) {
      return null;
    }

    // Look at water
    if (this.waterPos) {
      this.lookAt(this.waterPos);
    }

    // Cast the line
    try {
      this.bot.activateItem();
      this.isFishing = true;
    } catch {
      // May fail
    }

    this.state = FishingState.WAITING;
    this.waitTimer.reset();
    return null;
  }

  private handleWaiting(): Task | null {
    // Check for bobber state (fish bite)
    const bobber = this.getBobber();

    if (bobber && this.hasFishBite(bobber)) {
      this.state = FishingState.REELING;
      return null;
    }

    // Check timeout
    if (this.waitTimer.elapsed()) {
      // Reel in and recast
      this.reelIn();
      this.state = FishingState.CASTING;
      this.castTimer.reset();
    }

    return null;
  }

  private handleReeling(): Task | null {
    // Reel in the fish
    this.reelIn();
    this.caughtCount++;
    this.isFishing = false;

    if (this.config.collectItems) {
      this.state = FishingState.COLLECTING;
      this.castTimer.reset();
    } else {
      this.state = FishingState.CASTING;
      this.castTimer.reset();
    }

    return null;
  }

  private handleCollecting(): Task | null {
    // Wait briefly for item to land
    if (!this.castTimer.elapsed()) {
      return null;
    }

    // Items should auto-collect if close enough
    // Move back to casting
    this.state = FishingState.CASTING;
    this.castTimer.reset();
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Reel in if fishing
    if (this.isFishing) {
      this.reelIn();
    }
    this.waterPos = null;
    this.isFishing = false;
  }

  isFinished(): boolean {
    return this.state === FishingState.FINISHED || this.state === FishingState.FAILED;
  }

  isFailed(): boolean {
    return this.state === FishingState.FAILED;
  }

  // ---- Helper Methods ----

  private findDeepWater(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    let best: Vec3 | null = null;
    let bestDepth = 0;

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x += 3) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z += 3) {
        for (let y = -5; y <= 5; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block || block.name !== 'water') continue;

          // Check water depth
          const depth = this.getWaterDepth(pos);
          if (depth >= 2 && depth > bestDepth) {
            // Check if accessible from shore
            if (this.hasAdjacentLand(pos)) {
              bestDepth = depth;
              best = pos.clone();
            }
          }
        }
      }
    }

    return best;
  }

  private getWaterDepth(pos: Vec3): number {
    let depth = 0;
    for (let y = 0; y < 10; y++) {
      const block = this.bot.blockAt(pos.offset(0, -y, 0));
      if (!block || block.name !== 'water') break;
      depth++;
    }
    return depth;
  }

  private hasAdjacentLand(waterPos: Vec3): boolean {
    const offsets = [
      new Vec3(1, 1, 0), new Vec3(-1, 1, 0),
      new Vec3(0, 1, 1), new Vec3(0, 1, -1),
    ];

    for (const offset of offsets) {
      const pos = waterPos.plus(offset);
      const block = this.bot.blockAt(pos);
      if (block && block.boundingBox !== 'empty' && block.name !== 'water') {
        return true;
      }
    }

    return false;
  }

  private findItem(itemName: string): any | null {
    return this.bot.inventory.items().find(item => item.name === itemName) ?? null;
  }

  private getBobber(): any | null {
    // Find fishing bobber entity
    for (const entity of Object.values(this.bot.entities)) {
      if (entity && entity.name === 'fishing_bobber') {
        return entity;
      }
    }
    return null;
  }

  private hasFishBite(bobber: any): boolean {
    // Check if bobber is submerged (fish bite)
    if (!bobber || !bobber.position) return false;

    const bobberBlock = this.bot.blockAt(bobber.position);
    if (bobberBlock && bobberBlock.name === 'water') {
      // Check velocity for splash
      if (bobber.velocity && bobber.velocity.y < -0.1) {
        return true;
      }
    }

    return false;
  }

  private reelIn(): void {
    try {
      this.bot.activateItem(); // Right-click again to reel in
    } catch {
      // May fail
    }
    this.isFishing = false;
  }

  private lookAt(pos: Vec3): void {
    try {
      this.bot.lookAt(pos);
    } catch {
      // May fail
    }
  }

  /**
   * Get caught count
   */
  getCaughtCount(): number {
    return this.caughtCount;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof FishingTask)) return false;

    return this.config.targetCount === other.config.targetCount;
  }
}

/**
 * Convenience functions
 */
export function goFishing(bot: Bot, count: number = 10): FishingTask {
  return new FishingTask(bot, { targetCount: count });
}

export function fishUntilFull(bot: Bot): FishingTask {
  return new FishingTask(bot, { targetCount: 64 });
}

export function fishForFood(bot: Bot): FishingTask {
  return new FishingTask(bot, {
    targetCount: 20,
    targetItems: ['cod', 'salmon', 'tropical_fish', 'pufferfish'],
  });
}
