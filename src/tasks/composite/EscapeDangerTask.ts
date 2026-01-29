/**
 * EscapeDangerTask - Environmental Danger Escape
 * Based on AltoClef WorldSurvivalChain patterns
 *
 * Handles escaping from lava, fire, drowning, and other
 * environmental hazards.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for escaping danger
 */
enum EscapeState {
  ASSESSING,
  ESCAPING_LAVA,
  ESCAPING_FIRE,
  ESCAPING_WATER,
  ESCAPING_VOID,
  FINDING_SAFE_SPOT,
  MOVING_TO_SAFETY,
  SAFE,
  FAILED
}

/**
 * Danger types
 */
export enum DangerType {
  NONE = 'none',
  LAVA = 'lava',
  FIRE = 'fire',
  DROWNING = 'drowning',
  VOID = 'void',
  SUFFOCATION = 'suffocation',
  FREEZING = 'freezing',
}

/**
 * Configuration for escape
 */
export interface EscapeDangerConfig {
  /** Check for lava */
  checkLava: boolean;
  /** Check for fire */
  checkFire: boolean;
  /** Check for drowning */
  checkDrowning: boolean;
  /** Check for void */
  checkVoid: boolean;
  /** Air threshold for drowning (bubbles) */
  airThreshold: number;
  /** Void Y threshold */
  voidThreshold: number;
  /** Search radius for safe spot */
  safeSpotRadius: number;
}

const DEFAULT_CONFIG: EscapeDangerConfig = {
  checkLava: true,
  checkFire: true,
  checkDrowning: true,
  checkVoid: true,
  airThreshold: 5,
  voidThreshold: -60,
  safeSpotRadius: 16,
};

/**
 * Task for escaping environmental dangers
 */
export class EscapeDangerTask extends Task {
  private config: EscapeDangerConfig;
  private state: EscapeState = EscapeState.ASSESSING;
  private currentDanger: DangerType = DangerType.NONE;
  private safeSpot: Vec3 | null = null;
  private escapeTimer: TimerGame;
  private stuckTimer: TimerGame;

  constructor(bot: Bot, config: Partial<EscapeDangerConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.escapeTimer = new TimerGame(bot, 0.1);
    this.stuckTimer = new TimerGame(bot, 5.0);
  }

  get displayName(): string {
    return `EscapeDanger(${this.currentDanger}, ${EscapeState[this.state]})`;
  }

  onStart(): void {
    this.state = EscapeState.ASSESSING;
    this.currentDanger = DangerType.NONE;
    this.safeSpot = null;
    this.stuckTimer.reset();
  }

  onTick(): Task | null {
    // Check for stuck
    if (this.stuckTimer.elapsed()) {
      this.state = EscapeState.FAILED;
      return null;
    }

    switch (this.state) {
      case EscapeState.ASSESSING:
        return this.handleAssessing();

      case EscapeState.ESCAPING_LAVA:
        return this.handleEscapingLava();

      case EscapeState.ESCAPING_FIRE:
        return this.handleEscapingFire();

      case EscapeState.ESCAPING_WATER:
        return this.handleEscapingWater();

      case EscapeState.ESCAPING_VOID:
        return this.handleEscapingVoid();

      case EscapeState.FINDING_SAFE_SPOT:
        return this.handleFindingSafeSpot();

      case EscapeState.MOVING_TO_SAFETY:
        return this.handleMovingToSafety();

      case EscapeState.SAFE:
        return null;

      default:
        return null;
    }
  }

  private handleAssessing(): Task | null {
    // Check dangers in priority order
    if (this.config.checkVoid && this.isInVoid()) {
      this.currentDanger = DangerType.VOID;
      this.state = EscapeState.ESCAPING_VOID;
      return null;
    }

    if (this.config.checkLava && this.isInLava()) {
      this.currentDanger = DangerType.LAVA;
      this.state = EscapeState.ESCAPING_LAVA;
      return null;
    }

    if (this.config.checkFire && this.isOnFire()) {
      this.currentDanger = DangerType.FIRE;
      this.state = EscapeState.ESCAPING_FIRE;
      return null;
    }

    if (this.config.checkDrowning && this.isDrowning()) {
      this.currentDanger = DangerType.DROWNING;
      this.state = EscapeState.ESCAPING_WATER;
      return null;
    }

    // No danger detected
    this.currentDanger = DangerType.NONE;
    this.state = EscapeState.SAFE;
    return null;
  }

