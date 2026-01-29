/**
 * LocateStrongholdCoordinatesTask - Stronghold Location via Eye Triangulation
 * Based on BaritonePlus's LocateStrongholdCoordinatesTask.java
 *
 * WHY: Finding the stronghold is essential for speedruns and beating Minecraft:
 * - Strongholds contain the End Portal to reach the End dimension
 * - Eye of Ender triangulation is faster than random searching
 * - Two throws from different positions pinpoint the exact location
 *
 * The triangulation algorithm:
 * 1. Throw first eye, track its flight direction
 * 2. Move perpendicular to that direction
 * 3. Throw second eye, track its direction
 * 4. Calculate intersection point of both direction vectors
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToDimensionTask } from '../composite/PortalTask';
import { GoInDirectionXZTask } from './BlockSearchTask';
import { UseItemTask } from './UseItemTask';
import { BlockPos } from '../../types';
import { Dimension } from './ResourceTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Distance to stronghold estimate before rethrowing for accuracy
 */
const EYE_RETHROW_DISTANCE = 10;

/**
 * Target distance between first and second throw positions
 */
const SECOND_EYE_THROW_DISTANCE = 30;

/**
 * Represents a tracked eye of ender direction
 */
class EyeDirection {
  private start: Vec3;
  private end: Vec3 | null = null;

  constructor(startPos: Vec3) {
    this.start = startPos.clone();
  }

  /**
   * Update the eye's current position
   */
  updateEyePos(endPos: Vec3): void {
    this.end = endPos.clone();
  }

  /**
   * Get the origin of the throw
   */
  getOrigin(): Vec3 {
    return this.start;
  }

  /**
   * Get the direction vector of the eye's travel
   */
  getDelta(): Vec3 {
    if (!this.end) return new Vec3(0, 0, 0);
    return this.end.minus(this.start);
  }

  /**
   * Get the angle of the direction in the XZ plane
   */
  getAngle(): number {
    if (!this.end) return 0;
    const delta = this.getDelta();
    return Math.atan2(delta.x, delta.z);
  }

  /**
   * Check if we have a valid direction
   */
  hasDelta(): boolean {
    return this.end !== null && this.getDelta().norm() > 0.001;
  }
}

/**
 * State for stronghold location
 */
enum LocateState {
  GOING_TO_OVERWORLD,
  THROWING_FIRST_EYE,
  WAITING_FOR_FIRST_EYE,
  MOVING_FOR_SECOND_THROW,
  THROWING_SECOND_EYE,
  WAITING_FOR_SECOND_EYE,
  CALCULATING,
  FINISHED,
}

/**
 * Calculate the intersection of two 2D lines (in XZ plane)
 */
function calculateIntersection(
  start1: Vec3,
  direction1: Vec3,
  start2: Vec3,
  direction2: Vec3
): BlockPos {
  // Solve for start1 + direction1 * t1 = start2 + direction2 * t2
  // In XZ plane:
  // s1.x + d1.x * t1 = s2.x + d2.x * t2
  // s1.z + d1.z * t1 = s2.z + d2.z * t2
  //
  // Solving for t2:
  // t2 = ((d1.z * s2.x) - (d1.z * s1.x) - (d1.x * s2.z) + (d1.x * s1.z)) / ((d1.x * d2.z) - (d1.z * d2.x))

  const numerator =
    direction1.z * start2.x -
    direction1.z * start1.x -
    direction1.x * start2.z +
    direction1.x * start1.z;
  const denominator = direction1.x * direction2.z - direction1.z * direction2.x;

  if (Math.abs(denominator) < 0.0001) {
    // Lines are parallel, return midpoint as fallback
    return new BlockPos(
      Math.floor((start1.x + start2.x) / 2),
      0,
      Math.floor((start1.z + start2.z) / 2)
    );
  }

  const t2 = numerator / denominator;
  const intersection = start2.plus(direction2.scaled(t2));

  return new BlockPos(
    Math.floor(intersection.x),
    0,
    Math.floor(intersection.z)
  );
}

/**
 * Task to locate stronghold coordinates using eye of ender triangulation.
 *
 * WHY: This is the fastest way to find a stronghold:
 * - Throwing one eye gives a direction
 * - Throwing a second eye from a different position gives another direction
 * - The intersection of these directions is the stronghold
 *
 * Based on BaritonePlus LocateStrongholdCoordinatesTask.java
 */
export class LocateStrongholdCoordinatesTask extends Task {
  private targetEyes: number;
  private state: LocateState = LocateState.GOING_TO_OVERWORLD;
  private eyeDirection1: EyeDirection | null = null;
  private eyeDirection2: EyeDirection | null = null;
  private strongholdEstimate: BlockPos | null = null;
  private throwTimer: TimerGame;
  private trackedEyeEntity: any = null;

  constructor(bot: Bot, targetEyes: number = 2) {
    super(bot);
    this.targetEyes = targetEyes;
    this.throwTimer = new TimerGame(bot, 5);
  }

  get displayName(): string {
    return `LocateStronghold(state: ${LocateState[this.state]})`;
  }

  onStart(): void {
    this.state = LocateState.GOING_TO_OVERWORLD;
    this.eyeDirection1 = null;
    this.eyeDirection2 = null;
    this.strongholdEstimate = null;
    this.trackedEyeEntity = null;
  }

