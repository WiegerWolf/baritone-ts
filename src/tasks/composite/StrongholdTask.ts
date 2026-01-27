/**
 * StrongholdTask - Stronghold Navigation
 * Based on AltoClef patterns
 *
 * Handles finding strongholds using eye of ender triangulation,
 * navigating to them, and locating the end portal.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for stronghold finding
 */
enum StrongholdState {
  PREPARING,
  FIRST_THROW,
  TRAVELING_TO_SECOND,
  SECOND_THROW,
  TRIANGULATING,
  NAVIGATING,
  SEARCHING_PORTAL,
  AT_PORTAL,
  FINISHED,
  FAILED
}

/**
 * Eye throw data for triangulation
 */
interface EyeThrow {
  position: Vec3;
  direction: Vec3;
}

/**
 * Configuration for stronghold finding
 */
export interface StrongholdConfig {
  /** Distance to travel between throws */
  throwDistance: number;
  /** Maximum search radius for portal */
  portalSearchRadius: number;
  /** Re-throw distance when close */
  rethrowDistance: number;
}

const DEFAULT_CONFIG: StrongholdConfig = {
  throwDistance: 30,
  portalSearchRadius: 64,
  rethrowDistance: 10,
};

/**
 * Task for finding and navigating to strongholds
 */
export class StrongholdTask extends Task {
  private config: StrongholdConfig;
  private state: StrongholdState = StrongholdState.PREPARING;
  private firstThrow: EyeThrow | null = null;
  private secondThrow: EyeThrow | null = null;
  private estimatedPosition: Vec3 | null = null;
  private portalPosition: Vec3 | null = null;
  private throwTimer: TimerGame;

  constructor(bot: Bot, config: Partial<StrongholdConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.throwTimer = new TimerGame(bot, 2.0);
  }

  get displayName(): string {
    if (this.estimatedPosition) {
      const dist = this.bot.entity.position.distanceTo(this.estimatedPosition);
      return `Stronghold(~${Math.round(dist)}m, ${StrongholdState[this.state]})`;
    }
    return `Stronghold(${StrongholdState[this.state]})`;
  }

  onStart(): void {
    this.state = StrongholdState.PREPARING;
    this.firstThrow = null;
    this.secondThrow = null;
    this.estimatedPosition = null;
    this.portalPosition = null;
  }

  onTick(): Task | null {
    switch (this.state) {
      case StrongholdState.PREPARING:
        return this.handlePreparing();

      case StrongholdState.FIRST_THROW:
        return this.handleFirstThrow();

      case StrongholdState.TRAVELING_TO_SECOND:
        return this.handleTravelingToSecond();

      case StrongholdState.SECOND_THROW:
        return this.handleSecondThrow();

      case StrongholdState.TRIANGULATING:
        return this.handleTriangulating();

      case StrongholdState.NAVIGATING:
        return this.handleNavigating();

      case StrongholdState.SEARCHING_PORTAL:
        return this.handleSearchingPortal();

      case StrongholdState.AT_PORTAL:
        this.state = StrongholdState.FINISHED;
        return null;

      default:
        return null;
    }
  }

  private handlePreparing(): Task | null {
    // Check if we have ender eyes
    if (!this.hasEnderEyes(2)) {
      this.state = StrongholdState.FAILED;
      return null;
    }

    this.state = StrongholdState.FIRST_THROW;
    return null;
  }

  private handleFirstThrow(): Task | null {
    // Throw first eye and record direction
    this.firstThrow = this.throwEye();

    if (this.firstThrow) {
      this.state = StrongholdState.TRAVELING_TO_SECOND;
      this.throwTimer.reset();
    }

    return null;
  }

  private handleTravelingToSecond(): Task | null {
    if (!this.firstThrow) {
      this.state = StrongholdState.FAILED;
      return null;
    }

    // Calculate position for second throw
    const secondPos = this.calculateSecondThrowPosition(this.firstThrow);
    const dist = this.bot.entity.position.distanceTo(secondPos);

    if (dist > 5) {
      return new GoToNearTask(
        this.bot,
        Math.floor(secondPos.x),
        Math.floor(secondPos.y),
        Math.floor(secondPos.z),
        3
      );
    }

    this.state = StrongholdState.SECOND_THROW;
    return null;
  }

  private handleSecondThrow(): Task | null {
    // Throw second eye and record direction
    this.secondThrow = this.throwEye();

    if (this.secondThrow) {
      this.state = StrongholdState.TRIANGULATING;
    }

    return null;
  }

  private handleTriangulating(): Task | null {
    if (!this.firstThrow || !this.secondThrow) {
      this.state = StrongholdState.FAILED;
      return null;
    }

    // Calculate intersection point
    this.estimatedPosition = StrongholdTask.calculateIntersection(
      this.firstThrow.position,
      this.firstThrow.direction,
      this.secondThrow.position,
      this.secondThrow.direction
    );

    if (!this.estimatedPosition) {
      this.state = StrongholdState.FAILED;
      return null;
    }

    this.state = StrongholdState.NAVIGATING;
    return null;
  }

