/**
 * GetToXZWithElytraTask - Navigate to XZ using Elytra Flight
 * Based on BaritonePlus GetToXZWithElytraTask.java
 *
 * Handles intelligent elytra travel including:
 * - Walking if destination is close enough
 * - Elytra durability management and repair
 * - Firework collection before flight
 * - Surface navigation before takeoff
 * - Smart landing and elytra unequipping
 */

import type { Bot } from 'mineflayer';
import type { Item } from 'prismarine-item';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { GoToXZTask } from './GoToXZTask';
import { GetToYTask } from './GetToYTask';
import { ClickSlotTask, EnsureFreeInventorySlotTask } from './SlotTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import { LookHelper, calculateLookRotation } from '../../utils/LookHelper';
import { getGroundHeight, inRangeXZ } from '../../utils/WorldHelper';
import { isGrounded } from '../../utils/EntityHelper';

/**
 * Constants for elytra flight
 */
const CLOSE_ENOUGH_TO_WALK = 128; // Walk instead if closer
const MINIMAL_ELYTRA_DURABILITY = 35; // Land if durability below this
const MINIMAL_FIREWORKS = 16; // Minimum fireworks before starting
const FIREWORKS_GOAL = 32; // Target fireworks to collect
const FLY_LEVEL = 325; // Target flight altitude (world height ~320)
const LOOK_DISTANCE = 6; // Don't adjust look if closer than this
const LAND_TARGET_DISTANCE = 12; // Start landing if closer than this

/**
 * Flight state
 */
enum ElytraFlightState {
  CHECKING_DISTANCE,
  EQUIPPING_ELYTRA,
  COLLECTING_FIREWORKS,
  MOVING_TO_SURFACE,
  FLYING,
  LANDING,
  UNEQUIPPING_ELYTRA,
  FINISHED,
  WALKING_FALLBACK,
}

/**
 * Configuration for GetToXZWithElytraTask
 */
export interface GetToXZWithElytraConfig {
  /** Distance threshold for walking instead of flying */
  walkDistance: number;
  /** Minimum elytra durability before landing */
  minDurability: number;
  /** Minimum fireworks before taking off */
  minFireworks: number;
  /** Target fireworks to collect */
  targetFireworks: number;
  /** Target flight altitude */
  flyLevel: number;
  /** Distance to start landing */
  landDistance: number;
  /** Whether to repair elytra if needed */
  allowRepair: boolean;
}

const DEFAULT_CONFIG: GetToXZWithElytraConfig = {
  walkDistance: CLOSE_ENOUGH_TO_WALK,
  minDurability: MINIMAL_ELYTRA_DURABILITY,
  minFireworks: MINIMAL_FIREWORKS,
  targetFireworks: FIREWORKS_GOAL,
  flyLevel: FLY_LEVEL,
  landDistance: LAND_TARGET_DISTANCE,
  allowRepair: true,
};

/**
 * GetToXZWithElytraTask - Navigate to coordinates using elytra
 *
 * This task handles the complete elytra travel workflow:
 * 1. Check if walking is more appropriate (short distance)
 * 2. Ensure elytra is equipped with sufficient durability
 * 3. Collect fireworks if needed
 * 4. Navigate to surface for takeoff
 * 5. Fly toward target at high altitude
 * 6. Land safely and unequip elytra
 */
export class GetToXZWithElytraTask extends Task {
  private config: GetToXZWithElytraConfig;
  private targetX: number;
  private targetZ: number;
  private state: ElytraFlightState = ElytraFlightState.CHECKING_DISTANCE;

  // Flight tracking
  private isFlyRunning: boolean = false;
  private isCollectingFireworks: boolean = false;
  private oldCoordsY: number = 0;
  private yGoal: number = 0;

  // Emergency landing point
  private landingX: number = 0;
  private landingZ: number = 0;

  // Timers
  private fireworkTimer: TimerGame;
  private messageTimer: TimerGame;
  private surfaceTimer: TimerGame;
  private jumpTimer: TimerGame;

  private lookHelper: LookHelper;

  constructor(
    bot: Bot,
    x: number,
    z: number,
    config: Partial<GetToXZWithElytraConfig> = {}
  ) {
    super(bot);
    this.targetX = Math.floor(x);
    this.targetZ = Math.floor(z);
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.fireworkTimer = new TimerGame(bot, 0.1);
    this.messageTimer = new TimerGame(bot, 3);
    this.surfaceTimer = new TimerGame(bot, 2);
    this.jumpTimer = new TimerGame(bot, 0.1);

    this.lookHelper = new LookHelper(bot);
  }

  get displayName(): string {
    const dist = this.getDistanceXZ();
    return `ElytraTravel(${this.targetX}, ${this.targetZ}, dist: ${Math.round(dist)}, ${ElytraFlightState[this.state]})`;
  }

  onStart(): void {
    this.state = ElytraFlightState.CHECKING_DISTANCE;
    this.isFlyRunning = false;
    this.isCollectingFireworks = false;
    this.oldCoordsY = this.bot.entity.position.y;
    this.yGoal = 0;
    this.landingX = 0;
    this.landingZ = 0;

    this.jumpTimer.reset();
    this.fireworkTimer.reset();
    this.messageTimer.reset();
  }

