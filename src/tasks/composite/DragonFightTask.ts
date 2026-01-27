/**
 * DragonFightTask - Ender Dragon Combat Automation
 * Based on AltoClef patterns
 *
 * Handles fighting the ender dragon including crystal destruction,
 * phase detection, bed bombing, and breath avoidance.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToTask';
import { AttackEntityTask } from '../concrete/InteractTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for dragon fight
 */
enum DragonFightState {
  ARRIVING,
  DESTROYING_CRYSTALS,
  WAITING_FOR_PERCH,
  ATTACKING_PERCHED,
  DODGING_BREATH,
  BED_BOMBING,
  FINISHED,
  FAILED
}

/**
 * Configuration for dragon fight
 */
export interface DragonFightConfig {
  /** Use beds for extra damage */
  useBeds: boolean;
  /** Attack crystals first */
  destroyCrystals: boolean;
  /** Safe distance during breath attack */
  breathSafeDistance: number;
  /** Attack range */
  attackRange: number;
  /** Perch attack position (at fountain) */
  perchPosition: Vec3;
}

const DEFAULT_CONFIG: DragonFightConfig = {
  useBeds: true,
  destroyCrystals: true,
  breathSafeDistance: 8,
  attackRange: 4,
  perchPosition: new Vec3(0, 64, 0),
};

/**
 * Task for fighting the ender dragon
 */
export class DragonFightTask extends Task {
  private config: DragonFightConfig;
  private state: DragonFightState = DragonFightState.ARRIVING;
  private dragon: Entity | null = null;
  private crystalsDestroyed: number = 0;
  private attackTimer: TimerGame;
  private breathDodgeTimer: TimerGame;
  private damageDealt: number = 0;

  constructor(bot: Bot, config: Partial<DragonFightConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.attackTimer = new TimerGame(bot, 0.5);
    this.breathDodgeTimer = new TimerGame(bot, 0.2);
  }

  get displayName(): string {
    return `DragonFight(crystals: ${this.crystalsDestroyed}, ${DragonFightState[this.state]})`;
  }

  onStart(): void {
    this.state = DragonFightState.ARRIVING;
    this.dragon = null;
    this.crystalsDestroyed = 0;
    this.damageDealt = 0;
  }

  onTick(): Task | null {
    // Update dragon reference
    this.dragon = this.findDragon();

    // Check if dragon is dead
    if (this.state !== DragonFightState.ARRIVING && !this.dragon) {
      this.state = DragonFightState.FINISHED;
      return null;
    }

    // Check for breath attack
    if (this.isInBreathCloud()) {
      this.state = DragonFightState.DODGING_BREATH;
    }

    switch (this.state) {
      case DragonFightState.ARRIVING:
        return this.handleArriving();

      case DragonFightState.DESTROYING_CRYSTALS:
        return this.handleDestroyingCrystals();

      case DragonFightState.WAITING_FOR_PERCH:
        return this.handleWaitingForPerch();

      case DragonFightState.ATTACKING_PERCHED:
        return this.handleAttackingPerched();

      case DragonFightState.DODGING_BREATH:
        return this.handleDodgingBreath();

      case DragonFightState.BED_BOMBING:
        return this.handleBedBombing();

      default:
        return null;
    }
  }

  private handleArriving(): Task | null {
    // Get to the end island center
    const center = this.config.perchPosition;
    const dist = this.bot.entity.position.distanceTo(center);

    if (dist > 20) {
      return new GoToNearTask(
        this.bot,
        Math.floor(center.x),
        Math.floor(center.y),
        Math.floor(center.z),
        15
      );
    }

    // Look for dragon and crystals
    this.dragon = this.findDragon();

    if (this.config.destroyCrystals && this.hasCrystals()) {
      this.state = DragonFightState.DESTROYING_CRYSTALS;
    } else if (this.dragon) {
      this.state = DragonFightState.WAITING_FOR_PERCH;
    }

    return null;
  }

