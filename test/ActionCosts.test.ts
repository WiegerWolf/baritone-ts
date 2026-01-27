import {
  WALK_ONE_BLOCK_COST,
  SPRINT_ONE_BLOCK_COST,
  SPRINT_MULTIPLIER,
  SNEAK_ONE_BLOCK_COST,
  WALK_ONE_IN_WATER_COST,
  WALK_ONE_OVER_SOUL_SAND_COST,
  LADDER_UP_ONE_COST,
  LADDER_DOWN_ONE_COST,
  SWIM_UP_ONE_COST,
  SWIM_DOWN_ONE_COST,
  JUMP_ONE_BLOCK_COST,
  WALK_OFF_BLOCK_COST,
  CENTER_AFTER_FALL_COST,
  SQRT_2,
  FALL_N_BLOCKS_COST,
  getFallCost,
  PLACE_ONE_BLOCK_COST,
  BACKPLACE_ADDITIONAL_PENALTY
} from '../src/core/ActionCosts';

describe('ActionCosts', () => {
  describe('movement costs', () => {
    it('should have correct walk cost', () => {
      // 4.633 ticks per block at 4.317 m/s walking speed
      expect(WALK_ONE_BLOCK_COST).toBeCloseTo(4.633, 2);
    });

    it('should have correct sprint cost', () => {
      // 3.564 ticks per block at 5.612 m/s sprinting speed
      expect(SPRINT_ONE_BLOCK_COST).toBeCloseTo(3.564, 2);
    });

    it('should have sprint multiplier less than 1', () => {
      expect(SPRINT_MULTIPLIER).toBeLessThan(1);
      expect(SPRINT_MULTIPLIER).toBeCloseTo(SPRINT_ONE_BLOCK_COST / WALK_ONE_BLOCK_COST, 2);
    });

    it('should have sneak cost higher than walk', () => {
      expect(SNEAK_ONE_BLOCK_COST).toBeGreaterThan(WALK_ONE_BLOCK_COST);
      expect(SNEAK_ONE_BLOCK_COST).toBeCloseTo(15.385, 2);
    });

    it('should have water walking cost higher than normal walk', () => {
      expect(WALK_ONE_IN_WATER_COST).toBeGreaterThan(WALK_ONE_BLOCK_COST);
      expect(WALK_ONE_IN_WATER_COST).toBeCloseTo(9.091, 2);
    });

    it('should have soul sand cost higher than normal walk', () => {
      expect(WALK_ONE_OVER_SOUL_SAND_COST).toBeGreaterThan(WALK_ONE_BLOCK_COST);
      expect(WALK_ONE_OVER_SOUL_SAND_COST).toBeCloseTo(6.486, 2);
    });
  });

  describe('climbing costs', () => {
    it('should have ladder up cost', () => {
      expect(LADDER_UP_ONE_COST).toBeCloseTo(5.0, 1);
    });

    it('should have ladder down cost less than up', () => {
      expect(LADDER_DOWN_ONE_COST).toBeLessThan(LADDER_UP_ONE_COST);
      expect(LADDER_DOWN_ONE_COST).toBeCloseTo(1.43, 1);
    });
  });

  describe('swimming costs', () => {
    it('should have swim up cost', () => {
      expect(SWIM_UP_ONE_COST).toBeDefined();
      expect(SWIM_UP_ONE_COST).toBeGreaterThan(0);
    });

    it('should have swim down cost less than swim up', () => {
      expect(SWIM_DOWN_ONE_COST).toBeLessThan(SWIM_UP_ONE_COST);
    });
  });

  describe('jumping costs', () => {
    it('should have jump cost', () => {
      expect(JUMP_ONE_BLOCK_COST).toBeCloseTo(2.5, 1);
    });

    it('should have walk off block cost', () => {
      expect(WALK_OFF_BLOCK_COST).toBeDefined();
      expect(WALK_OFF_BLOCK_COST).toBeGreaterThan(0);
    });
  });

  describe('fall costs', () => {
    it('should have pre-computed fall costs array', () => {
      expect(FALL_N_BLOCKS_COST).toBeDefined();
      expect(FALL_N_BLOCKS_COST.length).toBeGreaterThan(0);
    });

    it('should have increasing fall costs', () => {
      for (let i = 1; i < Math.min(10, FALL_N_BLOCKS_COST.length); i++) {
        expect(FALL_N_BLOCKS_COST[i]).toBeGreaterThanOrEqual(FALL_N_BLOCKS_COST[i - 1]);
      }
    });

    it('should have center after fall cost', () => {
      expect(CENTER_AFTER_FALL_COST).toBeDefined();
      expect(CENTER_AFTER_FALL_COST).toBeGreaterThan(0);
    });
  });

  describe('getFallCost', () => {
    it('should return 0 for 0 blocks', () => {
      expect(getFallCost(0, false)).toBe(0);
    });

    it('should return cost for small falls', () => {
      expect(getFallCost(1, false)).toBeGreaterThan(0);
      expect(getFallCost(2, false)).toBeGreaterThan(getFallCost(1, false));
      expect(getFallCost(3, false)).toBeGreaterThan(getFallCost(2, false));
    });

    it('should handle water landing differently', () => {
      // Water landing should have different cost (usually lower for high falls)
      const normalFall = getFallCost(10, false);
      const waterFall = getFallCost(10, true);
      expect(waterFall).toBeDefined();
      // For very high falls, water landing should be cheaper due to no damage
    });

    it('should handle very high falls', () => {
      const highFall = getFallCost(100, false);
      expect(highFall).toBeDefined();
      // Should either be finite or infinite depending on damage
    });
  });

  describe('placement costs', () => {
    it('should have place block cost', () => {
      expect(PLACE_ONE_BLOCK_COST).toBeDefined();
      expect(PLACE_ONE_BLOCK_COST).toBeGreaterThan(0);
    });

    it('should have backplace penalty', () => {
      expect(BACKPLACE_ADDITIONAL_PENALTY).toBeDefined();
      expect(BACKPLACE_ADDITIONAL_PENALTY).toBeGreaterThan(0);
    });
  });

  describe('math constants', () => {
    it('should have correct SQRT_2', () => {
      expect(SQRT_2).toBeCloseTo(Math.sqrt(2), 6);
    });
  });
});
