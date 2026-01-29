/**
 * RunAwayFromHostilesTask - Hostile Mob Flee Task
 * Based on BaritonePlus's escape/safety system
 *
 * Task for fleeing from hostile mobs.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToTask';
import { EscapeState } from './EscapeFromLavaTask';

/**
 * Configuration for RunAwayFromHostilesTask
 */
export interface HostileFleeConfig {
  /** Distance to run from hostiles */
  fleeDistance: number;
  /** Include skeletons (might want to fight them for arrows) */
  includeSkeletons: boolean;
  /** Hostile mob types to flee from */
  hostileTypes: string[];
  /** Sprint while fleeing */
  sprint: boolean;
}

const DEFAULT_HOSTILE_CONFIG: HostileFleeConfig = {
  fleeDistance: 20,
  includeSkeletons: false,
  hostileTypes: [
    'zombie', 'husk', 'drowned', 'zombie_villager',
    'skeleton', 'stray', 'wither_skeleton',
    'spider', 'cave_spider',
    'creeper',
    'witch',
    'phantom',
    'pillager', 'vindicator', 'ravager', 'evoker', 'vex',
    'piglin_brute', 'hoglin', 'zoglin',
    'warden',
  ],
  sprint: true,
};

/**
 * Task to run away from hostile mobs.
 *
 * WHY: When low on health, resources, or just exploring, sometimes
 * running is smarter than fighting. This task handles fleeing from
 * multiple hostile mobs at once, calculating the safest escape route.
 *
 * Based on BaritonePlus RunAwayFromHostilesTask.java
 */
export class RunAwayFromHostilesTask extends Task {
  private config: HostileFleeConfig;
  private state: EscapeState = EscapeState.ASSESSING;
  private fleeTarget: Vec3 | null = null;
  private nearbyHostiles: Entity[] = [];

  constructor(bot: Bot, config: Partial<HostileFleeConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_HOSTILE_CONFIG, ...config };
  }

  get displayName(): string {
    return `RunAwayFromHostiles(${this.nearbyHostiles.length})`;
  }

  onStart(): void {
    this.state = EscapeState.ASSESSING;
    this.fleeTarget = null;
    this.nearbyHostiles = [];
    this.updateHostiles();
  }

  onTick(): Task | null {
    this.updateHostiles();

    // No hostiles nearby - we're safe
    if (this.nearbyHostiles.length === 0) {
      this.state = EscapeState.SAFE;
      this.clearControls();
      return null;
    }

    switch (this.state) {
      case EscapeState.ASSESSING:
        return this.handleAssessing();

      case EscapeState.ESCAPING:
        return this.handleEscaping();

      case EscapeState.SAFE:
        this.state = EscapeState.FINISHED;
        return null;

      default:
        return null;
    }
  }

  private handleAssessing(): Task | null {
    this.fleeTarget = this.calculateFleeTarget();
    this.state = EscapeState.ESCAPING;
    return null;
  }

  private handleEscaping(): Task | null {
    if (this.config.sprint) {
      this.bot.setControlState('sprint', true);
    }

    if (!this.fleeTarget) {
      this.bot.setControlState('forward', true);
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.fleeTarget.x),
      Math.floor(this.fleeTarget.y),
      Math.floor(this.fleeTarget.z),
      2
    );
  }

  private clearControls(): void {
    this.bot.setControlState('sprint', false);
    this.bot.setControlState('forward', false);
  }

  onStop(interruptTask: ITask | null): void {
    this.clearControls();
    this.nearbyHostiles = [];
    this.fleeTarget = null;
  }

  isFinished(): boolean {
    return this.state === EscapeState.FINISHED ||
           this.state === EscapeState.SAFE ||
           this.nearbyHostiles.length === 0;
  }

  // ---- Helper methods ----

  private updateHostiles(): void {
    this.nearbyHostiles = [];
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;

      const name = entity.name ?? '';

      // Check if hostile type
      if (!this.config.hostileTypes.includes(name)) continue;

      // Skip skeletons if configured
      if (!this.config.includeSkeletons && name.includes('skeleton')) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist < this.config.fleeDistance) {
        this.nearbyHostiles.push(entity);
      }
    }
  }

  private calculateFleeTarget(): Vec3 | null {
    if (this.nearbyHostiles.length === 0) return null;

    const playerPos = this.bot.entity.position;

    // Calculate average position of hostiles
    let hostileCenter = new Vec3(0, 0, 0);
    for (const hostile of this.nearbyHostiles) {
      hostileCenter = hostileCenter.plus(hostile.position);
    }
    hostileCenter = hostileCenter.scaled(1 / this.nearbyHostiles.length);

    // Flee in opposite direction
    const fleeDir = playerPos.minus(hostileCenter);
    const len = Math.sqrt(fleeDir.x * fleeDir.x + fleeDir.z * fleeDir.z);

    if (len < 0.1) {
      const angle = Math.random() * Math.PI * 2;
      return playerPos.plus(new Vec3(
        Math.cos(angle) * this.config.fleeDistance,
        0,
        Math.sin(angle) * this.config.fleeDistance
      ));
    }

    return playerPos.plus(fleeDir.scaled(this.config.fleeDistance / len));
  }

  /**
   * Get current hostile count
   */
  getHostileCount(): number {
    return this.nearbyHostiles.length;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof RunAwayFromHostilesTask)) return false;
    return Math.abs(this.config.fleeDistance - other.config.fleeDistance) < 1;
  }
}

export function runFromHostiles(bot: Bot, distance: number = 20): RunAwayFromHostilesTask {
  return new RunAwayFromHostilesTask(bot, { fleeDistance: distance });
}

export function runFromAllHostiles(bot: Bot): RunAwayFromHostilesTask {
  return new RunAwayFromHostilesTask(bot, {
    includeSkeletons: true,
    fleeDistance: 25,
    sprint: true,
  });
}
