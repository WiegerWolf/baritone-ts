/**
 * Unit tests for ItemTarget utility
 */

import { ItemTarget, ItemTargets } from '../src/utils/ItemTarget';

describe('ItemTarget', () => {
  describe('constructor', () => {
    test('should accept single item name', () => {
      const target = new ItemTarget(['oak_log']);
      expect(target.getItemNames()).toEqual(['oak_log']);
    });

    test('should accept multiple item names', () => {
      const target = new ItemTarget(['oak_log', 'birch_log', 'spruce_log']);
      expect(target.getItemNames()).toHaveLength(3);
    });

    test('should set target count', () => {
      const target = new ItemTarget(['iron_ingot'], 64);
      expect(target.getTargetCount()).toBe(64);
    });

    test('should default to count of 1', () => {
      const target = new ItemTarget(['diamond']);
      expect(target.getTargetCount()).toBe(1);
    });
  });

  describe('matches', () => {
    test('should match item in list', () => {
      const target = new ItemTarget(['oak_log', 'birch_log']);
      expect(target.matches('oak_log')).toBe(true);
      expect(target.matches('birch_log')).toBe(true);
    });

    test('should not match item not in list', () => {
      const target = new ItemTarget(['oak_log', 'birch_log']);
      expect(target.matches('spruce_log')).toBe(false);
    });
  });

  describe('isMet', () => {
    test('should return true when count is met', () => {
      const target = new ItemTarget(['iron_ingot'], 10);
      expect(target.isMet(10)).toBe(true);
      expect(target.isMet(15)).toBe(true);
    });

    test('should return false when count is not met', () => {
      const target = new ItemTarget(['iron_ingot'], 10);
      expect(target.isMet(5)).toBe(false);
      expect(target.isMet(9)).toBe(false);
    });
  });

  describe('infinite', () => {
    test('should create infinite target', () => {
      const target = ItemTarget.infinite(['cobblestone']);
      expect(target.isInfinite()).toBe(true);
      expect(target.isMet(0)).toBe(false);
      expect(target.isMet(999999)).toBe(false);
    });

    test('should not be infinite by default', () => {
      const target = new ItemTarget(['cobblestone'], 64);
      expect(target.isInfinite()).toBe(false);
    });
  });

  describe('getRemainingCount', () => {
    test('should calculate remaining count', () => {
      const target = new ItemTarget(['iron_ingot'], 64);
      expect(target.getRemainingCount(10)).toBe(54);
      expect(target.getRemainingCount(64)).toBe(0);
      expect(target.getRemainingCount(100)).toBe(0);
    });
  });

  describe('toString', () => {
    test('should format single item', () => {
      const target = new ItemTarget(['diamond'], 5);
      expect(target.toString()).toContain('diamond');
      expect(target.toString()).toContain('5');
    });

    test('should format multiple items', () => {
      const target = new ItemTarget(['oak_log', 'birch_log'], 10);
      const str = target.toString();
      expect(str).toContain('oak_log');
    });

    test('should show infinite for infinite targets', () => {
      const target = ItemTarget.infinite(['stone']);
      expect(target.toString()).toContain('infinite');
    });
  });
});

describe('ItemTargets presets', () => {
  describe('logs', () => {
    test('should include all log types', () => {
      const target = ItemTargets.logs(10);
      expect(target.matches('oak_log')).toBe(true);
      expect(target.matches('birch_log')).toBe(true);
      expect(target.matches('spruce_log')).toBe(true);
      expect(target.matches('jungle_log')).toBe(true);
      expect(target.matches('acacia_log')).toBe(true);
      expect(target.matches('dark_oak_log')).toBe(true);
    });

    test('should not match planks', () => {
      const target = ItemTargets.logs(10);
      expect(target.matches('oak_planks')).toBe(false);
    });
  });

  describe('planks', () => {
    test('should include all plank types', () => {
      const target = ItemTargets.planks(10);
      expect(target.matches('oak_planks')).toBe(true);
      expect(target.matches('birch_planks')).toBe(true);
      expect(target.matches('spruce_planks')).toBe(true);
    });

    test('should not match logs', () => {
      const target = ItemTargets.planks(10);
      expect(target.matches('oak_log')).toBe(false);
    });
  });

  describe('pickaxe', () => {
    test('should include all pickaxe tiers', () => {
      const target = ItemTargets.pickaxe(1);
      expect(target.matches('wooden_pickaxe')).toBe(true);
      expect(target.matches('stone_pickaxe')).toBe(true);
      expect(target.matches('iron_pickaxe')).toBe(true);
      expect(target.matches('diamond_pickaxe')).toBe(true);
      expect(target.matches('netherite_pickaxe')).toBe(true);
    });
  });

  describe('sword', () => {
    test('should include all sword tiers', () => {
      const target = ItemTargets.sword(1);
      expect(target.matches('wooden_sword')).toBe(true);
      expect(target.matches('stone_sword')).toBe(true);
      expect(target.matches('iron_sword')).toBe(true);
      expect(target.matches('diamond_sword')).toBe(true);
      expect(target.matches('netherite_sword')).toBe(true);
    });
  });

  describe('food', () => {
    test('should include common foods', () => {
      const target = ItemTargets.food(10);
      expect(target.matches('cooked_beef')).toBe(true);
      expect(target.matches('bread')).toBe(true);
      expect(target.matches('apple')).toBe(true);
    });
  });

  describe('coal', () => {
    test('should include coal and charcoal', () => {
      const target = ItemTargets.coal(10);
      expect(target.matches('coal')).toBe(true);
      expect(target.matches('charcoal')).toBe(true);
    });
  });

  describe('ironOre', () => {
    test('should include all iron ore variants', () => {
      const target = ItemTargets.ironOre(10);
      expect(target.matches('iron_ore')).toBe(true);
      expect(target.matches('deepslate_iron_ore')).toBe(true);
    });
  });
});
