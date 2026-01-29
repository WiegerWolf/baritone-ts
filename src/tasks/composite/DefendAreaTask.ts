/**
 * DefendAreaTask - Area Defense Automation
 * Based on AltoClef patterns
 *
 * Handles defending a specific area from hostile mobs,
 * patrolling, and responding to threats.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { AttackEntityTask } from '../concrete/AttackEntityTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for area defense
 */
enum DefendState {
  PATROLLING,
  ENGAGING,
  PURSUING,
  RETURNING,
  RESTING,
  FINISHED,
  FAILED
}

/**
 * Hostile mob types
 */
const HOSTILE_MOBS = [
  'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider',
  'enderman', 'witch', 'slime', 'magma_cube', 'blaze',
  'ghast', 'wither_skeleton', 'piglin_brute', 'hoglin',
  'zoglin', 'ravager', 'vex', 'vindicator', 'pillager',
  'evoker', 'phantom', 'drowned', 'husk', 'stray',
];

/**
 * Configuration for area defense
 */
export interface DefendAreaConfig {
  /** Center of the defense area */
  center: Vec3;
  /** Radius to defend */
  radius: number;
  /** Maximum chase distance from center */
  maxChaseDistance: number;
  /** Mob types to engage */
  hostileTypes: string[];
  /** Attack range */
  attackRange: number;
  /** Patrol when no threats */
  patrolWhenIdle: boolean;
  /** Number of patrol points */
  patrolPoints: number;
  /** Rest between patrols (seconds) */
  restDuration: number;
  /** Continuous defense (never finish) */
  continuous: boolean;
  /** Duration to defend (seconds, if not continuous) */
  duration: number;
}

const DEFAULT_CONFIG: Partial<DefendAreaConfig> = {
  radius: 16,
  maxChaseDistance: 32,
  hostileTypes: HOSTILE_MOBS,
  attackRange: 3.5,
  patrolWhenIdle: true,
  patrolPoints: 4,
  restDuration: 2,
  continuous: true,
  duration: 300,
};

/**
 * Task for defending an area
 */
export class DefendAreaTask extends Task {
  private config: DefendAreaConfig;
  private state: DefendState = DefendState.PATROLLING;
  private currentTarget: Entity | null = null;
  private patrolIndex: number = 0;
  private patrolPositions: Vec3[] = [];
  private attackTimer: TimerGame;
  private restTimer: TimerGame;
  private durationTimer: TimerGame;
  private killCount: number = 0;

  constructor(bot: Bot, center: Vec3, config: Partial<DefendAreaConfig> = {}) {
    super(bot);
    this.config = {
      ...DEFAULT_CONFIG,
      center: center.clone(),
      ...config
    } as DefendAreaConfig;
    this.attackTimer = new TimerGame(bot, 0.5);
    this.restTimer = new TimerGame(bot, this.config.restDuration);
    this.durationTimer = new TimerGame(bot, this.config.duration);
    this.patrolPositions = this.generatePatrolPoints();
  }

  get displayName(): string {
    return `DefendArea(kills: ${this.killCount}, ${DefendState[this.state]})`;
  }

  onStart(): void {
    this.state = DefendState.PATROLLING;
    this.currentTarget = null;
    this.patrolIndex = 0;
    this.killCount = 0;
    this.durationTimer.reset();
  }

  onTick(): Task | null {
    // Check duration if not continuous
    if (!this.config.continuous && this.durationTimer.elapsed()) {
      this.state = DefendState.FINISHED;
      return null;
    }

    // Always check for threats
    const threat = this.findNearestThreat();
    if (threat && this.state !== DefendState.ENGAGING && this.state !== DefendState.PURSUING) {
      this.currentTarget = threat;
      this.state = DefendState.ENGAGING;
    }

    switch (this.state) {
      case DefendState.PATROLLING:
        return this.handlePatrolling();

      case DefendState.ENGAGING:
        return this.handleEngaging();

      case DefendState.PURSUING:
        return this.handlePursuing();

      case DefendState.RETURNING:
        return this.handleReturning();

      case DefendState.RESTING:
        return this.handleResting();

      default:
        return null;
    }
  }

  private handlePatrolling(): Task | null {
    if (!this.config.patrolWhenIdle) {
      // Just stand at center
      const dist = this.bot.entity.position.distanceTo(this.config.center);
      if (dist > 2) {
        return new GoToNearTask(
          this.bot,
          Math.floor(this.config.center.x),
          Math.floor(this.config.center.y),
          Math.floor(this.config.center.z),
          1
        );
      }
      return null;
    }

    // Patrol between points
    const targetPoint = this.patrolPositions[this.patrolIndex];
    const dist = this.bot.entity.position.distanceTo(targetPoint);

    if (dist <= 2) {
      // Reached patrol point, move to next
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPositions.length;
      this.state = DefendState.RESTING;
      this.restTimer.reset();
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(targetPoint.x),
      Math.floor(targetPoint.y),
      Math.floor(targetPoint.z),
      1
    );
  }

