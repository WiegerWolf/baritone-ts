/**
 * DodgeProjectilesTask - Projectile Dodging Task
 * Based on BaritonePlus's DodgeProjectilesTask.java
 *
 * WHY: Skeletons and other ranged attackers are dangerous. Dodging
 * their projectiles significantly reduces damage taken, especially
 * when not yet armored. This task moves the player to avoid incoming
 * arrows and other projectiles.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';

/**
 * Projectile types to dodge
 */
const PROJECTILE_TYPES = [
  'arrow',
  'spectral_arrow',
  'trident',
  'fireball',
  'small_fireball',
  'wither_skull',
  'shulker_bullet',
  'llama_spit',
];

/**
 * Configuration for DodgeProjectilesTask
 */
export interface DodgeProjectilesConfig {
  /** Horizontal dodge distance */
  dodgeDistanceH: number;
  /** Vertical dodge distance */
  dodgeDistanceV: number;
  /** Maximum projectile detection range */
  detectionRange: number;
  /** Minimum time between projectile and player for dodge to trigger */
  reactionTime: number;
}

const DEFAULT_CONFIG: DodgeProjectilesConfig = {
  dodgeDistanceH: 2,
  dodgeDistanceV: 1,
  detectionRange: 32,
  reactionTime: 0.5,
};

/**
 * Task to dodge incoming projectiles.
 *
 * WHY: Taking unnecessary damage wastes resources (food for healing)
 * and can lead to death. By tracking projectile trajectories and
 * moving perpendicular to them, we can avoid most ranged attacks.
 *
 * Based on BaritonePlus DodgeProjectilesTask.java
 */
export class DodgeProjectilesTask extends Task {
  private config: DodgeProjectilesConfig;
  private finished: boolean = false;
  private dodgeDirection: Vec3 | null = null;

  constructor(bot: Bot, config: Partial<DodgeProjectilesConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get displayName(): string {
    return `DodgeProjectiles(${this.config.dodgeDistanceH}m)`;
  }

  onStart(): void {
    this.finished = false;
    this.dodgeDirection = null;
  }

  onTick(): Task | null {
    // Find dangerous projectiles
    const dangerousProjectile = this.findDangerousProjectile();

    if (!dangerousProjectile) {
      // No projectiles to dodge
      this.finished = true;
      return null;
    }

    // Calculate dodge direction
    const dodgeDir = this.calculateDodgeDirection(dangerousProjectile);

    if (!dodgeDir) {
      // Can't determine dodge direction
      this.finished = true;
      return null;
    }

    // Execute dodge movement
    this.executeDodge(dodgeDir);

    return null;
  }

  private findDangerousProjectile(): Entity | null {
    const playerPos = this.bot.entity.position;
    const playerVelocity = this.bot.entity.velocity ?? new Vec3(0, 0, 0);

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;

      // Check if it's a projectile
      const entityName = entity.name ?? entity.type;
      if (!PROJECTILE_TYPES.some(type => entityName?.includes(type))) continue;

      // Check distance
      const dist = playerPos.distanceTo(entity.position);
      if (dist > this.config.detectionRange) continue;

      // Check if projectile is heading toward player
      if (this.isProjectileHeadingTowardPlayer(entity)) {
        return entity;
      }
    }

    return null;
  }

  private isProjectileHeadingTowardPlayer(projectile: Entity): boolean {
    const playerPos = this.bot.entity.position;
    const projectilePos = projectile.position;
    const projectileVelocity = projectile.velocity ?? new Vec3(0, 0, 0);

    // If no velocity, can't predict
    if (projectileVelocity.norm() < 0.01) return false;

    // Vector from projectile to player
    const toPlayer = playerPos.minus(projectilePos);

    // Normalize velocity
    const velNorm = projectileVelocity.norm();
    const velDir = new Vec3(
      projectileVelocity.x / velNorm,
      projectileVelocity.y / velNorm,
      projectileVelocity.z / velNorm
    );

    // Dot product to see if projectile is heading toward player
    const toPlayerNorm = toPlayer.norm();
    if (toPlayerNorm < 0.01) return true; // Already at player

    const toPlayerDir = new Vec3(
      toPlayer.x / toPlayerNorm,
      toPlayer.y / toPlayerNorm,
      toPlayer.z / toPlayerNorm
    );

    const dot = velDir.x * toPlayerDir.x + velDir.y * toPlayerDir.y + velDir.z * toPlayerDir.z;

    // Projectile heading toward player if dot product > 0.5
    if (dot < 0.5) return false;

    // Check if projectile will pass close to player
    const closestApproach = this.calculateClosestApproach(
      projectilePos, projectileVelocity, playerPos
    );

    // Consider dangerous if will pass within 2 blocks
    return closestApproach < 2;
  }

