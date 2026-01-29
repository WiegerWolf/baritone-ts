/**
 * Tests for MiningRequirementTask
 *
 * These tests verify:
 * 1. Intent (WHY): What the task is supposed to accomplish
 * 2. State Machine: Correct state transitions
 * 3. Edge Cases: Error handling, interruption
 */

import { describe, it, expect, mock } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  MiningRequirement,
  SatisfyMiningRequirementTask,
  satisfyMiningRequirement,
  miningRequirementMet,
  getBlockMiningRequirement,
} from './SatisfyMiningRequirementTask';
import {
  GetBuildingMaterialsTask,
  getBuildingMaterials,
  BUILDING_MATERIALS,
} from './GetBuildingMaterialsTask';

// Mock bot for testing
const createMockBot = (overrides: any = {}) => ({
  entity: {
    position: new Vec3(0, 64, 0),
    onGround: true,
  },
  inventory: {
    items: () => [],
  },
  blockAt: () => null,
  setControlState: mock(),
  lookAt: mock(),
  equip: mock(),
  activateItem: mock(),
  activateBlock: mock(),
  entities: {},
  ...overrides,
});

describe('MiningRequirement', () => {
  describe('WHY: Minecraft tool progression', () => {
    it('should have correct tier ordering', () => {
      // WHY: Mining requirements follow Minecraft's tool progression
      expect(MiningRequirement.HAND).toBeLessThan(MiningRequirement.WOOD);
      expect(MiningRequirement.WOOD).toBeLessThan(MiningRequirement.STONE);
      expect(MiningRequirement.STONE).toBeLessThan(MiningRequirement.IRON);
      expect(MiningRequirement.IRON).toBeLessThan(MiningRequirement.DIAMOND);
    });
  });

  describe('getBlockMiningRequirement', () => {
    it('should return DIAMOND for obsidian', () => {
      // WHY: Obsidian requires diamond pickaxe to mine
      expect(getBlockMiningRequirement('obsidian')).toBe(MiningRequirement.DIAMOND);
    });

    it('should return IRON for diamond ore', () => {
      // WHY: Diamond ore requires iron pickaxe
      expect(getBlockMiningRequirement('diamond_ore')).toBe(MiningRequirement.IRON);
    });

    it('should return STONE for iron ore', () => {
      // WHY: Iron ore requires stone pickaxe
      expect(getBlockMiningRequirement('iron_ore')).toBe(MiningRequirement.STONE);
    });

    it('should return WOOD for stone', () => {
      // WHY: Stone requires wood pickaxe
      expect(getBlockMiningRequirement('stone')).toBe(MiningRequirement.WOOD);
    });

    it('should return HAND for dirt', () => {
      // WHY: Dirt can be broken with any tool
      expect(getBlockMiningRequirement('dirt')).toBe(MiningRequirement.HAND);
    });
  });
});

describe('SatisfyMiningRequirementTask', () => {
  describe('creation and initialization', () => {
    it('should create with mining requirement', () => {
      const bot = createMockBot() as any;
      const task = new SatisfyMiningRequirementTask(bot, MiningRequirement.IRON);

      expect(task.displayName).toContain('IRON');
    });

    it('should finish immediately for HAND requirement', () => {
      // WHY: HAND requirement is always satisfied (no tool needed)
      const bot = createMockBot() as any;
      const task = new SatisfyMiningRequirementTask(bot, MiningRequirement.HAND);

      task.onStart();
      task.onTick();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('inventory checking', () => {
    it('should finish if already has required pickaxe', () => {
      const bot = createMockBot({
        inventory: {
          items: () => [{ name: 'diamond_pickaxe', count: 1 }],
        },
      }) as any;
      const task = new SatisfyMiningRequirementTask(bot, MiningRequirement.DIAMOND);

      task.onStart();
      expect(task.isFinished()).toBe(true);
    });

    it('should accept higher tier pickaxe', () => {
      // WHY: A diamond pickaxe can mine stone-tier blocks
      const bot = createMockBot({
        inventory: {
          items: () => [{ name: 'diamond_pickaxe', count: 1 }],
        },
      }) as any;
      const task = new SatisfyMiningRequirementTask(bot, MiningRequirement.STONE);

      task.onStart();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('miningRequirementMet helper', () => {
    it('should return true when requirement is met', () => {
      const bot = createMockBot({
        inventory: {
          items: () => [{ name: 'iron_pickaxe', count: 1 }],
        },
      }) as any;

      expect(miningRequirementMet(bot, MiningRequirement.IRON)).toBe(true);
      expect(miningRequirementMet(bot, MiningRequirement.STONE)).toBe(true);
    });

    it('should return false when requirement not met', () => {
      const bot = createMockBot({
        inventory: {
          items: () => [{ name: 'stone_pickaxe', count: 1 }],
        },
      }) as any;

      expect(miningRequirementMet(bot, MiningRequirement.DIAMOND)).toBe(false);
    });
  });

  describe('convenience functions', () => {
    it('satisfyMiningRequirement should create task', () => {
      const bot = createMockBot() as any;
      const task = satisfyMiningRequirement(bot, MiningRequirement.IRON);

      expect(task).toBeInstanceOf(SatisfyMiningRequirementTask);
    });
  });
});

describe('GetBuildingMaterialsTask', () => {
  describe('WHY: collect throwaway blocks', () => {
    it('should track building material count', () => {
      // WHY: Building materials (cobblestone, dirt) are used for scaffolding,
      // bridging, and clearing liquids - tasks need a certain amount
      const bot = createMockBot({
        inventory: {
          items: () => [
            { name: 'cobblestone', count: 32 },
            { name: 'dirt', count: 16 },
          ],
        },
      }) as any;
      const task = new GetBuildingMaterialsTask(bot, 64);

      expect(task.getBuildingMaterialCount()).toBe(48);
    });

    it('should finish when target count reached', () => {
      const bot = createMockBot({
        inventory: {
          items: () => [{ name: 'cobblestone', count: 64 }],
        },
      }) as any;
      const task = new GetBuildingMaterialsTask(bot, 64);

      task.onStart();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('BUILDING_MATERIALS constant', () => {
    it('should include common building blocks', () => {
      expect(BUILDING_MATERIALS).toContain('cobblestone');
      expect(BUILDING_MATERIALS).toContain('dirt');
      expect(BUILDING_MATERIALS).toContain('netherrack');
      expect(BUILDING_MATERIALS).toContain('end_stone');
    });
  });

  describe('convenience function', () => {
    it('getBuildingMaterials should create task', () => {
      const bot = createMockBot() as any;
      const task = getBuildingMaterials(bot, 64);

      expect(task).toBeInstanceOf(GetBuildingMaterialsTask);
    });
  });
});

describe('Integration scenarios', () => {
  describe('Mining progression', () => {
    it('should identify tool requirements for nether progression', () => {
      // Scenario: Player wants to mine obsidian for a portal
      // WHY: Must have diamond pickaxe to mine obsidian
      expect(getBlockMiningRequirement('obsidian')).toBe(MiningRequirement.DIAMOND);

      // Scenario: Player wants to mine iron to make bucket
      // WHY: Must have stone pickaxe to mine iron ore
      expect(getBlockMiningRequirement('iron_ore')).toBe(MiningRequirement.STONE);
    });
  });
});
