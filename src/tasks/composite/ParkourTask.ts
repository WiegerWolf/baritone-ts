/**
 * ParkourTask - Advanced Parkour Movement
 * Based on AltoClef patterns
 *
 * Handles 4-block jumps, ladder climbing, water escapes,
 * and complex multi-jump sequences.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for parkour movement
 */
enum ParkourState {
  ANALYZING,
  APPROACHING_START,
  ALIGNING,
  SPRINTING,
  JUMPING,
  IN_AIR,
  LANDING,
  CLIMBING,
  SWIMMING,
  FINISHED,
  FAILED
}

/**
 * Parkour move types
 */
export enum ParkourMoveType {
  SPRINT_JUMP,    // 4-block gap
  WALK_JUMP,      // 3-block gap
  STEP_UP,        // 1-block height
  LADDER_CLIMB,   // Climb ladder/vine
  WATER_ESCAPE,   // Get out of water
  NEO,            // 45-degree sprint jump
  HEAD_HITTER,    // Jump with ceiling
}

/**
 * Configuration for parkour
 */
export interface ParkourConfig {
  /** Target position to reach */
  target: Vec3;
  /** Allow sprint jumping */
  allowSprintJump: boolean;
  /** Allow ladder climbing */
  allowLadders: boolean;
  /** Allow water swimming */
  allowSwimming: boolean;
  /** Maximum gap to attempt */
  maxGapDistance: number;
  /** Maximum height difference */
  maxHeightDiff: number;
  /** Retry on failure */
  retryOnFail: boolean;
  /** Maximum retries */
  maxRetries: number;
}

const DEFAULT_CONFIG: ParkourConfig = {
  target: new Vec3(0, 0, 0),
  allowSprintJump: true,
  allowLadders: true,
  allowSwimming: true,
  maxGapDistance: 4,
  maxHeightDiff: 3,
  retryOnFail: true,
  maxRetries: 3,
};

/**
 * Jump distance by condition
 */
const JUMP_DISTANCES = {
  SOUL_SAND: 2,      // Slow movement
  WALK: 3,           // Standard walk jump
  SPRINT: 4,         // Sprint jump (optimal)
};

/**
 * Movement costs (ticks per block)
 */
const MOVEMENT_COSTS = {
  WALK: 4.633,       // 20/4.317
  SPRINT: 3.564,     // 20/5.612
  LADDER: 8.511,     // 20/2.35
};

/**
 * Task for advanced parkour movement
 */
export class ParkourTask extends Task {
  private config: ParkourConfig;
  private state: ParkourState = ParkourState.ANALYZING;
  private currentMove: ParkourMoveType = ParkourMoveType.WALK_JUMP;
  private jumpTimer: TimerGame;
  private alignTimer: TimerGame;
  private retryCount: number = 0;
  private jumpStartPos: Vec3 | null = null;

  constructor(bot: Bot, target: Vec3, config: Partial<ParkourConfig> = {}) {
    super(bot);
    this.config = {
      ...DEFAULT_CONFIG,
      target: target.clone(),
      ...config
    };
    this.jumpTimer = new TimerGame(bot, 0.5);
    this.alignTimer = new TimerGame(bot, 2.0);
  }

  get displayName(): string {
    const dist = this.getDistanceToTarget();
    return `Parkour(${Math.round(dist)}m, ${ParkourState[this.state]}, ${ParkourMoveType[this.currentMove]})`;
  }

  onStart(): void {
    this.state = ParkourState.ANALYZING;
    this.retryCount = 0;
    this.jumpStartPos = null;
  }

  onTick(): Task | null {
    // Check if arrived
    if (this.hasArrived()) {
      this.state = ParkourState.FINISHED;
      return null;
    }

    switch (this.state) {
      case ParkourState.ANALYZING:
        return this.handleAnalyzing();

      case ParkourState.APPROACHING_START:
        return this.handleApproachingStart();

      case ParkourState.ALIGNING:
        return this.handleAligning();

      case ParkourState.SPRINTING:
        return this.handleSprinting();

      case ParkourState.JUMPING:
        return this.handleJumping();

      case ParkourState.IN_AIR:
        return this.handleInAir();

      case ParkourState.LANDING:
        return this.handleLanding();

      case ParkourState.CLIMBING:
        return this.handleClimbing();

      case ParkourState.SWIMMING:
        return this.handleSwimming();

      default:
        return null;
    }
  }

