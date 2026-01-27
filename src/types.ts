import { Vec3 } from 'vec3';
import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';

/**
 * Core position type with efficient hashing (similar to Baritone's BetterBlockPos)
 */
export class BlockPos {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number
  ) {}

  /**
   * Efficient long hash using prime multipliers (Baritone-style)
   * Avoids collision issues with vanilla Minecraft's hashCode
   */
  static longHash(x: number, y: number, z: number): bigint {
    let hash = 3241n;
    hash = 3457689n * hash + BigInt(x | 0);
    hash = 8734625n * hash + BigInt(y | 0);
    hash = 2873465n * hash + BigInt(z | 0);
    return hash;
  }

  get hash(): bigint {
    return BlockPos.longHash(this.x, this.y, this.z);
  }

  get hashString(): string {
    return `${this.x},${this.y},${this.z}`;
  }

  equals(other: BlockPos): boolean {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }

  offset(dx: number, dy: number, dz: number): BlockPos {
    return new BlockPos(this.x + dx, this.y + dy, this.z + dz);
  }

  toVec3(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  static fromVec3(v: Vec3): BlockPos {
    return new BlockPos(Math.floor(v.x), Math.floor(v.y), Math.floor(v.z));
  }

  distanceTo(other: BlockPos): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dz = this.z - other.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  distanceSquared(other: BlockPos): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dz = this.z - other.z;
    return dx * dx + dy * dy + dz * dz;
  }
}

/**
 * Movement status returned by movement execution
 */
export enum MovementStatus {
  PREPPING,      // Preparing for movement (equipping, looking)
  WAITING,       // Waiting for something (falling, swimming)
  RUNNING,       // Actively moving
  SUCCESS,       // Movement completed successfully
  UNREACHABLE,   // Cannot complete this movement
  FAILED         // Movement failed (block changed, etc.)
}

/**
 * Ternary passability classification (Baritone-style)
 */
export enum Passability {
  YES,    // Definitely passable
  NO,     // Definitely not passable
  MAYBE   // Need position-specific check
}

/**
 * Pathing block type for chunk caching (2-bit encoding)
 */
export enum PathingBlockType {
  AIR = 0b00,    // Passable, dry
  WATER = 0b01,  // Passable, wet
  AVOID = 0b10,  // Blocked, dangerous
  SOLID = 0b11   // Blocked, solid
}

/**
 * Block break/place action
 */
export interface BlockAction {
  pos: BlockPos;
  type: 'break' | 'place';
  block?: Block;
}

/**
 * Calculation context passed to movements for cost calculation
 */
export interface CalculationContext {
  bot: Bot;
  world: any; // prismarine-world

  // Precomputed block data
  canWalkOn(block: Block | null): boolean;
  canWalkThrough(block: Block | null): boolean;
  isWater(block: Block | null): boolean;
  isLava(block: Block | null): boolean;

  // Block access
  getBlock(x: number, y: number, z: number): Block | null;

  // Tool calculations
  getBreakTime(block: Block): number;
  getBestTool(block: Block): any;

  // Settings
  canDig: boolean;
  canPlace: boolean;
  allowSprint: boolean;
  allowParkour: boolean;
  allowWaterBucket: boolean;

  // Jump penalty (increases with bad terrain)
  jumpPenalty: number;

  // Favoring multipliers
  getFavoring(x: number, y: number, z: number): number;
}

/**
 * Mutable move result for object pooling (Baritone-style)
 */
export class MutableMoveResult {
  x: number = 0;
  y: number = 0;
  z: number = 0;
  cost: number = Infinity;

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.cost = Infinity;
  }

  set(x: number, y: number, z: number, cost: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.cost = cost;
  }
}

/**
 * Path node for A* algorithm
 */
export class PathNode {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly hash: string;

  cost: number;                    // g(n) - cost from start
  estimatedCostToGoal: number;     // h(n) - heuristic
  combinedCost: number;            // f(n) = g(n) + h(n)
  previous: PathNode | null;
  heapPosition: number;            // For O(1) decrease-key

  // Movement info
  toBreak: BlockPos[];
  toPlace: BlockPos[];

  constructor(x: number, y: number, z: number, heuristic: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.hash = `${x},${y},${z}`;
    this.cost = Infinity;
    this.estimatedCostToGoal = heuristic;
    this.combinedCost = Infinity;
    this.previous = null;
    this.heapPosition = -1;
    this.toBreak = [];
    this.toPlace = [];
  }

  getPos(): BlockPos {
    return new BlockPos(this.x, this.y, this.z);
  }
}

/**
 * Path result from A* search
 */
export interface PathResult {
  status: 'success' | 'partial' | 'timeout' | 'noPath';
  path: PathNode[];
  cost: number;
  time: number;
  visitedNodes: number;
  generatedNodes: number;
}

/**
 * Goal interface
 */
export interface Goal {
  /**
   * Check if position is the end goal
   */
  isEnd(x: number, y: number, z: number): boolean;

  /**
   * Heuristic estimate of cost to reach goal from position
   */
  heuristic(x: number, y: number, z: number): number;
}

/**
 * Movement interface that all movement types implement
 */
export interface Movement {
  /**
   * Source position
   */
  readonly src: BlockPos;

  /**
   * Destination position
   */
  readonly dest: BlockPos;

  /**
   * Calculate cost of this movement
   */
  getCost(ctx: CalculationContext): number;

  /**
   * Execute one tick of this movement
   * Returns the current status
   */
  tick(ctx: CalculationContext): MovementStatus;

  /**
   * Reset movement state for re-execution
   */
  reset(): void;

  /**
   * Get blocks that need to be broken
   */
  getToBreak(): BlockPos[];

  /**
   * Get blocks that need to be placed
   */
  getToPlace(): BlockPos[];

  /**
   * Get all valid positions during this movement
   */
  getValidPositions(): BlockPos[];
}

/**
 * Infinity cost value (not MAX_VALUE to avoid overflow)
 */
export const COST_INF = 1000000;
