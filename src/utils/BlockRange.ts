/**
 * BlockRange - 3D Region Definition
 * Based on BaritonePlus's BlockRange.java
 *
 * WHY: Many gameplay systems need to define regions:
 * - Stash areas for storing items
 * - Build zones for construction
 * - Exclusion zones for safety
 * - Search bounds for exploration
 *
 * A BlockRange defines a rectangular 3D region with:
 * - Start and end positions (corners)
 * - Dimension awareness (overworld, nether, end)
 */

import { Vec3 } from 'vec3';
import { BlockPos } from '../types';
import { Dimension } from '../tasks/concrete/ResourceTask';

/**
 * Represents a 3D rectangular region in a specific dimension.
 *
 * WHY: Game systems often need to work with regions:
 * - Stash management: Store items in containers within a range
 * - Build systems: Construct within defined areas
 * - Search systems: Look for blocks in bounded regions
 *
 * The region is defined by two corner positions (start and end).
 */
export class BlockRange {
  public start: BlockPos;
  public end: BlockPos;
  public dimension: Dimension;

  constructor(start: BlockPos, end: BlockPos, dimension: Dimension = Dimension.OVERWORLD) {
    // Normalize so start is always the min corner and end is max corner
    this.start = new BlockPos(
      Math.min(start.x, end.x),
      Math.min(start.y, end.y),
      Math.min(start.z, end.z)
    );
    this.end = new BlockPos(
      Math.max(start.x, end.x),
      Math.max(start.y, end.y),
      Math.max(start.z, end.z)
    );
    this.dimension = dimension;
  }

  /**
   * Create a range from two positions
   */
  static fromPositions(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    dimension: Dimension = Dimension.OVERWORLD
  ): BlockRange {
    return new BlockRange(
      new BlockPos(x1, y1, z1),
      new BlockPos(x2, y2, z2),
      dimension
    );
  }

  /**
   * Create a range around a center point with a radius
   */
  static aroundPoint(
    center: BlockPos,
    radiusX: number,
    radiusY: number,
    radiusZ: number,
    dimension: Dimension = Dimension.OVERWORLD
  ): BlockRange {
    return new BlockRange(
      new BlockPos(center.x - radiusX, center.y - radiusY, center.z - radiusZ),
      new BlockPos(center.x + radiusX, center.y + radiusY, center.z + radiusZ),
      dimension
    );
  }

  /**
   * Create a range around a center point with uniform radius
   */
  static aroundPointUniform(
    center: BlockPos,
    radius: number,
    dimension: Dimension = Dimension.OVERWORLD
  ): BlockRange {
    return BlockRange.aroundPoint(center, radius, radius, radius, dimension);
  }

  /**
   * Check if a position is within this range
   */
  contains(pos: BlockPos, dimension?: Dimension): boolean {
    // If dimension is specified, check it matches
    if (dimension !== undefined && this.dimension !== dimension) {
      return false;
    }

    return (
      pos.x >= this.start.x && pos.x <= this.end.x &&
      pos.y >= this.start.y && pos.y <= this.end.y &&
      pos.z >= this.start.z && pos.z <= this.end.z
    );
  }

  /**
   * Check if a Vec3 position is within this range
   */
  containsVec3(pos: Vec3, dimension?: Dimension): boolean {
    return this.contains(
      new BlockPos(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z)),
      dimension
    );
  }

  /**
   * Get the center of this range
   */
  getCenter(): BlockPos {
    return new BlockPos(
      Math.floor((this.start.x + this.end.x) / 2),
      Math.floor((this.start.y + this.end.y) / 2),
      Math.floor((this.start.z + this.end.z) / 2)
    );
  }

  /**
   * Get the size of this range
   */
  getSize(): { x: number; y: number; z: number } {
    return {
      x: this.end.x - this.start.x + 1,
      y: this.end.y - this.start.y + 1,
      z: this.end.z - this.start.z + 1,
    };
  }

  /**
   * Get the volume of this range
   */
  getVolume(): number {
    const size = this.getSize();
    return size.x * size.y * size.z;
  }

  /**
   * Expand this range by a given amount in all directions
   */
  expand(amount: number): BlockRange {
    return new BlockRange(
      new BlockPos(this.start.x - amount, this.start.y - amount, this.start.z - amount),
      new BlockPos(this.end.x + amount, this.end.y + amount, this.end.z + amount),
      this.dimension
    );
  }

  /**
   * Check if two ranges are equal
   */
  equals(other: BlockRange): boolean {
    return (
      this.start.equals(other.start) &&
      this.end.equals(other.end) &&
      this.dimension === other.dimension
    );
  }

  /**
   * Get a string representation
   */
  toString(): string {
    const dimName = this.dimension === Dimension.NETHER ? 'nether'
      : this.dimension === Dimension.END ? 'end'
      : 'overworld';
    return `[${this.start.x},${this.start.y},${this.start.z} -> ${this.end.x},${this.end.y},${this.end.z}] (${dimName})`;
  }

  /**
   * Iterate over all positions in this range
   */
  *positions(): Generator<BlockPos> {
    for (let x = this.start.x; x <= this.end.x; x++) {
      for (let y = this.start.y; y <= this.end.y; y++) {
        for (let z = this.start.z; z <= this.end.z; z++) {
          yield new BlockPos(x, y, z);
        }
      }
    }
  }
}

/**
 * Convenience function to create a block range
 */
export function blockRange(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  dimension: Dimension = Dimension.OVERWORLD
): BlockRange {
  return BlockRange.fromPositions(x1, y1, z1, x2, y2, z2, dimension);
}

/**
 * Convenience function to create a range around a point
 */
export function blockRangeAround(
  center: BlockPos,
  radius: number,
  dimension: Dimension = Dimension.OVERWORLD
): BlockRange {
  return BlockRange.aroundPointUniform(center, radius, dimension);
}