  private handleNavigating(): Task | null {
    if (!this.estimatedPosition) {
      this.state = StrongholdState.FAILED;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.estimatedPosition);

    if (dist <= this.config.rethrowDistance) {
      // Close enough, start searching
      this.state = StrongholdState.SEARCHING_PORTAL;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.estimatedPosition.x),
      Math.floor(this.estimatedPosition.y),
      Math.floor(this.estimatedPosition.z),
      this.config.rethrowDistance
    );
  }

  private handleSearchingPortal(): Task | null {
    // Search for end portal frame blocks
    const portal = this.findEndPortal();

    if (portal) {
      this.portalPosition = portal;
      this.state = StrongholdState.AT_PORTAL;
      return null;
    }

    // Keep searching underground
    // Look for stronghold blocks (stone bricks, etc.)
    const strongholdEntrance = this.findStrongholdEntrance();
    if (strongholdEntrance) {
      return new GoToNearTask(
        this.bot,
        Math.floor(strongholdEntrance.x),
        Math.floor(strongholdEntrance.y),
        Math.floor(strongholdEntrance.z),
        2
      );
    }

    // Dig down if needed
    this.state = StrongholdState.FAILED;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.state === StrongholdState.FINISHED || this.state === StrongholdState.FAILED;
  }

  isFailed(): boolean {
    return this.state === StrongholdState.FAILED;
  }

  // ---- Helper Methods ----

  private hasEnderEyes(count: number): boolean {
    let total = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'ender_eye') {
        total += item.count;
      }
    }
    return total >= count;
  }

  private throwEye(): EyeThrow | null {
    // Simulate eye throw
    // In reality, this would use the item and track the eye entity
    const pos = this.bot.entity.position.clone();

    // Get player's look direction
    const yaw = (this.bot.entity as any).yaw ?? 0;
    const pitch = (this.bot.entity as any).pitch ?? 0;

    // Convert yaw to direction (simplified)
    const direction = new Vec3(
      -Math.sin(yaw),
      0,
      Math.cos(yaw)
    );

    // Use ender eye
    try {
      // Equip and use
      const eye = this.bot.inventory.items().find(i => i.name === 'ender_eye');
      if (eye) {
        this.bot.equip(eye, 'hand');
        this.bot.activateItem();
      }
    } catch {
      // May fail
    }

    return { position: pos, direction };
  }

  private calculateSecondThrowPosition(firstThrow: EyeThrow): Vec3 {
    // Move perpendicular to first throw direction
    const perpendicular = new Vec3(
      -firstThrow.direction.z,
      0,
      firstThrow.direction.x
    );

    return firstThrow.position.plus(
      perpendicular.scaled(this.config.throwDistance)
    );
  }

  private findEndPortal(): Vec3 | null {
    const pos = this.bot.entity.position;

    for (let x = -this.config.portalSearchRadius; x <= this.config.portalSearchRadius; x += 4) {
      for (let z = -this.config.portalSearchRadius; z <= this.config.portalSearchRadius; z += 4) {
        for (let y = 0; y <= 64; y += 2) {
          const checkPos = pos.offset(x, -pos.y + y, z);
          const block = this.bot.blockAt(checkPos);

          if (block && block.name === 'end_portal_frame') {
            return checkPos.clone();
          }
        }
      }
    }

    return null;
  }

  private findStrongholdEntrance(): Vec3 | null {
    const pos = this.bot.entity.position;
    const strongholdBlocks = ['stone_bricks', 'mossy_stone_bricks', 'cracked_stone_bricks'];

    for (let x = -16; x <= 16; x += 2) {
      for (let z = -16; z <= 16; z += 2) {
        for (let y = -20; y <= 0; y++) {
          const checkPos = pos.offset(x, y, z);
          const block = this.bot.blockAt(checkPos);

          if (block && strongholdBlocks.includes(block.name)) {
            return checkPos.clone();
          }
        }
      }
    }

    return null;
  }

  /**
   * Calculate intersection of two eye trajectories
   * Uses 2D line intersection formula
   */
  static calculateIntersection(
    start1: Vec3,
    dir1: Vec3,
    start2: Vec3,
    dir2: Vec3
  ): Vec3 | null {
    // 2D line intersection (ignore Y)
    // Line 1: start1 + t * dir1
    // Line 2: start2 + s * dir2

    const denominator = (dir1.x * dir2.z) - (dir1.z * dir2.x);
    if (Math.abs(denominator) < 0.0001) {
      // Lines are parallel
      return null;
    }

    const t2 = (
      (dir1.z * start2.x) - (dir1.z * start1.x) -
      (dir1.x * start2.z) + (dir1.x * start1.z)
    ) / denominator;

    const x = start2.x + dir2.x * t2;
    const z = start2.z + dir2.z * t2;

    // Strongholds are typically at Y=30-40
    return new Vec3(Math.floor(x), 35, Math.floor(z));
  }

  /**
   * Get estimated stronghold position
   */
  getEstimatedPosition(): Vec3 | null {
    return this.estimatedPosition;
  }

  /**
   * Get portal position if found
   */
  getPortalPosition(): Vec3 | null {
    return this.portalPosition;
  }

  /**
   * Get current state
   */
  getCurrentState(): StrongholdState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof StrongholdTask)) return false;

    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Convenience functions
 */
export function findStronghold(bot: Bot): StrongholdTask {
  return new StrongholdTask(bot);
}

export function findStrongholdQuick(bot: Bot): StrongholdTask {
  return new StrongholdTask(bot, { throwDistance: 20 });
}

export function findStrongholdPrecise(bot: Bot): StrongholdTask {
  return new StrongholdTask(bot, { throwDistance: 50, rethrowDistance: 5 });
}
