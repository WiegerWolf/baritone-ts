/**
 * FleeFromProjectilesTask - Dodge incoming projectiles
 *
 * When projectiles (arrows, fireballs) are heading toward
 * the player, this task calculates and executes a dodge maneuver.
 *
 * Note: This is the entity-supplier variant.
 * See also DodgeTask.ts for the standalone dodge/strafe variants.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';

export class FleeFromProjectilesTask extends Task {
  private dodgeRange: number;
  private dodgeDirection: Vec3 | null = null;
  private dodgeTimer: number = 0;

  constructor(bot: Bot, dodgeRange: number = 10) {
    super(bot);
    this.dodgeRange = dodgeRange;
  }

  get displayName(): string {
    return 'DodgeProjectiles';
  }

  onStart(): void {
    this.dodgeDirection = null;
    this.dodgeTimer = 0;
  }

  onTick(): Task | null {
    // Find incoming projectiles
    const projectiles = this.findIncomingProjectiles();

    if (projectiles.length === 0) {
      this.bot.clearControlStates();
      return null;
    }

    // Calculate dodge direction
    this.dodgeDirection = this.calculateDodgeDirection(projectiles);

    if (this.dodgeDirection) {
      // Look perpendicular and strafe
      const playerPos = this.bot.entity.position;
      const targetPos = playerPos.plus(this.dodgeDirection.scaled(5));

      this.bot.lookAt(targetPos, true);
      this.bot.setControlState('forward', true);
      this.bot.setControlState('sprint', true);

      // Jump occasionally to avoid splash damage
      if (Math.random() > 0.7) {
        this.bot.setControlState('jump', true);
      }
    }

    this.dodgeTimer++;
    return null;
  }

  private findIncomingProjectiles(): Entity[] {
    const projectiles: Entity[] = [];
    const playerPos = this.bot.entity.position;

    const projectileTypes = ['arrow', 'spectral_arrow', 'fireball', 'small_fireball',
                            'wither_skull', 'dragon_fireball', 'trident', 'shulker_bullet'];

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (!entity.name || !projectileTypes.includes(entity.name)) continue;
      if (entity.isValid === false) continue;

      // Check distance
      const dist = playerPos.distanceTo(entity.position);
      if (dist > this.dodgeRange) continue;

      // Check if heading toward player
      const velocity = entity.velocity;
      if (!velocity || (velocity.x === 0 && velocity.y === 0 && velocity.z === 0)) {
        continue;
      }

      // Check if velocity is pointing toward player
      const toPlayer = playerPos.minus(entity.position);
      const dot = toPlayer.x * velocity.x + toPlayer.y * velocity.y + toPlayer.z * velocity.z;
      if (dot > 0) {
        projectiles.push(entity);
      }
    }

    return projectiles;
  }

  private calculateDodgeDirection(projectiles: Entity[]): Vec3 | null {
    if (projectiles.length === 0) return null;

    // Average the dodge directions for all projectiles
    let dodgeDir = new Vec3(0, 0, 0);

    for (const proj of projectiles) {
      const velocity = proj.velocity;
      if (!velocity) continue;

      // Dodge perpendicular to projectile velocity
      const perpendicular = new Vec3(-velocity.z, 0, velocity.x);
      const len = Math.sqrt(perpendicular.x * perpendicular.x + perpendicular.z * perpendicular.z);

      if (len > 0.01) {
        // Choose the perpendicular direction that's away from other threats
        const normalized = perpendicular.scaled(1 / len);
        dodgeDir = dodgeDir.plus(normalized);
      }
    }

    const finalLen = dodgeDir.norm();
    if (finalLen < 0.1) return null;

    return dodgeDir.scaled(1 / finalLen);
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.findIncomingProjectiles().length === 0 || this.dodgeTimer > 40;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof FleeFromProjectilesTask)) return false;
    return Math.abs(this.dodgeRange - other.dodgeRange) < 1;
  }
}
