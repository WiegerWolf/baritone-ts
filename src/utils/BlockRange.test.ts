/**
 * Tests for BlockRange utility class
 *
 * BlockRange defines 3D rectangular regions used for:
 * - Stash area boundaries
 * - Structure search regions
 * - Containment checks for positions
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Vec3 } from 'vec3';
import { BlockRange, blockRange, blockRangeAround } from './BlockRange';
import { BlockPos } from '../types';
import { Dimension } from '../tasks/concrete/ResourceTask';

describe('BlockRange', () => {
  describe('Construction and Normalization', () => {
    it('WHY: Normalizes coordinates so start is always min corner', () => {
      // Create range with end < start
      const range = new BlockRange(
        new BlockPos(10, 70, 10),
        new BlockPos(0, 60, 0)
      );

      // Should normalize so start is min corner
      expect(range.start.x).toBe(0);
      expect(range.start.y).toBe(60);
      expect(range.start.z).toBe(0);
      expect(range.end.x).toBe(10);
      expect(range.end.y).toBe(70);
      expect(range.end.z).toBe(10);
    });

    it('WHY: fromPositions creates range from coordinates', () => {
      const range = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.NETHER);

      expect(range.start.equals(new BlockPos(0, 60, 0))).toBe(true);
      expect(range.end.equals(new BlockPos(10, 70, 10))).toBe(true);
      expect(range.dimension).toBe(Dimension.NETHER);
    });

    it('WHY: aroundPoint creates symmetric range around center', () => {
      const center = new BlockPos(100, 65, 100);
      const range = BlockRange.aroundPoint(center, 5, 3, 5);

      expect(range.start.equals(new BlockPos(95, 62, 95))).toBe(true);
      expect(range.end.equals(new BlockPos(105, 68, 105))).toBe(true);
    });

    it('WHY: aroundPointUniform uses same radius in all directions', () => {
      const center = new BlockPos(0, 0, 0);
      const range = BlockRange.aroundPointUniform(center, 10);

      expect(range.start.equals(new BlockPos(-10, -10, -10))).toBe(true);
      expect(range.end.equals(new BlockPos(10, 10, 10))).toBe(true);
    });
  });

  describe('Containment Checking', () => {
    let range: BlockRange;

    beforeEach(() => {
      range = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.OVERWORLD);
    });

    it('WHY: contains returns true for positions inside range', () => {
      expect(range.contains(new BlockPos(5, 65, 5))).toBe(true);
      expect(range.contains(new BlockPos(0, 60, 0))).toBe(true);
      expect(range.contains(new BlockPos(10, 70, 10))).toBe(true);
    });

    it('WHY: contains returns false for positions outside range', () => {
      expect(range.contains(new BlockPos(-1, 65, 5))).toBe(false);
      expect(range.contains(new BlockPos(5, 59, 5))).toBe(false);
      expect(range.contains(new BlockPos(11, 65, 5))).toBe(false);
    });

    it('WHY: contains checks dimension when specified', () => {
      const netherRange = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.NETHER);

      // Position is in range but wrong dimension
      expect(netherRange.contains(new BlockPos(5, 65, 5), Dimension.OVERWORLD)).toBe(false);
      expect(netherRange.contains(new BlockPos(5, 65, 5), Dimension.NETHER)).toBe(true);
      expect(netherRange.contains(new BlockPos(5, 65, 5))).toBe(true); // No dimension check
    });

    it('WHY: containsVec3 works with floating point positions', () => {
      expect(range.containsVec3(new Vec3(5.5, 65.9, 5.1))).toBe(true);
      expect(range.containsVec3(new Vec3(-0.1, 65, 5))).toBe(false);
    });
  });

  describe('Geometry Methods', () => {
    let range: BlockRange;

    beforeEach(() => {
      range = BlockRange.fromPositions(0, 60, 0, 10, 70, 10);
    });

    it('WHY: getCenter returns the middle of the range', () => {
      const center = range.getCenter();
      expect(center.x).toBe(5);
      expect(center.y).toBe(65);
      expect(center.z).toBe(5);
    });

    it('WHY: getSize returns dimensions including endpoints', () => {
      const size = range.getSize();
      expect(size.x).toBe(11); // 0-10 inclusive
      expect(size.y).toBe(11); // 60-70 inclusive
      expect(size.z).toBe(11);
    });

    it('WHY: getVolume returns total blocks in range', () => {
      expect(range.getVolume()).toBe(11 * 11 * 11);
    });

    it('WHY: expand grows the range in all directions', () => {
      const expanded = range.expand(5);

      expect(expanded.start.equals(new BlockPos(-5, 55, -5))).toBe(true);
      expect(expanded.end.equals(new BlockPos(15, 75, 15))).toBe(true);
    });
  });

  describe('Equality and String Representation', () => {
    it('WHY: equals checks all properties', () => {
      const range1 = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.OVERWORLD);
      const range2 = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.OVERWORLD);
      const range3 = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.NETHER);
      const range4 = BlockRange.fromPositions(1, 60, 0, 10, 70, 10, Dimension.OVERWORLD);

      expect(range1.equals(range2)).toBe(true);
      expect(range1.equals(range3)).toBe(false); // Different dimension
      expect(range1.equals(range4)).toBe(false); // Different start
    });

    it('WHY: toString provides readable representation', () => {
      const range = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.NETHER);
      const str = range.toString();

      expect(str).toContain('0,60,0');
      expect(str).toContain('10,70,10');
      expect(str).toContain('nether');
    });
  });

  describe('Position Generator', () => {
    it('WHY: positions iterator yields all blocks in range', () => {
      const smallRange = BlockRange.fromPositions(0, 0, 0, 1, 1, 1);
      const positions = Array.from(smallRange.positions());

      expect(positions.length).toBe(8); // 2x2x2 = 8
      expect(positions.some(p => p.x === 0 && p.y === 0 && p.z === 0)).toBe(true);
      expect(positions.some(p => p.x === 1 && p.y === 1 && p.z === 1)).toBe(true);
    });
  });

  describe('Convenience Functions', () => {
    it('WHY: blockRange creates range from coordinates', () => {
      const range = blockRange(0, 60, 0, 10, 70, 10);
      expect(range.start.equals(new BlockPos(0, 60, 0))).toBe(true);
      expect(range.end.equals(new BlockPos(10, 70, 10))).toBe(true);
    });

    it('WHY: blockRangeAround creates symmetric range', () => {
      const range = blockRangeAround(new BlockPos(100, 65, 100), 5);
      expect(range.start.equals(new BlockPos(95, 60, 95))).toBe(true);
      expect(range.end.equals(new BlockPos(105, 70, 105))).toBe(true);
    });
  });
});