  private handleAnalyzing(): Task | null {
    const pos = this.bot.entity.position;
    const target = this.config.target;

    // Check current conditions
    if (this.isInWater()) {
      this.currentMove = ParkourMoveType.WATER_ESCAPE;
      this.state = ParkourState.SWIMMING;
      return null;
    }

    if (this.isOnLadder()) {
      this.currentMove = ParkourMoveType.LADDER_CLIMB;
      this.state = ParkourState.CLIMBING;
      return null;
    }

    // Calculate gap and height
    const gap = this.calculateGap(pos, target);
    const heightDiff = target.y - pos.y;

    // Determine move type
    if (gap > this.config.maxGapDistance || heightDiff > this.config.maxHeightDiff) {
      // Too far, need to approach first
      this.state = ParkourState.APPROACHING_START;
      return null;
    }

    // Select appropriate jump type
    if (this.isOnSoulSand()) {
      this.currentMove = gap <= JUMP_DISTANCES.SOUL_SAND
        ? ParkourMoveType.WALK_JUMP
        : ParkourMoveType.SPRINT_JUMP;
    } else if (gap <= JUMP_DISTANCES.WALK) {
      this.currentMove = ParkourMoveType.WALK_JUMP;
    } else if (gap <= JUMP_DISTANCES.SPRINT && this.config.allowSprintJump) {
      this.currentMove = ParkourMoveType.SPRINT_JUMP;
    } else {
      // Can't make jump
      this.state = ParkourState.APPROACHING_START;
      return null;
    }

    // Check for ceiling (head hitter)
    if (this.hasCeiling()) {
      this.currentMove = ParkourMoveType.HEAD_HITTER;
    }

    this.state = ParkourState.ALIGNING;
    this.alignTimer.reset();
    return null;
  }

