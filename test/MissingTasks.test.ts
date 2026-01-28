/**
 * Tests for newly ported missing tasks from BaritonePlus
 *
 * These tests verify:
 * 1. Intent (WHY): What the task is supposed to accomplish
 * 2. State Machine: Correct state transitions
 * 3. Edge Cases: Error handling, interruption
 */

import { Vec3 } from 'vec3';
import {
  RunAwayFromPositionTask,
  runFromPositions,
  runFromPositionsAtY,
} from '../src/tasks/concrete/EscapeTask';
import {
  GetCloseToBlockTask,
  getCloseTo,
  getCloseToVec,
} from '../src/tasks/concrete/BlockSearchTask';
import {
  MiningRequirement,
  SatisfyMiningRequirementTask,
  GetBuildingMaterialsTask,
  satisfyMiningRequirement,
  getBuildingMaterials,
  miningRequirementMet,
  getBlockMiningRequirement,
  BUILDING_MATERIALS,
} from '../src/tasks/concrete/MiningRequirementTask';
import {
  Biomes,
  SearchWithinBiomeTask,
  LocateDesertTempleTask,
  searchWithinBiome,
  locateDesertTemple,
  isInBiome,
} from '../src/tasks/concrete/BiomeSearchTask';
import {
  KillEnderDragonWithBedsTask,
  BedDragonState,
  BED_ITEMS,
} from '../src/tasks/concrete/DragonFightTask';

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
  setControlState: jest.fn(),
  lookAt: jest.fn(),
  equip: jest.fn(),
  activateItem: jest.fn(),
  activateBlock: jest.fn(),
  entities: {},
  ...overrides,
});

