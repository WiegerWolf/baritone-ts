import { Goal } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

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