  private handleEngaging(): Task | null {
    if (!this.currentTarget || !this.currentTarget.isValid) {
      // Target died
      this.killCount++;
      this.currentTarget = null;
      this.state = DefendState.RETURNING;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentTarget.position);
    const distFromCenter = this.currentTarget.position.distanceTo(this.config.center);

    // Check if target left defense area
    if (distFromCenter > this.config.maxChaseDistance) {
      this.currentTarget = null;
      this.state = DefendState.RETURNING;
      return null;
    }

    // Move closer if needed
    if (dist > this.config.attackRange) {
      this.state = DefendState.PURSUING;
      return null;
    }

    // Attack
    if (this.attackTimer.elapsed()) {
      this.attackTimer.reset();
      return new AttackEntityTask(this.bot, this.currentTarget.id);
    }

    // Look at target
    try {
      this.bot.lookAt(this.currentTarget.position.offset(0, 1, 0));
    } catch {
      // May fail
    }

    return null;
  }

  private handlePursuing(): Task | null {
    if (!this.currentTarget || !this.currentTarget.isValid) {
      this.killCount++;
      this.currentTarget = null;
      this.state = DefendState.RETURNING;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentTarget.position);
    const distFromCenter = this.currentTarget.position.distanceTo(this.config.center);

    // Check chase limit
    if (distFromCenter > this.config.maxChaseDistance) {
      this.currentTarget = null;
      this.state = DefendState.RETURNING;
      return null;
    }

    // In range, switch to engaging
    if (dist <= this.config.attackRange) {
      this.state = DefendState.ENGAGING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.currentTarget.position.x),
      Math.floor(this.currentTarget.position.y),
      Math.floor(this.currentTarget.position.z),
      Math.floor(this.config.attackRange - 0.5)
    );
  }

  private handleReturning(): Task | null {
    const dist = this.bot.entity.position.distanceTo(this.config.center);

    if (dist <= this.config.radius) {
      this.state = DefendState.PATROLLING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.config.center.x),
      Math.floor(this.config.center.y),
      Math.floor(this.config.center.z),
      Math.floor(this.config.radius / 2)
    );
  }

  private handleResting(): Task | null {
    if (this.restTimer.elapsed()) {
      this.state = DefendState.PATROLLING;
    }
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.currentTarget = null;
  }

  isFinished(): boolean {
    return this.state === DefendState.FINISHED || this.state === DefendState.FAILED;
  }

  isFailed(): boolean {
    return this.state === DefendState.FAILED;
  }

  // ---- Helper Methods ----

  private generatePatrolPoints(): Vec3[] {
    const points: Vec3[] = [];
    const count = this.config.patrolPoints;
    const radius = this.config.radius * 0.7; // Patrol inside the area

    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count;
      const x = this.config.center.x + Math.cos(angle) * radius;
      const z = this.config.center.z + Math.sin(angle) * radius;
      points.push(new Vec3(x, this.config.center.y, z));
    }

    return points;
  }

  private findNearestThreat(): Entity | null {
    const center = this.config.center;
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;
      if (!this.isThreat(entity)) continue;

      const distFromCenter = entity.position.distanceTo(center);
      if (distFromCenter > this.config.radius) continue;

      const dist = this.bot.entity.position.distanceTo(entity.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private isThreat(entity: Entity): boolean {
    const name = entity.name ?? '';
    return this.config.hostileTypes.includes(name);
  }

  /**
   * Get kill count
   */
  getKillCount(): number {
    return this.killCount;
  }

  /**
   * Get current state
   */
  getCurrentState(): DefendState {
    return this.state;
  }

  /**
   * Get defense center
   */
  getCenter(): Vec3 {
    return this.config.center.clone();
  }

  /**
   * Get defense radius
   */
  getRadius(): number {
    return this.config.radius;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof DefendAreaTask)) return false;

    return this.config.center.equals(other.config.center) &&
           this.config.radius === other.config.radius;
  }
}

/**
 * Convenience functions
 */
export function defendArea(bot: Bot, center: Vec3, radius: number = 16): DefendAreaTask {
  return new DefendAreaTask(bot, center, { radius });
}

export function defendCurrentPosition(bot: Bot, radius: number = 16): DefendAreaTask {
  return new DefendAreaTask(bot, bot.entity.position.clone(), { radius });
}

export function defendForDuration(bot: Bot, center: Vec3, durationSeconds: number): DefendAreaTask {
  return new DefendAreaTask(bot, center, {
    continuous: false,
    duration: durationSeconds,
  });
}

export function defendWithPatrol(bot: Bot, center: Vec3, radius: number = 16): DefendAreaTask {
  return new DefendAreaTask(bot, center, {
    radius,
    patrolWhenIdle: true,
    patrolPoints: 4,
  });
}

export function defendStationary(bot: Bot, center: Vec3, radius: number = 16): DefendAreaTask {
  return new DefendAreaTask(bot, center, {
    radius,
    patrolWhenIdle: false,
  });
}
