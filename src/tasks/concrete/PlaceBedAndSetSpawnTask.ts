/**
 * PlaceBedAndSetSpawnTask - Bed Placement and Spawn Setting
 * Based on BaritonePlus's PlaceBedAndSetSpawnTask.java
 *
 * WHY: Beds are critical for Minecraft survival - they set spawn points
 * and allow sleeping through the night to skip hostile mob spawns.
 * This task handles finding beds, placing new ones, and sleeping.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { PlaceBlockTask } from './PlaceBlockTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';
import { Dimension } from './ResourceTask';

/**
 * State for bed task
 */
export enum BedState {
  FINDING_BED,
  APPROACHING,
  SLEEPING,
  WAITING_FOR_SLEEP,
  PLACING_BED,
  FINDING_PLACE_LOCATION,
  WANDERING,
  FINISHED,
  FAILED
}

/**
 * Configuration for PlaceBedAndSetSpawnTask
 */
export interface BedTaskConfig {
  /** Whether to stay in bed until morning */
  stayInBed: boolean;
  /** Timeout for sleeping interaction */
  sleepTimeout: number;
  /** Whether to place a bed if none found */
  placeBedIfMissing: boolean;
}

const DEFAULT_CONFIG: BedTaskConfig = {
  stayInBed: false,
  sleepTimeout: 5,
  placeBedIfMissing: false,
};

/**
 * Bed block names
 */
export const BED_BLOCKS = [
  'white_bed', 'orange_bed', 'magenta_bed', 'light_blue_bed',
  'yellow_bed', 'lime_bed', 'pink_bed', 'gray_bed',
  'light_gray_bed', 'cyan_bed', 'purple_bed', 'blue_bed',
  'brown_bed', 'green_bed', 'red_bed', 'black_bed'
];

/**
 * Task to find or place a bed and sleep in it.
 *
 * WHY: Setting spawn points prevents losing progress on death.
 * Sleeping skips the night and prevents hostile mob spawns.
 * This is essential for both survival and speedruns.
 *
 * Based on BaritonePlus PlaceBedAndSetSpawnTask.java
 */
export class PlaceBedAndSetSpawnTask extends Task {
  private config: BedTaskConfig;
  private state: BedState = BedState.FINDING_BED;
  private currentBedPos: Vec3 | null = null;
  private sleepTimer: TimerGame;
  private progressChecker: MovementProgressChecker;
  private spawnSet: boolean = false;
  private sleepAttempted: boolean = false;

  constructor(bot: Bot, config: Partial<BedTaskConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sleepTimer = new TimerGame(bot, this.config.sleepTimeout);
    this.progressChecker = new MovementProgressChecker(bot);
  }

  get displayName(): string {
    return 'PlaceBedAndSetSpawn';
  }

  onStart(): void {
    this.state = BedState.FINDING_BED;
    this.currentBedPos = null;
    this.spawnSet = false;
    this.sleepAttempted = false;
    this.progressChecker.reset();
  }

  onTick(): Task | null {
    // Check dimension - beds explode in nether/end
    if (this.getCurrentDimension() !== Dimension.OVERWORLD) {
      this.state = BedState.FAILED;
      return null;
    }

    // Check if we're sleeping
    if (this.isSleeping()) {
      this.spawnSet = true;
      this.state = BedState.WAITING_FOR_SLEEP;
      return null;
    }

    switch (this.state) {
      case BedState.FINDING_BED:
        return this.handleFindingBed();

      case BedState.APPROACHING:
        return this.handleApproaching();

      case BedState.SLEEPING:
        return this.handleSleeping();

      case BedState.WAITING_FOR_SLEEP:
        return this.handleWaitingForSleep();

      case BedState.FINDING_PLACE_LOCATION:
        return this.handleFindingPlaceLocation();

      case BedState.PLACING_BED:
        return this.handlePlacingBed();

      case BedState.WANDERING:
        return this.handleWandering();

      default:
        return null;
    }
  }

