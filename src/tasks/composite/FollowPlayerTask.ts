/**
 * FollowPlayerTask - Player Following Automation
 * Based on AltoClef patterns
 *
 * Handles following other players, maintaining distance,
 * and responding to player movements.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for following
 */
enum FollowState {
  SEARCHING,
  FOLLOWING,
  WAITING,
  TELEPORTING,
  LOST,
  FINISHED
}

/**
 * Configuration for following
 */
export interface FollowPlayerConfig {
  /** Player name to follow */
  playerName: string;
  /** Minimum distance to maintain */
  minDistance: number;
  /** Maximum distance before running */
  maxDistance: number;
  /** Distance at which player is considered lost */
  lostDistance: number;
  /** Sprint when far */
  sprintWhenFar: boolean;
  /** Stop following after duration (seconds, 0 = forever) */
  duration: number;
  /** Mimic player actions */
  mimicActions: boolean;
  /** Teleport if too far (if possible) */
  teleportIfLost: boolean;
}

const DEFAULT_CONFIG: Partial<FollowPlayerConfig> = {
  minDistance: 2,
  maxDistance: 5,
  lostDistance: 64,
  sprintWhenFar: true,
  duration: 0,
  mimicActions: false,
  teleportIfLost: false,
};

/**
 * Task for following players
 */
export class FollowPlayerTask extends Task {
  private config: FollowPlayerConfig;
  private state: FollowState = FollowState.SEARCHING;
  private targetPlayer: Entity | null = null;
  private updateTimer: TimerGame;
  private durationTimer: TimerGame;
  private lastKnownPos: Vec3 | null = null;
  private lostTime: number = 0;

  constructor(bot: Bot, playerName: string, config: Partial<FollowPlayerConfig> = {}) {
    super(bot);
    this.config = {
      ...DEFAULT_CONFIG,
      playerName,
      ...config
    } as FollowPlayerConfig;
    this.updateTimer = new TimerGame(bot, 0.25);
    this.durationTimer = new TimerGame(bot, this.config.duration || 9999999);
  }

  get displayName(): string {
    if (this.targetPlayer) {
      const dist = Math.round(this.bot.entity.position.distanceTo(this.targetPlayer.position));
      return `Follow(${this.config.playerName}, ${dist}m, ${FollowState[this.state]})`;
    }
    return `Follow(${this.config.playerName}, ${FollowState[this.state]})`;
  }

  onStart(): void {
    this.state = FollowState.SEARCHING;
    this.targetPlayer = null;
    this.lastKnownPos = null;
    this.lostTime = 0;
    this.durationTimer.reset();
  }

  onTick(): Task | null {
    // Check duration
    if (this.config.duration > 0 && this.durationTimer.elapsed()) {
      this.state = FollowState.FINISHED;
      return null;
    }

    // Update target reference
    this.updateTargetPlayer();

    switch (this.state) {
      case FollowState.SEARCHING:
        return this.handleSearching();

      case FollowState.FOLLOWING:
        return this.handleFollowing();

      case FollowState.WAITING:
        return this.handleWaiting();

      case FollowState.TELEPORTING:
        return this.handleTeleporting();

      case FollowState.LOST:
        return this.handleLost();

      default:
        return null;
    }
  }

  private handleSearching(): Task | null {
    if (this.targetPlayer) {
      this.state = FollowState.FOLLOWING;
      this.lastKnownPos = this.targetPlayer.position.clone();
      return null;
    }

    // Player not found yet
    return null;
  }