  private handleApproachingStart(): Task | null {
    // Find intermediate position closer to target
    const intermediate = this.findIntermediatePosition();
    if (!intermediate) {
      this.state = ParkourState.FAILED;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(intermediate);
    if (dist < 1.0) {
      this.state = ParkourState.ANALYZING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(intermediate.x),
      Math.floor(intermediate.y),
      Math.floor(intermediate.z),
      1
    );
  }

  private handleAligning(): Task | null {
    const target = this.config.target;

    // Look toward target
    try {
      this.bot.lookAt(target);
    } catch {
      // May fail
    }

    // Wait for alignment
    if (!this.alignTimer.elapsed()) {
      // Move to edge if needed
      this.alignToEdge();
      return null;
    }

    // Ready to sprint/jump
    this.jumpStartPos = this.bot.entity.position.clone();
    if (this.currentMove === ParkourMoveType.SPRINT_JUMP) {
      this.state = ParkourState.SPRINTING;
    } else {
      this.state = ParkourState.JUMPING;
    }
    this.jumpTimer.reset();
    return null;
  }

  private handleSprinting(): Task | null {
    // Start sprinting toward target
    this.bot.setControlState('sprint', true);
    this.bot.setControlState('forward', true);

    // Jump at optimal distance from edge (< 0.7 blocks)
    const distFromStart = this.jumpStartPos
      ? this.bot.entity.position.distanceTo(this.jumpStartPos)
      : 0;

    if (distFromStart > 0.3 && distFromStart < 0.7) {
      this.state = ParkourState.JUMPING;
    }

    // Timeout protection
    if (this.jumpTimer.elapsed()) {
      this.state = ParkourState.JUMPING;
    }

    return null;
  }

  private handleJumping(): Task | null {
    // Execute jump
    this.bot.setControlState('jump', true);
    this.bot.setControlState('forward', true);

    if (this.currentMove === ParkourMoveType.SPRINT_JUMP) {
      this.bot.setControlState('sprint', true);
    }

    this.state = ParkourState.IN_AIR;
    this.jumpTimer.reset();
    return null;
  }

  private handleInAir(): Task | null {
    // Maintain forward momentum
    this.bot.setControlState('forward', true);
    if (this.currentMove === ParkourMoveType.SPRINT_JUMP) {
      this.bot.setControlState('sprint', true);
    }

    // Check if landed
    if ((this.bot as any).entity.onGround && this.jumpTimer.elapsed()) {
      this.state = ParkourState.LANDING;
    }

    return null;
  }

  private handleLanding(): Task | null {
    // Clear controls
    this.bot.clearControlStates();

    // Check if landed successfully
    const distToTarget = this.getDistanceToTarget();
    if (distToTarget < 2) {
      this.state = ParkourState.FINISHED;
      return null;
    }

    // Analyze for next jump
    this.state = ParkourState.ANALYZING;
    return null;
  }

  private handleClimbing(): Task | null {
    if (!this.config.allowLadders) {
      this.state = ParkourState.FAILED;
      return null;
    }

    // Climb up/down ladder
    const targetY = this.config.target.y;
    const currentY = this.bot.entity.position.y;

    if (Math.abs(targetY - currentY) < 1) {
      // At target height, dismount
      this.bot.setControlState('forward', true);
      this.state = ParkourState.LANDING;
      return null;
    }

    if (targetY > currentY) {
      this.bot.setControlState('jump', true);
      this.bot.setControlState('forward', true);
    } else {
      this.bot.setControlState('sneak', true);
    }

    return null;
  }

  private handleSwimming(): Task | null {
    if (!this.config.allowSwimming) {
      this.state = ParkourState.FAILED;
      return null;
    }

    // Try to get out of water
    const nearestLand = this.findNearestLand();
    if (!nearestLand) {
      // Swim toward target
      try {
        this.bot.lookAt(this.config.target);
      } catch {
        // May fail
      }
      this.bot.setControlState('forward', true);
      this.bot.setControlState('jump', true);
      return null;
    }

    // Swim toward land
    try {
      this.bot.lookAt(nearestLand);
    } catch {
      // May fail
    }
    this.bot.setControlState('forward', true);
    this.bot.setControlState('jump', true);

    if (!this.isInWater()) {
      this.state = ParkourState.LANDING;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.state === ParkourState.FINISHED || this.state === ParkourState.FAILED;
  }

  isFailed(): boolean {
    return this.state === ParkourState.FAILED;
  }

  // ---- Helper Methods ----

  private getDistanceToTarget(): number {
    return this.bot.entity.position.distanceTo(this.config.target);
  }

  private hasArrived(): boolean {
    return this.getDistanceToTarget() <= 1.5;
  }

  private calculateGap(from: Vec3, to: Vec3): number {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private isInWater(): boolean {
    const block = this.bot.blockAt(this.bot.entity.position);
    return block !== null && block.name === 'water';
  }

  private isOnLadder(): boolean {
    const block = this.bot.blockAt(this.bot.entity.position);
    if (!block) return false;
    return block.name === 'ladder' || block.name === 'vine';
  }

  private isOnSoulSand(): boolean {
    const below = this.bot.blockAt(this.bot.entity.position.offset(0, -1, 0));
    return below !== null && (below.name === 'soul_sand' || below.name === 'soul_soil');
  }

  private hasCeiling(): boolean {
    const above = this.bot.blockAt(this.bot.entity.position.offset(0, 2, 0));
    return above !== null && above.boundingBox !== 'empty';
  }

  private alignToEdge(): void {
    // Move slightly toward target to align at edge
    this.bot.setControlState('forward', true);
  }

  private findIntermediatePosition(): Vec3 | null {
    const pos = this.bot.entity.position;
    const target = this.config.target;

    // Find a position 3 blocks closer to target
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= 3) return target;

    const ratio = 3 / dist;
    return new Vec3(
      pos.x + dx * ratio,
      pos.y,
      pos.z + dz * ratio
    );
  }

  private findNearestLand(): Vec3 | null {
    const pos = this.bot.entity.position;

    for (let r = 1; r <= 5; r++) {
      for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
          for (let y = -2; y <= 2; y++) {
            const checkPos = pos.offset(x, y, z);
            const block = this.bot.blockAt(checkPos);
            const above = this.bot.blockAt(checkPos.offset(0, 1, 0));

            if (block && block.boundingBox !== 'empty' && block.name !== 'water' &&
                above && above.boundingBox === 'empty') {
              return checkPos.offset(0, 1, 0);
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Get current move type
   */
  getCurrentMoveType(): ParkourMoveType {
    return this.currentMove;
  }

  /**
   * Get current state
   */
  getCurrentState(): ParkourState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ParkourTask)) return false;

    return this.config.target.equals(other.config.target);
  }
}

/**
 * Convenience functions
 */
export function parkourTo(bot: Bot, target: Vec3): ParkourTask {
  return new ParkourTask(bot, target);
}

export function sprintJumpTo(bot: Bot, target: Vec3): ParkourTask {
  return new ParkourTask(bot, target, { allowSprintJump: true });
}

export function escapeWater(bot: Bot): ParkourTask {
  const pos = bot.entity.position;
  // Find nearest land and parkour there
  return new ParkourTask(bot, pos.offset(0, 1, 0), { allowSwimming: true });
}

export function climbLadder(bot: Bot, targetY: number): ParkourTask {
  const pos = bot.entity.position;
  return new ParkourTask(bot, new Vec3(pos.x, targetY, pos.z), { allowLadders: true });
}
