import { Goal, BlockPos } from '../types';

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
