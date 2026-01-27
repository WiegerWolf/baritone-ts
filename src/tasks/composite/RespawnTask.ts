/**
 * RespawnTask - Death and Respawn Handling
 * Based on AltoClef death recovery patterns
 *
 * Handles respawn logic and returning to death location
 * to recover items.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for respawn handling
 */
enum RespawnState {
  CHECKING_STATUS,
  DEAD,
  WAITING_RESPAWN,
  RESPAWNED,
  GOING_TO_DEATH,
  COLLECTING_ITEMS,
  FINISHED,
  FAILED
}

/**
 * Configuration for respawn handling
 */
export interface RespawnConfig {
  /** Whether to return to death location */
  returnToDeathLocation: boolean;
  /** Time to wait at death location for items (seconds) */
  itemCollectionTime: number;
  /** Maximum time to travel to death location (seconds) */
  maxTravelTime: number;
  /** Radius around death location to search for items */
  searchRadius: number;
  /** Whether to auto-respawn */
  autoRespawn: boolean;
}

const DEFAULT_CONFIG: RespawnConfig = {
  returnToDeathLocation: true,
  itemCollectionTime: 30,
  maxTravelTime: 300, // 5 minutes
  searchRadius: 16,
  autoRespawn: true,
};

/**
 * Task for handling death and respawn
 */
export class RespawnTask extends Task {
  private config: RespawnConfig;
  private state: RespawnState = RespawnState.CHECKING_STATUS;
  private deathLocation: Vec3 | null = null;
  private respawnTime: number = 0;
  private travelTimer: TimerGame;
  private collectTimer: TimerGame;
  private respawnTimer: TimerGame;

  constructor(bot: Bot, config: Partial<RespawnConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.travelTimer = new TimerGame(bot, this.config.maxTravelTime);
    this.collectTimer = new TimerGame(bot, this.config.itemCollectionTime);
    this.respawnTimer = new TimerGame(bot, 5.0); // Wait up to 5 seconds for respawn
  }

  get displayName(): string {
    return `Respawn(${RespawnState[this.state]})`;
  }

  onStart(): void {
    this.state = RespawnState.CHECKING_STATUS;
    this.respawnTime = 0;
  }

  /**
   * Set death location (should be called when death is detected)
   */
  setDeathLocation(pos: Vec3): void {
    this.deathLocation = pos.clone();
  }

  onTick(): Task | null {
    switch (this.state) {
      case RespawnState.CHECKING_STATUS:
        return this.handleCheckingStatus();

      case RespawnState.DEAD:
        return this.handleDead();

      case RespawnState.WAITING_RESPAWN:
        return this.handleWaitingRespawn();

      case RespawnState.RESPAWNED:
        return this.handleRespawned();

      case RespawnState.GOING_TO_DEATH:
        return this.handleGoingToDeath();

      case RespawnState.COLLECTING_ITEMS:
        return this.handleCollectingItems();

      default:
        return null;
    }
  }

  private handleCheckingStatus(): Task | null {
    // Check if bot is dead
    if (this.isDead()) {
      // Store death location if we have it
      if (!this.deathLocation) {
        this.deathLocation = this.bot.entity.position.clone();
      }
      this.state = RespawnState.DEAD;
    } else {
      // Already alive
      if (this.config.returnToDeathLocation && this.deathLocation) {
        this.state = RespawnState.GOING_TO_DEATH;
        this.travelTimer.reset();
      } else {
        this.state = RespawnState.FINISHED;
      }
    }

    return null;
  }

  private handleDead(): Task | null {
    if (this.config.autoRespawn) {
      // Trigger respawn
      try {
        // In mineflayer, we'd check for respawn screen and click respawn
        // For now, just transition to waiting
      } catch {
        // May fail
      }
    }

    this.state = RespawnState.WAITING_RESPAWN;
    this.respawnTimer.reset();
    return null;
  }

  private handleWaitingRespawn(): Task | null {
    // Check if we've respawned
    if (!this.isDead()) {
      this.respawnTime = Date.now();
      this.state = RespawnState.RESPAWNED;
      return null;
    }

    // Timeout waiting for respawn
    if (this.respawnTimer.elapsed()) {
      this.state = RespawnState.FAILED;
    }

    return null;
  }

  private handleRespawned(): Task | null {
    // Brief pause after respawning
    if (this.config.returnToDeathLocation && this.deathLocation) {
      this.state = RespawnState.GOING_TO_DEATH;
      this.travelTimer.reset();
    } else {
      this.state = RespawnState.FINISHED;
    }

    return null;
  }

  private handleGoingToDeath(): Task | null {
    if (!this.deathLocation) {
      this.state = RespawnState.FINISHED;
      return null;
    }

    // Check travel timeout
    if (this.travelTimer.elapsed()) {
      // Took too long, give up
      this.state = RespawnState.FINISHED;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.deathLocation);

    if (dist <= this.config.searchRadius) {
      // Arrived at death location
      this.state = RespawnState.COLLECTING_ITEMS;
      this.collectTimer.reset();
      return null;
    }

    // Move toward death location
    this.moveToward(this.deathLocation);
    return null;
  }

  private handleCollectingItems(): Task | null {
    // Wait for items to be collected
    // Would normally use PickupItemTask here

    if (this.collectTimer.elapsed()) {
      this.state = RespawnState.FINISHED;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.state === RespawnState.FINISHED || this.state === RespawnState.FAILED;
  }

  isFailed(): boolean {
    return this.state === RespawnState.FAILED;
  }

  // ---- Helper Methods ----

  private isDead(): boolean {
    // Check if bot health is 0 or bot is in death state
    const health = (this.bot as any).health ?? 20;
    return health <= 0;
  }

  private moveToward(target: Vec3): void {
    const pos = this.bot.entity.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const yaw = Math.atan2(-dx, dz);

    this.bot.look(yaw, 0, true);
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);
  }

  /**
   * Get death location
   */
  getDeathLocation(): Vec3 | null {
    return this.deathLocation?.clone() ?? null;
  }

  /**
   * Get current state
   */
  getCurrentState(): RespawnState {
    return this.state;
  }

  /**
   * Check if respawned successfully
   */
  hasRespawned(): boolean {
    return this.state === RespawnState.RESPAWNED ||
           this.state === RespawnState.GOING_TO_DEATH ||
           this.state === RespawnState.COLLECTING_ITEMS ||
           this.state === RespawnState.FINISHED;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return other instanceof RespawnTask;
  }
}

/**
 * Convenience functions
 */
export function handleRespawn(bot: Bot): RespawnTask {
  return new RespawnTask(bot);
}

export function respawnAndRecover(bot: Bot, deathLocation?: Vec3): RespawnTask {
  const task = new RespawnTask(bot, { returnToDeathLocation: true });
  if (deathLocation) {
    task.setDeathLocation(deathLocation);
  }
  return task;
}

export function respawnOnly(bot: Bot): RespawnTask {
  return new RespawnTask(bot, { returnToDeathLocation: false });
}

export function recoverItems(bot: Bot, deathLocation: Vec3): RespawnTask {
  const task = new RespawnTask(bot, {
    returnToDeathLocation: true,
    itemCollectionTime: 60,
  });
  task.setDeathLocation(deathLocation);
  return task;
}
