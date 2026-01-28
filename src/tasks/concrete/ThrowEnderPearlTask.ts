/**
 * ThrowEnderPearlTask - Ender Pearl Throwing
 * Based on AltoClef/BaritonePlus ThrowEnderPearlSimpleProjectileTask.java
 *
 * Task for throwing ender pearls to travel to distant locations.
 * Calculates the required pitch angle for projectile motion.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';
import {
  calculateAnglesForSimpleProjectileMotion,
  getThrowOrigin,
  THROWN_ENTITY_GRAVITY_ACCEL,
} from '../../utils/ProjectileHelper';

/**
 * Configuration for ThrowEnderPearlTask
 */
export interface ThrowEnderPearlConfig {
  /** Target position to throw toward */
  target: Vec3;
  /** Wait time after throwing before considering done */
  throwCooldown: number;
  /** Initial velocity of thrown pearl (Minecraft default) */
  throwSpeed: number;
}

const DEFAULT_CONFIG: Partial<ThrowEnderPearlConfig> = {
  throwCooldown: 5,
  throwSpeed: 1.5,
};

/**
 * ThrowEnderPearlSimpleProjectileTask - Throw an ender pearl toward a target
 *
 * Intent: When the bot needs to travel quickly to a distant location,
 * this task calculates the required throw angle and throws an ender pearl.
 */
export class ThrowEnderPearlSimpleProjectileTask extends Task {
  private config: ThrowEnderPearlConfig;
  private thrownTimer: TimerGame;
  private thrown: boolean = false;

  constructor(bot: Bot, target: Vec3, config: Partial<ThrowEnderPearlConfig> = {}) {
    super(bot);
    this.config = {
      ...DEFAULT_CONFIG,
      target,
      ...config,
    } as ThrowEnderPearlConfig;
    this.thrownTimer = new TimerGame(bot, this.config.throwCooldown);
  }

  /**
   * Create from coordinates
   */
  static fromCoords(
    bot: Bot,
    x: number,
    y: number,
    z: number,
    config: Partial<ThrowEnderPearlConfig> = {}
  ): ThrowEnderPearlSimpleProjectileTask {
    return new ThrowEnderPearlSimpleProjectileTask(bot, new Vec3(x, y, z), config);
  }

  get displayName(): string {
    const { target } = this.config;
    return `ThrowPearl(${Math.floor(target.x)}, ${Math.floor(target.y)}, ${Math.floor(target.z)})`;
  }

  onStart(): void {
    this.thrownTimer.forceElapsed();
    this.thrown = false;
  }

