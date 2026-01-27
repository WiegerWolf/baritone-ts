/**
 * ElytraTask - Elytra Flight Automation
 * Based on AltoClef's GetToXZWithElytraTask
 *
 * Handles elytra flight including takeoff, cruising,
 * and landing with firework management.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToTask';
import { EquipTask, EquipmentSlot } from '../concrete/InventoryTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Flight phase
 */
export enum FlightPhase {
  PREPARING,    // Equipping elytra, checking supplies
  TAKING_OFF,   // Jumping and activating elytra
  ASCENDING,    // Gaining altitude
  CRUISING,     // Flying toward target
  DESCENDING,   // Landing approach
  LANDING,      // Final touchdown
  FINISHED,
  FAILED
}

/**
 * Configuration for elytra flight
 */
export interface ElytraConfig {
  /** Target X coordinate */
  targetX: number;
  /** Target Z coordinate */
  targetZ: number;
  /** Cruising altitude */
  cruiseAltitude: number;
  /** Minimum fireworks required */
  minFireworks: number;
  /** Minimum elytra durability percent */
  minDurabilityPercent: number;
  /** Landing distance threshold */
  landingDistance: number;
  /** Firework boost interval (ticks) */
  fireworkInterval: number;
}

const DEFAULT_CONFIG: Partial<ElytraConfig> = {
  cruiseAltitude: 200,
  minFireworks: 8,
  minDurabilityPercent: 35,
  landingDistance: 50,
  fireworkInterval: 60, // 3 seconds
};

/**
 * Task for elytra flight
 */
export class ElytraTask extends Task {
  private config: ElytraConfig;
  private phase: FlightPhase = FlightPhase.PREPARING;
  private takeoffTimer: TimerGame;
  private fireworkTimer: TimerGame;
  private jumpTimer: TimerGame;
  private flightStartY: number = 0;
  private fireworksUsed: number = 0;

  constructor(bot: Bot, targetX: number, targetZ: number, config: Partial<ElytraConfig> = {}) {
    super(bot);
    this.config = {
      ...DEFAULT_CONFIG,
      targetX,
      targetZ,
      ...config
    } as ElytraConfig;
    this.takeoffTimer = new TimerGame(bot, 0.5);
    this.fireworkTimer = new TimerGame(bot, this.config.fireworkInterval / 20);
    this.jumpTimer = new TimerGame(bot, 0.1);
  }

  get displayName(): string {
    const dist = this.getDistanceToTarget();
    return `ElytraFlight(${this.config.targetX}, ${this.config.targetZ}, dist: ${Math.round(dist)}, ${FlightPhase[this.phase]})`;
  }

  onStart(): void {
    this.phase = FlightPhase.PREPARING;
    this.flightStartY = this.bot.entity.position.y;
    this.fireworksUsed = 0;
  }

  onTick(): Task | null {
    switch (this.phase) {
      case FlightPhase.PREPARING:
        return this.handlePreparing();

      case FlightPhase.TAKING_OFF:
        return this.handleTakingOff();

      case FlightPhase.ASCENDING:
        return this.handleAscending();

      case FlightPhase.CRUISING:
        return this.handleCruising();

      case FlightPhase.DESCENDING:
        return this.handleDescending();

      case FlightPhase.LANDING:
        return this.handleLanding();

      default:
        return null;
    }
  }

  private handlePreparing(): Task | null {
    // Check if we have elytra equipped
    const chestSlot = this.bot.inventory.slots[38]; // Chest armor slot
    const hasElytraEquipped = chestSlot && chestSlot.name === 'elytra';

    if (!hasElytraEquipped) {
      // Find elytra in inventory
      const elytra = this.findItem('elytra');
      if (!elytra) {
        this.phase = FlightPhase.FAILED;
        return null;
      }

      // Check durability
      if (this.getItemDurabilityPercent(elytra) < this.config.minDurabilityPercent) {
        this.phase = FlightPhase.FAILED;
        return null;
      }

      return new EquipTask(this.bot, 'elytra', EquipmentSlot.CHEST);
    }

    // Check firework supply
    const fireworkCount = this.countItem('firework_rocket');
    if (fireworkCount < this.config.minFireworks) {
      this.phase = FlightPhase.FAILED;
      return null;
    }

    this.phase = FlightPhase.TAKING_OFF;
    this.takeoffTimer.reset();
    return null;
  }

  private handleTakingOff(): Task | null {
    // Need to jump to activate elytra
    if (!this.isFlying()) {
      if (this.jumpTimer.elapsed()) {
        // Jump
        this.bot.setControlState('jump', true);
        this.jumpTimer.reset();
      } else {
        this.bot.setControlState('jump', false);
      }

      // Try to activate elytra while in air
      if (!this.bot.entity.onGround) {
        try {
          // Press jump again to deploy elytra
          this.bot.setControlState('jump', true);
        } catch {
          // May fail
        }
      }

      return null;
    }

    // Elytra deployed!
    this.flightStartY = this.bot.entity.position.y;
    this.phase = FlightPhase.ASCENDING;
    this.fireworkTimer.reset();
    return null;
  }

  private handleAscending(): Task | null {
    if (!this.isFlying()) {
      // Lost flight, try to recover
      this.phase = FlightPhase.TAKING_OFF;
      return null;
    }

    const currentY = this.bot.entity.position.y;

    // Look up to ascend
    this.lookInDirection(-40); // Pitch up

    // Use fireworks to gain altitude
    if (currentY < this.config.cruiseAltitude) {
      if (this.fireworkTimer.elapsed()) {
        this.useFirework();
        this.fireworkTimer.reset();
      }
    }

    // Reached cruise altitude
    if (currentY >= this.config.cruiseAltitude) {
      this.phase = FlightPhase.CRUISING;
    }

    return null;
  }

