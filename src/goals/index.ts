import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Goal, BlockPos, COST_INF } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

/**
 * Direction enum for GoalBlockSide
 */
export enum Direction {
  NORTH = 'north',
  SOUTH = 'south',
  EAST = 'east',
  WEST = 'west',
  UP = 'up',
  DOWN = 'down',
}

/**
 * Get direction vector for a Direction
 */
function getDirectionVector(dir: Direction): { x: number; y: number; z: number } {
  switch (dir) {
    case Direction.NORTH: return { x: 0, y: 0, z: -1 };
    case Direction.SOUTH: return { x: 0, y: 0, z: 1 };
    case Direction.EAST:  return { x: 1, y: 0, z: 0 };
    case Direction.WEST:  return { x: -1, y: 0, z: 0 };
    case Direction.UP:    return { x: 0, y: 1, z: 0 };
    case Direction.DOWN:  return { x: 0, y: -1, z: 0 };
  }
}

/**
 * Goal to reach a specific block position
 */
export class GoalBlock implements Goal {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number
  ) {}

  isEnd(x: number, y: number, z: number): boolean {
    return x === this.x && y === this.y && z === this.z;
  }

  heuristic(x: number, y: number, z: number): number {
    const dx = x - this.x;
    const dy = y - this.y;
    const dz = z - this.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) * WALK_ONE_BLOCK_COST;
  }

  static fromVec3(v: Vec3): GoalBlock {
    return new GoalBlock(Math.floor(v.x), Math.floor(v.y), Math.floor(v.z));
  }

  static fromBlockPos(pos: BlockPos): GoalBlock {
    return new GoalBlock(pos.x, pos.y, pos.z);
  }
}

/**
 * Goal to reach a specific X,Z coordinate (any Y level)
 */
export class GoalXZ implements Goal {
  constructor(
    public readonly x: number,
    public readonly z: number
  ) {}

  isEnd(x: number, _y: number, z: number): boolean {
    return x === this.x && z === this.z;
  }

  heuristic(x: number, _y: number, z: number): number {
    const dx = x - this.x;
    const dz = z - this.z;
    return Math.sqrt(dx * dx + dz * dz) * WALK_ONE_BLOCK_COST;
  }
}

/**
 * Goal to reach a specific Y level (any X,Z)
 */
export class GoalYLevel implements Goal {
  constructor(public readonly y: number) {}

  isEnd(_x: number, y: number, _z: number): boolean {
    return y === this.y;
  }

  heuristic(_x: number, y: number, _z: number): number {
    return Math.abs(y - this.y) * WALK_ONE_BLOCK_COST;
  }
}

/**
 * Goal to get within reach of a block (adjacent, not on top)
 */
export class GoalGetToBlock implements Goal {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number
  ) {}

  isEnd(x: number, y: number, z: number): boolean {
    // Must be adjacent (not on the block itself)
    const dx = Math.abs(x - this.x);
    const dy = Math.abs(y - this.y);
    const dz = Math.abs(z - this.z);

    // Adjacent means within 1 block on any axis
    if (dx > 1 || dy > 1 || dz > 1) return false;

    // But not on the block itself
    if (dx === 0 && dy === 0 && dz === 0) return false;

    return true;
  }

  heuristic(x: number, y: number, z: number): number {
    const dx = x - this.x;
    const dy = y - this.y;
    const dz = z - this.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // Subtract 1 because we want to be adjacent, not on top
    return Math.max(0, dist - 1) * WALK_ONE_BLOCK_COST;
  }
}

/**
 * Goal to get within a certain radius of a position
 */
export class GoalNear implements Goal {
  public readonly rangeSq: number;

  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number,
    public readonly range: number
  ) {
    this.rangeSq = range * range;
  }

  isEnd(x: number, y: number, z: number): boolean {
    const dx = x - this.x;
    const dy = y - this.y;
    const dz = z - this.z;
    return dx * dx + dy * dy + dz * dz <= this.rangeSq;
  }

  heuristic(x: number, y: number, z: number): number {
    const dx = x - this.x;
    const dy = y - this.y;
    const dz = z - this.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return Math.max(0, dist - this.range) * WALK_ONE_BLOCK_COST;
  }
}

/**
 * Goal where either head or feet can be at target (2 block tall entity)
 */
export class GoalTwoBlocks implements Goal {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number
  ) {}

  isEnd(x: number, y: number, z: number): boolean {
    if (x !== this.x || z !== this.z) return false;
    // Either feet at y or head at y (feet at y-1)
    return y === this.y || y === this.y - 1;
  }

  heuristic(x: number, y: number, z: number): number {
    const dx = x - this.x;
    const dz = z - this.z;

    // Check both positions
    const dy1 = y - this.y;        // feet at target
    const dy2 = y - (this.y - 1);  // head at target

    const dist1 = Math.sqrt(dx * dx + dy1 * dy1 + dz * dz);
    const dist2 = Math.sqrt(dx * dx + dy2 * dy2 + dz * dz);

    return Math.min(dist1, dist2) * WALK_ONE_BLOCK_COST;
  }
}