  onTick(): Task | null {
    const dist = this.getDistanceXZ();

    // If already flying, skip pre-flight checks
    if (this.isFlyRunning) {
      return this.handleFlying();
    }

    // Reset landing point when not flying
    this.landingX = 0;
    this.landingZ = 0;

    // Check if close enough to walk
    if (dist < this.config.walkDistance) {
      return new GoToXZTask(this.bot, this.targetX, this.targetZ);
    }

    // Check if we have elytra
    if (!this.hasElytra() && !this.hasElytraEquipped()) {
      // No elytra - walk instead
      return new GoToXZTask(this.bot, this.targetX, this.targetZ);
    }

    // Check elytra durability
    const durability = this.getElytraDurability();
    if (durability < this.config.minDurability && durability !== -1) {
      // Elytra too damaged - walk instead
      // TODO: Add repair task integration
      return new GoToXZTask(this.bot, this.targetX, this.targetZ);
    }

    // Collect fireworks if needed
    const fireworkCount = this.countFireworks();
    if (
      (fireworkCount < this.config.minFireworks || this.isCollectingFireworks) &&
      fireworkCount < this.config.targetFireworks
    ) {
      this.isCollectingFireworks = true;
      // TODO: Add firework collection task
      // For now, proceed if we have at least some fireworks
      if (fireworkCount < 1) {
        return new GoToXZTask(this.bot, this.targetX, this.targetZ);
      }
    }
    this.isCollectingFireworks = false;

    // Equip elytra if not equipped
    if (!this.hasElytraEquipped()) {
      return this.equipElytra();
    }

    // Move to surface before takeoff
    const playerX = Math.floor(this.bot.entity.position.x);
    const playerZ = Math.floor(this.bot.entity.position.z);
    const groundY = this.getGroundHeightWithRadius(playerX, playerZ);

    if (this.yGoal === 0 || this.yGoal < this.bot.entity.position.y) {
      this.yGoal = groundY;
    }

    if (groundY > this.bot.entity.position.y || !this.surfaceTimer.elapsed()) {
      if (groundY > this.bot.entity.position.y) {
        this.surfaceTimer.reset();
      }
      return new GetToYTask(this.bot, this.yGoal + 1);
    }

    // Ready to fly!
    this.yGoal = 0;
    this.fireworkTimer.forceElapsed();
    this.isFlyRunning = true;

    return null;
  }

  private handleFlying(): Task | null {
    // Get elytra durability
    const durability = this.getEquippedElytraDurability();

    // Calculate direction to target
    const pos = this.bot.entity.position;
    let targetVec = new Vec3(this.targetX, 1, this.targetZ);
    let dist = this.getDistanceXZ();

    // Emergency landing if durability low
    if (durability < this.config.minDurability && durability > 0) {
      // Set landing point if not set or too far
      const landingDist = this.landingX !== 0
        ? Math.sqrt(
            (pos.x - this.landingX) ** 2 + (pos.z - this.landingZ) ** 2
          )
        : Infinity;

      if (landingDist > 30 || this.landingX === 0) {
        this.landingX = Math.floor(pos.x);
        this.landingZ = Math.floor(pos.z);
      }

      // Navigate to landing point instead
      dist = Math.sqrt(
        (pos.x - this.landingX) ** 2 + (pos.z - this.landingZ) ** 2
      );
      targetVec = new Vec3(this.landingX, 1, this.landingZ);
    }

    // Calculate yaw to target
    const rotation = calculateLookRotation(pos, targetVec);
    const yaw = (rotation.yaw * Math.PI) / 180;

    // Calculate pitch based on altitude and distance
    let pitch: number;

    if (dist > 15) {
      // Still flying toward target
      if (pos.y > this.config.flyLevel - 2) {
        // At or above fly level
        if (this.oldCoordsY > pos.y && this.fireworkTimer.elapsed()) {
          pitch = (10 * Math.PI) / 180; // Look slightly down when descending
        } else {
          pitch = (-10 * Math.PI) / 180; // Look slightly up
        }
      } else {
        // Below fly level - need to gain altitude
        pitch = (-40 * Math.PI) / 180;
      }

      // Jump to activate/maintain elytra
      if (this.jumpTimer.elapsed()) {
        this.bot.setControlState('jump', true);
        setTimeout(() => this.bot.setControlState('jump', false), 50);
        this.jumpTimer.reset();
      }

      // Use fireworks when below fly level
      if (
        this.fireworkTimer.elapsed() &&
        pos.y < this.config.flyLevel &&
        this.countFireworks() > 0
      ) {
        this.useFirework();
        this.fireworkTimer.reset();
        pitch = (-10 * Math.PI) / 180;
      }

      // Progress message
      if (this.messageTimer.elapsed()) {
        // Debug logging would go here
        this.messageTimer.reset();
      }
    } else {
      // Landing approach
      const groundHeight = this.getGroundHeightWithRadius(
        Math.floor(pos.x),
        Math.floor(pos.z)
      );

      if (groundHeight + 50 > pos.y) {
        pitch = (20 * Math.PI) / 180; // Gentle descent
      } else {
        pitch = (50 * Math.PI) / 180; // Steeper descent
      }
    }

    // Look toward target
    if (dist > LOOK_DISTANCE) {
      this.bot.look(yaw, pitch, true);
    }

    // Check if landed
    if (
      isGrounded(this.bot.entity) &&
      (dist < this.config.landDistance || this.countFireworks() === 0)
    ) {
      // Unequip elytra
      if (this.hasElytraEquipped()) {
        return this.unequipElytra();
      }

      // Done flying
      this.isFlyRunning = false;
    }

    this.oldCoordsY = pos.y;
    return null;
  }