  private handleCruising(): Task | null {
    if (!this.isFlying()) {
      this.phase = FlightPhase.TAKING_OFF;
      return null;
    }

    const dist = this.getDistanceToTarget();

    // Check if close enough to start descent
    if (dist < this.config.landingDistance) {
      this.phase = FlightPhase.DESCENDING;
      return null;
    }

    // Look toward target
    this.lookTowardTarget(-10); // Slight pitch down for glide

    // Boost occasionally to maintain speed
    if (this.fireworkTimer.elapsed()) {
      // Only boost if losing altitude
      if (this.bot.entity.position.y < this.config.cruiseAltitude - 20) {
        this.useFirework();
      }
      this.fireworkTimer.reset();
    }

    return null;
  }

  private handleDescending(): Task | null {
    if (!this.isFlying()) {
      // Landed
      this.phase = FlightPhase.LANDING;
      return null;
    }

    const dist = this.getDistanceToTarget();
    const height = this.bot.entity.position.y;

    // Steeper descent as we get closer
    let pitch: number;
    if (height >= 100) {
      pitch = 20; // Gentle descent
    } else if (height >= 50) {
      pitch = 35; // Medium descent
    } else {
      pitch = 50; // Steep descent
    }

    this.lookTowardTarget(pitch);

    // Emergency recovery if too low
    if (height < 20 && dist > 30) {
      this.useFirework();
    }

    return null;
  }

  private handleLanding(): Task | null {
    // Stop all flight controls
    this.bot.clearControlStates();

    // Check if close enough to target
    const dist = this.getDistanceToTarget();
    if (dist < 5) {
      this.phase = FlightPhase.FINISHED;
      return null;
    }

    // Walk to exact position
    return new GoToNearTask(
      this.bot,
      this.config.targetX,
      Math.floor(this.bot.entity.position.y),
      this.config.targetZ,
      2
    );
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.phase === FlightPhase.FINISHED || this.phase === FlightPhase.FAILED;
  }

  isFailed(): boolean {
    return this.phase === FlightPhase.FAILED;
  }

  // ---- Helper Methods ----

  private isFlying(): boolean {
    // Check if elytra is deployed
    const bot = this.bot as any;
    return bot.entity.elytraFlying === true ||
           (!this.bot.entity.onGround && this.hasElytraEquipped());
  }

  private hasElytraEquipped(): boolean {
    const chestSlot = this.bot.inventory.slots[38];
    return chestSlot !== null && chestSlot !== undefined && chestSlot.name === 'elytra';
  }

  private findItem(itemName: string): any | null {
    return this.bot.inventory.items().find(item => item.name === itemName) ?? null;
  }

  private countItem(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName) {
        count += item.count;
      }
    }
    return count;
  }

  private getItemDurabilityPercent(item: any): number {
    if (item.maxDurability && item.durabilityUsed !== undefined) {
      return ((item.maxDurability - item.durabilityUsed) / item.maxDurability) * 100;
    }
    return 100; // Assume full if can't determine
  }

  private getDistanceToTarget(): number {
    const pos = this.bot.entity.position;
    const dx = this.config.targetX - pos.x;
    const dz = this.config.targetZ - pos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private lookInDirection(pitch: number): void {
    try {
      const currentYaw = this.bot.entity.yaw;
      this.bot.look(currentYaw, (pitch * Math.PI) / 180, true);
    } catch {
      // May fail
    }
  }

  private lookTowardTarget(pitch: number): void {
    try {
      const pos = this.bot.entity.position;
      const dx = this.config.targetX - pos.x;
      const dz = this.config.targetZ - pos.z;
      const yaw = Math.atan2(-dx, dz);
      this.bot.look(yaw, (pitch * Math.PI) / 180, true);
    } catch {
      // May fail
    }
  }

  private useFirework(): void {
    // Find firework in hotbar or equip one
    const firework = this.findItem('firework_rocket');
    if (!firework) return;

    try {
      // Equip and use firework
      this.bot.equip(firework, 'hand');
      this.bot.activateItem();
      this.fireworksUsed++;
    } catch {
      // May fail
    }
  }

  /**
   * Get fireworks used count
   */
  getFireworksUsed(): number {
    return this.fireworksUsed;
  }

  /**
   * Get current flight phase
   */
  getFlightPhase(): FlightPhase {
    return this.phase;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ElytraTask)) return false;

    return this.config.targetX === other.config.targetX &&
           this.config.targetZ === other.config.targetZ;
  }
}

/**
 * Convenience functions
 */
export function flyToXZ(bot: Bot, x: number, z: number): ElytraTask {
  return new ElytraTask(bot, x, z);
}

export function flyToPosition(bot: Bot, pos: Vec3): ElytraTask {
  return new ElytraTask(bot, Math.floor(pos.x), Math.floor(pos.z));
}

export function flyHighAltitude(bot: Bot, x: number, z: number): ElytraTask {
  return new ElytraTask(bot, x, z, { cruiseAltitude: 300 });
}

export function flyLowAltitude(bot: Bot, x: number, z: number): ElytraTask {
  return new ElytraTask(bot, x, z, { cruiseAltitude: 100 });
}
