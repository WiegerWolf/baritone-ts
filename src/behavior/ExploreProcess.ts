import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BaseProcess, ProcessPriority, ProcessTickResult, ProcessState } from './Process';
import { Goal, BlockPos } from '../types';
import { GoalXZ, GoalNear } from '../goals';

/**
 * ExploreProcess handles world exploration
 * Based on Baritone's ExploreProcess
 *
 * Features:
 * - Systematic chunk exploration
 * - Random exploration mode
 * - Track explored chunks
 * - Avoid revisiting areas
 */

/**
 * Explore configuration
 */
export interface ExploreConfig {
  // Exploration mode
  mode: 'spiral' | 'random' | 'direction';
  // Center point for spiral exploration
  center?: { x: number; z: number };
  // Direction for directional exploration (degrees)
  direction?: number;
  // Minimum distance between exploration points
  minExploreDistance: number;
  // Maximum exploration radius from start
  maxRadius: number;
  // Track visited chunks
  trackVisited: boolean;
}

const DEFAULT_CONFIG: ExploreConfig = {
  mode: 'spiral',
  minExploreDistance: 64,
  maxRadius: 10000,
  trackVisited: true
};

export class ExploreProcess extends BaseProcess {
  readonly displayName = 'Explore';

  private config: ExploreConfig;
  private startPosition: Vec3 | null = null;
  private currentTarget: { x: number; z: number } | null = null;
  private visitedChunks: Set<string> = new Set();
  private explorationIndex: number = 0;

  // Spiral exploration state
  private spiralX: number = 0;
  private spiralZ: number = 0;
  private spiralDirection: number = 0; // 0=east, 1=south, 2=west, 3=north
  private spiralStepSize: number = 1;
  private spiralStepsTaken: number = 0;

  constructor(bot: Bot, pathfinder: any, config: Partial<ExploreConfig> = {}) {
    super(bot, pathfinder, ProcessPriority.LOW);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set exploration mode
   */
  setMode(mode: 'spiral' | 'random' | 'direction'): void {
    this.config.mode = mode;
  }

  /**
   * Set center point for spiral exploration
   */
  setCenter(x: number, z: number): void {
    this.config.center = { x, z };
  }

  /**
   * Set direction for directional exploration
   */
  setDirection(degrees: number): void {
    this.config.direction = degrees;
  }

  /**
   * Set maximum exploration radius
   */
  setMaxRadius(radius: number): void {
    this.config.maxRadius = radius;
  }

  /**
   * Clear visited chunk tracking
   */
  clearVisited(): void {
    this.visitedChunks.clear();
  }

  onActivate(): void {
    super.onActivate();
    this.startPosition = this.bot.entity.position.clone();

    if (this.config.mode === 'spiral') {
      // Initialize spiral from center or current position
      const center = this.config.center || {
        x: Math.floor(this.startPosition.x / 16) * 16,
        z: Math.floor(this.startPosition.z / 16) * 16
      };
      this.spiralX = center.x;
      this.spiralZ = center.z;
      this.spiralDirection = 0;
      this.spiralStepSize = 1;
      this.spiralStepsTaken = 0;
    }
  }

  onDeactivate(): void {
    super.onDeactivate();
    this.currentTarget = null;
  }

  tick(): ProcessTickResult {
    // Check if we've exceeded max radius
    if (this.startPosition) {
      const pos = this.bot.entity.position;
      const dx = pos.x - this.startPosition.x;
      const dz = pos.z - this.startPosition.z;
      const distFromStart = Math.sqrt(dx * dx + dz * dz);

      if (distFromStart > this.config.maxRadius) {
        return this.completeResult('Reached maximum exploration radius');
      }
    }

    // Get next exploration target
    if (!this.currentTarget || this.isAtTarget()) {
      this.currentTarget = this.getNextExplorationTarget();

      if (!this.currentTarget) {
        return this.completeResult('No more areas to explore');
      }
    }

    // Mark current chunk as visited
    if (this.config.trackVisited) {
      const chunkX = Math.floor(this.bot.entity.position.x / 16);
      const chunkZ = Math.floor(this.bot.entity.position.z / 16);
      this.visitedChunks.add(`${chunkX},${chunkZ}`);
    }

    // Create goal to exploration target
    const goal = new GoalXZ(this.currentTarget.x, this.currentTarget.z);

    return this.newGoalResult(goal, `Exploring (${this.currentTarget.x}, ${this.currentTarget.z})`);
  }

  /**
   * Check if we're at the current target
   */
  private isAtTarget(): boolean {
    if (!this.currentTarget) return false;

    const pos = this.bot.entity.position;
    const dx = pos.x - this.currentTarget.x;
    const dz = pos.z - this.currentTarget.z;
    const distSq = dx * dx + dz * dz;

    return distSq < this.config.minExploreDistance * this.config.minExploreDistance / 4;
  }

  /**
   * Get next exploration target based on mode
   */
  private getNextExplorationTarget(): { x: number; z: number } | null {
    switch (this.config.mode) {
      case 'spiral':
        return this.getNextSpiralTarget();
      case 'random':
        return this.getNextRandomTarget();
      case 'direction':
        return this.getNextDirectionalTarget();
      default:
        return null;
    }
  }

  /**
   * Get next target in spiral pattern
   */
  private getNextSpiralTarget(): { x: number; z: number } {
    // Move in current direction
    const directionOffsets = [
      { dx: 1, dz: 0 },  // East
      { dx: 0, dz: 1 },  // South
      { dx: -1, dz: 0 }, // West
      { dx: 0, dz: -1 }  // North
    ];

    const offset = directionOffsets[this.spiralDirection];
    this.spiralX += offset.dx * this.config.minExploreDistance;
    this.spiralZ += offset.dz * this.config.minExploreDistance;
    this.spiralStepsTaken++;

    // Check if we need to turn
    if (this.spiralStepsTaken >= this.spiralStepSize) {
      this.spiralStepsTaken = 0;
      this.spiralDirection = (this.spiralDirection + 1) % 4;

      // Increase step size every 2 turns
      if (this.spiralDirection === 0 || this.spiralDirection === 2) {
        this.spiralStepSize++;
      }
    }

    return { x: this.spiralX, z: this.spiralZ };
  }

  /**
   * Get random exploration target
   */
  private getNextRandomTarget(): { x: number; z: number } {
    const pos = this.bot.entity.position;
    const angle = Math.random() * Math.PI * 2;
    const distance = this.config.minExploreDistance + Math.random() * this.config.minExploreDistance;

    return {
      x: pos.x + Math.cos(angle) * distance,
      z: pos.z + Math.sin(angle) * distance
    };
  }

  /**
   * Get next target in specified direction
   */
  private getNextDirectionalTarget(): { x: number; z: number } {
    const pos = this.bot.entity.position;
    const angle = (this.config.direction ?? 0) * (Math.PI / 180);
    const distance = this.config.minExploreDistance;

    return {
      x: pos.x + Math.sin(angle) * distance,
      z: pos.z + Math.cos(angle) * distance
    };
  }

  /**
   * Get number of visited chunks
   */
  getVisitedChunkCount(): number {
    return this.visitedChunks.size;
  }

  /**
   * Check if a chunk has been visited
   */
  hasVisitedChunk(chunkX: number, chunkZ: number): boolean {
    return this.visitedChunks.has(`${chunkX},${chunkZ}`);
  }

  /**
   * Get current exploration target
   */
  getCurrentTarget(): { x: number; z: number } | null {
    return this.currentTarget;
  }
}
