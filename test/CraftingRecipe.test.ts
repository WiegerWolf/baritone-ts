/**
 * Unit tests for CraftingRecipe system
 */

import {
  CraftingRecipe,
  RecipeTarget,
  CraftingGridSize,
  COMMON_RECIPES,
  getRecipe,
  isCraftable,
} from '../src/crafting';
import { ItemTarget } from '../src/utils/ItemTarget';

describe('CraftingRecipe', () => {
  describe('constructor', () => {
    test('should create recipe with string ingredients', () => {
      const recipe = new CraftingRecipe({
        result: 'test_item',
        resultCount: 1,
        ingredients: ['ingredient_a', 'ingredient_b'],
        width: 1,
        height: 2,
      });

      expect(recipe.result).toBe('test_item');
      expect(recipe.width).toBe(1);
      expect(recipe.height).toBe(2);
    });

    test('should create recipe with ItemTarget ingredients', () => {
      const target = new ItemTarget(['wood_a', 'wood_b']);
      const recipe = new CraftingRecipe({
        result: 'planks',
        ingredients: [target],
        width: 1,
        height: 1,
      });

      expect(recipe.ingredients[0]).toBeInstanceOf(ItemTarget);
    });

    test('should create recipe with null ingredients', () => {
      const recipe = new CraftingRecipe({
        result: 'bucket',
        ingredients: ['iron', null, 'iron', null, 'iron', null],
        width: 3,
        height: 2,
      });

      expect(recipe.ingredients[1]).toBeNull();
      expect(recipe.ingredients[3]).toBeNull();
    });

    test('should throw on wrong ingredient count', () => {
      expect(() => {
        new CraftingRecipe({
          result: 'test',
          ingredients: ['a', 'b', 'c'],
          width: 2,
          height: 2, // Expects 4 ingredients
        });
      }).toThrow();
    });
  });

  describe('canCraftInInventory', () => {
    test('should return true for 2x2 recipe', () => {
      const recipe = new CraftingRecipe({
        result: 'crafting_table',
        ingredients: ['planks', 'planks', 'planks', 'planks'],
        width: 2,
        height: 2,
      });

      expect(recipe.canCraftInInventory()).toBe(true);
    });

    test('should return true for 1x2 recipe', () => {
      const recipe = new CraftingRecipe({
        result: 'stick',
        resultCount: 4,
        ingredients: ['planks', 'planks'],
        width: 1,
        height: 2,
      });

      expect(recipe.canCraftInInventory()).toBe(true);
    });

    test('should return false for 3x3 recipe', () => {
      const recipe = COMMON_RECIPES.furnace;
      expect(recipe.canCraftInInventory()).toBe(false);
    });
  });

  describe('requiresCraftingTable', () => {
    test('should return true for 3x3 recipe', () => {
      const recipe = COMMON_RECIPES.furnace;
      expect(recipe.requiresCraftingTable()).toBe(true);
    });

    test('should return false for 2x2 recipe', () => {
      const recipe = COMMON_RECIPES.crafting_table;
      expect(recipe.requiresCraftingTable()).toBe(false);
    });
  });

  describe('getMinimumGridSize', () => {
    test('should return INVENTORY for small recipes', () => {
      const recipe = COMMON_RECIPES.crafting_table;
      expect(recipe.getMinimumGridSize()).toBe(CraftingGridSize.INVENTORY);
    });

    test('should return TABLE for large recipes', () => {
      const recipe = COMMON_RECIPES.furnace;
      expect(recipe.getMinimumGridSize()).toBe(CraftingGridSize.TABLE);
    });
  });

  describe('getSlots', () => {
    test('should expand to 3x3 grid', () => {
      const recipe = new CraftingRecipe({
        result: 'stick',
        resultCount: 4,
        ingredients: ['planks', 'planks'],
        width: 1,
        height: 2,
      });

      const slots = recipe.getSlots(CraftingGridSize.TABLE);
      expect(slots).toHaveLength(9);
      expect(slots[0]).not.toBeNull(); // planks
      expect(slots[3]).not.toBeNull(); // planks
      expect(slots[1]).toBeNull(); // empty
    });

    test('should expand to 2x2 grid', () => {
      const recipe = new CraftingRecipe({
        result: 'planks',
        resultCount: 4,
        ingredients: ['log'],
        width: 1,
        height: 1,
      });

      const slots = recipe.getSlots(CraftingGridSize.INVENTORY);
      expect(slots).toHaveLength(4);
      expect(slots[0]).not.toBeNull();
      expect(slots[1]).toBeNull();
    });
  });

  describe('getUniqueIngredients', () => {
    test('should deduplicate ingredients', () => {
      const recipe = COMMON_RECIPES.crafting_table;
      const unique = recipe.getUniqueIngredients();

      // Crafting table uses 4 planks, but only 1 unique ingredient type
      expect(unique.length).toBe(1);
    });
  });

  describe('getIngredientCounts', () => {
    test('should count each ingredient', () => {
      const recipe = new CraftingRecipe({
        result: 'torch',
        resultCount: 4,
        ingredients: ['coal', 'stick'],
        width: 1,
        height: 2,
      });

      const counts = recipe.getIngredientCounts();
      expect(counts.size).toBe(2);

      // Each ingredient used once
      for (const count of counts.values()) {
        expect(count).toBe(1);
      }
    });

    test('should count repeated ingredients', () => {
      const recipe = COMMON_RECIPES.furnace; // Uses 8 cobblestone
      const counts = recipe.getIngredientCounts();

      // Should have 1 unique ingredient (cobblestone) used 8 times
      expect(counts.size).toBe(1);
      const [, count] = [...counts.entries()][0];
      expect(count).toBe(8);
    });
  });
});