  private calculateClosestApproach(
    projectilePos: Vec3,
    projectileVel: Vec3,
    playerPos: Vec3
  ): number {
    // Calculate time of closest approach
    const toPlayer = playerPos.minus(projectilePos);
    const velSq = projectileVel.x * projectileVel.x +
                  projectileVel.y * projectileVel.y +
                  projectileVel.z * projectileVel.z;

    if (velSq < 0.01) return toPlayer.norm();

    const t = Math.max(0, (
      toPlayer.x * projectileVel.x +
      toPlayer.y * projectileVel.y +
      toPlayer.z * projectileVel.z
    ) / velSq);

    // Position at closest approach
    const closestPos = new Vec3(
      projectilePos.x + projectileVel.x * t,
      projectilePos.y + projectileVel.y * t,
      projectilePos.z + projectileVel.z * t
    );

    return playerPos.distanceTo(closestPos);
  }

  private calculateDodgeDirection(projectile: Entity): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const projectilePos = projectile.position;
    const projectileVelocity = projectile.velocity ?? new Vec3(0, 0, 0);

    // Get projectile trajectory direction (horizontal only)
    const trajDir = new Vec3(projectileVelocity.x, 0, projectileVelocity.z);
    const trajNorm = Math.sqrt(trajDir.x * trajDir.x + trajDir.z * trajDir.z);

    if (trajNorm < 0.01) {
      // Projectile falling straight down - move away
      const awayDir = playerPos.minus(projectilePos);
      const awayNorm = Math.sqrt(awayDir.x * awayDir.x + awayDir.z * awayDir.z);
      if (awayNorm < 0.01) return new Vec3(1, 0, 0);
      return new Vec3(awayDir.x / awayNorm, 0, awayDir.z / awayNorm);
    }

    // Perpendicular direction (rotate 90 degrees)
    const perpDir = new Vec3(-trajDir.z / trajNorm, 0, trajDir.x / trajNorm);

    // Choose direction that moves us further from projectile
    const playerToProjectile = projectilePos.minus(playerPos);
    const dot = perpDir.x * playerToProjectile.x + perpDir.z * playerToProjectile.z;

    // Move in direction that increases distance
    if (dot > 0) {
      return perpDir;
    } else {
      return new Vec3(-perpDir.x, 0, -perpDir.z);
    }
  }

  private executeDodge(direction: Vec3): void {
    this.dodgeDirection = direction;

    // Calculate control states based on direction
    const forward = direction.z > 0.3;
    const back = direction.z < -0.3;
    const left = direction.x < -0.3;
    const right = direction.x > 0.3;

    // Clear old states
    this.bot.clearControlStates();

    // Set movement
    if (forward) this.bot.setControlState('forward', true);
    if (back) this.bot.setControlState('back', true);
    if (left) this.bot.setControlState('left', true);
    if (right) this.bot.setControlState('right', true);

    // Sprint for faster dodge
    this.bot.setControlState('sprint', true);
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.dodgeDirection = null;
  }

  isFinished(): boolean {
    return this.finished;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof DodgeProjectilesTask)) return false;
    return Math.abs(this.config.dodgeDistanceH - other.config.dodgeDistanceH) < 1 &&
           Math.abs(this.config.dodgeDistanceV - other.config.dodgeDistanceV) < 1;
  }
}

/**
 * Helper to create dodge task
 */
export function dodgeProjectiles(
  bot: Bot,
  horizontalDistance: number = 2,
  verticalDistance: number = 1
): DodgeProjectilesTask {
  return new DodgeProjectilesTask(bot, {
    dodgeDistanceH: horizontalDistance,
    dodgeDistanceV: verticalDistance,
  });
}
