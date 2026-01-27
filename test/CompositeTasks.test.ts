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
  TradingTask,
  EnchantTask,
  BrewingTask,
  BuildTask,
  BUILD_PATTERNS,
  RepairTask,
  RepairMethod,
  StorageTask,
  StorageOperation,
  ElytraTask,
  FlightPhase,
  PortalTask,
  PortalType,
  FishingTask,
  SleepTask,
  BoatTask,
  ParkourTask,
  ParkourMoveType,
  SchematicTask,
  createCubeSchematic,
  createHollowBoxSchematic,
  createWallSchematic,
  DragonFightTask,
  StrongholdTask,
} from '../src/tasks/composite';
import { Vec3 } from 'vec3';

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

  describe('TradingTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new TradingTask(bot);
      expect(task.displayName).toContain('Trading');
    });

    it('should create with specific profession', () => {
      const bot = createMockBot();
      const task = new TradingTask(bot, { professions: ['librarian'] });
      expect(task.displayName).toContain('Trading');
    });

    it('should create with wanted items', () => {
      const bot = createMockBot();
      const task = new TradingTask(bot, { wantedItems: ['emerald'] });
      expect(task.displayName).toContain('Trading');
    });

    it('should start in FINDING_VILLAGER state', () => {
      const bot = createMockBot();
      const task = new TradingTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should track trade count', () => {
      const bot = createMockBot();
      const task = new TradingTask(bot);
      task.onStart();
      expect(task.getTradeCount()).toBe(0);
    });
  });

  describe('EnchantTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new EnchantTask(bot);
      expect(task.displayName).toContain('Enchant');
    });

    it('should create with specific item', () => {
      const bot = createMockBot();
      const task = new EnchantTask(bot, { itemToEnchant: 'diamond_sword' });
      expect(task.displayName).toContain('diamond_sword');
    });

    it('should create with preferred slot', () => {
      const bot = createMockBot();
      const task = new EnchantTask(bot, { preferredSlot: 0 });
      expect(task.displayName).toContain('Enchant');
    });

    it('should start in FINDING_TABLE state', () => {
      const bot = createMockBot();
      const task = new EnchantTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('BrewingTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new BrewingTask(bot);
      expect(task.displayName).toContain('Brew');
    });

    it('should create with target effect', () => {
      const bot = createMockBot();
      const task = new BrewingTask(bot, { targetEffect: 'healing' });
      expect(task.displayName).toContain('healing');
    });

    it('should create with count', () => {
      const bot = createMockBot();
      const task = new BrewingTask(bot, { count: 6 });
      expect(task.displayName).toContain('0/6');
    });

    it('should start in FINDING_STAND state', () => {
      const bot = createMockBot();
      const task = new BrewingTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should track brewed count', () => {
      const bot = createMockBot();
      const task = new BrewingTask(bot);
      task.onStart();
      expect(task.getBrewedCount()).toBe(0);
    });
  });

  describe('BuildTask', () => {
    it('should create with pattern', () => {
      const bot = createMockBot();
      const task = new BuildTask(bot, {
        origin: new Vec3(0, 64, 0),
        pattern: BUILD_PATTERNS.CUBE_3X3,
        clearArea: true,
        verifyBuild: true,
        gatherRadius: 32,
      });
      expect(task.displayName).toContain('Build');
      expect(task.displayName).toContain('cube_3x3');
    });

    it('should create with platform pattern', () => {
      const bot = createMockBot();
      const task = new BuildTask(bot, {
        origin: new Vec3(0, 64, 0),
        pattern: BUILD_PATTERNS.PLATFORM_5X5,
        clearArea: true,
        verifyBuild: true,
        gatherRadius: 32,
      });
      expect(task.displayName).toContain('platform_5x5');
    });

    it('should start in ANALYZING state', () => {
      const bot = createMockBot();
      const task = new BuildTask(bot, {
        origin: new Vec3(0, 64, 0),
        pattern: BUILD_PATTERNS.CUBE_3X3,
        clearArea: true,
        verifyBuild: true,
        gatherRadius: 32,
      });
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should track build progress', () => {
      const bot = createMockBot();
      const task = new BuildTask(bot, {
        origin: new Vec3(0, 64, 0),
        pattern: BUILD_PATTERNS.CUBE_3X3,
        clearArea: true,
        verifyBuild: true,
        gatherRadius: 32,
      });
      task.onStart();
      expect(task.getProgress()).toBe(0);
    });
  });

  describe('RepairTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new RepairTask(bot);
      expect(task.displayName).toContain('Repair');
    });

    it('should create with specific item', () => {
      const bot = createMockBot();
      const task = new RepairTask(bot, { itemToRepair: 'diamond_pickaxe' });
      expect(task.displayName).toContain('diamond_pickaxe');
    });

    it('should create with anvil method', () => {
      const bot = createMockBot();
      const task = new RepairTask(bot, { method: RepairMethod.ANVIL });
      expect(task.displayName).toContain('ANVIL');
    });

    it('should create with grindstone method', () => {
      const bot = createMockBot();
      const task = new RepairTask(bot, { method: RepairMethod.GRINDSTONE });
      expect(task.displayName).toContain('GRINDSTONE');
    });

    it('should start in FINDING_STATION state', () => {
      const bot = createMockBot();
      const task = new RepairTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should provide repair material info', () => {
      expect(RepairTask.getRepairMaterial('diamond_pickaxe')).toBe('diamond');
      expect(RepairTask.getRepairMaterial('iron_sword')).toBe('iron_ingot');
      expect(RepairTask.getRepairMaterial('elytra')).toBe('phantom_membrane');
    });
  });

  describe('StorageTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new StorageTask(bot);
      expect(task.displayName).toContain('Storage');
    });

    it('should create with deposit operation', () => {
      const bot = createMockBot();
      const task = new StorageTask(bot, { operation: StorageOperation.DEPOSIT });
      expect(task.displayName).toContain('DEPOSIT');
    });

    it('should create with withdraw operation', () => {
      const bot = createMockBot();
      const task = new StorageTask(bot, { operation: StorageOperation.WITHDRAW });
      expect(task.displayName).toContain('WITHDRAW');
    });

    it('should create with organize operation', () => {
      const bot = createMockBot();
      const task = new StorageTask(bot, { operation: StorageOperation.ORGANIZE });
      expect(task.displayName).toContain('ORGANIZE');
    });

    it('should start in FINDING_CONTAINER state', () => {
      const bot = createMockBot();
      const task = new StorageTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should track transferred count', () => {
      const bot = createMockBot();
      const task = new StorageTask(bot);
      task.onStart();
      expect(task.getTransferredCount()).toBe(0);
    });

    it('should accept target items', () => {
      const bot = createMockBot();
      const task = new StorageTask(bot, {
        operation: StorageOperation.DEPOSIT,
        targetItems: ['cobblestone', 'dirt'],
      });
      expect(task.displayName).toContain('DEPOSIT');
    });
  });

  describe('ElytraTask', () => {
    it('should create with target coordinates', () => {
      const bot = createMockBot();
      const task = new ElytraTask(bot, 1000, 1000);
      expect(task.displayName).toContain('ElytraFlight');
      expect(task.displayName).toContain('1000');
    });

    it('should create with custom altitude', () => {
      const bot = createMockBot();
      const task = new ElytraTask(bot, 500, 500, { cruiseAltitude: 300 });
      expect(task.displayName).toContain('ElytraFlight');
    });

    it('should start in PREPARING phase', () => {
      const bot = createMockBot();
      const task = new ElytraTask(bot, 100, 100);
      task.onStart();
      expect(task.getFlightPhase()).toBe(FlightPhase.PREPARING);
    });

    it('should track fireworks used', () => {
      const bot = createMockBot();
      const task = new ElytraTask(bot, 100, 100);
      task.onStart();
      expect(task.getFireworksUsed()).toBe(0);
    });

    it('should not be finished at start', () => {
      const bot = createMockBot();
      const task = new ElytraTask(bot, 100, 100);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('PortalTask', () => {
    it('should create for nether portal', () => {
      const bot = createMockBot();
      const task = new PortalTask(bot, { portalType: PortalType.NETHER });
      expect(task.displayName).toContain('NETHER');
    });

    it('should create for end portal', () => {
      const bot = createMockBot();
      const task = new PortalTask(bot, { portalType: PortalType.END });
      expect(task.displayName).toContain('END');
    });

    it('should start in FINDING_PORTAL state', () => {
      const bot = createMockBot();
      const task = new PortalTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should convert overworld to nether coordinates', () => {
      const result = PortalTask.overworldToNether(800, 800);
      expect(result.x).toBe(100);
      expect(result.z).toBe(100);
    });

    it('should convert nether to overworld coordinates', () => {
      const result = PortalTask.netherToOverworld(100, 100);
      expect(result.x).toBe(800);
      expect(result.z).toBe(800);
    });

    it('should create with build option', () => {
      const bot = createMockBot();
      const task = new PortalTask(bot, {
        portalType: PortalType.NETHER,
        buildIfNeeded: true,
      });
      expect(task.displayName).toContain('NETHER');
    });
  });

  describe('FishingTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new FishingTask(bot);
      expect(task.displayName).toContain('Fishing');
    });

    it('should create with target count', () => {
      const bot = createMockBot();
      const task = new FishingTask(bot, { targetCount: 20 });
      expect(task.displayName).toContain('0/20');
    });

    it('should start in FINDING_WATER state', () => {
      const bot = createMockBot();
      const task = new FishingTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should track caught count', () => {
      const bot = createMockBot();
      const task = new FishingTask(bot);
      task.onStart();
      expect(task.getCaughtCount()).toBe(0);
    });

    it('should compare by target count', () => {
      const bot = createMockBot();
      const task1 = new FishingTask(bot, { targetCount: 10 });
      const task2 = new FishingTask(bot, { targetCount: 10 });
      const task3 = new FishingTask(bot, { targetCount: 20 });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('SleepTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new SleepTask(bot);
      expect(task.displayName).toContain('Sleep');
    });

    it('should create with only at night option', () => {
      const bot = createMockBot();
      const task = new SleepTask(bot, { onlyAtNight: true });
      expect(task.displayName).toContain('Sleep');
    });

    it('should create with place bed option', () => {
      const bot = createMockBot();
      const task = new SleepTask(bot, { placeBedIfNeeded: true });
      expect(task.displayName).toContain('Sleep');
    });

    it('should start in CHECKING_TIME state', () => {
      const bot = createMockBot();
      const task = new SleepTask(bot);
      task.onStart();
      expect(task.displayName).toContain('CHECKING_TIME');
    });

    it('should track sleeping status', () => {
      const bot = createMockBot();
      const task = new SleepTask(bot);
      task.onStart();
      expect(task.isCurrentlySleeping()).toBe(false);
    });

    it('should compare by config', () => {
      const bot = createMockBot();
      const task1 = new SleepTask(bot, { onlyAtNight: true });
      const task2 = new SleepTask(bot, { onlyAtNight: true });
      const task3 = new SleepTask(bot, { onlyAtNight: false });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('BoatTask', () => {
    it('should create with target coordinates', () => {
      const bot = createMockBot();
      const task = new BoatTask(bot, 100, 200);
      expect(task.displayName).toContain('Boat');
      expect(task.displayName).toContain('100');
      expect(task.displayName).toContain('200');
    });

    it('should create with exit on arrival option', () => {
      const bot = createMockBot();
      const task = new BoatTask(bot, 50, 50, { exitOnArrival: true });
      expect(task.displayName).toContain('Boat');
    });

    it('should create with place boat option', () => {
      const bot = createMockBot();
      const task = new BoatTask(bot, 50, 50, { placeBoatIfNeeded: true });
      expect(task.displayName).toContain('Boat');
    });

    it('should start in FINDING_BOAT state', () => {
      const bot = createMockBot();
      const task = new BoatTask(bot, 100, 100);
      task.onStart();
      expect(task.displayName).toContain('FINDING_BOAT');
    });

    it('should track in-boat status', () => {
      const bot = createMockBot();
      const task = new BoatTask(bot, 100, 100);
      task.onStart();
      expect(task.isCurrentlyInBoat()).toBe(false);
    });

    it('should compare by target coordinates', () => {
      const bot = createMockBot();
      const task1 = new BoatTask(bot, 100, 200);
      const task2 = new BoatTask(bot, 100, 200);
      const task3 = new BoatTask(bot, 300, 400);
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('ParkourTask', () => {
    it('should create with target position', () => {
      const bot = createMockBot();
      const target = new Vec3(100, 64, 100);
      const task = new ParkourTask(bot, target);
      expect(task.displayName).toContain('Parkour');
    });

    it('should create with sprint jump enabled', () => {
      const bot = createMockBot();
      const target = new Vec3(50, 64, 50);
      const task = new ParkourTask(bot, target, { allowSprintJump: true });
      expect(task.displayName).toContain('Parkour');
    });

    it('should create with ladder climbing enabled', () => {
      const bot = createMockBot();
      const target = new Vec3(0, 80, 0);
      const task = new ParkourTask(bot, target, { allowLadders: true });
      expect(task.displayName).toContain('Parkour');
    });

    it('should start in ANALYZING state', () => {
      const bot = createMockBot();
      const target = new Vec3(10, 64, 10);
      const task = new ParkourTask(bot, target);
      task.onStart();
      expect(task.displayName).toContain('ANALYZING');
    });

    it('should track current move type', () => {
      const bot = createMockBot();
      const target = new Vec3(10, 64, 10);
      const task = new ParkourTask(bot, target);
      task.onStart();
      expect(task.getCurrentMoveType()).toBeDefined();
    });

    it('should compare by target position', () => {
      const bot = createMockBot();
      const target1 = new Vec3(100, 64, 100);
      const target2 = new Vec3(100, 64, 100);
      const target3 = new Vec3(200, 64, 200);
      const task1 = new ParkourTask(bot, target1);
      const task2 = new ParkourTask(bot, target2);
      const task3 = new ParkourTask(bot, target3);
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('SchematicTask', () => {
    it('should create with cube schematic', () => {
      const bot = createMockBot();
      const origin = new Vec3(0, 64, 0);
      const schematic = createCubeSchematic(3, 'cobblestone');
      const task = new SchematicTask(bot, origin, schematic);
      expect(task.displayName).toContain('Schematic');
      expect(task.displayName).toContain('cube_3x3x3');
    });

    it('should create with hollow box schematic', () => {
      const bot = createMockBot();
      const origin = new Vec3(0, 64, 0);
      const schematic = createHollowBoxSchematic(5, 4, 5, 'stone');
      const task = new SchematicTask(bot, origin, schematic);
      expect(task.displayName).toContain('hollow_box');
    });

    it('should create with wall schematic', () => {
      const bot = createMockBot();
      const origin = new Vec3(0, 64, 0);
      const schematic = createWallSchematic(10, 3, 'oak_planks');
      const task = new SchematicTask(bot, origin, schematic);
      expect(task.displayName).toContain('wall_10x3');
    });

    it('should start in LOADING state', () => {
      const bot = createMockBot();
      const origin = new Vec3(0, 64, 0);
      const schematic = createCubeSchematic(2, 'dirt');
      const task = new SchematicTask(bot, origin, schematic);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should track build progress', () => {
      const bot = createMockBot();
      const origin = new Vec3(0, 64, 0);
      const schematic = createCubeSchematic(2, 'dirt');
      const task = new SchematicTask(bot, origin, schematic);
      task.onStart();
      expect(task.getProgress()).toBe(0);
    });

    it('should provide materials needed', () => {
      const bot = createMockBot();
      const origin = new Vec3(0, 64, 0);
      const schematic = createCubeSchematic(2, 'stone');
      const task = new SchematicTask(bot, origin, schematic);
      task.onStart();
      const materials = task.getMaterialsNeeded();
      expect(materials).toBeDefined();
    });

    it('should compare by origin and schematic name', () => {
      const bot = createMockBot();
      const origin1 = new Vec3(0, 64, 0);
      const origin2 = new Vec3(0, 64, 0);
      const origin3 = new Vec3(100, 64, 100);
      const schematic = createCubeSchematic(2, 'dirt');
      const task1 = new SchematicTask(bot, origin1, schematic);
      const task2 = new SchematicTask(bot, origin2, schematic);
      const task3 = new SchematicTask(bot, origin3, schematic);
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });

    it('should create cube schematic with correct block count', () => {
      const schematic = createCubeSchematic(3, 'cobblestone');
      expect(schematic.blocks.length).toBe(27); // 3x3x3
      expect(schematic.palette).toContain('cobblestone');
    });

    it('should create hollow box schematic with correct block count', () => {
      const schematic = createHollowBoxSchematic(3, 3, 3, 'stone');
      // Hollow 3x3x3 = 27 total - 1 interior = 26 blocks
      expect(schematic.blocks.length).toBe(26);
    });

    it('should create wall schematic with correct block count', () => {
      const schematic = createWallSchematic(5, 3, 'brick');
      expect(schematic.blocks.length).toBe(15); // 5x3
    });
  });

  describe('DragonFightTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new DragonFightTask(bot);
      expect(task.displayName).toContain('DragonFight');
    });

    it('should create with bed bombing enabled', () => {
      const bot = createMockBot();
      const task = new DragonFightTask(bot, { useBeds: true });
      expect(task.displayName).toContain('DragonFight');
    });

    it('should create with crystal destruction', () => {
      const bot = createMockBot();
      const task = new DragonFightTask(bot, { destroyCrystals: true });
      expect(task.displayName).toContain('DragonFight');
    });

    it('should start in ARRIVING state', () => {
      const bot = createMockBot();
      const task = new DragonFightTask(bot);
      task.onStart();
      expect(task.displayName).toContain('ARRIVING');
    });

    it('should track crystals destroyed', () => {
      const bot = createMockBot();
      const task = new DragonFightTask(bot);
      task.onStart();
      expect(task.getCrystalsDestroyed()).toBe(0);
    });

    it('should compare by config options', () => {
      const bot = createMockBot();
      const task1 = new DragonFightTask(bot, { useBeds: true });
      const task2 = new DragonFightTask(bot, { useBeds: true });
      const task3 = new DragonFightTask(bot, { useBeds: false });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('StrongholdTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new StrongholdTask(bot);
      expect(task.displayName).toContain('Stronghold');
    });

    it('should create with custom throw distance', () => {
      const bot = createMockBot();
      const task = new StrongholdTask(bot, { throwDistance: 50 });
      expect(task.displayName).toContain('Stronghold');
    });

    it('should start in PREPARING state', () => {
      const bot = createMockBot();
      const task = new StrongholdTask(bot);
      task.onStart();
      expect(task.displayName).toContain('PREPARING');
    });

    it('should have null estimated position at start', () => {
      const bot = createMockBot();
      const task = new StrongholdTask(bot);
      task.onStart();
      expect(task.getEstimatedPosition()).toBeNull();
    });

    it('should have null portal position at start', () => {
      const bot = createMockBot();
      const task = new StrongholdTask(bot);
      task.onStart();
      expect(task.getPortalPosition()).toBeNull();
    });

    it('should calculate intersection correctly', () => {
      const start1 = new Vec3(0, 0, 0);
      const dir1 = new Vec3(1, 0, 1);
      const start2 = new Vec3(100, 0, 0);
      const dir2 = new Vec3(-1, 0, 1);
      const intersection = StrongholdTask.calculateIntersection(start1, dir1, start2, dir2);
      expect(intersection).not.toBeNull();
      if (intersection) {
        expect(intersection.x).toBe(50);
        expect(intersection.z).toBe(50);
      }
    });

    it('should return null for parallel lines', () => {
      const start1 = new Vec3(0, 0, 0);
      const dir1 = new Vec3(1, 0, 0);
      const start2 = new Vec3(0, 0, 10);
      const dir2 = new Vec3(1, 0, 0);
      const intersection = StrongholdTask.calculateIntersection(start1, dir1, start2, dir2);
      expect(intersection).toBeNull();
    });
  });
});
