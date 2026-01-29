/**
 * SleepTask - Bed Sleeping Automation
 * Based on AltoClef patterns
 *
 * Handles finding beds, sleeping through the night,
 * and setting spawn points.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask } from '../concrete/GetToBlockTask';
import { InteractBlockTask } from '../concrete/InteractBlockTask';
import { PlaceBlockTask } from '../concrete/PlaceBlockTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for sleeping
 */
enum SleepState {
  CHECKING_TIME,
  FINDING_BED,
  APPROACHING,
  PLACING_BED,
  ENTERING_BED,
  SLEEPING,
  WAKING,
  FINISHED,
  FAILED
}

/**
 * Configuration for sleeping
 */
export interface SleepConfig {
  /** Search radius for existing bed */
  searchRadius: number;
  /** Place bed if not found */
  placeBedIfNeeded: boolean;
  /** Only sleep at night */
  onlyAtNight: boolean;
  /** Set spawn point at bed */
  setSpawn: boolean;
  /** Wait for full sleep cycle */
  waitForMorning: boolean;
}

const DEFAULT_CONFIG: SleepConfig = {
  searchRadius: 32,
  placeBedIfNeeded: true,
  onlyAtNight: true,
  setSpawn: true,
  waitForMorning: true,
};

/**
 * Bed block names
 */
const BED_BLOCKS = [
  'white_bed', 'orange_bed', 'magenta_bed', 'light_blue_bed',
  'yellow_bed', 'lime_bed', 'pink_bed', 'gray_bed',
  'light_gray_bed', 'cyan_bed', 'purple_bed', 'blue_bed',
  'brown_bed', 'green_bed', 'red_bed', 'black_bed',
];

/**
 * Task for sleeping in beds
 */
export class SleepTask extends Task {
  private config: SleepConfig;
  private state: SleepState = SleepState.CHECKING_TIME;
  private bedPos: Vec3 | null = null;
  private sleepTimer: TimerGame;
  private isSleeping: boolean = false;

  constructor(bot: Bot, config: Partial<SleepConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sleepTimer = new TimerGame(bot, 1.0);
  }

  get displayName(): string {
    return `Sleep(${SleepState[this.state]})`;
  }

  onStart(): void {
    this.state = SleepState.CHECKING_TIME;
    this.bedPos = null;
    this.isSleeping = false;
  }

  onTick(): Task | null {
    switch (this.state) {
      case SleepState.CHECKING_TIME:
        return this.handleCheckingTime();

      case SleepState.FINDING_BED:
        return this.handleFindingBed();

      case SleepState.APPROACHING:
        return this.handleApproaching();

      case SleepState.PLACING_BED:
        return this.handlePlacingBed();

      case SleepState.ENTERING_BED:
        return this.handleEnteringBed();

      case SleepState.SLEEPING:
        return this.handleSleeping();

      case SleepState.WAKING:
        return this.handleWaking();

      default:
        return null;
    }
  }

  private handleCheckingTime(): Task | null {
    // Check if it's night time
    if (this.config.onlyAtNight && !this.isNightTime()) {
      this.state = SleepState.FAILED;
      return null;
    }

    this.state = SleepState.FINDING_BED;
    return null;
  }

  private handleFindingBed(): Task | null {
    this.bedPos = this.findBed();

    if (this.bedPos) {
      this.state = SleepState.APPROACHING;
      return null;
    }

    // No bed found
    if (this.config.placeBedIfNeeded && this.hasBedItem()) {
      this.state = SleepState.PLACING_BED;
      return null;
    }

    this.state = SleepState.FAILED;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.bedPos) {
      this.state = SleepState.FINDING_BED;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.bedPos);
    if (dist <= 3.0) {
      this.state = SleepState.ENTERING_BED;
      return null;
    }

