/**
 * RunAwayFromCreepersTask - Creeper Flee Task
 * Based on BaritonePlus's escape/safety system
 *
 * Task for fleeing from creepers.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToTask';
import { EscapeState } from './EscapeFromLavaTask';

/**
 * Configuration for RunAwayFromCreepersTask
 */
export interface CreeperFleeConfig {
  /** Distance to maintain from creepers */
  fleeDistance: number;
  /** Extra distance for charged creepers */
  chargedCreeperDistance: number;
  /** Sprint while fleeing */
  sprint: boolean;
}

const DEFAULT_CREEPER_CONFIG: CreeperFleeConfig = {
  fleeDistance: 10,
  chargedCreeperDistance: 15,
  sprint: true,
};

/**
 * Task to run away from creepers.
 *
 * WHY: Creepers are uniquely dangerous - they explode and destroy blocks.
 * Unlike other mobs, the best strategy is always to run, not fight.
 * This task calculates safe distance based on creeper fuse state and charge.
 *
 * Based on BaritonePlus RunAwayFromCreepersTask.java
 */
export class RunAwayFromCreepersTask extends Task {
  private config: CreeperFleeConfig;
  private state: EscapeState = EscapeState.ASSESSING;
  private fleeTarget: Vec3 | null = null;
  private nearbyCreepers: Entity[] = [];

  constructor(bot: Bot, config: Partial<CreeperFleeConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CREEPER_CONFIG, ...config };
  }

  get displayName(): string {
    return `RunAwayFromCreepers(${this.nearbyCreepers.length} creepers)`;
  }

  onStart(): void {
    this.state = EscapeState.ASSESSING;
    this.fleeTarget = null;
    this.nearbyCreepers = [];
    this.updateCreepers();
  }

  onTick(): Task | null {
    this.updateCreepers();

    // No creepers nearby - we're safe
    if (this.nearbyCreepers.length === 0) {
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
    // Calculate flee direction (opposite of creeper center)
    this.fleeTarget = this.calculateFleeTarget();
    this.state = EscapeState.ESCAPING;
    return null;
  }

  private handleEscaping(): Task | null {
    if (this.config.sprint) {
      this.bot.setControlState('sprint', true);
    }

    if (!this.fleeTarget) {
      // Just run forward
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
    this.nearbyCreepers = [];
    this.fleeTarget = null;
  }

  isFinished(): boolean {
    return this.state === EscapeState.FINISHED ||
           this.state === EscapeState.SAFE ||
           this.nearbyCreepers.length === 0;
  }

  // ---- Helper methods ----

  private updateCreepers(): void {
    this.nearbyCreepers = [];
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity.name !== 'creeper') continue;

      const dist = playerPos.distanceTo(entity.position);
      const fleeDistance = this.getCreeperFleeDistance(entity);

      if (dist < fleeDistance) {
        this.nearbyCreepers.push(entity);
      }
    }
  }

  private getCreeperFleeDistance(creeper: Entity): number {
    // Check if charged creeper
    const metadata = (creeper as any).metadata;
    if (metadata && metadata[17] === true) {
      // Charged creepers have bigger explosion
      return this.config.chargedCreeperDistance;
    }

    // Check if fusing (ignited)
    if (metadata && metadata[16] === 1) {
      // Already fusing - need more distance
      return this.config.fleeDistance * 1.5;
    }

    return this.config.fleeDistance;
  }

  private calculateFleeTarget(): Vec3 | null {
    if (this.nearbyCreepers.length === 0) return null;

    const playerPos = this.bot.entity.position;

    // Calculate weighted center of creepers (closer = more weight)
    let creeperCenter = new Vec3(0, 0, 0);
    let totalWeight = 0;

    for (const creeper of this.nearbyCreepers) {
      const dist = playerPos.distanceTo(creeper.position);
      const weight = 1 / (dist + 1); // Inverse distance weight

      creeperCenter = creeperCenter.plus(creeper.position.scaled(weight));
      totalWeight += weight;
    }

    creeperCenter = creeperCenter.scaled(1 / totalWeight);

    // Flee in opposite direction
    const fleeDir = playerPos.minus(creeperCenter);
    const len = Math.sqrt(fleeDir.x * fleeDir.x + fleeDir.z * fleeDir.z);

    if (len < 0.1) {
      // Creepers on top of us - random direction
      const angle = Math.random() * Math.PI * 2;
      return playerPos.plus(new Vec3(
        Math.cos(angle) * this.config.fleeDistance,
        0,
        Math.sin(angle) * this.config.fleeDistance
      ));
    }

    return playerPos.plus(fleeDir.scaled(this.config.fleeDistance / len));
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof RunAwayFromCreepersTask)) return false;
    return Math.abs(this.config.fleeDistance - other.config.fleeDistance) < 1;
  }
}

export function runFromCreepers(bot: Bot, distance: number = 10): RunAwayFromCreepersTask {
  return new RunAwayFromCreepersTask(bot, { fleeDistance: distance });
}
