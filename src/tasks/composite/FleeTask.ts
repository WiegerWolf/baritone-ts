/**
 * FleeTask - Escape/Flee Automation
 * Based on AltoClef patterns
 *
 * Handles fleeing from dangerous situations including hostile mobs,
 * environmental hazards, and low health scenarios.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for fleeing
 */
enum FleeState {
  ASSESSING,
  FLEEING,
  HIDING,
  SAFE,
  FINISHED
}

/**
 * Flee trigger types
 */
export enum FleeTrigger {
  LOW_HEALTH,
  MOB_NEARBY,
  CREEPER_FUSING,
  ENVIRONMENTAL,
  MANUAL,
}

/**
 * Hostile mobs to flee from
 */
const FLEE_FROM_MOBS = [
  'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider',
  'enderman', 'witch', 'blaze', 'ghast', 'wither_skeleton',
  'piglin_brute', 'hoglin', 'zoglin', 'ravager', 'vex',
  'vindicator', 'pillager', 'evoker', 'phantom', 'drowned',
  'husk', 'stray', 'warden', 'wither',
];

/**
 * Configuration for fleeing
 */
export interface FleeConfig {
  /** Minimum safe distance from threats */
  safeDistance: number;
  /** Health threshold to trigger flee */
  healthThreshold: number;
  /** Mobs to flee from */
  fleeMobs: string[];
  /** Flee from creepers specifically */
  fleeCreepers: boolean;
  /** Creeper distance threshold */
  creeperDistance: number;
  /** Duration to stay hidden (seconds) */
  hideDuration: number;
  /** Try to break line of sight */
  breakLineOfSight: boolean;
  /** Use sprint while fleeing */
  sprintFlee: boolean;
  /** Flee toward spawn point */
  fleeTowardSpawn: boolean;
}

const DEFAULT_CONFIG: FleeConfig = {
  safeDistance: 32,
  healthThreshold: 6,
  fleeMobs: FLEE_FROM_MOBS,
  fleeCreepers: true,
  creeperDistance: 8,
  hideDuration: 10,
  breakLineOfSight: true,
  sprintFlee: true,
  fleeTowardSpawn: false,
};

/**
 * Task for fleeing from danger
 */
export class FleeTask extends Task {
  private config: FleeConfig;
  private state: FleeState = FleeState.ASSESSING;
  private trigger: FleeTrigger = FleeTrigger.MANUAL;
  private threats: Entity[] = [];
  private fleeDirection: Vec3 | null = null;
  private hideTimer: TimerGame;
  private updateTimer: TimerGame;
  private startHealth: number = 20;

  constructor(bot: Bot, config: Partial<FleeConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.hideTimer = new TimerGame(bot, this.config.hideDuration);
    this.updateTimer = new TimerGame(bot, 0.25);
  }

  get displayName(): string {
    return `Flee(${this.threats.length} threats, ${FleeState[this.state]}, ${FleeTrigger[this.trigger]})`;
  }

  onStart(): void {
    this.state = FleeState.ASSESSING;
    this.threats = [];
    this.fleeDirection = null;
    this.startHealth = this.bot.health;
    this.assessThreats();
  }

  onTick(): Task | null {
    // Update threats periodically
    if (this.updateTimer.elapsed()) {
      this.assessThreats();
      this.updateTimer.reset();
    }

    switch (this.state) {
      case FleeState.ASSESSING:
        return this.handleAssessing();

      case FleeState.FLEEING:
        return this.handleFleeing();

      case FleeState.HIDING:
        return this.handleHiding();

      case FleeState.SAFE:
        this.state = FleeState.FINISHED;
        return null;

      default:
        return null;
    }
  }

  private handleAssessing(): Task | null {
    // Check health
    if (this.bot.health <= this.config.healthThreshold) {
      this.trigger = FleeTrigger.LOW_HEALTH;
      this.state = FleeState.FLEEING;
      return null;
    }

    // Check for nearby threats
    if (this.threats.length > 0) {
      // Check for fusing creeper
      const fusingCreeper = this.findFusingCreeper();
      if (fusingCreeper) {
        this.trigger = FleeTrigger.CREEPER_FUSING;
        this.state = FleeState.FLEEING;
        return null;
      }

      // Regular mob threat
      this.trigger = FleeTrigger.MOB_NEARBY;
      this.state = FleeState.FLEEING;
      return null;
    }

    // Check environmental hazards
    if (this.isInDanger()) {
      this.trigger = FleeTrigger.ENVIRONMENTAL;
      this.state = FleeState.FLEEING;
      return null;
    }

    // No threats, we're safe
    this.state = FleeState.SAFE;
    return null;
  }

  private handleFleeing(): Task | null {
    // Calculate flee direction
    this.fleeDirection = this.calculateFleeDirection();

    if (!this.fleeDirection) {
      // Can't determine direction, just run
      this.bot.setControlState('forward', true);
      if (this.config.sprintFlee) {
        this.bot.setControlState('sprint', true);
      }
      return null;
    }

    // Check if we've reached safety
    if (this.isSafe()) {
      if (this.config.breakLineOfSight) {
        this.state = FleeState.HIDING;
        this.hideTimer.reset();
      } else {
        this.state = FleeState.SAFE;
      }
      return null;
    }

    // Sprint toward safety
    if (this.config.sprintFlee) {
      this.bot.setControlState('sprint', true);
    }

    const targetPos = this.bot.entity.position.plus(this.fleeDirection);

    return new GoToNearTask(
      this.bot,
      Math.floor(targetPos.x),
      Math.floor(targetPos.y),
      Math.floor(targetPos.z),
      2
    );
  }

