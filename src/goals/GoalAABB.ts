import { Goal } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

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