/**
 * Composite goal - succeeds if ANY sub-goal is reached
 */
export class GoalComposite implements Goal {
  constructor(public readonly goals: Goal[]) {
    if (goals.length === 0) {
      throw new Error('GoalComposite requires at least one goal');
    }
  }

  isEnd(x: number, y: number, z: number): boolean {
    return this.goals.some(goal => goal.isEnd(x, y, z));
  }

  heuristic(x: number, y: number, z: number): number {
    let min = Infinity;
    for (const goal of this.goals) {
      const h = goal.heuristic(x, y, z);
      if (h < min) min = h;
    }
    return min;
  }

  /**
   * Create composite goal from multiple positions
   */
  static fromPositions(positions: BlockPos[]): GoalComposite {
    return new GoalComposite(
      positions.map(pos => new GoalBlock(pos.x, pos.y, pos.z))
    );
  }
}

/**
 * Inverted goal - succeeds if NOT at target
 * Useful for "get away from" scenarios
 */
export class GoalInverted implements Goal {
  constructor(public readonly inner: Goal) {}

  isEnd(x: number, y: number, z: number): boolean {
    return !this.inner.isEnd(x, y, z);
  }

  heuristic(x: number, y: number, z: number): number {
    // If we're at the target, we need to move
    if (this.inner.isEnd(x, y, z)) {
      return COST_INF;
    }
    // Otherwise we're already at the goal
    return 0;
  }
}

/**
 * Goal to run away from multiple danger points
 * Maximizes distance from all danger sources
 */
export class GoalRunAway implements Goal {
  public readonly minDistance: number;

  constructor(
    public readonly dangers: BlockPos[],
    minDistance: number = 16
  ) {
    this.minDistance = minDistance;
  }

  isEnd(x: number, y: number, z: number): boolean {
    // We're safe if far enough from ALL dangers
    for (const danger of this.dangers) {
      const dx = x - danger.x;
      const dy = y - danger.y;
      const dz = z - danger.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < this.minDistance * this.minDistance) {
        return false;
      }
    }
    return true;
  }

  heuristic(x: number, y: number, z: number): number {
    // Sum of distances to all dangers (negative because we want to maximize)
    let sum = 0;
    for (const danger of this.dangers) {
      const dx = x - danger.x;
      const dy = y - danger.y;
      const dz = z - danger.z;
      sum += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    // Negative sum so A* maximizes distance
    return -sum;
  }
}

/**
 * Goal to follow an entity (dynamic goal)
 */
export class GoalFollow implements Goal {
  private lastX: number;
  private lastY: number;
  private lastZ: number;

  public readonly rangeSq: number;

  constructor(
    public readonly entity: any, // Mineflayer entity
    public readonly range: number = 2
  ) {
    this.lastX = Math.floor(entity.position.x);
    this.lastY = Math.floor(entity.position.y);
    this.lastZ = Math.floor(entity.position.z);
    this.rangeSq = range * range;
  }

  isEnd(x: number, y: number, z: number): boolean {
    this.updatePosition();
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dz = z - this.lastZ;
    return dx * dx + dy * dy + dz * dz <= this.rangeSq;
  }

  heuristic(x: number, y: number, z: number): number {
    this.updatePosition();
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dz = z - this.lastZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return Math.max(0, dist - this.range) * WALK_ONE_BLOCK_COST;
  }

  private updatePosition(): void {
    if (this.entity?.position) {
      this.lastX = Math.floor(this.entity.position.x);
      this.lastY = Math.floor(this.entity.position.y);
      this.lastZ = Math.floor(this.entity.position.z);
    }
  }

  /**
   * Check if entity has moved significantly (goal changed)
   */
  hasChanged(): boolean {
    if (!this.entity?.position) return false;
    const x = Math.floor(this.entity.position.x);
    const y = Math.floor(this.entity.position.y);
    const z = Math.floor(this.entity.position.z);
    return x !== this.lastX || y !== this.lastY || z !== this.lastZ;
  }

  /**
   * Check if goal is still valid (entity exists)
   */
  isValid(): boolean {
    return this.entity != null && this.entity.position != null;
  }
}

/**
 * Goal to be within axis-aligned bounding box
 */
export class GoalAABB implements Goal {
  constructor(
    public readonly minX: number,
    public readonly minY: number,
    public readonly minZ: number,
    public readonly maxX: number,
    public readonly maxY: number,
    public readonly maxZ: number
  ) {}

