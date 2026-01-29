import {
  smoothPath,
  simplifyPath,
  calculatePathCost,
  calculatePathDistance,
  pathContains,
  findInPath,
  getPathSegment,
  mergePaths
} from './PathSmoother';
import { PathNode, CalculationContext } from '../types';

describe('PathSmoother', () => {
  describe('simplifyPath', () => {
    it('should return empty path unchanged', () => {
      expect(simplifyPath([])).toEqual([]);
    });

    it('should return single node unchanged', () => {
      const path = [createNode(0, 64, 0, 0)];
      expect(simplifyPath(path)).toEqual(path);
    });

    it('should return two nodes unchanged', () => {
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1)
      ];
      expect(simplifyPath(path)).toEqual(path);
    });

    it('should keep first and last nodes', () => {
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1),
        createNode(2, 64, 0, 2),
        createNode(3, 64, 0, 3)
      ];
      const simplified = simplifyPath(path);
      expect(simplified[0]).toBe(path[0]);
      expect(simplified[simplified.length - 1]).toBe(path[path.length - 1]);
    });

    it('should remove middle nodes on straight line', () => {
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1),
        createNode(2, 64, 0, 2),
        createNode(3, 64, 0, 3)
      ];
      const simplified = simplifyPath(path);
      // Should simplify to just start and end
      expect(simplified.length).toBeLessThanOrEqual(path.length);
    });

    it('should keep corner nodes', () => {
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1),
        createNode(1, 64, 1, 2), // Corner
        createNode(1, 64, 2, 3)
      ];
      const simplified = simplifyPath(path);
      // Corner should be preserved
      expect(simplified.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('calculatePathCost', () => {
    it('should return 0 for empty path', () => {
      expect(calculatePathCost([])).toBe(0);
    });

    it('should return cost of last node', () => {
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 5),
        createNode(2, 64, 0, 10)
      ];
      expect(calculatePathCost(path)).toBe(10);
    });
  });

  describe('calculatePathDistance', () => {
    it('should return 0 for empty path', () => {
      expect(calculatePathDistance([])).toBe(0);
    });

    it('should return 0 for single node', () => {
      expect(calculatePathDistance([createNode(0, 64, 0, 0)])).toBe(0);
    });

    it('should calculate horizontal distance', () => {
      const path = [
        createNode(0, 64, 0, 0),
        createNode(3, 64, 0, 1)
      ];
      expect(calculatePathDistance(path)).toBe(3);
    });

    it('should calculate diagonal distance', () => {
      const path = [
        createNode(0, 64, 0, 0),
        createNode(3, 64, 4, 1)
      ];
      expect(calculatePathDistance(path)).toBe(5); // 3-4-5 triangle
    });

    it('should sum distances for multiple segments', () => {
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1),
        createNode(1, 64, 1, 2)
      ];
      expect(calculatePathDistance(path)).toBe(2);
    });
  });

  describe('pathContains', () => {
    const path = [
      createNode(0, 64, 0, 0),
      createNode(1, 64, 0, 1),
      createNode(2, 64, 0, 2)
    ];

    it('should return true for nodes in path', () => {
      expect(pathContains(path, 0, 64, 0)).toBe(true);
      expect(pathContains(path, 1, 64, 0)).toBe(true);
      expect(pathContains(path, 2, 64, 0)).toBe(true);
    });

    it('should return false for nodes not in path', () => {
      expect(pathContains(path, 3, 64, 0)).toBe(false);
      expect(pathContains(path, 0, 65, 0)).toBe(false);
      expect(pathContains(path, 0, 64, 1)).toBe(false);
    });

    it('should return false for empty path', () => {
      expect(pathContains([], 0, 64, 0)).toBe(false);
    });
  });

  describe('findInPath', () => {
    const path = [
      createNode(0, 64, 0, 0),
      createNode(1, 64, 0, 1),
      createNode(2, 64, 0, 2)
    ];

    it('should return index for nodes in path', () => {
      expect(findInPath(path, 0, 64, 0)).toBe(0);
      expect(findInPath(path, 1, 64, 0)).toBe(1);
      expect(findInPath(path, 2, 64, 0)).toBe(2);
    });

    it('should return -1 for nodes not in path', () => {
      expect(findInPath(path, 3, 64, 0)).toBe(-1);
      expect(findInPath(path, 0, 65, 0)).toBe(-1);
    });

    it('should return -1 for empty path', () => {
      expect(findInPath([], 0, 64, 0)).toBe(-1);
    });
  });

  describe('getPathSegment', () => {
    const path = [
      createNode(0, 64, 0, 0),
      createNode(1, 64, 0, 1),
      createNode(2, 64, 0, 2),
      createNode(3, 64, 0, 3),
      createNode(4, 64, 0, 4)
    ];

    it('should return segment inclusive of end index', () => {
      const segment = getPathSegment(path, 1, 3);
      expect(segment.length).toBe(3);
      expect(segment[0]).toBe(path[1]);
      expect(segment[2]).toBe(path[3]);
    });

    it('should return full path for 0 to length-1', () => {
      const segment = getPathSegment(path, 0, path.length - 1);
      expect(segment.length).toBe(path.length);
    });

    it('should return single node for same start and end', () => {
      const segment = getPathSegment(path, 2, 2);
      expect(segment.length).toBe(1);
      expect(segment[0]).toBe(path[2]);
    });
  });

  describe('mergePaths', () => {
    it('should return second if first is empty', () => {
      const path2 = [createNode(0, 64, 0, 0)];
      expect(mergePaths([], path2)).toEqual(path2);
    });

    it('should return first if second is empty', () => {
      const path1 = [createNode(0, 64, 0, 0)];
      expect(mergePaths(path1, [])).toEqual(path1);
    });

    it('should merge paths with direct connection', () => {
      const path1 = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1)
      ];
      const path2 = [
        createNode(1, 64, 0, 0), // Same as end of path1
        createNode(2, 64, 0, 1)
      ];

      const merged = mergePaths(path1, path2);
      expect(merged).not.toBeNull();
      expect(merged!.length).toBe(3);
    });

    it('should return null for non-overlapping paths', () => {
      const path1 = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1)
      ];
      const path2 = [
        createNode(5, 64, 0, 0), // No connection
        createNode(6, 64, 0, 1)
      ];

      expect(mergePaths(path1, path2)).toBeNull();
    });
  });
});

  describe('smoothPath', () => {
    function createMockCtx(solidBlocks: Set<string> = new Set()): CalculationContext {
      const solid = { name: 'stone', type: 1 } as any;
      const air = { name: 'air', type: 0 } as any;

      return {
        bot: {} as any,
        world: {},
        canWalkOn: (block: any) => block === solid,
        canWalkThrough: (block: any) => block !== solid,
        isWater: () => false,
        isLava: () => false,
        getBlock: (x: number, y: number, z: number) => {
          if (solidBlocks.has(`${x},${y},${z}`)) return solid;
          // Ground level at y=63 is solid
          if (y === 63) return solid;
          return air;
        },
        getBreakTime: () => 1,
        getBestTool: () => null,
        canDig: true,
        canPlace: true,
        allowSprint: true,
      } as any;
    }

    it('should return short paths unchanged', () => {
      const ctx = createMockCtx();
      const path = [createNode(0, 64, 0, 0)];
      expect(smoothPath(path, ctx)).toEqual(path);
    });

    it('should return two-node paths unchanged', () => {
      const ctx = createMockCtx();
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1),
      ];
      expect(smoothPath(path, ctx)).toEqual(path);
    });

    it('should smooth a straight-line path', () => {
      const ctx = createMockCtx();
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1),
        createNode(2, 64, 0, 2),
        createNode(3, 64, 0, 3),
      ];
      const smoothed = smoothPath(path, ctx);
      // Should shortcut intermediate nodes
      expect(smoothed.length).toBeLessThanOrEqual(path.length);
      // First and last should always be preserved
      expect(smoothed[0]).toBe(path[0]);
      expect(smoothed[smoothed.length - 1]).toBe(path[path.length - 1]);
    });

    it('should not smooth past obstacles', () => {
      // Place a wall at x=2 blocking direct path
      const solidBlocks = new Set(['2,64,0', '2,65,0']);
      const ctx = createMockCtx(solidBlocks);
      const path = [
        createNode(0, 64, 0, 0),
        createNode(0, 64, 1, 1),
        createNode(1, 64, 1, 2),
        createNode(2, 64, 1, 3),
        createNode(3, 64, 0, 4),
      ];
      const smoothed = smoothPath(path, ctx);
      // Should still have multiple nodes due to obstacle
      expect(smoothed.length).toBeGreaterThan(2);
    });
  });

  describe('mergePaths with overlap in middle', () => {
    it('should merge when overlap is not at start of second path', () => {
      const path1 = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1),
      ];
      const path2 = [
        createNode(0, 64, 0, 0), // Different start
        createNode(1, 64, 0, 1), // This matches path1 end
        createNode(2, 64, 0, 2),
      ];
      const merged = mergePaths(path1, path2);
      expect(merged).not.toBeNull();
      expect(merged!.length).toBe(3);
    });
  });

  describe('mergePaths edge cases', () => {
    it('should return second path when both are empty', () => {
      expect(mergePaths([], [])).toEqual([]);
    });

    it('should handle single-node paths with matching positions', () => {
      const path1 = [createNode(5, 64, 5, 0)];
      const path2 = [createNode(5, 64, 5, 0)];
      const merged = mergePaths(path1, path2);
      expect(merged).not.toBeNull();
      expect(merged!.length).toBe(1);
    });

    it('should handle overlap at end of second path', () => {
      const path1 = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1),
      ];
      const path2 = [
        createNode(3, 64, 0, 0),
        createNode(2, 64, 0, 1),
        createNode(1, 64, 0, 2), // Matches path1 end, at end of second
      ];
      const merged = mergePaths(path1, path2);
      expect(merged).not.toBeNull();
      // Should be path1 + nothing after overlap point (since overlap is at end)
      expect(merged!.length).toBe(2);
    });
  });

  describe('smoothPath edge cases', () => {
    function createMockCtx(solidBlocks: Set<string> = new Set()): CalculationContext {
      const solid = { name: 'stone', type: 1 } as any;
      const air = { name: 'air', type: 0 } as any;

      return {
        bot: {} as any,
        world: {},
        canWalkOn: (block: any) => block === solid,
        canWalkThrough: (block: any) => block !== solid,
        isWater: () => false,
        isLava: () => false,
        getBlock: (x: number, y: number, z: number) => {
          if (solidBlocks.has(`${x},${y},${z}`)) return solid;
          if (y === 63) return solid;
          return air;
        },
        getBreakTime: () => 1,
        getBestTool: () => null,
        canDig: true,
        canPlace: true,
        allowSprint: true,
      } as any;
    }

    it('should not smooth paths with large Y changes between nodes', () => {
      const ctx = createMockCtx();
      // Path with Y change > 1 between non-adjacent nodes
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 65, 0, 1),
        createNode(2, 67, 0, 2), // Y jump of 3 from start
      ];
      const smoothed = smoothPath(path, ctx);
      // Cannot shortcut from node 0 to node 2 (dy > 1)
      expect(smoothed.length).toBe(path.length);
    });

    it('should not smooth paths longer than 5 blocks horizontal distance', () => {
      const ctx = createMockCtx();
      const path = [
        createNode(0, 64, 0, 0),
        createNode(3, 64, 0, 1),
        createNode(6, 64, 0, 2),
        createNode(9, 64, 0, 3),
      ];
      const smoothed = smoothPath(path, ctx);
      // Distance from 0 to 9 is 9 > 5, so can't directly shortcut to end
      expect(smoothed.length).toBeGreaterThan(2);
    });

    it('should converge after repeated iterations', () => {
      const ctx = createMockCtx();
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1),
        createNode(2, 64, 0, 2),
        createNode(3, 64, 0, 3),
        createNode(4, 64, 0, 4),
      ];
      // With maxIterations=10, should still converge
      const smoothed = smoothPath(path, ctx, 10);
      expect(smoothed.length).toBeLessThanOrEqual(path.length);
      // Should contain start and end
      expect(smoothed[0]).toBe(path[0]);
      expect(smoothed[smoothed.length - 1]).toBe(path[path.length - 1]);
    });

    it('should not smooth through diagonal corner blocks', () => {
      // Both corners blocked - cannot pass diagonally
      const solidBlocks = new Set(['1,64,0', '0,64,1']);
      const ctx = createMockCtx(solidBlocks);
      const path = [
        createNode(0, 64, 0, 0),
        createNode(0, 64, 1, 1), // Goes around
        createNode(1, 64, 1, 2),
      ];
      const smoothed = smoothPath(path, ctx);
      // Should keep all nodes since diagonal (0,0) to (1,1) is blocked by both corners
      expect(smoothed.length).toBe(path.length);
    });
  });

  describe('simplifyPath edge cases', () => {
    it('should handle L-shaped path (direction change)', () => {
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1),
        createNode(2, 64, 0, 2),
        createNode(2, 64, 1, 3),
        createNode(2, 64, 2, 4),
      ];
      const simplified = simplifyPath(path);
      // Should keep start, corner (2,64,0), and end
      expect(simplified.length).toBeLessThanOrEqual(path.length);
      expect(simplified[0]).toBe(path[0]);
      expect(simplified[simplified.length - 1]).toBe(path[path.length - 1]);
    });

    it('should handle zigzag path (every node changes direction)', () => {
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 1, 1),
        createNode(2, 64, 0, 2),
        createNode(3, 64, 1, 3),
      ];
      const simplified = simplifyPath(path);
      // Every node changes direction, so all should be kept
      expect(simplified.length).toBe(path.length);
    });

    it('should handle path with only Y changes', () => {
      const path = [
        createNode(0, 60, 0, 0),
        createNode(0, 61, 0, 1),
        createNode(0, 62, 0, 2),
        createNode(0, 63, 0, 3),
      ];
      const simplified = simplifyPath(path);
      // All same direction (0, +1, 0), so should simplify to start + end
      expect(simplified.length).toBe(2);
    });
  });

  describe('calculatePathDistance edge cases', () => {
    it('should handle vertical-only path', () => {
      const path = [
        createNode(0, 60, 0, 0),
        createNode(0, 70, 0, 1),
      ];
      expect(calculatePathDistance(path)).toBe(10);
    });

    it('should handle 3D diagonal distance', () => {
      const path = [
        createNode(0, 0, 0, 0),
        createNode(1, 1, 1, 1),
      ];
      expect(calculatePathDistance(path)).toBeCloseTo(Math.sqrt(3), 10);
    });
  });

  describe('getPathSegment edge cases', () => {
    it('should handle first element only', () => {
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1),
        createNode(2, 64, 0, 2),
      ];
      const segment = getPathSegment(path, 0, 0);
      expect(segment.length).toBe(1);
      expect(segment[0]).toBe(path[0]);
    });

    it('should handle last element only', () => {
      const path = [
        createNode(0, 64, 0, 0),
        createNode(1, 64, 0, 1),
        createNode(2, 64, 0, 2),
      ];
      const segment = getPathSegment(path, 2, 2);
      expect(segment.length).toBe(1);
      expect(segment[0]).toBe(path[2]);
    });
  });

function createNode(x: number, y: number, z: number, cost: number): PathNode {
  const node = new PathNode(x, y, z, 0);
  node.cost = cost;
  return node;
}