  private handleEscapingLava(): Task | null {
    // Try to jump out immediately
    this.bot.setControlState('jump', true);
    this.bot.setControlState('forward', true);

    // Look for safe spot
    this.safeSpot = this.findSafeSpotFrom(DangerType.LAVA);

    if (this.safeSpot) {
      this.state = EscapeState.MOVING_TO_SAFETY;
      return null;
    }

    // Just keep jumping and moving forward
    if (!this.isInLava()) {
      this.state = EscapeState.FINDING_SAFE_SPOT;
    }

    return null;
  }

  private handleEscapingFire(): Task | null {
    // Sprint away from fire
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);

    // Look for water
    const waterPos = this.findNearbyWater();
    if (waterPos) {
      this.safeSpot = waterPos;
      this.state = EscapeState.MOVING_TO_SAFETY;
      return null;
    }

    // Find safe spot
    this.safeSpot = this.findSafeSpotFrom(DangerType.FIRE);

    if (this.safeSpot) {
      this.state = EscapeState.MOVING_TO_SAFETY;
    } else if (!this.isOnFire()) {
      this.state = EscapeState.SAFE;
    }

    return null;
  }

  private handleEscapingWater(): Task | null {
    // Swim up
    this.bot.setControlState('jump', true);

    // Look for surface
    const surfacePos = this.findWaterSurface();
    if (surfacePos) {
      this.safeSpot = surfacePos;
      this.state = EscapeState.MOVING_TO_SAFETY;
      return null;
    }

    if (!this.isDrowning()) {
      this.state = EscapeState.SAFE;
    }

    return null;
  }

  private handleEscapingVoid(): Task | null {
    // Not much we can do about void...
    // Check for elytra and try to fly up
    if (this.hasElytra()) {
      this.bot.setControlState('jump', true);
      // Would need to activate elytra
    }

    this.state = EscapeState.FAILED;
    return null;
  }

  private handleFindingSafeSpot(): Task | null {
    this.safeSpot = this.findSafeSpotFrom(this.currentDanger);

    if (this.safeSpot) {
      this.state = EscapeState.MOVING_TO_SAFETY;
    } else {
      // Keep moving in current direction
      this.bot.setControlState('forward', true);
    }

    return null;
  }

  private handleMovingToSafety(): Task | null {
    if (!this.safeSpot) {
      this.state = EscapeState.FINDING_SAFE_SPOT;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.safeSpot);

    if (dist <= 2) {
      // Check if still in danger
      if (!this.isInDanger()) {
        this.state = EscapeState.SAFE;
        this.bot.clearControlStates();
      } else {
        // Find new safe spot
        this.state = EscapeState.FINDING_SAFE_SPOT;
      }
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.safeSpot.x),
      Math.floor(this.safeSpot.y),
      Math.floor(this.safeSpot.z),
      2
    );
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.safeSpot = null;
  }

  isFinished(): boolean {
    return this.state === EscapeState.SAFE || this.state === EscapeState.FAILED;
  }

  isFailed(): boolean {
    return this.state === EscapeState.FAILED;
  }

  // ---- Helper Methods ----

  private isInLava(): boolean {
    const pos = this.bot.entity.position;
    const block = this.bot.blockAt(new Vec3(
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z)
    ));
    return block?.name === 'lava';
  }

  private isOnFire(): boolean {
    // Check entity metadata for fire
    return (this.bot.entity as any).isOnFire ?? false;
  }

  private isDrowning(): boolean {
    // Check air level
    const air = (this.bot as any).oxygenLevel ?? 20;
    return air < this.config.airThreshold && this.isInWater();
  }

  private isInWater(): boolean {
    const pos = this.bot.entity.position;
    const block = this.bot.blockAt(new Vec3(
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z)
    ));
    return block?.name === 'water';
  }

  private isInVoid(): boolean {
    return this.bot.entity.position.y < this.config.voidThreshold;
  }

  private isInDanger(): boolean {
    return this.isInLava() || this.isOnFire() || this.isDrowning() || this.isInVoid();
  }

  private findSafeSpotFrom(danger: DangerType): Vec3 | null {
    const pos = this.bot.entity.position;
    let best: Vec3 | null = null;
    let bestDist = Infinity;

    for (let x = -this.config.safeSpotRadius; x <= this.config.safeSpotRadius; x++) {
      for (let z = -this.config.safeSpotRadius; z <= this.config.safeSpotRadius; z++) {
        for (let y = -5; y <= 5; y++) {
          const checkPos = new Vec3(
            Math.floor(pos.x) + x,
            Math.floor(pos.y) + y,
            Math.floor(pos.z) + z
          );

          if (!this.isSafeSpot(checkPos, danger)) continue;

          const dist = pos.distanceTo(checkPos);
          if (dist < bestDist) {
            bestDist = dist;
            best = checkPos;
          }
        }
      }
    }

    return best;
  }

  private isSafeSpot(pos: Vec3, danger: DangerType): boolean {
    const block = this.bot.blockAt(pos);
    const blockBelow = this.bot.blockAt(pos.offset(0, -1, 0));
    const blockAbove = this.bot.blockAt(pos.offset(0, 1, 0));

    if (!block || !blockBelow) return false;

    // Must be air or passable
    if (block.boundingBox !== 'empty') return false;
    if (blockAbove && blockAbove.boundingBox !== 'empty') return false;

    // Must have solid ground
    if (blockBelow.boundingBox === 'empty') return false;

    // Check danger-specific conditions
    if (danger === DangerType.LAVA) {
      if (blockBelow.name === 'lava') return false;
      // Check nearby for lava
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const nearBlock = this.bot.blockAt(pos.offset(dx, 0, dz));
          if (nearBlock?.name === 'lava') return false;
        }
      }
    }

    if (danger === DangerType.FIRE) {
      if (block.name === 'fire') return false;
      if (blockBelow.name === 'fire' || blockBelow.name === 'magma_block') return false;
    }

    if (danger === DangerType.DROWNING) {
      if (block.name === 'water') return false;
    }

    return true;
  }

  private findNearbyWater(): Vec3 | null {
    const pos = this.bot.entity.position;

    for (let x = -8; x <= 8; x++) {
      for (let z = -8; z <= 8; z++) {
        for (let y = -3; y <= 3; y++) {
          const checkPos = new Vec3(
            Math.floor(pos.x) + x,
            Math.floor(pos.y) + y,
            Math.floor(pos.z) + z
          );
          const block = this.bot.blockAt(checkPos);
          if (block?.name === 'water') {
            return checkPos;
          }
        }
      }
    }

    return null;
  }

  private findWaterSurface(): Vec3 | null {
    const pos = this.bot.entity.position;

    for (let y = 0; y <= 20; y++) {
      const checkPos = new Vec3(
        Math.floor(pos.x),
        Math.floor(pos.y) + y,
        Math.floor(pos.z)
      );
      const block = this.bot.blockAt(checkPos);
      if (block?.name !== 'water') {
        return checkPos;
      }
    }

    return null;
  }

  private hasElytra(): boolean {
    // Check armor slots for elytra
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'elytra') {
        return true;
      }
    }
    return false;
  }

  /**
   * Get current danger type
   */
  getCurrentDanger(): DangerType {
    return this.currentDanger;
  }

  /**
   * Get current state
   */
  getCurrentState(): EscapeState {
    return this.state;
  }

  /**
   * Get safe spot
   */
  getSafeSpot(): Vec3 | null {
    return this.safeSpot;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return other instanceof EscapeDangerTask;
  }
}

/**
 * Convenience functions
 */
export function escapeDanger(bot: Bot): EscapeDangerTask {
  return new EscapeDangerTask(bot);
}

export function escapeLava(bot: Bot): EscapeDangerTask {
  return new EscapeDangerTask(bot, {
    checkLava: true,
    checkFire: false,
    checkDrowning: false,
    checkVoid: false,
  });
}

export function escapeFire(bot: Bot): EscapeDangerTask {
  return new EscapeDangerTask(bot, {
    checkLava: false,
    checkFire: true,
    checkDrowning: false,
    checkVoid: false,
  });
}

export function escapeDrowning(bot: Bot): EscapeDangerTask {
  return new EscapeDangerTask(bot, {
    checkLava: false,
    checkFire: false,
    checkDrowning: true,
    checkVoid: false,
  });
}

export function escapeAllDangers(bot: Bot): EscapeDangerTask {
  return new EscapeDangerTask(bot, {
    checkLava: true,
    checkFire: true,
    checkDrowning: true,
    checkVoid: true,
  });
}