  isEnd(x: number, y: number, z: number): boolean {
    return (
      x >= this.minX && x <= this.maxX &&
      y >= this.minY && y <= this.maxY &&
      z >= this.minZ && z <= this.maxZ
    );
  }

  heuristic(x: number, y: number, z: number): number {
    // Distance to nearest point in AABB
    const dx = Math.max(0, this.minX - x, x - this.maxX);
    const dy = Math.max(0, this.minY - y, y - this.maxY);
    const dz = Math.max(0, this.minZ - z, z - this.maxZ);
    return Math.sqrt(dx * dx + dy * dy + dz * dz) * WALK_ONE_BLOCK_COST;
  }
}

/**
 * GoalAnd - Composite goal that requires ALL sub-goals to be met
 * Based on BaritonePlus GoalAnd.java
 *
 * Unlike GoalComposite (any), this requires all goals to be satisfied.
 * Useful for complex conditions like "at position X AND at Y level Y"
 */
export class GoalAnd implements Goal {
  public readonly goals: Goal[];

  constructor(...goals: Goal[]) {
    if (goals.length === 0) {
      throw new Error('GoalAnd requires at least one goal');
    }
    this.goals = goals;
  }

  isEnd(x: number, y: number, z: number): boolean {
    for (const goal of this.goals) {
      if (!goal.isEnd(x, y, z)) {
        return false;
      }
    }
    return true;
  }

  heuristic(x: number, y: number, z: number): number {
    // Sum heuristics from all goals
    let sum = 0;
    for (const goal of this.goals) {
      sum += goal.heuristic(x, y, z);
    }
    return sum;
  }

  toString(): string {
    return `GoalAnd[${this.goals.join(', ')}]`;
  }
}

/**
 * GoalBlockSide - Goal to approach a block from a specific side
 * Based on BaritonePlus GoalBlockSide.java
 *
 * Useful for interacting with blocks that require approaching from
 * a specific direction (e.g., opening a door, using a chest)
 */
export class GoalBlockSide implements Goal {
  private dirVec: { x: number; y: number; z: number };

  constructor(
    public readonly blockX: number,
    public readonly blockY: number,
    public readonly blockZ: number,
    public readonly direction: Direction,
    public readonly bufferDistance: number = 1
  ) {
    this.dirVec = getDirectionVector(direction);
  }

  static fromBlockPos(pos: BlockPos, direction: Direction, buffer: number = 1): GoalBlockSide {
    return new GoalBlockSide(pos.x, pos.y, pos.z, direction, buffer);
  }

  isEnd(x: number, y: number, z: number): boolean {
    // We are on the right side if distance in the correct direction > 0
    return this.getDistanceInRightDirection(x, y, z) > 0;
  }

  heuristic(x: number, y: number, z: number): number {
    // How far are we from being on the right side
    return Math.min(this.getDistanceInRightDirection(x, y, z), 0) * -WALK_ONE_BLOCK_COST;
  }

  private getDistanceInRightDirection(x: number, y: number, z: number): number {
    const dx = x - this.blockX;
    const dy = y - this.blockY;
    const dz = z - this.blockZ;

    // Dot product with direction vector
    const dot = dx * this.dirVec.x + dy * this.dirVec.y + dz * this.dirVec.z;

    // Distance along the direction (direction is normalized)
    return dot - this.bufferDistance;
  }
}

/**
 * GoalChunk - Goal to reach any position within a chunk
 * Based on BaritonePlus GoalChunk.java
 *
 * Useful for chunk loading, exploration, or reaching general areas
 */
export class GoalChunk implements Goal {
  public readonly chunkX: number;
  public readonly chunkZ: number;

  constructor(chunkX: number, chunkZ: number) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
  }

  /**
   * Create from world coordinates
   */
  static fromWorldCoords(x: number, z: number): GoalChunk {
    return new GoalChunk(Math.floor(x / 16), Math.floor(z / 16));
  }

  /**
   * Get chunk start X coordinate
   */
  get startX(): number {
    return this.chunkX * 16;
  }

  /**
   * Get chunk end X coordinate
   */
  get endX(): number {
    return this.chunkX * 16 + 15;
  }

  /**
   * Get chunk start Z coordinate
   */
  get startZ(): number {
    return this.chunkZ * 16;
  }

  /**
   * Get chunk end Z coordinate
   */
  get endZ(): number {
    return this.chunkZ * 16 + 15;
  }

  isEnd(x: number, y: number, z: number): boolean {
    return this.startX <= x && x <= this.endX &&
           this.startZ <= z && z <= this.endZ;
  }

  heuristic(x: number, y: number, z: number): number {
    // Distance to center of chunk
    const cx = (this.startX + this.endX) / 2;
    const cz = (this.startZ + this.endZ) / 2;
    const dx = cx - x;
    const dz = cz - z;
    return Math.sqrt(dx * dx + dz * dz) * WALK_ONE_BLOCK_COST;
  }
}