describe('RecipeTarget', () => {
  let recipe: CraftingRecipe;

  beforeEach(() => {
    recipe = new CraftingRecipe({
      result: 'planks',
      resultCount: 4,
      ingredients: ['log'],
      width: 1,
      height: 1,
    });
  });

  describe('getCraftsNeeded', () => {
    test('should calculate crafts from zero', () => {
      const target = new RecipeTarget(recipe, 16);
      // 16 planks / 4 per craft = 4 crafts
      expect(target.getCraftsNeeded(0)).toBe(4);
    });

    test('should account for current count', () => {
      const target = new RecipeTarget(recipe, 16);
      // Need 16, have 8, need 8 more = 2 crafts
      expect(target.getCraftsNeeded(8)).toBe(2);
    });

    test('should round up partial crafts', () => {
      const target = new RecipeTarget(recipe, 5);
      // 5 planks / 4 per craft = 1.25 → 2 crafts
      expect(target.getCraftsNeeded(0)).toBe(2);
    });

    test('should return 0 when target met', () => {
      const target = new RecipeTarget(recipe, 10);
      expect(target.getCraftsNeeded(10)).toBe(0);
      expect(target.getCraftsNeeded(100)).toBe(0);
    });
  });

  describe('getTotalIngredients', () => {
    test('should calculate total ingredients needed', () => {
      const target = new RecipeTarget(recipe, 16);
      const ingredients = target.getTotalIngredients(0);

      // 4 crafts, each needs 1 log = 4 logs
      const [, count] = [...ingredients.entries()][0];
      expect(count).toBe(4);
    });
  });

  describe('canCraftOnce', () => {
    test('should return true with enough ingredients', () => {
      const target = new RecipeTarget(recipe, 4);
      const checker = (t: ItemTarget) => 5; // Have 5 of everything

      expect(target.canCraftOnce(checker)).toBe(true);
    });

    test('should return false without ingredients', () => {
      const target = new RecipeTarget(recipe, 4);
      const checker = (t: ItemTarget) => 0;

      expect(target.canCraftOnce(checker)).toBe(false);
    });
  });
});

describe('COMMON_RECIPES', () => {
  test('should have planks recipes', () => {
    expect(COMMON_RECIPES.oak_planks).toBeDefined();
    expect(COMMON_RECIPES.oak_planks.resultCount).toBe(4);
  });

  test('should have stick recipe', () => {
    expect(COMMON_RECIPES.stick).toBeDefined();
    expect(COMMON_RECIPES.stick.resultCount).toBe(4);
  });

  test('should have crafting table recipe', () => {
    expect(COMMON_RECIPES.crafting_table).toBeDefined();
    expect(COMMON_RECIPES.crafting_table.canCraftInInventory()).toBe(true);
  });

  test('should have furnace recipe', () => {
    expect(COMMON_RECIPES.furnace).toBeDefined();
    expect(COMMON_RECIPES.furnace.requiresCraftingTable()).toBe(true);
  });

  test('should have tool recipes', () => {
    expect(COMMON_RECIPES.wooden_pickaxe).toBeDefined();
    expect(COMMON_RECIPES.stone_pickaxe).toBeDefined();
    expect(COMMON_RECIPES.iron_pickaxe).toBeDefined();
    expect(COMMON_RECIPES.diamond_pickaxe).toBeDefined();
  });
});

describe('getRecipe', () => {
  test('should return recipe for known item', () => {
    const recipe = getRecipe('furnace');
    expect(recipe).not.toBeNull();
    expect(recipe?.result).toBe('furnace');
  });

  test('should return null for unknown item', () => {
    const recipe = getRecipe('unknown_item');
    expect(recipe).toBeNull();
  });
});

describe('isCraftable', () => {
  test('should return true for craftable items', () => {
    expect(isCraftable('furnace')).toBe(true);
    expect(isCraftable('crafting_table')).toBe(true);
    expect(isCraftable('stick')).toBe(true);
  });

  test('should return false for non-craftable items', () => {
    expect(isCraftable('diamond')).toBe(false);
    expect(isCraftable('bedrock')).toBe(false);
  });
});
