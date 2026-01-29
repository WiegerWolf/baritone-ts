import { BlockPos, PathNode } from './types';

describe('BlockPos', () => {
  describe('constructor', () => {
    it('should create position with coordinates', () => {
      const pos = new BlockPos(10, 64, 20);
      expect(pos.x).toBe(10);
      expect(pos.y).toBe(64);
      expect(pos.z).toBe(20);
    });

    it('should handle negative coordinates', () => {
      const pos = new BlockPos(-100, -64, -200);
      expect(pos.x).toBe(-100);
      expect(pos.y).toBe(-64);
      expect(pos.z).toBe(-200);
    });
  });

  describe('hash', () => {
    it('should generate consistent hash', () => {
      const pos1 = new BlockPos(10, 64, 20);
      const pos2 = new BlockPos(10, 64, 20);
      expect(pos1.hash).toBe(pos2.hash);
    });

    it('should generate different hashes for different positions', () => {
      const pos1 = new BlockPos(10, 64, 20);
      const pos2 = new BlockPos(10, 64, 21);
      const pos3 = new BlockPos(10, 65, 20);
      const pos4 = new BlockPos(11, 64, 20);

      expect(pos1.hash).not.toBe(pos2.hash);
      expect(pos1.hash).not.toBe(pos3.hash);
      expect(pos1.hash).not.toBe(pos4.hash);
    });

    it('should be usable as Map key', () => {
      const map = new Map<string, number>();
      const pos1 = new BlockPos(10, 64, 20);
      const pos2 = new BlockPos(10, 64, 20);

      map.set(pos1.hashString, 1);
      expect(map.get(pos2.hashString)).toBe(1);
    });
  });

  describe('offset', () => {
    it('should return new position with offset', () => {
      const pos = new BlockPos(10, 64, 20);
      const offset = pos.offset(1, 2, 3);

      expect(offset.x).toBe(11);
      expect(offset.y).toBe(66);
      expect(offset.z).toBe(23);
    });

    it('should not modify original position', () => {
      const pos = new BlockPos(10, 64, 20);
      pos.offset(1, 2, 3);

      expect(pos.x).toBe(10);
      expect(pos.y).toBe(64);
      expect(pos.z).toBe(20);
    });

    it('should handle negative offsets', () => {
      const pos = new BlockPos(10, 64, 20);
      const offset = pos.offset(-5, -10, -15);

      expect(offset.x).toBe(5);
      expect(offset.y).toBe(54);
      expect(offset.z).toBe(5);
    });
  });

  describe('equals', () => {
    it('should return true for same coordinates', () => {
      const pos1 = new BlockPos(10, 64, 20);
      const pos2 = new BlockPos(10, 64, 20);
      expect(pos1.equals(pos2)).toBe(true);
    });

    it('should return false for different coordinates', () => {
      const pos1 = new BlockPos(10, 64, 20);
      const pos2 = new BlockPos(10, 64, 21);
      expect(pos1.equals(pos2)).toBe(false);
    });
  });

  describe('distanceTo', () => {
    it('should return 0 for same position', () => {
      const pos = new BlockPos(10, 64, 20);
      expect(pos.distanceTo(pos)).toBe(0);
    });

    it('should calculate horizontal distance', () => {
      const pos1 = new BlockPos(0, 64, 0);
      const pos2 = new BlockPos(3, 64, 4);
      expect(pos1.distanceTo(pos2)).toBe(5); // 3-4-5 triangle
    });

    it('should calculate vertical distance', () => {
      const pos1 = new BlockPos(0, 64, 0);
      const pos2 = new BlockPos(0, 74, 0);
      expect(pos1.distanceTo(pos2)).toBe(10);
    });
  });

  describe('distanceSquared', () => {
    it('should return 0 for same position', () => {
      const pos = new BlockPos(10, 64, 20);
      expect(pos.distanceSquared(pos)).toBe(0);
    });

    it('should calculate squared distance', () => {
      const pos1 = new BlockPos(0, 64, 0);
      const pos2 = new BlockPos(3, 64, 4);
      expect(pos1.distanceSquared(pos2)).toBe(25); // 3^2 + 0^2 + 4^2 = 25
    });
  });
});

describe('PathNode', () => {
  describe('constructor', () => {
    it('should create node with position and heuristic', () => {
      const node = new PathNode(10, 64, 20, 100);
      expect(node.x).toBe(10);
      expect(node.y).toBe(64);
      expect(node.z).toBe(20);
      expect(node.estimatedCostToGoal).toBe(100);
    });

    it('should initialize cost to infinity', () => {
      const node = new PathNode(10, 64, 20, 100);
      expect(node.cost).toBe(Infinity);
    });

    it('should initialize previous to null', () => {
      const node = new PathNode(10, 64, 20, 100);
      expect(node.previous).toBeNull();
    });
  });

  describe('hash', () => {
    it('should match BlockPos hash format', () => {
      const node = new PathNode(10, 64, 20, 0);
      // Should use string hash format
      expect(node.hash).toBe(`${10},${64},${20}`);
    });
  });

  describe('previous chain', () => {
    it('should allow building previous chain', () => {
      const node1 = new PathNode(0, 64, 0, 100);
      const node2 = new PathNode(1, 64, 0, 90);
      const node3 = new PathNode(2, 64, 0, 80);

      node2.previous = node1;
      node3.previous = node2;

      expect(node3.previous).toBe(node2);
      expect(node3.previous!.previous).toBe(node1);
      expect(node3.previous!.previous!.previous).toBeNull();
    });
  });

  describe('heap position', () => {
    it('should track heap position', () => {
      const node = new PathNode(10, 64, 20, 100);
      node.heapPosition = 5;
      expect(node.heapPosition).toBe(5);
    });
  });
});
