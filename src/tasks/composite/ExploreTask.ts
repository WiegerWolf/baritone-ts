/**
 * ExploreTask - Terrain Exploration Task
 * Based on AltoClef's exploration behavior
 *
 * Systematically explores the world, discovering new chunks
 * and optionally searching for specific features.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToTask, GoToNearTask } from '../concrete/GoToTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Exploration direction pattern
 */
export enum ExplorePattern {
  SPIRAL,     // Spiral outward from start
  CARDINAL,   // Alternate N/S/E/W
  RANDOM,     // Random directions
  TOWARDS,    // Move towards a target
}

/**
 * State for exploration
 */
enum ExploreState {
  CHOOSING_TARGET,
  MOVING,
  ARRIVED,
  FINISHED
}

/**
 * Configuration for exploration
 */
export interface ExploreConfig {
  /** Exploration pattern */
  pattern: ExplorePattern;
  /** Distance per exploration step */
  stepDistance: number;
  /** Maximum distance from start (0 = unlimited) */
  maxDistance: number;
  /** Target position for TOWARDS pattern */
  targetPosition?: Vec3;
  /** Number of chunks to explore (0 = unlimited) */
  targetChunks: number;
  /** Avoid water */
  avoidWater: boolean;
  /** Avoid dangerous areas (lava, high drops) */
  avoidDanger: boolean;
}

const DEFAULT_CONFIG: ExploreConfig = {
  pattern: ExplorePattern.SPIRAL,
  stepDistance: 32,
  maxDistance: 0,
  targetChunks: 0,
  avoidWater: true,
  avoidDanger: true,
};

/**
 * Track explored chunks
 */
interface ChunkKey {
  x: number;
  z: number;
}

/**
 * Task to explore the world
 */
export class ExploreTask extends Task {
  private config: ExploreConfig;
  private state: ExploreState = ExploreState.CHOOSING_TARGET;
  private startPosition: Vec3 | null = null;
  private currentTarget: Vec3 | null = null;
  private exploredChunks: Set<string> = new Set();
  private spiralIndex: number = 0;
  private cardinalIndex: number = 0;
  private moveTimer: TimerGame;
  private stuckTimer: TimerGame;
  private lastPosition: Vec3 | null = null;

  constructor(bot: Bot, config: Partial<ExploreConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.moveTimer = new TimerGame(bot, 30); // 30 seconds to reach target
    this.stuckTimer = new TimerGame(bot, 5); // Check stuck every 5 seconds
  }

  get displayName(): string {
    return `Explore(${this.exploredChunks.size} chunks, pattern: ${ExplorePattern[this.config.pattern]})`;
  }

  onStart(): void {
    this.state = ExploreState.CHOOSING_TARGET;
    this.startPosition = this.bot.entity.position.clone();
    this.currentTarget = null;
    this.exploredChunks = new Set();
    this.spiralIndex = 0;
    this.cardinalIndex = 0;
    this.lastPosition = null;

    // Mark starting chunk as explored
    this.markChunkExplored(this.startPosition);
  }

  onTick(): Task | null {
    // Check if we've reached target chunks
    if (this.config.targetChunks > 0 && this.exploredChunks.size >= this.config.targetChunks) {
      this.state = ExploreState.FINISHED;
      return null;
    }

    switch (this.state) {
      case ExploreState.CHOOSING_TARGET:
        return this.handleChoosingTarget();

      case ExploreState.MOVING:
        return this.handleMoving();

      case ExploreState.ARRIVED:
        return this.handleArrived();

      default:
        return null;
    }
  }