/**
 * GoalDirectionXZ - Goal to move in a direction indefinitely
 * Based on BaritonePlus GoalDirectionXZ.java
 *
 * Never returns true for isEnd - used for exploration in a direction.
 * Minimizes deviation from the direction while maximizing progress.
 */
export class GoalDirectionXZ implements Goal {
  private originX: number;
  private originZ: number;
  private dirX: number;
  private dirZ: number;

  constructor(
    origin: Vec3 | { x: number; z: number },
    direction: Vec3 | { x: number; z: number },
    public readonly sidePenalty: number = 1.0
  ) {
    this.originX = origin.x;
    this.originZ = 'z' in origin ? origin.z : 0;

    // Normalize direction (XZ only)
    const len = Math.sqrt(direction.x * direction.x +
      ('z' in direction ? direction.z * direction.z : 0));

    if (len < 0.001) {
      throw new Error('Direction vector cannot be zero');
    }

    this.dirX = direction.x / len;
    this.dirZ = ('z' in direction ? direction.z : 0) / len;
  }

  isEnd(_x: number, _y: number, _z: number): boolean {
    // Direction goals never end - always keep going
    return false;
  }

  heuristic(x: number, y: number, z: number): number {
    const dx = x - this.originX;
    const dz = z - this.originZ;

    // How far we've traveled in the correct direction
    const correctDistance = dx * this.dirX + dz * this.dirZ;

    // Project position onto direction line
    const px = this.dirX * correctDistance;
    const pz = this.dirZ * correctDistance;

    // Perpendicular distance (deviation from line)
    const perpDistSq = (dx - px) * (dx - px) + (dz - pz) * (dz - pz);

    // Reward moving in direction, penalize deviation
    return -correctDistance * WALK_ONE_BLOCK_COST + perpDistSq * this.sidePenalty;
  }
}

/**
 * Entity supplier type for GoalRunAwayFromEntities
 */
export type EntitySupplier = () => Entity[];

/**
 * GoalRunAwayFromEntities - Goal to flee from multiple entities
 * Based on BaritonePlus GoalRunAwayFromEntities.java
 *
 * Calculates heuristic based on inverse distance to entities,
 * making positions farther from entities more desirable.
 */
export class GoalRunAwayFromEntities implements Goal {
  constructor(
    public readonly getEntities: EntitySupplier,
    public readonly minDistance: number = 16,
    public readonly xzOnly: boolean = false,
    public readonly penaltyFactor: number = 10
  ) {}

  isEnd(x: number, y: number, z: number): boolean {
    const entities = this.getEntities();
    const minDistSq = this.minDistance * this.minDistance;

    for (const entity of entities) {
      if (!entity || entity.isValid === false) continue;

      let distSq: number;
      if (this.xzOnly) {
        const dx = entity.position.x - x;
        const dz = entity.position.z - z;
        distSq = dx * dx + dz * dz;
      } else {
        const dx = entity.position.x - x;
        const dy = entity.position.y - y;
        const dz = entity.position.z - z;
        distSq = dx * dx + dy * dy + dz * dz;
      }

      if (distSq < minDistSq) {
        return false;
      }
    }

    return true;
  }

  heuristic(x: number, y: number, z: number): number {
    const entities = this.getEntities();
    let costSum = 0;
    let count = 0;
    const maxEntities = 10; // Limit to prevent calculation explosion

    for (const entity of entities) {
      if (count >= maxEntities) break;
      if (!entity || entity.isValid === false) continue;

      const cost = this.getCostOfEntity(entity, x, y, z);
      if (cost !== 0) {
        // Closer entities have bigger weight (1/distance)
        costSum += 1 / cost;
      } else {
        // On top of entity - very bad
        costSum += 1000;
      }

      count++;
    }

    if (count > 0) {
      costSum /= count;
    }

    return costSum * this.penaltyFactor;
  }

  private getCostOfEntity(entity: Entity, x: number, y: number, z: number): number {
    const ex = Math.floor(entity.position.x);
    const ey = Math.floor(entity.position.y);
    const ez = Math.floor(entity.position.z);

    let heuristic = 0;

    if (!this.xzOnly) {
      heuristic += Math.abs(ey - y) * WALK_ONE_BLOCK_COST;
    }

    const dx = ex - x;
    const dz = ez - z;
    heuristic += Math.sqrt(dx * dx + dz * dz) * WALK_ONE_BLOCK_COST;

    return heuristic;
  }
}
