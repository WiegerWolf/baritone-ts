import {
  GoalBlock,
  GoalXZ,
  GoalYLevel,
  GoalGetToBlock,
  GoalNear,
  GoalTwoBlocks,
  GoalComposite,
  GoalInverted,
  GoalRunAway,
  GoalAABB,
  GoalAnd,
  GoalFollow,
  GoalBlockSide,
  GoalChunk,
  GoalDirectionXZ,
  GoalRunAwayFromEntities,
  Direction,
} from './index';
import { BlockPos } from '../types';
import { Vec3 } from 'vec3';

describe('Goals', () => {
  describe('GoalBlock', () => {
    const goal = new GoalBlock(10, 64, 20);

    it('should match exact position', () => {
      expect(goal.isEnd(10, 64, 20)).toBe(true);
    });

    it('should not match other positions', () => {
      expect(goal.isEnd(10, 64, 21)).toBe(false);
      expect(goal.isEnd(10, 65, 20)).toBe(false);
      expect(goal.isEnd(11, 64, 20)).toBe(false);
    });

    it('should return 0 heuristic at goal', () => {
      expect(goal.heuristic(10, 64, 20)).toBe(0);
    });

    it('should return positive heuristic away from goal', () => {
      expect(goal.heuristic(0, 64, 0)).toBeGreaterThan(0);
      expect(goal.heuristic(20, 64, 40)).toBeGreaterThan(0);
    });

    it('should scale heuristic with distance', () => {
      const near = goal.heuristic(11, 64, 20);
      const far = goal.heuristic(20, 64, 20);
      expect(far).toBeGreaterThan(near);
    });
  });

  describe('GoalXZ', () => {
    const goal = new GoalXZ(100, 200);

    it('should match any Y at target XZ', () => {
      expect(goal.isEnd(100, 0, 200)).toBe(true);
      expect(goal.isEnd(100, 64, 200)).toBe(true);
      expect(goal.isEnd(100, 256, 200)).toBe(true);
    });

    it('should not match other XZ positions', () => {
      expect(goal.isEnd(101, 64, 200)).toBe(false);
      expect(goal.isEnd(100, 64, 201)).toBe(false);
    });

    it('should not include Y in heuristic', () => {
      const h1 = goal.heuristic(100, 0, 200);
      const h2 = goal.heuristic(100, 100, 200);
      expect(h1).toBe(h2);
    });
  });

  describe('GoalYLevel', () => {
    const goal = new GoalYLevel(64);

    it('should match any XZ at target Y', () => {
      expect(goal.isEnd(0, 64, 0)).toBe(true);
      expect(goal.isEnd(100, 64, 200)).toBe(true);
      expect(goal.isEnd(-50, 64, -50)).toBe(true);
    });

    it('should not match other Y levels', () => {
      expect(goal.isEnd(0, 63, 0)).toBe(false);
      expect(goal.isEnd(0, 65, 0)).toBe(false);
    });

    it('should only consider Y in heuristic', () => {
      const h1 = goal.heuristic(0, 60, 0);
      const h2 = goal.heuristic(1000, 60, 1000);
      expect(h1).toBe(h2);
    });
  });

  describe('GoalGetToBlock', () => {
    const goal = new GoalGetToBlock(10, 64, 20);

    it('should match adjacent positions', () => {
      expect(goal.isEnd(9, 64, 20)).toBe(true);  // -x
      expect(goal.isEnd(11, 64, 20)).toBe(true); // +x
      expect(goal.isEnd(10, 64, 19)).toBe(true); // -z
      expect(goal.isEnd(10, 64, 21)).toBe(true); // +z
      expect(goal.isEnd(10, 63, 20)).toBe(true); // -y
      expect(goal.isEnd(10, 65, 20)).toBe(true); // +y
    });

    it('should not match the block itself', () => {
      expect(goal.isEnd(10, 64, 20)).toBe(false);
    });

    it('should match diagonal positions within reach', () => {
      // GoalGetToBlock allows adjacent including diagonal (within 1 block on each axis)
      expect(goal.isEnd(11, 64, 21)).toBe(true);
      // But not 2 blocks away
      expect(goal.isEnd(12, 64, 20)).toBe(false);
    });
  });

  describe('GoalNear', () => {
    const goal = new GoalNear(100, 64, 100, 5);

    it('should match positions within radius', () => {
      expect(goal.isEnd(100, 64, 100)).toBe(true); // Center
      expect(goal.isEnd(103, 64, 100)).toBe(true); // Within radius
      expect(goal.isEnd(100, 64, 103)).toBe(true);
    });

    it('should not match positions outside radius', () => {
      expect(goal.isEnd(106, 64, 100)).toBe(false);
      expect(goal.isEnd(100, 70, 100)).toBe(false);
    });

    it('should return 0 heuristic within radius', () => {
      expect(goal.heuristic(102, 64, 102)).toBe(0);
    });
  });

  describe('GoalTwoBlocks', () => {
    const goal = new GoalTwoBlocks(10, 64, 20);

    it('should match position at feet (y=64)', () => {
      expect(goal.isEnd(10, 64, 20)).toBe(true);
    });

    it('should match one block below (feet at y-1, head at y)', () => {
      // When feet are at y=63, head is at y=64 (the target)
      expect(goal.isEnd(10, 63, 20)).toBe(true);
    });

    it('should not match other positions', () => {
      expect(goal.isEnd(10, 62, 20)).toBe(false);
      expect(goal.isEnd(10, 65, 20)).toBe(false);
      expect(goal.isEnd(10, 66, 20)).toBe(false);
    });
  });

  describe('GoalComposite', () => {
    const goal1 = new GoalBlock(10, 64, 10);
    const goal2 = new GoalBlock(20, 64, 20);
    const composite = new GoalComposite([goal1, goal2]);

    it('should match any child goal', () => {
      expect(composite.isEnd(10, 64, 10)).toBe(true);
      expect(composite.isEnd(20, 64, 20)).toBe(true);
    });

    it('should not match positions that dont match any child', () => {
      expect(composite.isEnd(15, 64, 15)).toBe(false);
    });

    it('should return minimum heuristic of children', () => {
      const h = composite.heuristic(15, 64, 15);
      const h1 = goal1.heuristic(15, 64, 15);
      const h2 = goal2.heuristic(15, 64, 15);
      expect(h).toBe(Math.min(h1, h2));
    });
  });

  describe('GoalInverted', () => {
    const inner = new GoalNear(100, 64, 100, 5);
    const inverted = new GoalInverted(inner);

    it('should invert isEnd result', () => {
      // Inner goal matches at center, inverted should not
      expect(inner.isEnd(100, 64, 100)).toBe(true);
      expect(inverted.isEnd(100, 64, 100)).toBe(false);

      // Inner goal doesn't match far away, inverted should
      expect(inner.isEnd(200, 64, 200)).toBe(false);
      expect(inverted.isEnd(200, 64, 200)).toBe(true);
    });

    it('should invert heuristic', () => {
      // Closer to inner goal = higher inverted heuristic
      const nearH = inverted.heuristic(101, 64, 100);
      const farH = inverted.heuristic(200, 64, 200);
      expect(nearH).toBeGreaterThan(farH);
    });
  });

  describe('GoalRunAway', () => {
    const dangers = [
      new BlockPos(100, 64, 100),
      new BlockPos(110, 64, 100)
    ];
    const goal = new GoalRunAway(dangers, 20);

    it('should match when far from all dangers', () => {
      expect(goal.isEnd(200, 64, 200)).toBe(true);
    });

    it('should not match when near any danger', () => {
      expect(goal.isEnd(105, 64, 100)).toBe(false);
    });

    it('should have lower heuristic farther from dangers', () => {
      const nearH = goal.heuristic(105, 64, 100);
      const farH = goal.heuristic(200, 64, 200);
      expect(nearH).toBeGreaterThan(farH);
    });
  });

  describe('GoalAABB', () => {
    const goal = new GoalAABB(10, 64, 10, 20, 70, 20);

    it('should match positions inside bounding box', () => {
      expect(goal.isEnd(15, 67, 15)).toBe(true);
      expect(goal.isEnd(10, 64, 10)).toBe(true); // Corner
      expect(goal.isEnd(20, 70, 20)).toBe(true); // Other corner
    });

    it('should not match positions outside bounding box', () => {
      expect(goal.isEnd(5, 67, 15)).toBe(false);  // X too low
      expect(goal.isEnd(25, 67, 15)).toBe(false); // X too high
      expect(goal.isEnd(15, 63, 15)).toBe(false); // Y too low
      expect(goal.isEnd(15, 71, 15)).toBe(false); // Y too high
    });

    it('should return 0 heuristic inside box', () => {
      expect(goal.heuristic(15, 67, 15)).toBe(0);
    });

    it('should return positive heuristic outside box', () => {
      expect(goal.heuristic(0, 67, 15)).toBeGreaterThan(0);
    });
  });

  describe('GoalBlock static methods', () => {
    it('should create from Vec3', () => {
      const goal = GoalBlock.fromVec3(new Vec3(10.7, 64.3, 20.9));
      expect(goal.x).toBe(10);
      expect(goal.y).toBe(64);
      expect(goal.z).toBe(20);
    });

    it('should create from BlockPos', () => {
      const pos = new BlockPos(5, 60, 15);
      const goal = GoalBlock.fromBlockPos(pos);
      expect(goal.x).toBe(5);
      expect(goal.y).toBe(60);
      expect(goal.z).toBe(15);
    });
  });

  describe('GoalComposite extras', () => {
    it('should throw for empty goals array', () => {
      expect(() => new GoalComposite([])).toThrow('GoalComposite requires at least one goal');
    });

    it('should create from positions', () => {
      const positions = [
        new BlockPos(10, 64, 10),
        new BlockPos(20, 64, 20),
      ];
      const composite = GoalComposite.fromPositions(positions);
      expect(composite.isEnd(10, 64, 10)).toBe(true);
      expect(composite.isEnd(20, 64, 20)).toBe(true);
      expect(composite.isEnd(15, 64, 15)).toBe(false);
    });
  });

  describe('GoalAnd', () => {
    it('should require all sub-goals to be met', () => {
      const goal = new GoalAnd(
        new GoalYLevel(64),
        new GoalXZ(100, 200),
      );
      expect(goal.isEnd(100, 64, 200)).toBe(true);
      expect(goal.isEnd(100, 65, 200)).toBe(false); // Wrong Y
      expect(goal.isEnd(101, 64, 200)).toBe(false); // Wrong X
    });

    it('should throw for empty goals', () => {
      expect(() => new GoalAnd()).toThrow('GoalAnd requires at least one goal');
    });

    it('should sum heuristics', () => {
      const g1 = new GoalBlock(10, 64, 10);
      const g2 = new GoalBlock(20, 64, 20);
      const goal = new GoalAnd(g1, g2);
      const h = goal.heuristic(15, 64, 15);
      expect(h).toBe(g1.heuristic(15, 64, 15) + g2.heuristic(15, 64, 15));
    });

    it('should have toString', () => {
      const goal = new GoalAnd(new GoalYLevel(64));
      expect(goal.toString()).toContain('GoalAnd');
    });
  });

  describe('GoalFollow', () => {
    it('should match positions near entity', () => {
      const entity = { position: new Vec3(100, 64, 100) };
      const goal = new GoalFollow(entity, 3);
      expect(goal.isEnd(100, 64, 100)).toBe(true);
      expect(goal.isEnd(102, 64, 100)).toBe(true);
    });

    it('should not match positions far from entity', () => {
      const entity = { position: new Vec3(100, 64, 100) };
      const goal = new GoalFollow(entity, 3);
      expect(goal.isEnd(110, 64, 100)).toBe(false);
    });

    it('should update with entity movement', () => {
      const entity = { position: new Vec3(100, 64, 100) };
      const goal = new GoalFollow(entity, 3);
      expect(goal.isEnd(100, 64, 100)).toBe(true);

      entity.position = new Vec3(200, 64, 200);
      expect(goal.isEnd(200, 64, 200)).toBe(true);
      expect(goal.isEnd(100, 64, 100)).toBe(false);
    });

    it('should detect when entity has changed position', () => {
      const entity = { position: new Vec3(100, 64, 100) };
      const goal = new GoalFollow(entity, 3);
      expect(goal.hasChanged()).toBe(false);

      entity.position = new Vec3(200, 64, 200);
      expect(goal.hasChanged()).toBe(true);
    });

    it('should report validity', () => {
      const entity = { position: new Vec3(100, 64, 100) };
      const goal = new GoalFollow(entity, 3);
      expect(goal.isValid()).toBe(true);

      // Entity with null position after construction
      const entity2: any = { position: new Vec3(0, 0, 0) };
      const goal2 = new GoalFollow(entity2, 3);
      entity2.position = null;
      expect(goal2.isValid()).toBe(false);
    });

    it('should return 0 heuristic when within range', () => {
      const entity = { position: new Vec3(100, 64, 100) };
      const goal = new GoalFollow(entity, 5);
      expect(goal.heuristic(102, 64, 100)).toBe(0);
    });

    it('should return positive heuristic when out of range', () => {
      const entity = { position: new Vec3(100, 64, 100) };
      const goal = new GoalFollow(entity, 3);
      expect(goal.heuristic(200, 64, 200)).toBeGreaterThan(0);
    });
  });

  describe('GoalBlockSide', () => {
    it('should match positions on correct side of block', () => {
      const goal = new GoalBlockSide(10, 64, 10, Direction.EAST, 1);
      // East means positive X direction
      expect(goal.isEnd(12, 64, 10)).toBe(true); // East side
      expect(goal.isEnd(8, 64, 10)).toBe(false);  // West side
    });

    it('should create from BlockPos', () => {
      const pos = new BlockPos(10, 64, 10);
      const goal = GoalBlockSide.fromBlockPos(pos, Direction.NORTH);
      expect(goal.blockX).toBe(10);
      expect(goal.blockY).toBe(64);
      expect(goal.blockZ).toBe(10);
    });

    it('should handle all directions', () => {
      const x = 10, y = 64, z = 10;
      // North = -z
      const north = new GoalBlockSide(x, y, z, Direction.NORTH, 1);
      expect(north.isEnd(x, y, z - 3)).toBe(true);

      // South = +z
      const south = new GoalBlockSide(x, y, z, Direction.SOUTH, 1);
      expect(south.isEnd(x, y, z + 3)).toBe(true);

      // Up = +y
      const up = new GoalBlockSide(x, y, z, Direction.UP, 1);
      expect(up.isEnd(x, y + 3, z)).toBe(true);

      // Down = -y
      const down = new GoalBlockSide(x, y, z, Direction.DOWN, 1);
      expect(down.isEnd(x, y - 3, z)).toBe(true);

      // West = -x
      const west = new GoalBlockSide(x, y, z, Direction.WEST, 1);
      expect(west.isEnd(x - 3, y, z)).toBe(true);
    });

    it('should return 0 heuristic when on correct side', () => {
      const goal = new GoalBlockSide(10, 64, 10, Direction.EAST, 1);
      expect(goal.heuristic(12, 64, 10)).toBeCloseTo(0);
    });

    it('should return positive heuristic when on wrong side', () => {
      const goal = new GoalBlockSide(10, 64, 10, Direction.EAST, 1);
      expect(goal.heuristic(8, 64, 10)).toBeGreaterThan(0);
    });
  });

  describe('GoalChunk', () => {
    it('should match positions within chunk', () => {
      const goal = new GoalChunk(5, 10); // Chunk at 80-95, 160-175
      expect(goal.isEnd(85, 64, 165)).toBe(true);
      expect(goal.isEnd(80, 64, 160)).toBe(true);
      expect(goal.isEnd(95, 64, 175)).toBe(true);
    });

    it('should not match positions outside chunk', () => {
      const goal = new GoalChunk(5, 10);
      expect(goal.isEnd(79, 64, 165)).toBe(false);
      expect(goal.isEnd(96, 64, 165)).toBe(false);
    });

    it('should create from world coords', () => {
      const goal = GoalChunk.fromWorldCoords(85, 165);
      expect(goal.chunkX).toBe(5);
      expect(goal.chunkZ).toBe(10);
    });

    it('should expose chunk bounds', () => {
      const goal = new GoalChunk(5, 10);
      expect(goal.startX).toBe(80);
      expect(goal.endX).toBe(95);
      expect(goal.startZ).toBe(160);
      expect(goal.endZ).toBe(175);
    });

    it('should return positive heuristic outside chunk', () => {
      const goal = new GoalChunk(5, 10);
      expect(goal.heuristic(0, 64, 0)).toBeGreaterThan(0);
    });
  });

  describe('GoalDirectionXZ', () => {
    it('should never return true for isEnd', () => {
      const goal = new GoalDirectionXZ(
        { x: 0, z: 0 },
        { x: 1, z: 0 },
      );
      expect(goal.isEnd(0, 64, 0)).toBe(false);
      expect(goal.isEnd(1000, 64, 0)).toBe(false);
    });

    it('should reward movement in correct direction', () => {
      const goal = new GoalDirectionXZ(
        { x: 0, z: 0 },
        { x: 1, z: 0 },
      );
      const hForward = goal.heuristic(10, 64, 0);
      const hBackward = goal.heuristic(-10, 64, 0);
      expect(hForward).toBeLessThan(hBackward);
    });

    it('should penalize sideways deviation', () => {
      const goal = new GoalDirectionXZ(
        { x: 0, z: 0 },
        { x: 1, z: 0 },
      );
      const hOnLine = goal.heuristic(10, 64, 0);
      const hOffLine = goal.heuristic(10, 64, 10);
      expect(hOffLine).toBeGreaterThan(hOnLine);
    });

    it('should throw for zero direction', () => {
      expect(() => new GoalDirectionXZ(
        { x: 0, z: 0 },
        { x: 0, z: 0 },
      )).toThrow('Direction vector cannot be zero');
    });
  });

  describe('GoalRunAwayFromEntities', () => {
    it('should match when far from all entities', () => {
      const entities = [
        { position: new Vec3(100, 64, 100), isValid: true },
      ] as any[];
      const goal = new GoalRunAwayFromEntities(() => entities, 16);
      expect(goal.isEnd(200, 64, 200)).toBe(true);
    });

    it('should not match when near entity', () => {
      const entities = [
        { position: new Vec3(100, 64, 100), isValid: true },
      ] as any[];
      const goal = new GoalRunAwayFromEntities(() => entities, 16);
      expect(goal.isEnd(105, 64, 100)).toBe(false);
    });

    it('should support xzOnly mode', () => {
      const entities = [
        { position: new Vec3(100, 64, 100), isValid: true },
      ] as any[];
      const goal = new GoalRunAwayFromEntities(() => entities, 16, true);
      // Y difference shouldn't matter in xzOnly mode
      expect(goal.isEnd(105, 200, 100)).toBe(false);
    });

    it('should skip invalid entities', () => {
      const entities = [
        { position: new Vec3(105, 64, 100), isValid: false },
      ] as any[];
      const goal = new GoalRunAwayFromEntities(() => entities, 16);
      expect(goal.isEnd(105, 64, 100)).toBe(true);
    });

    it('should return heuristic based on entity proximity', () => {
      const entities = [
        { position: new Vec3(100, 64, 100), isValid: true },
      ] as any[];
      const goal = new GoalRunAwayFromEntities(() => entities, 16);
      const hNear = goal.heuristic(101, 64, 100);
      const hFar = goal.heuristic(200, 64, 200);
      expect(hNear).toBeGreaterThan(hFar);
    });
  });
});