    return new GetToBlockTask(
      this.bot,
      Math.floor(this.bedPos.x),
      Math.floor(this.bedPos.y),
      Math.floor(this.bedPos.z)
    );
  }

  private handlePlacingBed(): Task | null {
    // Find a suitable spot to place bed
    const placePos = this.findBedPlacementSpot();
    if (!placePos) {
      this.state = SleepState.FAILED;
      return null;
    }

    const bedItem = this.findBedItem();
    if (!bedItem) {
      this.state = SleepState.FAILED;
      return null;
    }

    // Place the bed
    this.bedPos = placePos;
    this.state = SleepState.APPROACHING;

    return new PlaceBlockTask(
      this.bot,
      Math.floor(placePos.x),
      Math.floor(placePos.y),
      Math.floor(placePos.z),
      bedItem.name
    );
  }

  private handleEnteringBed(): Task | null {
    if (!this.bedPos) {
      this.state = SleepState.FINDING_BED;
      return null;
    }

    // Check if already sleeping
    if (this.isBotSleeping()) {
      this.isSleeping = true;
      this.state = SleepState.SLEEPING;
      this.sleepTimer.reset();
      return null;
    }

    // Right-click bed to enter
    return new InteractBlockTask(
      this.bot,
      Math.floor(this.bedPos.x),
      Math.floor(this.bedPos.y),
      Math.floor(this.bedPos.z)
    );
  }

  private handleSleeping(): Task | null {
    // Check if still sleeping
    if (!this.isBotSleeping()) {
      this.state = SleepState.WAKING;
      return null;
    }

    // Check if it's morning
    if (!this.config.waitForMorning || this.isMorning()) {
      // Leave bed
      try {
        this.bot.wake();
      } catch {
        // May fail
      }
      this.state = SleepState.WAKING;
    }

    return null;
  }

  private handleWaking(): Task | null {
    this.isSleeping = false;
    this.state = SleepState.FINISHED;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Wake up if sleeping
    if (this.isSleeping) {
      try {
        this.bot.wake();
      } catch {
        // May fail
      }
    }
    this.bedPos = null;
    this.isSleeping = false;
  }

  isFinished(): boolean {
    return this.state === SleepState.FINISHED || this.state === SleepState.FAILED;
  }

  isFailed(): boolean {
    return this.state === SleepState.FAILED;
  }

  // ---- Helper Methods ----

  private isNightTime(): boolean {
    const time = this.bot.time.timeOfDay;
    // Night is roughly 12500-23500 ticks
    return time >= 12500 && time <= 23500;
  }

  private isMorning(): boolean {
    const time = this.bot.time.timeOfDay;
    // Morning is roughly 0-1000 ticks
    return time >= 0 && time <= 1000;
  }

  private isBotSleeping(): boolean {
    const bot = this.bot as any;
    return bot.isSleeping === true;
  }

  private findBed(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    let nearest: Vec3 | null = null;
    let nearestDist = Infinity;

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x += 2) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z += 2) {
        for (let y = -10; y <= 10; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block || !this.isBedBlock(block.name)) continue;

          const dist = playerPos.distanceTo(pos);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = pos.clone();
          }
        }
      }
    }

    return nearest;
  }

  private isBedBlock(blockName: string): boolean {
    return BED_BLOCKS.includes(blockName) || blockName.endsWith('_bed');
  }

  private hasBedItem(): boolean {
    return this.findBedItem() !== null;
  }

  private findBedItem(): any | null {
    for (const item of this.bot.inventory.items()) {
      if (item.name.endsWith('_bed')) {
        return item;
      }
    }
    return null;
  }

  private findBedPlacementSpot(): Vec3 | null {
    const playerPos = this.bot.entity.position;

    // Look for flat ground nearby
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        const groundPos = playerPos.offset(x, -1, z);
        const ground = this.bot.blockAt(groundPos);

        if (!ground || ground.boundingBox === 'empty') continue;

        // Check space above
        const bedPos = playerPos.offset(x, 0, z);
        const above = this.bot.blockAt(bedPos);
        const above2 = this.bot.blockAt(bedPos.offset(0, 1, 0));

        if (above && above.boundingBox === 'empty' &&
            above2 && above2.boundingBox === 'empty') {
          return bedPos;
        }
      }
    }

    return null;
  }

  /**
   * Check if currently sleeping
   */
  isCurrentlySleeping(): boolean {
    return this.isSleeping;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof SleepTask)) return false;

    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Convenience functions
 */
export function sleepInBed(bot: Bot): SleepTask {
  return new SleepTask(bot);
}

export function sleepNow(bot: Bot): SleepTask {
  return new SleepTask(bot, { onlyAtNight: false });
}

export function setSpawnAndSleep(bot: Bot): SleepTask {
  return new SleepTask(bot, { setSpawn: true });
}

export function sleepWithoutPlacing(bot: Bot): SleepTask {
  return new SleepTask(bot, { placeBedIfNeeded: false });
}