  private handleHiding(): Task | null {
    // Stay hidden until timer expires
    if (!this.hideTimer.elapsed()) {
      // Crouch to be less visible
      this.bot.setControlState('sneak', true);

      // Re-check threats
      if (this.threats.length > 0 && !this.isSafe()) {
        // Threat got closer, flee again
        this.state = FleeState.FLEEING;
        this.bot.setControlState('sneak', false);
      }

      return null;
    }

    this.bot.setControlState('sneak', false);
    this.state = FleeState.SAFE;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.threats = [];
    this.fleeDirection = null;
  }

  isFinished(): boolean {
    return this.state === FleeState.FINISHED;
  }

  isFailed(): boolean {
    return false; // Fleeing doesn't fail
  }

  // ---- Helper Methods ----

  private assessThreats(): void {
    this.threats = [];
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;

      const name = entity.name ?? '';
      if (!this.config.fleeMobs.includes(name)) continue;

      const dist = playerPos.distanceTo(entity.position);

      // Different distances for different threats
      let threatDistance = this.config.safeDistance;
      if (name === 'creeper' && this.config.fleeCreepers) {
        threatDistance = this.config.creeperDistance;
      }

      if (dist <= threatDistance) {
        this.threats.push(entity);
      }
    }

    // Sort by distance (closest first)
    this.threats.sort((a, b) =>
      playerPos.distanceTo(a.position) - playerPos.distanceTo(b.position)
    );
  }

  private findFusingCreeper(): Entity | null {
    for (const entity of this.threats) {
      if (entity.name === 'creeper') {
        // Check fuse metadata
        const metadata = (entity as any).metadata;
        if (metadata && metadata[17] === 1) {
          // Fuse state = 1 means ignited
          return entity;
        }
      }
    }
    return null;
  }

  private calculateFleeDirection(): Vec3 | null {
    if (this.threats.length === 0) return null;

    const playerPos = this.bot.entity.position;

    // Average position of all threats
    let threatCenter = new Vec3(0, 0, 0);
    for (const threat of this.threats) {
      threatCenter = threatCenter.plus(threat.position);
    }
    threatCenter = threatCenter.scaled(1 / this.threats.length);

    // Flee in opposite direction
    const fleeDir = playerPos.minus(threatCenter);
    const len = Math.sqrt(fleeDir.x * fleeDir.x + fleeDir.z * fleeDir.z);

    if (len < 0.1) {
      // Threats are on top of us, flee in random direction
      const angle = Math.random() * Math.PI * 2;
      return new Vec3(
        Math.cos(angle) * this.config.safeDistance,
        0,
        Math.sin(angle) * this.config.safeDistance
      );
    }

    // Normalize and scale to safe distance
    return new Vec3(
      (fleeDir.x / len) * this.config.safeDistance,
      0,
      (fleeDir.z / len) * this.config.safeDistance
    );
  }

  private isSafe(): boolean {
    const playerPos = this.bot.entity.position;

    for (const threat of this.threats) {
      const dist = playerPos.distanceTo(threat.position);
      if (dist < this.config.safeDistance) {
        return false;
      }
    }

    return true;
  }

  private isInDanger(): boolean {
    // Check for lava nearby
    const pos = this.bot.entity.position;
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        for (let y = -1; y <= 1; y++) {
          const block = this.bot.blockAt(pos.offset(x, y, z));
          if (block && block.name === 'lava') {
            return true;
          }
        }
      }
    }

    // Check if on fire (would need entity metadata)
    return false;
  }

  /**
   * Get current threats
   */
  getThreats(): Entity[] {
    return [...this.threats];
  }

  /**
   * Get threat count
   */
  getThreatCount(): number {
    return this.threats.length;
  }

  /**
   * Get current trigger
   */
  getTrigger(): FleeTrigger {
    return this.trigger;
  }

  /**
   * Get current state
   */
  getCurrentState(): FleeState {
    return this.state;
  }

  /**
   * Manually trigger flee
   */
  triggerFlee(): void {
    this.trigger = FleeTrigger.MANUAL;
    this.state = FleeState.FLEEING;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof FleeTask)) return false;

    return this.config.safeDistance === other.config.safeDistance &&
           this.config.healthThreshold === other.config.healthThreshold;
  }
}

/**
 * Convenience functions
 */
export function flee(bot: Bot): FleeTask {
  return new FleeTask(bot);
}

export function fleeFromMobs(bot: Bot, distance: number = 32): FleeTask {
  return new FleeTask(bot, { safeDistance: distance });
}

export function fleeWhenLowHealth(bot: Bot, threshold: number = 6): FleeTask {
  return new FleeTask(bot, { healthThreshold: threshold });
}

export function fleeFromCreepers(bot: Bot): FleeTask {
  return new FleeTask(bot, {
    fleeCreepers: true,
    creeperDistance: 10,
    fleeMobs: ['creeper'],
  });
}

export function emergencyFlee(bot: Bot): FleeTask {
  return new FleeTask(bot, {
    safeDistance: 50,
    sprintFlee: true,
    breakLineOfSight: true,
    hideDuration: 15,
  });
}