  private handleFindingBed(): Task | null {
    // Look for existing beds
    const bed = this.findNearestBed();

    if (bed) {
      this.currentBedPos = bed;
      this.state = BedState.APPROACHING;
      return null;
    }

    // No bed found - check if we have one to place
    if (this.config.placeBedIfMissing && this.hasBedInInventory()) {
      this.state = BedState.FINDING_PLACE_LOCATION;
      return null;
    }

    // No bed and can't place one
    this.state = BedState.WANDERING;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.currentBedPos) {
      this.state = BedState.FINDING_BED;
      return null;
    }

    // Check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      this.currentBedPos = null;
      this.state = BedState.FINDING_BED;
      this.progressChecker.reset();
      return null;
    }

    // Verify bed still exists
    const block = this.bot.blockAt(this.currentBedPos);
    if (!block || !this.isBedBlock(block)) {
      this.currentBedPos = null;
      this.state = BedState.FINDING_BED;
      return null;
    }

    // Check if close enough to interact
    const dist = this.bot.entity.position.distanceTo(this.currentBedPos);
    if (dist <= 3) {
      this.state = BedState.SLEEPING;
      this.sleepTimer.reset();
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.currentBedPos.x),
      Math.floor(this.currentBedPos.y),
      Math.floor(this.currentBedPos.z),
      2
    );
  }

  private handleSleeping(): Task | null {
    if (!this.currentBedPos) {
      this.state = BedState.FINDING_BED;
      return null;
    }

    // Try to sleep
    const block = this.bot.blockAt(this.currentBedPos);
    if (block && this.isBedBlock(block)) {
      try {
        this.bot.activateBlock(block);
        this.sleepAttempted = true;
      } catch {
        // Sleep failed - might be daytime or monsters nearby
      }
    }

    // Check for sleep success
    if (this.isSleeping()) {
      this.spawnSet = true;
      this.state = BedState.WAITING_FOR_SLEEP;
      return null;
    }

    // Check timeout
    if (this.sleepAttempted && this.sleepTimer.elapsed()) {
      // Assume spawn was set even without sleeping message
      this.spawnSet = true;
      this.state = BedState.FINISHED;
      return null;
    }

    return null;
  }

  private handleWaitingForSleep(): Task | null {
    // Wait until we stop sleeping
    if (!this.isSleeping()) {
      this.state = BedState.FINISHED;
      return null;
    }

    // Stay in bed if configured
    if (!this.config.stayInBed) {
      // Leave bed
      try {
        this.bot.wake();
      } catch {
        // Couldn't wake - will finish anyway
      }
      this.state = BedState.FINISHED;
    }

    return null;
  }

  private handleFindingPlaceLocation(): Task | null {
    // Find a suitable location to place a bed
    const placePos = this.findBedPlaceLocation();

    if (placePos) {
      this.currentBedPos = placePos;
      this.state = BedState.PLACING_BED;
      return null;
    }

    // No suitable location, wander
    this.state = BedState.WANDERING;
    return null;
  }

  private handlePlacingBed(): Task | null {
    if (!this.currentBedPos) {
      this.state = BedState.FINDING_PLACE_LOCATION;
      return null;
    }

    // Check if bed was placed
    const block = this.bot.blockAt(this.currentBedPos);
    if (block && this.isBedBlock(block)) {
      this.state = BedState.APPROACHING;
      return null;
    }

    // Place the bed
    const bedItem = this.getBedFromInventory();
    if (!bedItem) {
      this.state = BedState.FAILED;
      return null;
    }

    return new PlaceBlockTask(
      this.bot,
      Math.floor(this.currentBedPos.x),
      Math.floor(this.currentBedPos.y),
      Math.floor(this.currentBedPos.z),
      bedItem
    );
  }

  private handleWandering(): Task | null {
    // Check for beds while wandering
    const bed = this.findNearestBed();
    if (bed) {
      this.currentBedPos = bed;
      this.state = BedState.APPROACHING;
      return null;
    }

    return new TimeoutWanderTask(this.bot, 10);
  }

  onStop(interruptTask: ITask | null): void {
    this.currentBedPos = null;
  }

  isFinished(): boolean {
    return this.state === BedState.FINISHED ||
           this.state === BedState.FAILED;
  }

  isFailed(): boolean {
    return this.state === BedState.FAILED;
  }

  /**
   * Check if spawn point was set
   */
  isSpawnSet(): boolean {
    return this.spawnSet;
  }

  // ---- Helper methods ----

  private findNearestBed(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const searchRadius = 40;

    let nearest: Vec3 | null = null;
    let nearestDist = Infinity;

    for (let r = 1; r <= searchRadius; r++) {
      for (let x = -r; x <= r; x++) {
        for (let y = -Math.min(r, 16); y <= Math.min(r, 16); y++) {
          for (let z = -r; z <= r; z++) {
            if (Math.abs(x) !== r && Math.abs(y) !== r && Math.abs(z) !== r) continue;

            const checkPos = new Vec3(
              Math.floor(playerPos.x) + x,
              Math.floor(playerPos.y) + y,
              Math.floor(playerPos.z) + z
            );

            const block = this.bot.blockAt(checkPos);
            if (block && this.isBedBlock(block)) {
              const dist = playerPos.distanceTo(checkPos);
              if (dist < nearestDist) {
                nearestDist = dist;
                nearest = checkPos;
              }
            }
          }
        }
      }

      if (nearest) break;
    }

    return nearest;
  }

  private findBedPlaceLocation(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const searchRadius = 10;

    for (let r = 1; r <= searchRadius; r++) {
      for (let x = -r; x <= r; x++) {
        for (let y = -2; y <= 2; y++) {
          for (let z = -r; z <= r; z++) {
            const checkPos = new Vec3(
              Math.floor(playerPos.x) + x,
              Math.floor(playerPos.y) + y,
              Math.floor(playerPos.z) + z
            );

            if (this.canPlaceBedAt(checkPos)) {
              return checkPos;
            }
          }
        }
      }
    }

    return null;
  }

  private canPlaceBedAt(pos: Vec3): boolean {
    // Need 2 blocks horizontal space and solid ground below
    const block1 = this.bot.blockAt(pos);
    const block2 = this.bot.blockAt(pos.offset(1, 0, 0));
    const below1 = this.bot.blockAt(pos.offset(0, -1, 0));
    const below2 = this.bot.blockAt(pos.offset(1, -1, 0));

    // Check if space is clear
    if (!block1 || block1.boundingBox !== 'empty') return false;
    if (!block2 || block2.boundingBox !== 'empty') return false;

    // Check if ground is solid
    if (!below1 || below1.boundingBox !== 'block') return false;
    if (!below2 || below2.boundingBox !== 'block') return false;

    return true;
  }

  private isBedBlock(block: Block): boolean {
    return BED_BLOCKS.includes(block.name);
  }

  private hasBedInInventory(): boolean {
    return this.bot.inventory.items().some(item =>
      BED_BLOCKS.some(bed => item.name.includes('bed'))
    );
  }

  private getBedFromInventory(): string | null {
    const bedItem = this.bot.inventory.items().find(item =>
      item.name.includes('bed')
    );
    return bedItem ? bedItem.name : null;
  }

  private isSleeping(): boolean {
    return (this.bot as any).isSleeping === true;
  }

  private getCurrentDimension(): Dimension {
    const dimensionName = (this.bot as any).game?.dimension ?? 'minecraft:overworld';
    if (dimensionName.includes('nether')) return Dimension.NETHER;
    if (dimensionName.includes('end')) return Dimension.END;
    return Dimension.OVERWORLD;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PlaceBedAndSetSpawnTask)) return false;
    return this.config.stayInBed === other.config.stayInBed;
  }
}

/**
 * Helper to place bed and set spawn
 */
export function placeBedAndSetSpawn(bot: Bot, stayInBed: boolean = false): PlaceBedAndSetSpawnTask {
  return new PlaceBedAndSetSpawnTask(bot, { stayInBed });
}