  private equipElytra(): Task | null {
    const elytra = this.findElytra();
    if (!elytra) return null;

    // Move elytra to chest slot (slot 38)
    try {
      this.bot.equip(elytra, 'torso');
    } catch {
      // Will retry
    }
    return null;
  }

  private unequipElytra(): Task | null {
    // Click on chest armor slot to pick up elytra
    const chestSlot = this.bot.inventory.slots[38];
    if (chestSlot && chestSlot.name === 'elytra') {
      // Click to move to cursor
      return new ClickSlotTask(this.bot, 38);
    }

    // If cursor has item, put it in inventory
    const cursor = (this.bot as any).inventory?.cursorItem;
    if (cursor) {
      // Find empty slot
      const emptySlot = this.findEmptyInventorySlot();
      if (emptySlot !== -1) {
        return new ClickSlotTask(this.bot, emptySlot);
      }
      return new EnsureFreeInventorySlotTask(this.bot);
    }

    return null;
  }

  private useFirework(): void {
    const firework = this.bot.inventory
      .items()
      .find((i) => i.name === 'firework_rocket');
    if (!firework) return;

    try {
      this.bot.equip(firework, 'hand');
      this.bot.activateItem(false);
    } catch {
      // May fail
    }
  }

  // ---- Helper methods ----

  private getDistanceXZ(): number {
    const pos = this.bot.entity.position;
    const dx = this.targetX - pos.x;
    const dz = this.targetZ - pos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private hasElytra(): boolean {
    return this.bot.inventory.items().some((i) => i.name === 'elytra');
  }

  private hasElytraEquipped(): boolean {
    const chestSlot = this.bot.inventory.slots[38];
    return chestSlot !== null && chestSlot !== undefined && chestSlot.name === 'elytra';
  }

  private findElytra(): Item | null {
    return this.bot.inventory.items().find((i) => i.name === 'elytra') ?? null;
  }

  private getElytraDurability(): number {
    // Check inventory first
    const elytra = this.findElytra();
    if (elytra) {
      return this.getItemDurability(elytra);
    }

    // Check equipped
    return this.getEquippedElytraDurability();
  }

  private getEquippedElytraDurability(): number {
    const chestSlot = this.bot.inventory.slots[38];
    if (!chestSlot || chestSlot.name !== 'elytra') return -1;
    return this.getItemDurability(chestSlot);
  }

  private getItemDurability(item: Item): number {
    const maxDurability = item.maxDurability ?? 432; // Elytra max durability
    const durabilityUsed = item.durabilityUsed ?? 0;
    return maxDurability - durabilityUsed;
  }

  private countFireworks(): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'firework_rocket') {
        count += item.count;
      }
    }
    return count;
  }

  private findEmptyInventorySlot(): number {
    // Player inventory slots 9-44 (hotbar 36-44, main inventory 9-35)
    for (let i = 9; i <= 44; i++) {
      if (!this.bot.inventory.slots[i]) {
        return i;
      }
    }
    return -1;
  }

  private getGroundHeightWithRadius(x: number, z: number): number {
    let topY = 0;
    for (let dx = -5; dx <= 5; dx++) {
      for (let dz = -5; dz <= 5; dz++) {
        const y = getGroundHeight(this.bot, x + dx, z + dz);
        if (y > topY) {
          topY = y;
        }
      }
    }
    return topY;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.lookHelper.stopLooking();
  }

  isFinished(): boolean {
    return (
      inRangeXZ(
        this.bot.entity.position,
        new Vec3(this.targetX, 0, this.targetZ),
        2
      ) && !this.isFlyRunning
    );
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetToXZWithElytraTask)) return false;
    return other.targetX === this.targetX && other.targetZ === this.targetZ;
  }
}

/**
 * Factory functions
 */
export function flyToXZWithElytra(bot: Bot, x: number, z: number): GetToXZWithElytraTask {
  return new GetToXZWithElytraTask(bot, x, z);
}

export function flyToPositionWithElytra(bot: Bot, pos: Vec3): GetToXZWithElytraTask {
  return new GetToXZWithElytraTask(bot, pos.x, pos.z);
}

export default {
  GetToXZWithElytraTask,
  flyToXZWithElytra,
  flyToPositionWithElytra,
};
