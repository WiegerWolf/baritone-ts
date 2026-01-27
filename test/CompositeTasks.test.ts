/**
 * Tests for Composite Tasks
 */

import {
  CollectWoodTask,
  GetToolTask,
  GatherResourcesTask,
  MineOresTask,
  FarmTask,
  FarmMode,
  ExploreTask,
  ExplorePattern,
  BuildShelterTask,
  ShelterType,
  CombatTask,
  CombatStyle,
  SurviveTask,
  SurvivalPriority,
} from '../src/tasks/composite';

// Mock bot for testing
function createMockBot(): any {
  return {
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
        distanceTo: () => 5,
        offset: () => ({ x: 1, y: 64, z: 1 }),
        clone: () => ({ x: 0, y: 64, z: 0 }),
        minus: () => ({ x: 0, y: 0, z: 0, scaled: () => ({ x: 0, y: 0, z: 0 }) }),
        plus: () => ({ x: 0, y: 64, z: 0 }),
      },
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: () => null,
    entities: {},
    time: { timeOfDay: 6000 },
    health: 20,
    food: 20,
    heldItem: null,
  };
}

describe('Composite Tasks', () => {
  describe('CollectWoodTask', () => {
    it('should create with default count', () => {
      const bot = createMockBot();
      const task = new CollectWoodTask(bot, 5);
      expect(task.displayName).toContain('CollectWood');
      expect(task.displayName).toContain('0/5');
    });

    it('should start in SEARCHING state', () => {
      const bot = createMockBot();
      const task = new CollectWoodTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('GetToolTask', () => {
    it('should create for pickaxe', () => {
      const bot = createMockBot();
      const task = new GetToolTask(bot, 'pickaxe');
      expect(task.displayName).toBe('GetTool(pickaxe)');
    });

    it('should create for axe with minimum tier', () => {
      const bot = createMockBot();
      const task = new GetToolTask(bot, 'axe', 'stone');
      expect(task.displayName).toBe('GetTool(axe)');
    });

    it('should start in CHECKING_INVENTORY state', () => {
      const bot = createMockBot();
      const task = new GetToolTask(bot, 'sword');
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('GatherResourcesTask', () => {
    it('should create with string target', () => {
      const bot = createMockBot();
      const task = new GatherResourcesTask(bot, 'cobblestone', 16);
      expect(task.displayName).toContain('GatherResources');
    });

    it('should create with array of targets', () => {
      const bot = createMockBot();
      const task = new GatherResourcesTask(bot, ['iron_ore', 'coal'], [10, 20]);
      expect(task.displayName).toContain('GatherResources');
    });

    it('should start in ANALYZING state', () => {
      const bot = createMockBot();
      const task = new GatherResourcesTask(bot, 'dirt', 8);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('MineOresTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new MineOresTask(bot);
      expect(task.displayName).toContain('MineOres');
    });

    it('should create with specific ores', () => {
      const bot = createMockBot();
      const task = new MineOresTask(bot, { targetOres: ['diamond', 'iron'] });
      expect(task.displayName).toContain('MineOres');
    });

    it('should create with target count', () => {
      const bot = createMockBot();
      const task = new MineOresTask(bot, { targetCount: 10 });
      expect(task.displayName).toContain('0/10');
    });
  });

  describe('FarmTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new FarmTask(bot);
      expect(task.displayName).toContain('Farm');
    });

    it('should create with harvest mode', () => {
      const bot = createMockBot();
      const task = new FarmTask(bot, { mode: FarmMode.HARVEST_ONLY });
      expect(task.displayName).toContain('Farm');
    });

    it('should create with specific crops', () => {
      const bot = createMockBot();
      const task = new FarmTask(bot, { targetCrops: ['wheat', 'carrot'] });
      expect(task.displayName).toContain('Farm');
    });
  });

  describe('ExploreTask', () => {
    it('should create with spiral pattern', () => {
      const bot = createMockBot();
      const task = new ExploreTask(bot, { pattern: ExplorePattern.SPIRAL });
      expect(task.displayName).toContain('Explore');
      expect(task.displayName).toContain('SPIRAL');
    });

    it('should create with random pattern', () => {
      const bot = createMockBot();
      const task = new ExploreTask(bot, { pattern: ExplorePattern.RANDOM });
      expect(task.displayName).toContain('RANDOM');
    });

    it('should track explored chunks', () => {
      const bot = createMockBot();
      const task = new ExploreTask(bot);
      task.onStart();
      expect(task.getExploredCount()).toBe(1); // Starting chunk
    });
  });

  describe('BuildShelterTask', () => {
    it('should create dirt hut', () => {
      const bot = createMockBot();
      const task = new BuildShelterTask(bot, { type: ShelterType.DIRT_HUT });
      expect(task.displayName).toContain('DIRT_HUT');
    });

    it('should create wood cabin', () => {
      const bot = createMockBot();
      const task = new BuildShelterTask(bot, { type: ShelterType.WOOD_CABIN });
      expect(task.displayName).toContain('WOOD_CABIN');
    });

    it('should start in FINDING_LOCATION state', () => {
      const bot = createMockBot();
      const task = new BuildShelterTask(bot);
      task.onStart();
      expect(task.displayName).toContain('FINDING_LOCATION');
    });
  });

  describe('CombatTask', () => {
    it('should create with melee style', () => {
      const bot = createMockBot();
      const task = new CombatTask(bot, { style: CombatStyle.MELEE });
      expect(task.displayName).toContain('MELEE');
    });

    it('should create with hit-and-run style', () => {
      const bot = createMockBot();
      const task = new CombatTask(bot, { style: CombatStyle.HIT_AND_RUN });
      expect(task.displayName).toContain('HIT_AND_RUN');
    });

    it('should track kill count', () => {
      const bot = createMockBot();
      const task = new CombatTask(bot);
      task.onStart();
      expect(task.getKillCount()).toBe(0);
    });

    it('should accept target types', () => {
      const bot = createMockBot();
      const task = new CombatTask(bot, { targetTypes: ['zombie', 'skeleton'] });
      expect(task.displayName).toContain('Combat');
    });
  });

  describe('SurviveTask', () => {
    it('should create with default goals', () => {
      const bot = createMockBot();
      const task = new SurviveTask(bot);
      expect(task.displayName).toContain('Survive');
    });

    it('should create with custom goals', () => {
      const bot = createMockBot();
      const task = new SurviveTask(bot, {
        minFoodLevel: 18,
        targetToolTier: 'diamond',
      });
      expect(task.displayName).toContain('Survive');
    });

    it('should never finish (continuous survival)', () => {
      const bot = createMockBot();
      const task = new SurviveTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should start in ASSESSING state', () => {
      const bot = createMockBot();
      const task = new SurviveTask(bot);
      task.onStart();
      expect(task.displayName).toContain('ASSESSING');
    });
  });

  describe('Task equality', () => {
    it('CollectWoodTask should compare by count', () => {
      const bot = createMockBot();
      const task1 = new CollectWoodTask(bot, 5);
      const task2 = new CollectWoodTask(bot, 5);
      const task3 = new CollectWoodTask(bot, 10);

      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });

    it('GetToolTask should compare by type and tier', () => {
      const bot = createMockBot();
      const task1 = new GetToolTask(bot, 'pickaxe', 'stone');
      const task2 = new GetToolTask(bot, 'pickaxe', 'stone');
      const task3 = new GetToolTask(bot, 'pickaxe', 'iron');

      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });
});
