import { describe, it, expect } from 'bun:test';
import { BlockPos } from './types';
import { Vec3 } from 'vec3';

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

  describe('toVec3', () => {
    it('should convert to Vec3', () => {
      const pos = new BlockPos(10, 64, 20);
      const v = pos.toVec3();
      expect(v.x).toBe(10);
      expect(v.y).toBe(64);
      expect(v.z).toBe(20);
    });
  });

  describe('fromVec3', () => {
    it('should floor coordinates', () => {
      const v = new Vec3(10.7, 64.3, 20.9);
      const pos = BlockPos.fromVec3(v);
      expect(pos.x).toBe(10);
      expect(pos.y).toBe(64);
      expect(pos.z).toBe(20);
    });

    it('should handle negative coordinates', () => {
      const v = new Vec3(-0.5, -1.5, -2.5);
      const pos = BlockPos.fromVec3(v);
      expect(pos.x).toBe(-1);
      expect(pos.y).toBe(-2);
      expect(pos.z).toBe(-3);
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

describe('BlockPos.longHash edge cases', () => {
  it('should produce consistent hashes for negative coordinates', () => {
    const h1 = BlockPos.longHash(-100, -64, -200);
    const h2 = BlockPos.longHash(-100, -64, -200);
    expect(h1).toBe(h2);
  });

  it('should produce different hashes for mirrored coordinates', () => {
    const h1 = BlockPos.longHash(10, 20, 30);
    const h2 = BlockPos.longHash(-10, -20, -30);
    expect(h1).not.toBe(h2);
  });

  it('should produce different hashes for swapped coordinates', () => {
    const h1 = BlockPos.longHash(1, 2, 3);
    const h2 = BlockPos.longHash(3, 2, 1);
    const h3 = BlockPos.longHash(2, 1, 3);
    expect(h1).not.toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h2).not.toBe(h3);
  });

  it('should handle zero coordinates', () => {
    const h = BlockPos.longHash(0, 0, 0);
    expect(typeof h).toBe('bigint');
  });

  it('should handle large coordinates (world border)', () => {
    const h1 = BlockPos.longHash(30000000, 320, 30000000);
    const h2 = BlockPos.longHash(30000000, 320, 30000001);
    expect(h1).not.toBe(h2);
  });

  it('should handle bitwise OR truncation for floats', () => {
    // x | 0 truncates to 32-bit integer
    const h1 = BlockPos.longHash(10.7, 64.3, 20.9);
    const h2 = BlockPos.longHash(10, 64, 20);
    expect(h1).toBe(h2);
  });
});
