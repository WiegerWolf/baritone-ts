/**
 * RunAwayFromPositionTask - Position Flee Task
 * Based on BaritonePlus's escape/safety system
 *
 * Task for fleeing from specific positions.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToTask';
import { EscapeState } from './EscapeFromLavaTask';

/**
 * Configuration for RunAwayFromPositionTask
 */
export interface PositionFleeConfig {
  /** Distance to maintain from danger positions */
  fleeDistance: number;
  /** Y level to maintain while fleeing (optional) */
  maintainY?: number;
}

const DEFAULT_POSITION_CONFIG: PositionFleeConfig = {
  fleeDistance: 15,
};

/**
 * Task to run away from specific positions.
 *
 * WHY: Sometimes we need to flee from dangerous blocks or positions -
 * explosions, lava pools, TNT, etc. This task calculates the optimal
 * direction away from multiple danger positions at once.
 *
 * Based on BaritonePlus RunAwayFromPositionTask.java
 */
export class RunAwayFromPositionTask extends Task {
  private config: PositionFleeConfig;
  private dangerPositions: Vec3[];
  private state: EscapeState = EscapeState.ASSESSING;
  private fleeTarget: Vec3 | null = null;

  constructor(
    bot: Bot,
    dangerPositions: Vec3[],
    config: Partial<PositionFleeConfig> = {}
  ) {
    super(bot);
    this.dangerPositions = dangerPositions;
    this.config = { ...DEFAULT_POSITION_CONFIG, ...config };
  }

  get displayName(): string {
    return `RunAwayFromPosition(${this.dangerPositions.length} positions, d=${this.config.fleeDistance})`;
  }

  onStart(): void {
    this.state = EscapeState.ASSESSING;
    this.fleeTarget = null;
  }

  onTick(): Task | null {
    // Check if we're safe from all positions
    if (this.isSafeFromAll()) {
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
    this.bot.setControlState('sprint', true);

    if (!this.fleeTarget) {
      this.bot.setControlState('forward', true);
      return null;
    }

    // If maintainY is set, adjust target Y
    let targetY = Math.floor(this.fleeTarget.y);
    if (this.config.maintainY !== undefined) {
      targetY = this.config.maintainY;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.fleeTarget.x),
      targetY,
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
    this.fleeTarget = null;
  }

  isFinished(): boolean {
    return this.state === EscapeState.FINISHED ||
           this.state === EscapeState.SAFE ||
           this.isSafeFromAll();
  }

  // ---- Helper methods ----

  private isSafeFromAll(): boolean {
    const playerPos = this.bot.entity.position;

    for (const dangerPos of this.dangerPositions) {
      const dist = playerPos.distanceTo(dangerPos);
      if (dist < this.config.fleeDistance) {
        return false;
      }
    }
    return true;
  }

  private calculateFleeTarget(): Vec3 | null {
    if (this.dangerPositions.length === 0) return null;

    const playerPos = this.bot.entity.position;

    // Calculate weighted center of danger (closer = more weight)
    let dangerCenter = new Vec3(0, 0, 0);
    let totalWeight = 0;

    for (const dangerPos of this.dangerPositions) {
      const dist = playerPos.distanceTo(dangerPos);
      const weight = 1 / (dist + 1);

      dangerCenter = dangerCenter.plus(dangerPos.scaled(weight));
      totalWeight += weight;
    }

    dangerCenter = dangerCenter.scaled(1 / totalWeight);

    // Flee in opposite direction
    const fleeDir = playerPos.minus(dangerCenter);
    const len = Math.sqrt(fleeDir.x * fleeDir.x + fleeDir.z * fleeDir.z);

    if (len < 0.1) {
      // Danger right on top of us - random direction
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
    if (!(other instanceof RunAwayFromPositionTask)) return false;

    if (this.dangerPositions.length !== other.dangerPositions.length) return false;

    // Check if all positions match
    for (let i = 0; i < this.dangerPositions.length; i++) {
      if (!this.dangerPositions[i].equals(other.dangerPositions[i])) return false;
    }

    return true;
  }
}

/**
 * Helper function to run away from positions
 */
export function runFromPositions(
  bot: Bot,
  distance: number,
  ...positions: Vec3[]
): RunAwayFromPositionTask {
  return new RunAwayFromPositionTask(bot, positions, { fleeDistance: distance });
}

/**
 * Helper function to run away from positions while maintaining Y level
 */
export function runFromPositionsAtY(
  bot: Bot,
  distance: number,
  maintainY: number,
  ...positions: Vec3[]
): RunAwayFromPositionTask {
  return new RunAwayFromPositionTask(bot, positions, {
    fleeDistance: distance,
    maintainY,
  });
}
