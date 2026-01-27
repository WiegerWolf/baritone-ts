import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { BaseProcess, ProcessPriority, ProcessTickResult, ProcessState } from './Process';
import { Goal } from '../types';
import { GoalFollow, GoalNear } from '../goals';

/**
 * FollowProcess handles following entities (players, mobs)
 * Based on Baritone's FollowProcess
 *
 * Features:
 * - Follow players by name
 * - Follow entities by type
 * - Configurable follow distance
 * - Sprint when target is far
 * - Stop when close enough
 */

/**
 * Follow configuration
 */
export interface FollowConfig {
  // Target entity (player name or entity)
  target: string | Entity | null;
  // Minimum distance to maintain
  minDistance: number;
  // Maximum distance before sprinting
  maxDistance: number;
  // Distance at which to give up
  giveUpDistance: number;
  // Should sprint to catch up
  allowSprint: boolean;
  // Follow through portals
  followThroughPortals: boolean;
}

const DEFAULT_CONFIG: FollowConfig = {
  target: null,
  minDistance: 2,
  maxDistance: 10,
  giveUpDistance: 128,
  allowSprint: true,
  followThroughPortals: false
};

export class FollowProcess extends BaseProcess {
  readonly displayName = 'Follow';

  private config: FollowConfig;
  private targetEntity: Entity | null = null;
  private lastKnownPosition: Vec3 | null = null;
  private ticksSinceLastSeen: number = 0;

  constructor(bot: Bot, pathfinder: any, config: Partial<FollowConfig> = {}) {
    super(bot, pathfinder, ProcessPriority.NORMAL);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set target to follow
   */
  setTarget(target: string | Entity): void {
    if (typeof target === 'string') {
      this.config.target = target;
      this.targetEntity = null;
    } else {
      this.config.target = target;
      this.targetEntity = target;
    }
  }

  /**
   * Set follow distance
   */
  setFollowDistance(min: number, max?: number): void {
    this.config.minDistance = min;
    if (max !== undefined) {
      this.config.maxDistance = max;
    }
  }

  /**
   * Set give up distance
   */
  setGiveUpDistance(distance: number): void {
    this.config.giveUpDistance = distance;
  }

  onActivate(): void {
    super.onActivate();
    this.ticksSinceLastSeen = 0;
    this.resolveTarget();
  }

  onDeactivate(): void {
    super.onDeactivate();
    this.targetEntity = null;
    this.lastKnownPosition = null;
  }

  tick(): ProcessTickResult {
    // Resolve target if needed
    if (!this.targetEntity) {
      this.resolveTarget();
    }

    // Check if we have a target
    if (!this.targetEntity) {
      // Check if we have a last known position
      if (this.lastKnownPosition) {
        this.ticksSinceLastSeen++;

        // Give up after too long
        if (this.ticksSinceLastSeen > 200) { // 10 seconds
          return this.failedResult('Lost target');
        }

        // Go to last known position
        const goal = new GoalNear(
          this.lastKnownPosition.x,
          this.lastKnownPosition.y,
          this.lastKnownPosition.z,
          this.config.minDistance
        );

        return this.newGoalResult(goal, 'Going to last known position');
      }

      return this.failedResult('No target to follow');
    }

    // Update last known position
    this.lastKnownPosition = this.targetEntity.position.clone();
    this.ticksSinceLastSeen = 0;

    // Check distance to target
    const distance = this.bot.entity.position.distanceTo(this.targetEntity.position);

    // Check if target is too far
    if (distance > this.config.giveUpDistance) {
      return this.failedResult('Target too far away');
    }

    // Check if we're close enough
    if (distance <= this.config.minDistance) {
      // Close enough, just wait
      return this.waitResult('Following (close)');
    }

    // Create goal to follow
    const goal = new GoalFollow(this.targetEntity, this.config.minDistance);

    // Determine status
    let status = `Following ${this.getTargetName()}`;
    if (distance > this.config.maxDistance && this.config.allowSprint) {
      status += ' (sprinting)';
    }

    return this.newGoalResult(goal, status);
  }

  /**
   * Resolve target from config
   */
  private resolveTarget(): void {
    if (!this.config.target) {
      this.targetEntity = null;
      return;
    }

    if (typeof this.config.target === 'string') {
      // Find player by name
      const player = this.bot.players[this.config.target];
      if (player && player.entity) {
        this.targetEntity = player.entity;
      } else {
        this.targetEntity = null;
      }
    } else {
      // Direct entity reference
      this.targetEntity = this.config.target;

      // Validate entity is still valid
      if (!this.targetEntity.isValid) {
        this.targetEntity = null;
      }
    }
  }

  /**
   * Get target entity
   */
  getTarget(): Entity | null {
    return this.targetEntity;
  }

  /**
   * Get target name for display
   */
  getTargetName(): string {
    if (typeof this.config.target === 'string') {
      return this.config.target;
    }
    if (this.targetEntity) {
      return this.targetEntity.name || this.targetEntity.type || 'entity';
    }
    return 'unknown';
  }

  /**
   * Get current distance to target
   */
  getDistanceToTarget(): number {
    if (!this.targetEntity) return Infinity;
    return this.bot.entity.position.distanceTo(this.targetEntity.position);
  }

  /**
   * Check if target is in range
   */
  isTargetInRange(): boolean {
    const distance = this.getDistanceToTarget();
    return distance <= this.config.minDistance;
  }
}
