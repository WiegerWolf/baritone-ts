import { Vec3 } from 'vec3';
import { Goal } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

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