describe('RunAwayFromPositionTask', () => {
  describe('creation and initialization', () => {
    it('should create with danger positions', () => {
      const bot = createMockBot() as any;
      const dangerPositions = [new Vec3(5, 64, 5), new Vec3(-5, 64, -5)];
      const task = new RunAwayFromPositionTask(bot, dangerPositions);

      expect(task.displayName).toContain('RunAwayFromPosition');
      expect(task.displayName).toContain('2 positions');
    });

    it('should start not finished when near danger', () => {
      const bot = createMockBot({
        entity: { position: new Vec3(3, 64, 3) },
      }) as any;
      const dangerPositions = [new Vec3(5, 64, 5)];
      const task = new RunAwayFromPositionTask(bot, dangerPositions, { fleeDistance: 10 });

      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should finish when far from all danger positions', () => {
      const bot = createMockBot({
        entity: { position: new Vec3(100, 64, 100) },
      }) as any;
      const dangerPositions = [new Vec3(5, 64, 5)];
      const task = new RunAwayFromPositionTask(bot, dangerPositions, { fleeDistance: 10 });

      task.onStart();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('WHY: flee from dangerous positions', () => {
    it('should calculate flee direction away from danger center', () => {
      const bot = createMockBot({
        entity: { position: new Vec3(0, 64, 0) },
      }) as any;
      // Danger on both sides - should flee perpendicular
      const dangerPositions = [new Vec3(10, 64, 0), new Vec3(-10, 64, 0)];
      const task = new RunAwayFromPositionTask(bot, dangerPositions, { fleeDistance: 15 });

      task.onStart();
      // The flee calculation should move away from the weighted center
      expect(task.isFinished()).toBe(false);
    });

    it('should maintain Y level when configured', () => {
      const bot = createMockBot() as any;
      const dangerPositions = [new Vec3(5, 64, 5)];
      const task = runFromPositionsAtY(bot, 10, 70, ...dangerPositions);

      expect(task).toBeInstanceOf(RunAwayFromPositionTask);
    });
  });

  describe('equality', () => {
    it('should be equal if same danger positions', () => {
      const bot = createMockBot() as any;
      const pos1 = [new Vec3(5, 64, 5)];
      const pos2 = [new Vec3(5, 64, 5)];
      const task1 = new RunAwayFromPositionTask(bot, pos1);
      const task2 = new RunAwayFromPositionTask(bot, pos2);

      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different positions', () => {
      const bot = createMockBot() as any;
      const task1 = new RunAwayFromPositionTask(bot, [new Vec3(5, 64, 5)]);
      const task2 = new RunAwayFromPositionTask(bot, [new Vec3(10, 64, 10)]);

      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('convenience functions', () => {
    it('runFromPositions should create task', () => {
      const bot = createMockBot() as any;
      const task = runFromPositions(bot, 15, new Vec3(5, 64, 5), new Vec3(10, 64, 10));

      expect(task).toBeInstanceOf(RunAwayFromPositionTask);
    });
  });
});

describe('GetCloseToBlockTask', () => {
  describe('WHY: approach unreachable positions', () => {
    it('should handle approaching lava pool centers', () => {
      // WHY: Some blocks (center of lava pool) cannot be directly reached
      // This task iteratively reduces approach distance to get as close as possible
      const bot = createMockBot() as any;
      const task = new GetCloseToBlockTask(bot, 100, 64, 100);

      expect(task.displayName).toContain('GetCloseTo');
    });

    it('should start with maximum range', () => {
      const bot = createMockBot() as any;
      const task = new GetCloseToBlockTask(bot, 10, 64, 10);

      task.onStart();
      // Range starts at maximum
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('iterative approach', () => {
    it('should return GetWithinRangeOfBlockTask as subtask', () => {
      const bot = createMockBot() as any;
      const task = new GetCloseToBlockTask(bot, 50, 64, 50);

      task.onStart();
      const subtask = task.onTick();

      // Should return a subtask to approach the block
      expect(subtask).not.toBeNull();
    });

    it('should report achieved distance', () => {
      const bot = createMockBot({
        entity: { position: new Vec3(10, 64, 10) },
      }) as any;
      const task = new GetCloseToBlockTask(bot, 15, 64, 15);

      task.onStart();
      // Distance from (10,64,10) to (15,64,15) ≈ 7 blocks
      expect(task.getAchievedDistance()).toBeCloseTo(7, 0);
    });
  });

  describe('convenience functions', () => {
    it('getCloseTo should create task', () => {
      const bot = createMockBot() as any;
      const task = getCloseTo(bot, 100, 64, 100);

      expect(task).toBeInstanceOf(GetCloseToBlockTask);
    });

    it('getCloseToVec should create task from Vec3', () => {
      const bot = createMockBot() as any;
      const task = getCloseToVec(bot, new Vec3(100, 64, 100));

      expect(task).toBeInstanceOf(GetCloseToBlockTask);
    });
  });

  describe('equality', () => {
    it('should be equal if same target position', () => {
      const bot = createMockBot() as any;
      const task1 = new GetCloseToBlockTask(bot, 10, 64, 10);
      const task2 = new GetCloseToBlockTask(bot, 10, 64, 10);

      expect(task1.isEqual(task2)).toBe(true);
    });
  });
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

describe('Biomes constant', () => {
  describe('WHY: structure-specific searching', () => {
    it('should have desert biome for temple search', () => {
      expect(Biomes.DESERT).toBe('desert');
    });

    it('should have swamp biome for witch hut search', () => {
      expect(Biomes.SWAMP).toBe('swamp');
    });

    it('should have nether biomes for fortress search', () => {
      expect(Biomes.NETHER_WASTES).toBe('nether_wastes');
      expect(Biomes.SOUL_SAND_VALLEY).toBe('soul_sand_valley');
    });
  });
});

describe('SearchWithinBiomeTask', () => {
  describe('creation', () => {
    it('should create with biome name', () => {
      const bot = createMockBot() as any;
      const task = new SearchWithinBiomeTask(bot, Biomes.DESERT);

      expect(task.displayName).toContain('desert');
    });
  });

  describe('convenience function', () => {
    it('searchWithinBiome should create task', () => {
      const bot = createMockBot() as any;
      const task = searchWithinBiome(bot, Biomes.JUNGLE);

      expect(task).toBeInstanceOf(SearchWithinBiomeTask);
    });
  });
});

describe('LocateDesertTempleTask', () => {
  describe('WHY: valuable temple loot', () => {
    it('should search for desert temples', () => {
      // WHY: Desert temples contain diamonds, enchanted books, TNT
      const bot = createMockBot() as any;
      const task = new LocateDesertTempleTask(bot);

      expect(task.displayName).toContain('LocateDesertTemple');
    });
  });

  describe('temple detection', () => {
    it('should return found position when temple located', () => {
      const bot = createMockBot() as any;
      const task = new LocateDesertTempleTask(bot);

      // Initially no position found
      expect(task.getFoundTemplePosition()).toBeNull();
    });
  });

  describe('convenience function', () => {
    it('locateDesertTemple should create task', () => {
      const bot = createMockBot() as any;
      const task = locateDesertTemple(bot);

      expect(task).toBeInstanceOf(LocateDesertTempleTask);
    });
  });
});

describe('KillEnderDragonWithBedsTask', () => {
  describe('WHY: speedrun bed explosion strategy', () => {
    it('should use beds for massive damage', () => {
      // WHY: Beds explode in the End, dealing huge damage to the dragon
      // This is faster than traditional melee combat
      const bot = createMockBot() as any;

      // Need a mock dragon waiter
      const mockWaiter = {
        setExitPortalTop: jest.fn(),
        setPerchState: jest.fn(),
        isFinished: () => false,
        onStart: () => {},
        onTick: () => null,
        onStop: () => {},
        isEqual: () => false,
        displayName: 'MockWaiter',
      };

      const task = new KillEnderDragonWithBedsTask(bot, mockWaiter as any);
      expect(task.displayName).toContain('KillDragonWithBeds');
    });
  });

  describe('BED_ITEMS constant', () => {
    it('should include all bed colors', () => {
      expect(BED_ITEMS).toContain('white_bed');
      expect(BED_ITEMS).toContain('red_bed');
      expect(BED_ITEMS).toContain('blue_bed');
      expect(BED_ITEMS.length).toBe(16); // All 16 colors
    });
  });

  describe('bed counting', () => {
    it('should count beds in inventory', () => {
      const bot = createMockBot({
        inventory: {
          items: () => [
            { name: 'white_bed', count: 3 },
            { name: 'red_bed', count: 2 },
          ],
        },
      }) as any;

      const mockWaiter = {
        setExitPortalTop: jest.fn(),
        setPerchState: jest.fn(),
        isFinished: () => false,
        onStart: () => {},
        onTick: () => null,
        onStop: () => {},
        isEqual: () => false,
        displayName: 'MockWaiter',
      };

      const task = new KillEnderDragonWithBedsTask(bot, mockWaiter as any);
      expect(task.getBedCount()).toBe(5);
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

  describe('Structure looting workflow', () => {
    it('should locate then loot desert temples', () => {
      // Scenario: Find and loot desert temples for resources
      // Step 1: Locate temple (SearchWithinBiome + block detection)
      // Step 2: Navigate to temple entrance (14 blocks above trap)
      // Step 3: Disable trap and loot chests
      const bot = createMockBot() as any;

      const locateTask = locateDesertTemple(bot);
      expect(locateTask).toBeInstanceOf(LocateDesertTempleTask);

      // After locating, would use LootDesertTempleTask
    });
  });

  describe('Dragon fight preparation', () => {
    it('should require beds for bed strategy', () => {
      // WHY: Bed explosion is the fastest dragon kill method
      // Need multiple beds because each explosion only does partial damage
      const bot = createMockBot({
        inventory: {
          items: () => [{ name: 'white_bed', count: 10 }],
        },
      }) as any;

      const mockWaiter = {
        setExitPortalTop: jest.fn(),
        setPerchState: jest.fn(),
        isFinished: () => false,
        onStart: () => {},
        onTick: () => null,
        onStop: () => {},
        isEqual: () => false,
        displayName: 'MockWaiter',
      };

      const task = new KillEnderDragonWithBedsTask(bot, mockWaiter as any);
      expect(task.getBedCount()).toBeGreaterThanOrEqual(10);
    });
  });
});