  onTick(): Task | null {
    const dimension = this.getCurrentDimension();

    // Must be in overworld to throw eyes
    if (dimension !== 'overworld') {
      this.state = LocateState.GOING_TO_OVERWORLD;
      return new GoToDimensionTask(this.bot, Dimension.OVERWORLD);
    }

    // Check for eye of ender in inventory
    const hasEye = this.hasItem('ender_eye');
    if (!hasEye) {
      // Try to pick up dropped eyes
      // In a full implementation, would return a task to get eyes
      return null;
    }

    // Check for flying eye entity
    const eyeEntity = this.findEyeOfEnderEntity();

    // Handle eye tracking
    if (eyeEntity) {
      if (this.trackedEyeEntity !== eyeEntity) {
        // New eye thrown
        this.trackedEyeEntity = eyeEntity;

        if (this.eyeDirection2 !== null) {
          // Reset both if we already have two
          this.eyeDirection1 = null;
          this.eyeDirection2 = null;
        } else if (this.eyeDirection1 === null) {
          // First eye
          this.eyeDirection1 = new EyeDirection(eyeEntity.position);
          this.state = LocateState.WAITING_FOR_FIRST_EYE;
        } else {
          // Second eye
          this.eyeDirection2 = new EyeDirection(eyeEntity.position);
          this.state = LocateState.WAITING_FOR_SECOND_EYE;
        }
      }

      // Update eye position
      if (this.eyeDirection2 !== null) {
        this.eyeDirection2.updateEyePos(eyeEntity.position);
      } else if (this.eyeDirection1 !== null) {
        this.eyeDirection1.updateEyePos(eyeEntity.position);
      }

      return null; // Wait for eye to finish flying
    }

    // Eye finished flying, check if we can calculate
    if (
      this.eyeDirection1?.hasDelta() &&
      this.eyeDirection2?.hasDelta() &&
      this.strongholdEstimate === null
    ) {
      // Check if second throw angle is good (should be different from first)
      if (this.eyeDirection2.getAngle() >= this.eyeDirection1.getAngle()) {
        // Bad throw, retry
        this.eyeDirection1 = this.eyeDirection2;
        this.eyeDirection2 = null;
        this.state = LocateState.MOVING_FOR_SECOND_THROW;
      } else {
        // Calculate intersection
        this.strongholdEstimate = calculateIntersection(
          this.eyeDirection1.getOrigin(),
          this.eyeDirection1.getDelta(),
          this.eyeDirection2.getOrigin(),
          this.eyeDirection2.getDelta()
        );
        this.state = LocateState.FINISHED;
      }
    }

    // Re-throw if we got close to the estimate
    if (this.strongholdEstimate !== null) {
      const playerPos = this.bot.entity.position;
      const dist = Math.sqrt(
        Math.pow(playerPos.x - this.strongholdEstimate.x, 2) +
          Math.pow(playerPos.z - this.strongholdEstimate.z, 2)
      );
      if (dist < EYE_RETHROW_DISTANCE) {
        // Re-throw for accuracy
        this.strongholdEstimate = null;
        this.eyeDirection1 = null;
        this.eyeDirection2 = null;
        this.state = LocateState.THROWING_FIRST_EYE;
      }
    }

    // Throw eye if needed
    if (this.eyeDirection1 === null) {
      this.state = LocateState.THROWING_FIRST_EYE;
      return this.throwEyeTask();
    }

    // Move for second throw
    if (this.eyeDirection1.hasDelta() && this.eyeDirection2 === null) {
      const playerPos = this.bot.entity.position;
      const origin = this.eyeDirection1.getOrigin();
      const distSq = playerPos.distanceSquared(origin);

      if (distSq < SECOND_EYE_THROW_DISTANCE * SECOND_EYE_THROW_DISTANCE) {
        this.state = LocateState.MOVING_FOR_SECOND_THROW;
        // Move perpendicular to the eye direction
        const delta = this.eyeDirection1.getDelta();
        const perpendicular = new Vec3(-delta.z, 0, delta.x).normalize();
        return new GoInDirectionXZTask(this.bot, origin, perpendicular, SECOND_EYE_THROW_DISTANCE);
      }

      // We're far enough, throw second eye
      this.state = LocateState.THROWING_SECOND_EYE;
      return this.throwEyeTask();
    }

    return null;
  }

  /**
   * Get current dimension
   */
  private getCurrentDimension(): string {
    const dimName = (this.bot as any).game?.dimension || 'overworld';
    if (dimName.includes('nether')) return 'nether';
    if (dimName.includes('end')) return 'the_end';
    return 'overworld';
  }

  /**
   * Check if player has item
   */
  private hasItem(itemName: string): boolean {
    return this.bot.inventory.items().some((item) => item.name.includes(itemName));
  }

  /**
   * Find eye of ender entity in the world
   */
  private findEyeOfEnderEntity(): any | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'eye_of_ender' || entity.name === 'ender_eye') {
        return entity;
      }
    }
    return null;
  }

  /**
   * Create task to throw eye of ender
   */
  private throwEyeTask(): Task | null {
    // Equip and use eye of ender
    const eyeItem = this.bot.inventory.items().find((item) => item.name.includes('ender_eye'));
    if (eyeItem) {
      // Equip the eye and then use it
      this.bot.equip(eyeItem, 'hand');
      return new UseItemTask(this.bot, 1.0);
    }
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.trackedEyeEntity = null;
  }

  isFinished(): boolean {
    return this.strongholdEstimate !== null;
  }

  /**
   * Get the estimated stronghold coordinates
   */
  getStrongholdCoordinates(): BlockPos | null {
    return this.strongholdEstimate;
  }

  /**
   * Check if currently searching (has at least one eye direction)
   */
  isSearching(): boolean {
    return this.eyeDirection1 !== null;
  }

  /**
   * Get current state
   */
  getState(): LocateState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof LocateStrongholdCoordinatesTask;
  }
}

/**
 * Convenience function to locate stronghold
 */
export function locateStronghold(bot: Bot, targetEyes: number = 2): LocateStrongholdCoordinatesTask {
  return new LocateStrongholdCoordinatesTask(bot, targetEyes);
}

export { LocateState, EyeDirection, calculateIntersection };