  private handleFollowing(): Task | null {
    if (!this.targetPlayer) {
      this.state = FollowState.LOST;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.targetPlayer.position);
    this.lastKnownPos = this.targetPlayer.position.clone();

    // Check if lost
    if (dist > this.config.lostDistance) {
      this.state = FollowState.LOST;
      return null;
    }

    // Close enough, wait
    if (dist <= this.config.minDistance) {
      this.state = FollowState.WAITING;
      return null;
    }

    // Need to move closer
    if (!this.updateTimer.elapsed()) {
      return null;
    }
    this.updateTimer.reset();

    // Sprint if far
    if (this.config.sprintWhenFar && dist > this.config.maxDistance) {
      this.bot.setControlState('sprint', true);
    } else {
      this.bot.setControlState('sprint', false);
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.targetPlayer.position.x),
      Math.floor(this.targetPlayer.position.y),
      Math.floor(this.targetPlayer.position.z),
      Math.floor(this.config.minDistance)
    );
  }

  private handleWaiting(): Task | null {
    if (!this.targetPlayer) {
      this.state = FollowState.LOST;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.targetPlayer.position);
    this.lastKnownPos = this.targetPlayer.position.clone();

    // Player moved away
    if (dist > this.config.maxDistance) {
      this.state = FollowState.FOLLOWING;
      return null;
    }

    // Look at player while waiting
    try {
      this.bot.lookAt(this.targetPlayer.position.offset(0, 1.6, 0));
    } catch {
      // May fail
    }

    // Mimic actions if enabled
    if (this.config.mimicActions) {
      this.mimicPlayerActions();
    }

    return null;
  }

  private handleTeleporting(): Task | null {
    // Teleport command would need to be executed
    // This is server-dependent
    this.state = FollowState.SEARCHING;
    return null;
  }

  private handleLost(): Task | null {
    // Try to find player at last known position
    if (this.lastKnownPos) {
      const distToLastPos = this.bot.entity.position.distanceTo(this.lastKnownPos);

      if (distToLastPos > 5) {
        // Go to last known position
        return new GoToNearTask(
          this.bot,
          Math.floor(this.lastKnownPos.x),
          Math.floor(this.lastKnownPos.y),
          Math.floor(this.lastKnownPos.z),
          2
        );
      }
    }

    // Check if player came back
    if (this.targetPlayer) {
      this.state = FollowState.FOLLOWING;
      return null;
    }

    // Still lost
    this.lostTime++;

    // Try teleport if enabled and lost for too long
    if (this.config.teleportIfLost && this.lostTime > 100) {
      this.state = FollowState.TELEPORTING;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.targetPlayer = null;
  }

  isFinished(): boolean {
    return this.state === FollowState.FINISHED;
  }

  isFailed(): boolean {
    return false; // Following doesn't fail, just loses target
  }

  // ---- Helper Methods ----

  private updateTargetPlayer(): void {
    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity.type !== 'player') continue;
      if ((entity as any).username === this.config.playerName) {
        this.targetPlayer = entity;
        return;
      }
    }
    this.targetPlayer = null;
  }

  private mimicPlayerActions(): void {
    if (!this.targetPlayer) return;

    // Mimic sneaking
    const playerMetadata = (this.targetPlayer as any).metadata;
    if (playerMetadata) {
      const isSneaking = playerMetadata[0] & 0x02;
      this.bot.setControlState('sneak', !!isSneaking);
    }
  }

  /**
   * Get target player
   */
  getTargetPlayer(): Entity | null {
    return this.targetPlayer;
  }

  /**
   * Get current state
   */
  getCurrentState(): FollowState {
    return this.state;
  }

  /**
   * Get distance to target
   */
  getDistanceToTarget(): number {
    if (!this.targetPlayer) return Infinity;
    return this.bot.entity.position.distanceTo(this.targetPlayer.position);
  }

  /**
   * Check if currently following
   */
  isFollowing(): boolean {
    return this.state === FollowState.FOLLOWING || this.state === FollowState.WAITING;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof FollowPlayerTask)) return false;

    return this.config.playerName === other.config.playerName;
  }
}

/**
 * Convenience functions
 */
export function followPlayer(bot: Bot, playerName: string): FollowPlayerTask {
  return new FollowPlayerTask(bot, playerName);
}

export function followPlayerClose(bot: Bot, playerName: string): FollowPlayerTask {
  return new FollowPlayerTask(bot, playerName, {
    minDistance: 1,
    maxDistance: 3,
  });
}

export function followPlayerFar(bot: Bot, playerName: string): FollowPlayerTask {
  return new FollowPlayerTask(bot, playerName, {
    minDistance: 5,
    maxDistance: 10,
  });
}

export function followPlayerForDuration(bot: Bot, playerName: string, seconds: number): FollowPlayerTask {
  return new FollowPlayerTask(bot, playerName, { duration: seconds });
}

export function followPlayerWithMimic(bot: Bot, playerName: string): FollowPlayerTask {
  return new FollowPlayerTask(bot, playerName, { mimicActions: true });
}
