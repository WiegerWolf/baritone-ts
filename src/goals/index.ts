import { Vec3 } from 'vec3';
import { Goal, BlockPos, COST_INF } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

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