  onTick(): Task | null {
    // Check if there's an active ender pearl in the world
    if (this.isEnderPearlInFlight()) {
      this.thrownTimer.reset();
    }

    // Wait for cooldown if just thrown
    if (!this.thrownTimer.elapsed()) {
      return null;
    }

    // Try to equip ender pearl
    const equipped = this.equipEnderPearl();
    if (!equipped) {
      // No ender pearl available
      return null;
    }

    // Calculate throw angle
    const lookTarget = this.calculateThrowLook();
    if (!lookTarget) {
      return null;
    }

    // Look at target
    this.bot.look(lookTarget.yaw, lookTarget.pitch, true);

    // Check if looking at target
    if (this.isLookingAt(lookTarget.yaw, lookTarget.pitch)) {
      // Throw the pearl
      this.bot.activateItem(false); // Right click
      this.thrown = true;
      this.thrownTimer.reset();
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    // Done if we've thrown and cooldown elapsed, or we have no pearls
    return (this.thrown && this.thrownTimer.elapsed()) ||
           (!this.thrown && !this.hasEnderPearl());
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ThrowEnderPearlSimpleProjectileTask)) return false;
    return this.config.target.distanceTo(other.config.target) < 1;
  }

  // ---- Private Helpers ----

  /**
   * Check if we have an ender pearl in inventory
   */
  private hasEnderPearl(): boolean {
    return this.bot.inventory.items().some(item => item.name === 'ender_pearl');
  }

  /**
   * Try to equip an ender pearl
   */
  private equipEnderPearl(): boolean {
    // Check if already holding
    const heldItem = this.bot.heldItem;
    if (heldItem?.name === 'ender_pearl') {
      return true;
    }

    // Find pearl in inventory
    const pearl = this.bot.inventory.items().find(item => item.name === 'ender_pearl');
    if (!pearl) {
      return false;
    }

    // Equip it (this is async but we'll check next tick)
    this.bot.equip(pearl, 'hand').catch(() => {
      // Ignore errors
    });

    return false; // Not equipped yet
  }

  /**
   * Check if there's an ender pearl entity in flight
   */
  private isEnderPearlInFlight(): boolean {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity?.name === 'ender_pearl') {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate the required yaw/pitch for throwing to target
   */
  private calculateThrowLook(): { yaw: number; pitch: number } | null {
    const start = getThrowOrigin(this.bot.entity.position);
    const end = this.config.target;

    // Calculate horizontal distance and direction
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    // Calculate yaw (horizontal angle)
    const yaw = Math.atan2(-dx, dz) * (180 / Math.PI);

    // Calculate vertical distance (positive = target is above)
    const heightDiff = start.y - end.y;

    // Calculate pitch using projectile motion
    const pitches = calculateAnglesForSimpleProjectileMotion(
      heightDiff,
      horizontalDist,
      this.config.throwSpeed,
      THROWN_ENTITY_GRAVITY_ACCEL
    );

    // Try the lower angle first (usually cleaner throw)
    let pitch = pitches[0];

    // Check if lower angle has clean line of sight
    if (!this.hasCleanLineOfSight(yaw, pitch)) {
      // Try higher angle
      pitch = pitches[1];
    }

    // Convert to Minecraft pitch (inverted)
    return { yaw, pitch: -pitch };
  }

  /**
   * Check if there's a clean line of sight for throwing
   */
  private hasCleanLineOfSight(yaw: number, pitch: number): boolean {
    const range = 3;
    const radYaw = (yaw * Math.PI) / 180;
    const radPitch = (pitch * Math.PI) / 180;

    // Calculate direction vector
    const dx = -Math.sin(radYaw) * Math.cos(radPitch);
    const dy = -Math.sin(radPitch);
    const dz = Math.cos(radYaw) * Math.cos(radPitch);

    // Check blocks along throw path
    const start = this.bot.entity.position.offset(0, 1.62, 0); // Eye position
    for (let dist = 0.5; dist <= range; dist += 0.5) {
      const checkPos = start.offset(dx * dist, dy * dist, dz * dist);
      const block = this.bot.blockAt(checkPos);
      if (block && block.boundingBox !== 'empty') {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if bot is looking close enough to target angles
   */
  private isLookingAt(targetYaw: number, targetPitch: number): boolean {
    const currentYaw = this.bot.entity.yaw * (180 / Math.PI);
    const currentPitch = this.bot.entity.pitch * (180 / Math.PI);

    // Normalize yaw difference
    let yawDiff = Math.abs(currentYaw - targetYaw);
    if (yawDiff > 180) yawDiff = 360 - yawDiff;

    const pitchDiff = Math.abs(currentPitch - targetPitch);

    // Allow 3 degree tolerance
    return yawDiff < 3 && pitchDiff < 3;
  }
}

/**
 * Factory function for creating ender pearl tasks
 */
export function throwEnderPearl(
  bot: Bot,
  target: Vec3 | { x: number; y: number; z: number }
): ThrowEnderPearlSimpleProjectileTask {
  const targetVec = target instanceof Vec3 ? target : new Vec3(target.x, target.y, target.z);
  return new ThrowEnderPearlSimpleProjectileTask(bot, targetVec);
}

export default {
  ThrowEnderPearlSimpleProjectileTask,
  throwEnderPearl,
};