  private handleChoosingTarget(): Task | null {
    // Choose next exploration target based on pattern
    switch (this.config.pattern) {
      case ExplorePattern.SPIRAL:
        this.currentTarget = this.getSpiralTarget();
        break;
      case ExplorePattern.CARDINAL:
        this.currentTarget = this.getCardinalTarget();
        break;
      case ExplorePattern.RANDOM:
        this.currentTarget = this.getRandomTarget();
        break;
      case ExplorePattern.TOWARDS:
        this.currentTarget = this.getTowardsTarget();
        break;
    }

    if (!this.currentTarget) {
      this.state = ExploreState.FINISHED;
      return null;
    }

    // Check max distance
    if (this.config.maxDistance > 0 && this.startPosition) {
      const distFromStart = this.currentTarget.distanceTo(this.startPosition);
      if (distFromStart > this.config.maxDistance) {
        this.state = ExploreState.FINISHED;
        return null;
      }
    }

    this.moveTimer.reset();
    this.stuckTimer.reset();
    this.lastPosition = this.bot.entity.position.clone();
    this.state = ExploreState.MOVING;
    return null;
  }

  private handleMoving(): Task | null {
    if (!this.currentTarget) {
      this.state = ExploreState.CHOOSING_TARGET;
      return null;
    }

    // Check if arrived
    const dist = this.bot.entity.position.distanceTo(this.currentTarget);
    if (dist <= this.config.stepDistance / 2) {
      this.state = ExploreState.ARRIVED;
      return null;
    }

    // Check if stuck
    if (this.stuckTimer.elapsed()) {
      this.stuckTimer.reset();
      if (this.lastPosition) {
        const moved = this.bot.entity.position.distanceTo(this.lastPosition);
        if (moved < 2) {
          // Stuck - choose new target
          this.state = ExploreState.CHOOSING_TARGET;
          return null;
        }
      }
      this.lastPosition = this.bot.entity.position.clone();
    }

    // Check if taking too long
    if (this.moveTimer.elapsed()) {
      // Give up on this target
      this.state = ExploreState.CHOOSING_TARGET;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.currentTarget.x),
      Math.floor(this.currentTarget.y),
      Math.floor(this.currentTarget.z),
      8
    );
  }

  private handleArrived(): Task | null {
    if (this.currentTarget) {
      this.markChunkExplored(this.currentTarget);
    }

    this.state = ExploreState.CHOOSING_TARGET;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.currentTarget = null;
  }

  isFinished(): boolean {
    return this.state === ExploreState.FINISHED;
  }

  // ---- Target Selection ----

  private getSpiralTarget(): Vec3 | null {
    if (!this.startPosition) return null;

    // Spiral pattern: move outward in increasing squares
    // 0: E, 1: N, 2: W, 3: W, 4: S, 5: S, 6: E, 7: E, 8: E, etc.
    const directions = [
      new Vec3(1, 0, 0),   // E
      new Vec3(0, 0, -1),  // N
      new Vec3(-1, 0, 0),  // W
      new Vec3(0, 0, 1),   // S
    ];

    // Calculate which ring and position in spiral
    let steps = 0;
    let ring = 1;
    let dirIndex = 0;
    let stepsInDir = 0;
    let maxStepsInDir = 1;
    let sidesCompleted = 0;

    const pos = this.startPosition.clone();

    while (steps < this.spiralIndex) {
      pos.add(directions[dirIndex].scaled(this.config.stepDistance));
      stepsInDir++;
      steps++;

      if (stepsInDir >= maxStepsInDir) {
        stepsInDir = 0;
        dirIndex = (dirIndex + 1) % 4;
        sidesCompleted++;

        if (sidesCompleted >= 2) {
          sidesCompleted = 0;
          maxStepsInDir++;
        }
      }
    }

    this.spiralIndex++;

    // Adjust Y to ground level
    return this.adjustToGround(pos);
  }

  private getCardinalTarget(): Vec3 | null {
    const pos = this.bot.entity.position.clone();
    const directions = [
      new Vec3(0, 0, -1),  // N
      new Vec3(1, 0, 0),   // E
      new Vec3(0, 0, 1),   // S
      new Vec3(-1, 0, 0),  // W
    ];

    const dir = directions[this.cardinalIndex % 4];
    this.cardinalIndex++;

    const target = pos.add(dir.scaled(this.config.stepDistance));
    return this.adjustToGround(target);
  }

  private getRandomTarget(): Vec3 | null {
    const pos = this.bot.entity.position.clone();

    const angle = Math.random() * Math.PI * 2;
    const dx = Math.cos(angle) * this.config.stepDistance;
    const dz = Math.sin(angle) * this.config.stepDistance;

    const target = pos.offset(dx, 0, dz);
    return this.adjustToGround(target);
  }

  private getTowardsTarget(): Vec3 | null {
    if (!this.config.targetPosition) return null;

    const pos = this.bot.entity.position.clone();
    const target = this.config.targetPosition;

    // Move towards target
    const diff = target.minus(pos);
    const dist = diff.norm();

    if (dist <= this.config.stepDistance) {
      return target;
    }

    const direction = diff.scaled(1 / dist);
    const nextTarget = pos.add(direction.scaled(this.config.stepDistance));

    return this.adjustToGround(nextTarget);
  }

  // ---- Helper Methods ----

  private adjustToGround(pos: Vec3): Vec3 {
    // Find ground level at this XZ position
    const x = Math.floor(pos.x);
    const z = Math.floor(pos.z);

    // Start from current Y and search for ground
    const startY = Math.floor(this.bot.entity.position.y);

    for (let y = startY + 10; y >= startY - 30; y--) {
      const block = this.bot.blockAt(new Vec3(x, y, z));
      const above = this.bot.blockAt(new Vec3(x, y + 1, z));

      if (!block || !above) continue;

      // Check if this is walkable ground
      const isSolid = block.boundingBox === 'block';
      const isAboveAir = above.name === 'air' || above.boundingBox === 'empty';

      if (isSolid && isAboveAir) {
        // Check for danger
        if (this.config.avoidDanger) {
          if (block.name === 'lava' || block.name.includes('lava')) continue;
        }

        // Check for water
        if (this.config.avoidWater) {
          if (block.name === 'water' || block.name.includes('water')) continue;
        }

        return new Vec3(x, y + 1, z);
      }
    }

    // Couldn't find ground, return original
    return pos;
  }

  private markChunkExplored(pos: Vec3): void {
    const chunkX = Math.floor(pos.x / 16);
    const chunkZ = Math.floor(pos.z / 16);
    this.exploredChunks.add(`${chunkX},${chunkZ}`);
  }

  private isChunkExplored(pos: Vec3): boolean {
    const chunkX = Math.floor(pos.x / 16);
    const chunkZ = Math.floor(pos.z / 16);
    return this.exploredChunks.has(`${chunkX},${chunkZ}`);
  }

  /**
   * Get count of explored chunks
   */
  getExploredCount(): number {
    return this.exploredChunks.size;
  }

  /**
   * Get distance from start
   */
  getDistanceFromStart(): number {
    if (!this.startPosition) return 0;
    return this.bot.entity.position.distanceTo(this.startPosition);
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ExploreTask)) return false;

    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Convenience functions
 */
export function exploreSpiral(bot: Bot, chunks: number = 0): ExploreTask {
  return new ExploreTask(bot, {
    pattern: ExplorePattern.SPIRAL,
    targetChunks: chunks,
  });
}

export function exploreTowards(bot: Bot, target: Vec3): ExploreTask {
  return new ExploreTask(bot, {
    pattern: ExplorePattern.TOWARDS,
    targetPosition: target,
  });
}

export function exploreRandom(bot: Bot, chunks: number = 0): ExploreTask {
  return new ExploreTask(bot, {
    pattern: ExplorePattern.RANDOM,
    targetChunks: chunks,
  });
}

export function exploreArea(bot: Bot, maxDistance: number): ExploreTask {
  return new ExploreTask(bot, {
    pattern: ExplorePattern.SPIRAL,
    maxDistance,
  });
}