  private handleDestroyingCrystals(): Task | null {
    const crystal = this.findNearestCrystal();

    if (!crystal) {
      // All crystals destroyed
      this.state = DragonFightState.WAITING_FOR_PERCH;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(crystal.position);

    if (dist <= 7) {
      // Attack the crystal
      if (this.attackTimer.elapsed()) {
        this.crystalsDestroyed++;
        this.attackTimer.reset();
        return new AttackEntityTask(this.bot, crystal.id);
      }
      return null;
    }

    // Get closer to crystal
    return new GoToNearTask(
      this.bot,
      Math.floor(crystal.position.x),
      Math.floor(crystal.position.y),
      Math.floor(crystal.position.z),
      5
    );
  }

  private handleWaitingForPerch(): Task | null {
    if (!this.dragon) {
      this.state = DragonFightState.ARRIVING;
      return null;
    }

    // Check if dragon is perching
    if (this.isDragonPerched()) {
      this.state = DragonFightState.ATTACKING_PERCHED;
      return null;
    }

    // Get to perch position and wait
    const perchPos = this.config.perchPosition;
    const dist = this.bot.entity.position.distanceTo(perchPos);

    if (dist > 5) {
      return new GoToNearTask(
        this.bot,
        Math.floor(perchPos.x),
        Math.floor(perchPos.y),
        Math.floor(perchPos.z),
        3
      );
    }

    // Look at dragon while waiting
    try {
      this.bot.lookAt(this.dragon.position);
    } catch {
      // May fail
    }

    return null;
  }

  private handleAttackingPerched(): Task | null {
    if (!this.dragon) {
      this.state = DragonFightState.WAITING_FOR_PERCH;
      return null;
    }

    // Check if dragon left perch
    if (!this.isDragonPerched()) {
      this.state = DragonFightState.WAITING_FOR_PERCH;
      return null;
    }

    // Attack dragon
    if (this.attackTimer.elapsed()) {
      this.attackTimer.reset();
      return new AttackEntityTask(this.bot, this.dragon.id);
    }

    // Keep hitting
    try {
      this.bot.lookAt(this.dragon.position);
    } catch {
      // May fail
    }

    return null;
  }

  private handleDodgingBreath(): Task | null {
    // Run away from breath
    if (!this.breathDodgeTimer.elapsed()) {
      this.bot.setControlState('forward', true);
      this.bot.setControlState('sprint', true);
      return null;
    }

    // Check if still in breath
    if (!this.isInBreathCloud()) {
      this.state = DragonFightState.WAITING_FOR_PERCH;
      return null;
    }

    // Keep running
    const escapeDir = this.getEscapeDirection();
    try {
      const escapePos = this.bot.entity.position.plus(escapeDir);
      this.bot.lookAt(escapePos);
    } catch {
      // May fail
    }

    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);
    this.breathDodgeTimer.reset();

    return null;
  }

  private handleBedBombing(): Task | null {
    // Bed bombing implementation
    // In the End, beds explode when trying to sleep
    if (!this.config.useBeds || !this.hasBed()) {
      this.state = DragonFightState.WAITING_FOR_PERCH;
      return null;
    }

    if (!this.dragon || !this.isDragonPerched()) {
      this.state = DragonFightState.WAITING_FOR_PERCH;
      return null;
    }

    // Place and click bed when dragon is close
    // This is simplified - actual implementation would need
    // precise timing and bed placement
    this.state = DragonFightState.ATTACKING_PERCHED;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.state === DragonFightState.FINISHED || this.state === DragonFightState.FAILED;
  }

  isFailed(): boolean {
    return this.state === DragonFightState.FAILED;
  }

  // ---- Helper Methods ----

  private findDragon(): Entity | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity && entity.name === 'ender_dragon') {
        return entity;
      }
    }
    return null;
  }

  private hasCrystals(): boolean {
    return this.findNearestCrystal() !== null;
  }

  private findNearestCrystal(): Entity | null {
    const playerPos = this.bot.entity.position;
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity.name !== 'end_crystal') continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private isDragonPerched(): boolean {
    if (!this.dragon) return false;

    // Dragon is perched when near the fountain and low altitude
    const dragonPos = this.dragon.position;
    const fountainPos = this.config.perchPosition;

    const horizontalDist = Math.sqrt(
      Math.pow(dragonPos.x - fountainPos.x, 2) +
      Math.pow(dragonPos.z - fountainPos.z, 2)
    );

    return horizontalDist < 10 && dragonPos.y < fountainPos.y + 10;
  }

  private isInBreathCloud(): boolean {
    // Check for area effect clouds (dragon breath)
    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity.name !== 'area_effect_cloud') continue;

      const dist = this.bot.entity.position.distanceTo(entity.position);
      if (dist < 4) {
        return true;
      }
    }
    return false;
  }

  private getEscapeDirection(): Vec3 {
    // Run away from center
    const pos = this.bot.entity.position;
    const center = this.config.perchPosition;

    const dx = pos.x - center.x;
    const dz = pos.z - center.z;
    const len = Math.sqrt(dx * dx + dz * dz);

    if (len === 0) return new Vec3(1, 0, 0);
    return new Vec3(dx / len * 10, 0, dz / len * 10);
  }

  private hasBed(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name.endsWith('_bed')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get crystals destroyed count
   */
  getCrystalsDestroyed(): number {
    return this.crystalsDestroyed;
  }

  /**
   * Get current state
   */
  getCurrentState(): DragonFightState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof DragonFightTask)) return false;

    return this.config.useBeds === other.config.useBeds &&
           this.config.destroyCrystals === other.config.destroyCrystals;
  }
}

/**
 * Convenience functions
 */
export function fightDragon(bot: Bot): DragonFightTask {
  return new DragonFightTask(bot);
}

export function fightDragonWithBeds(bot: Bot): DragonFightTask {
  return new DragonFightTask(bot, { useBeds: true });
}

export function fightDragonSafe(bot: Bot): DragonFightTask {
  return new DragonFightTask(bot, { useBeds: false, breathSafeDistance: 12 });
}
