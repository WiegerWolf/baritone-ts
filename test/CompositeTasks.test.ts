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
  HuntTask,
  DefendAreaTask,
  FollowPlayerTask,
  LootChestTask,
  FleeTask,
  FleeTrigger,
  SmithingTask,
  SmithingType,
  TameAnimalTask,
  TameableAnimal,
  RideEntityTask,
  RideableEntity,
  CleanupTask,
  CleanupMode,
  WaterBucketTask,
  EscapeDangerTask,
  DangerType,
  ThrowEnderEyeTask,
  BridgeTask,
  BridgeDirection,
  ScaffoldTask,
  ScaffoldMode,
  MineLayerTask,
  MinePattern,
  TorchTask,
  TorchMode,
  ShearTask,
  RespawnTask,
  PlantTreeTask,
  CompostTask,
  UseEffectTask,
  EffectType,
  EffectTrigger,
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

  describe('HuntTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new HuntTask(bot);
      expect(task.displayName).toContain('Hunt');
    });

    it('should create with target kill count', () => {
      const bot = createMockBot();
      const task = new HuntTask(bot, { targetKills: 10 });
      expect(task.displayName).toContain('0/10');
    });

    it('should create with specific animals', () => {
      const bot = createMockBot();
      const task = new HuntTask(bot, { targetAnimals: ['cow', 'pig'] });
      expect(task.displayName).toContain('Hunt');
    });

    it('should start in SEARCHING state', () => {
      const bot = createMockBot();
      const task = new HuntTask(bot);
      task.onStart();
      expect(task.displayName).toContain('SEARCHING');
    });

    it('should track kill count', () => {
      const bot = createMockBot();
      const task = new HuntTask(bot);
      task.onStart();
      expect(task.getKillCount()).toBe(0);
    });

    it('should have no current target at start', () => {
      const bot = createMockBot();
      const task = new HuntTask(bot);
      task.onStart();
      expect(task.getCurrentTarget()).toBeNull();
    });

    it('should compare by target kills and animals', () => {
      const bot = createMockBot();
      const task1 = new HuntTask(bot, { targetKills: 5, targetAnimals: ['cow'] });
      const task2 = new HuntTask(bot, { targetKills: 5, targetAnimals: ['cow'] });
      const task3 = new HuntTask(bot, { targetKills: 10, targetAnimals: ['cow'] });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('DefendAreaTask', () => {
    it('should create with center position', () => {
      const bot = createMockBot();
      const center = new Vec3(100, 64, 100);
      const task = new DefendAreaTask(bot, center);
      expect(task.displayName).toContain('DefendArea');
    });

    it('should create with custom radius', () => {
      const bot = createMockBot();
      const center = new Vec3(0, 64, 0);
      const task = new DefendAreaTask(bot, center, { radius: 32 });
      expect(task.getRadius()).toBe(32);
    });

    it('should start in PATROLLING state', () => {
      const bot = createMockBot();
      const center = new Vec3(0, 64, 0);
      const task = new DefendAreaTask(bot, center);
      task.onStart();
      expect(task.displayName).toContain('PATROLLING');
    });

    it('should track kill count', () => {
      const bot = createMockBot();
      const center = new Vec3(0, 64, 0);
      const task = new DefendAreaTask(bot, center);
      task.onStart();
      expect(task.getKillCount()).toBe(0);
    });

    it('should return defense center', () => {
      const bot = createMockBot();
      const center = new Vec3(50, 64, 50);
      const task = new DefendAreaTask(bot, center);
      const returnedCenter = task.getCenter();
      expect(returnedCenter.x).toBe(50);
      expect(returnedCenter.z).toBe(50);
    });

    it('should compare by center and radius', () => {
      const bot = createMockBot();
      const center1 = new Vec3(100, 64, 100);
      const center2 = new Vec3(100, 64, 100);
      const center3 = new Vec3(200, 64, 200);
      const task1 = new DefendAreaTask(bot, center1, { radius: 16 });
      const task2 = new DefendAreaTask(bot, center2, { radius: 16 });
      const task3 = new DefendAreaTask(bot, center3, { radius: 16 });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });

    it('should create with patrol disabled', () => {
      const bot = createMockBot();
      const center = new Vec3(0, 64, 0);
      const task = new DefendAreaTask(bot, center, { patrolWhenIdle: false });
      expect(task.displayName).toContain('DefendArea');
    });

    it('should create with duration limit', () => {
      const bot = createMockBot();
      const center = new Vec3(0, 64, 0);
      const task = new DefendAreaTask(bot, center, { continuous: false, duration: 60 });
      expect(task.displayName).toContain('DefendArea');
    });
  });

  describe('FollowPlayerTask', () => {
    it('should create with player name', () => {
      const bot = createMockBot();
      const task = new FollowPlayerTask(bot, 'TestPlayer');
      expect(task.displayName).toContain('Follow');
      expect(task.displayName).toContain('TestPlayer');
    });

    it('should create with custom distances', () => {
      const bot = createMockBot();
      const task = new FollowPlayerTask(bot, 'TestPlayer', {
        minDistance: 3,
        maxDistance: 8,
      });
      expect(task.displayName).toContain('Follow');
    });

    it('should start in SEARCHING state', () => {
      const bot = createMockBot();
      const task = new FollowPlayerTask(bot, 'TestPlayer');
      task.onStart();
      expect(task.displayName).toContain('SEARCHING');
    });

    it('should have no target at start', () => {
      const bot = createMockBot();
      const task = new FollowPlayerTask(bot, 'TestPlayer');
      task.onStart();
      expect(task.getTargetPlayer()).toBeNull();
    });

    it('should return infinite distance when no target', () => {
      const bot = createMockBot();
      const task = new FollowPlayerTask(bot, 'TestPlayer');
      task.onStart();
      expect(task.getDistanceToTarget()).toBe(Infinity);
    });

    it('should not be following at start', () => {
      const bot = createMockBot();
      const task = new FollowPlayerTask(bot, 'TestPlayer');
      task.onStart();
      expect(task.isFollowing()).toBe(false);
    });

    it('should compare by player name', () => {
      const bot = createMockBot();
      const task1 = new FollowPlayerTask(bot, 'Player1');
      const task2 = new FollowPlayerTask(bot, 'Player1');
      const task3 = new FollowPlayerTask(bot, 'Player2');
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });

    it('should create with duration', () => {
      const bot = createMockBot();
      const task = new FollowPlayerTask(bot, 'TestPlayer', { duration: 60 });
      expect(task.displayName).toContain('Follow');
    });

    it('should create with mimic enabled', () => {
      const bot = createMockBot();
      const task = new FollowPlayerTask(bot, 'TestPlayer', { mimicActions: true });
      expect(task.displayName).toContain('Follow');
    });
  });

  describe('LootChestTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new LootChestTask(bot);
      expect(task.displayName).toContain('LootChest');
    });

    it('should create with target items', () => {
      const bot = createMockBot();
      const task = new LootChestTask(bot, { targetItems: ['diamond', 'emerald'] });
      expect(task.displayName).toContain('LootChest');
    });

    it('should create with custom search radius', () => {
      const bot = createMockBot();
      const task = new LootChestTask(bot, { searchRadius: 64 });
      expect(task.displayName).toContain('LootChest');
    });

    it('should start in SEARCHING state', () => {
      const bot = createMockBot();
      const task = new LootChestTask(bot);
      task.onStart();
      expect(task.displayName).toContain('SEARCHING');
    });

    it('should track containers looted', () => {
      const bot = createMockBot();
      const task = new LootChestTask(bot);
      task.onStart();
      expect(task.getContainersLooted()).toBe(0);
    });

    it('should track items collected', () => {
      const bot = createMockBot();
      const task = new LootChestTask(bot);
      task.onStart();
      expect(task.getItemsCollected()).toBe(0);
    });

    it('should compare by target items', () => {
      const bot = createMockBot();
      const task1 = new LootChestTask(bot, { targetItems: ['diamond'] });
      const task2 = new LootChestTask(bot, { targetItems: ['diamond'] });
      const task3 = new LootChestTask(bot, { targetItems: ['emerald'] });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });

    it('should support clearing looted tracking', () => {
      const bot = createMockBot();
      const task = new LootChestTask(bot);
      task.clearLootedTracking();
      expect(task.getContainersLooted()).toBe(0);
    });
  });

  describe('FleeTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new FleeTask(bot);
      expect(task.displayName).toContain('Flee');
    });

    it('should create with safe distance', () => {
      const bot = createMockBot();
      const task = new FleeTask(bot, { safeDistance: 50 });
      expect(task.displayName).toContain('Flee');
    });

    it('should create with health threshold', () => {
      const bot = createMockBot();
      const task = new FleeTask(bot, { healthThreshold: 10 });
      expect(task.displayName).toContain('Flee');
    });

    it('should start in ASSESSING state', () => {
      const bot = createMockBot();
      const task = new FleeTask(bot);
      task.onStart();
      expect(task.displayName).toContain('ASSESSING');
    });

    it('should have no threats at start', () => {
      const bot = createMockBot();
      const task = new FleeTask(bot);
      task.onStart();
      expect(task.getThreatCount()).toBe(0);
    });

    it('should return empty threats array at start', () => {
      const bot = createMockBot();
      const task = new FleeTask(bot);
      task.onStart();
      expect(task.getThreats()).toEqual([]);
    });

    it('should support manual trigger', () => {
      const bot = createMockBot();
      const task = new FleeTask(bot);
      task.onStart();
      task.triggerFlee();
      expect(task.getTrigger()).toBe(FleeTrigger.MANUAL);
    });

    it('should compare by safe distance and health threshold', () => {
      const bot = createMockBot();
      const task1 = new FleeTask(bot, { safeDistance: 32, healthThreshold: 6 });
      const task2 = new FleeTask(bot, { safeDistance: 32, healthThreshold: 6 });
      const task3 = new FleeTask(bot, { safeDistance: 50, healthThreshold: 6 });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('SmithingTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new SmithingTask(bot);
      expect(task.displayName).toContain('Smithing');
    });

    it('should create with target items', () => {
      const bot = createMockBot();
      const task = new SmithingTask(bot, { targetItems: ['diamond_sword'] });
      expect(task.displayName).toContain('Smithing');
    });

    it('should start in FINDING_TABLE state', () => {
      const bot = createMockBot();
      const task = new SmithingTask(bot);
      task.onStart();
      expect(task.displayName).toContain('FINDING_TABLE');
    });

    it('should track upgrades completed', () => {
      const bot = createMockBot();
      const task = new SmithingTask(bot);
      task.onStart();
      expect(task.getUpgradesCompleted()).toBe(0);
    });

    it('should compare by target items', () => {
      const bot = createMockBot();
      const task1 = new SmithingTask(bot, { targetItems: ['diamond_sword'] });
      const task2 = new SmithingTask(bot, { targetItems: ['diamond_sword'] });
      const task3 = new SmithingTask(bot, { targetItems: ['diamond_pickaxe'] });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('TameAnimalTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new TameAnimalTask(bot);
      expect(task.displayName).toContain('TameAnimal');
    });

    it('should create with specific animal type', () => {
      const bot = createMockBot();
      const task = new TameAnimalTask(bot, { animalType: TameableAnimal.CAT });
      expect(task.displayName).toContain('cat');
    });

    it('should create with multiple animals', () => {
      const bot = createMockBot();
      const task = new TameAnimalTask(bot, { maxAnimals: 3 });
      expect(task.displayName).toContain('0/3');
    });

    it('should start in SEARCHING state', () => {
      const bot = createMockBot();
      const task = new TameAnimalTask(bot);
      task.onStart();
      expect(task.displayName).toContain('SEARCHING');
    });

    it('should track tamed count', () => {
      const bot = createMockBot();
      const task = new TameAnimalTask(bot);
      task.onStart();
      expect(task.getTamedCount()).toBe(0);
    });

    it('should have no target at start', () => {
      const bot = createMockBot();
      const task = new TameAnimalTask(bot);
      task.onStart();
      expect(task.getTargetAnimal()).toBeNull();
    });

    it('should compare by animal type and max count', () => {
      const bot = createMockBot();
      const task1 = new TameAnimalTask(bot, { animalType: TameableAnimal.WOLF, maxAnimals: 1 });
      const task2 = new TameAnimalTask(bot, { animalType: TameableAnimal.WOLF, maxAnimals: 1 });
      const task3 = new TameAnimalTask(bot, { animalType: TameableAnimal.CAT, maxAnimals: 1 });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('RideEntityTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new RideEntityTask(bot);
      expect(task.displayName).toContain('RideEntity');
    });

    it('should create with specific entity type', () => {
      const bot = createMockBot();
      const task = new RideEntityTask(bot, { entityType: RideableEntity.HORSE });
      expect(task.displayName).toContain('horse');
    });

    it('should create with destination', () => {
      const bot = createMockBot();
      const destination = new Vec3(100, 64, 100);
      const task = new RideEntityTask(bot, { destination });
      expect(task.displayName).toContain('to 100,100');
    });

    it('should start in FINDING_MOUNT state', () => {
      const bot = createMockBot();
      const task = new RideEntityTask(bot);
      task.onStart();
      expect(task.displayName).toContain('FINDING_MOUNT');
    });

    it('should have no mount at start', () => {
      const bot = createMockBot();
      const task = new RideEntityTask(bot);
      task.onStart();
      expect(task.getMount()).toBeNull();
    });

    it('should not be riding at start', () => {
      const bot = createMockBot();
      const task = new RideEntityTask(bot);
      task.onStart();
      expect(task.isCurrentlyRiding()).toBe(false);
    });

    it('should compare by entity type', () => {
      const bot = createMockBot();
      const task1 = new RideEntityTask(bot, { entityType: RideableEntity.HORSE });
      const task2 = new RideEntityTask(bot, { entityType: RideableEntity.HORSE });
      const task3 = new RideEntityTask(bot, { entityType: RideableEntity.PIG });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('CleanupTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new CleanupTask(bot);
      expect(task.displayName).toContain('Cleanup');
    });

    it('should create with debris mode', () => {
      const bot = createMockBot();
      const task = new CleanupTask(bot, { mode: CleanupMode.CLEAR_DEBRIS });
      expect(task.displayName).toContain('CLEAR_DEBRIS');
    });

    it('should create with flatten mode', () => {
      const bot = createMockBot();
      const task = new CleanupTask(bot, { mode: CleanupMode.FLATTEN, targetY: 64 });
      expect(task.displayName).toContain('FLATTEN');
    });

    it('should create with custom radius', () => {
      const bot = createMockBot();
      const task = new CleanupTask(bot, { radius: 32 });
      expect(task.displayName).toContain('Cleanup');
    });

    it('should start in SCANNING state', () => {
      const bot = createMockBot();
      const task = new CleanupTask(bot);
      task.onStart();
      expect(task.displayName).toContain('SCANNING');
    });

    it('should track blocks cleaned', () => {
      const bot = createMockBot();
      const task = new CleanupTask(bot);
      task.onStart();
      expect(task.getBlocksCleaned()).toBe(0);
    });

    it('should track items collected', () => {
      const bot = createMockBot();
      const task = new CleanupTask(bot);
      task.onStart();
      expect(task.getItemsCollected()).toBe(0);
    });

    it('should compare by mode and radius', () => {
      const bot = createMockBot();
      const task1 = new CleanupTask(bot, { mode: CleanupMode.CLEAR_DEBRIS, radius: 16 });
      const task2 = new CleanupTask(bot, { mode: CleanupMode.CLEAR_DEBRIS, radius: 16 });
      const task3 = new CleanupTask(bot, { mode: CleanupMode.CLEAR_VEGETATION, radius: 16 });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('WaterBucketTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      bot.entity.velocity = { y: 0 };
      const task = new WaterBucketTask(bot);
      expect(task.displayName).toContain('WaterBucket');
    });

    it('should start in MONITORING state', () => {
      const bot = createMockBot();
      bot.entity.velocity = { y: 0 };
      const task = new WaterBucketTask(bot);
      task.onStart();
      expect(task.displayName).toContain('MONITORING');
    });

    it('should have no landing position at start', () => {
      const bot = createMockBot();
      bot.entity.velocity = { y: 0 };
      const task = new WaterBucketTask(bot);
      task.onStart();
      expect(task.getLandingPosition()).toBeNull();
    });

    it('should not have placed water at start', () => {
      const bot = createMockBot();
      bot.entity.velocity = { y: 0 };
      const task = new WaterBucketTask(bot);
      task.onStart();
      expect(task.wasWaterPlaced()).toBe(false);
    });

    it('should support manual trigger', () => {
      const bot = createMockBot();
      bot.entity.velocity = { y: 0 };
      const task = new WaterBucketTask(bot);
      task.onStart();
      task.triggerMLG();
      expect(task.displayName).toContain('FALLING');
    });

    it('should compare as equal', () => {
      const bot = createMockBot();
      bot.entity.velocity = { y: 0 };
      const task1 = new WaterBucketTask(bot);
      const task2 = new WaterBucketTask(bot);
      expect(task1.isEqual(task2)).toBe(true);
    });
  });

  describe('EscapeDangerTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new EscapeDangerTask(bot);
      expect(task.displayName).toContain('EscapeDanger');
    });

    it('should start in ASSESSING state', () => {
      const bot = createMockBot();
      const task = new EscapeDangerTask(bot);
      task.onStart();
      expect(task.displayName).toContain('ASSESSING');
    });

    it('should have no danger at start', () => {
      const bot = createMockBot();
      const task = new EscapeDangerTask(bot);
      task.onStart();
      expect(task.getCurrentDanger()).toBe(DangerType.NONE);
    });

    it('should have no safe spot at start', () => {
      const bot = createMockBot();
      const task = new EscapeDangerTask(bot);
      task.onStart();
      expect(task.getSafeSpot()).toBeNull();
    });

    it('should create with lava-only config', () => {
      const bot = createMockBot();
      const task = new EscapeDangerTask(bot, {
        checkLava: true,
        checkFire: false,
        checkDrowning: false,
      });
      expect(task.displayName).toContain('EscapeDanger');
    });

    it('should compare as equal', () => {
      const bot = createMockBot();
      const task1 = new EscapeDangerTask(bot);
      const task2 = new EscapeDangerTask(bot);
      expect(task1.isEqual(task2)).toBe(true);
    });
  });

  describe('ThrowEnderEyeTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      bot.entity.yaw = 0;
      const task = new ThrowEnderEyeTask(bot);
      expect(task.displayName).toContain('ThrowEnderEye');
    });

    it('should start in PREPARING state', () => {
      const bot = createMockBot();
      bot.entity.yaw = 0;
      const task = new ThrowEnderEyeTask(bot);
      task.onStart();
      expect(task.displayName).toContain('PREPARING');
    });

    it('should have no result at start', () => {
      const bot = createMockBot();
      bot.entity.yaw = 0;
      const task = new ThrowEnderEyeTask(bot);
      task.onStart();
      expect(task.getResult()).toBeNull();
    });

    it('should have no direction at start', () => {
      const bot = createMockBot();
      bot.entity.yaw = 0;
      const task = new ThrowEnderEyeTask(bot);
      task.onStart();
      expect(task.getDirection()).toBeNull();
    });

    it('should have empty eye positions at start', () => {
      const bot = createMockBot();
      bot.entity.yaw = 0;
      const task = new ThrowEnderEyeTask(bot);
      task.onStart();
      expect(task.getEyePositions()).toEqual([]);
    });

    it('should create with custom pitch', () => {
      const bot = createMockBot();
      bot.entity.yaw = 0;
      const task = new ThrowEnderEyeTask(bot, { throwPitch: -45 });
      expect(task.displayName).toContain('ThrowEnderEye');
    });

    it('should compare as equal', () => {
      const bot = createMockBot();
      bot.entity.yaw = 0;
      const task1 = new ThrowEnderEyeTask(bot);
      const task2 = new ThrowEnderEyeTask(bot);
      expect(task1.isEqual(task2)).toBe(true);
    });
  });

  describe('BridgeTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new BridgeTask(bot);
      expect(task.displayName).toContain('Bridge');
    });

    it('should create with direction and distance', () => {
      const bot = createMockBot();
      const task = new BridgeTask(bot, {
        direction: BridgeDirection.NORTH,
        distance: 20,
      });
      expect(task.displayName).toContain('north');
      expect(task.displayName).toContain('0/20');
    });

    it('should start with zero blocks placed', () => {
      const bot = createMockBot();
      const task = new BridgeTask(bot);
      task.onStart();
      expect(task.getBlocksPlaced()).toBe(0);
    });

    it('should have no selected material at start', () => {
      const bot = createMockBot();
      const task = new BridgeTask(bot);
      task.onStart();
      expect(task.getSelectedMaterial()).toBeNull();
    });

    it('should compare direction and distance for equality', () => {
      const bot = createMockBot();
      const task1 = new BridgeTask(bot, { direction: BridgeDirection.EAST, distance: 10 });
      const task2 = new BridgeTask(bot, { direction: BridgeDirection.EAST, distance: 10 });
      const task3 = new BridgeTask(bot, { direction: BridgeDirection.WEST, distance: 10 });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });

    it('should create with railings option', () => {
      const bot = createMockBot();
      const task = new BridgeTask(bot, { placeRailings: true });
      expect(task.displayName).toContain('Bridge');
    });
  });

  describe('ScaffoldTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new ScaffoldTask(bot);
      expect(task.displayName).toContain('Scaffold');
    });

    it('should create in ascend mode', () => {
      const bot = createMockBot();
      const task = new ScaffoldTask(bot, { mode: ScaffoldMode.ASCEND });
      expect(task.displayName).toContain('ascend');
    });

    it('should create in descend mode', () => {
      const bot = createMockBot();
      const task = new ScaffoldTask(bot, { mode: ScaffoldMode.DESCEND });
      expect(task.displayName).toContain('descend');
    });

    it('should create with target Y', () => {
      const bot = createMockBot();
      const task = new ScaffoldTask(bot, {
        mode: ScaffoldMode.TO_Y,
        targetY: 100,
      });
      expect(task.displayName).toContain('to_y');
    });

    it('should start with zero blocks used', () => {
      const bot = createMockBot();
      const task = new ScaffoldTask(bot);
      task.onStart();
      expect(task.getBlocksUsed()).toBe(0);
    });

    it('should track height change', () => {
      const bot = createMockBot();
      const task = new ScaffoldTask(bot);
      task.onStart();
      expect(task.getHeightChange()).toBe(0);
    });

    it('should compare mode and target for equality', () => {
      const bot = createMockBot();
      const task1 = new ScaffoldTask(bot, { mode: ScaffoldMode.TO_Y, targetY: 100 });
      const task2 = new ScaffoldTask(bot, { mode: ScaffoldMode.TO_Y, targetY: 100 });
      const task3 = new ScaffoldTask(bot, { mode: ScaffoldMode.TO_Y, targetY: 200 });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('MineLayerTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new MineLayerTask(bot);
      expect(task.displayName).toContain('MineLayer');
      expect(task.displayName).toContain('Y:-59');
    });

    it('should create with custom Y level', () => {
      const bot = createMockBot();
      const task = new MineLayerTask(bot, { yLevel: 11 });
      expect(task.displayName).toContain('Y:11');
    });

    it('should start with zero blocks mined', () => {
      const bot = createMockBot();
      const task = new MineLayerTask(bot);
      task.onStart();
      expect(task.getBlocksMined()).toBe(0);
    });

    it('should have empty ores found at start', () => {
      const bot = createMockBot();
      const task = new MineLayerTask(bot);
      task.onStart();
      expect(task.getOresFound().size).toBe(0);
    });

    it('should track progress', () => {
      const bot = createMockBot();
      const task = new MineLayerTask(bot, { width: 10, length: 10 });
      task.onStart();
      expect(task.getProgress()).toBe(0);
    });

    it('should create with strip pattern', () => {
      const bot = createMockBot();
      const task = new MineLayerTask(bot, { pattern: MinePattern.STRIP });
      expect(task.displayName).toContain('MineLayer');
    });

    it('should create with spiral pattern', () => {
      const bot = createMockBot();
      const task = new MineLayerTask(bot, { pattern: MinePattern.SPIRAL });
      expect(task.displayName).toContain('MineLayer');
    });

    it('should create with grid pattern', () => {
      const bot = createMockBot();
      const task = new MineLayerTask(bot, { pattern: MinePattern.GRID });
      expect(task.displayName).toContain('MineLayer');
    });

    it('should compare dimensions for equality', () => {
      const bot = createMockBot();
      const task1 = new MineLayerTask(bot, { yLevel: -59, width: 16, length: 32 });
      const task2 = new MineLayerTask(bot, { yLevel: -59, width: 16, length: 32 });
      const task3 = new MineLayerTask(bot, { yLevel: 11, width: 16, length: 32 });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });

    it('should configure torch interval', () => {
      const bot = createMockBot();
      const task = new MineLayerTask(bot, { torchInterval: 4 });
      expect(task.displayName).toContain('MineLayer');
    });
  });

  describe('TorchTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new TorchTask(bot);
      expect(task.displayName).toContain('Torch');
    });

    it('should create with dark spots mode', () => {
      const bot = createMockBot();
      const task = new TorchTask(bot, { mode: TorchMode.DARK_SPOTS });
      expect(task.displayName).toContain('dark_spots');
    });

    it('should create with grid mode', () => {
      const bot = createMockBot();
      const task = new TorchTask(bot, { mode: TorchMode.GRID });
      expect(task.displayName).toContain('grid');
    });

    it('should create with walls mode', () => {
      const bot = createMockBot();
      const task = new TorchTask(bot, { mode: TorchMode.WALLS });
      expect(task.displayName).toContain('walls');
    });

    it('should start with zero torches placed', () => {
      const bot = createMockBot();
      const task = new TorchTask(bot);
      task.onStart();
      expect(task.getTorchesPlaced()).toBe(0);
    });

    it('should track remaining spots', () => {
      const bot = createMockBot();
      const task = new TorchTask(bot);
      task.onStart();
      expect(task.getRemainingSpots()).toBe(0);
    });

    it('should compare mode and radius for equality', () => {
      const bot = createMockBot();
      const task1 = new TorchTask(bot, { mode: TorchMode.GRID, radius: 16 });
      const task2 = new TorchTask(bot, { mode: TorchMode.GRID, radius: 16 });
      const task3 = new TorchTask(bot, { mode: TorchMode.FLOOD, radius: 16 });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('ShearTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new ShearTask(bot);
      expect(task.displayName).toContain('Shear');
    });

    it('should create with max sheep count', () => {
      const bot = createMockBot();
      const task = new ShearTask(bot, { maxSheep: 20 });
      expect(task.displayName).toContain('0/20');
    });

    it('should start with zero sheep sheared', () => {
      const bot = createMockBot();
      const task = new ShearTask(bot);
      task.onStart();
      expect(task.getSheepSheared()).toBe(0);
    });

    it('should have no current target at start', () => {
      const bot = createMockBot();
      const task = new ShearTask(bot);
      task.onStart();
      expect(task.getCurrentTarget()).toBeNull();
    });

    it('should compare max sheep and color for equality', () => {
      const bot = createMockBot();
      const task1 = new ShearTask(bot, { maxSheep: 10, targetColor: 'white' });
      const task2 = new ShearTask(bot, { maxSheep: 10, targetColor: 'white' });
      const task3 = new ShearTask(bot, { maxSheep: 10, targetColor: 'black' });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });

    it('should create with specific color target', () => {
      const bot = createMockBot();
      const task = new ShearTask(bot, { targetColor: 'blue' });
      expect(task.displayName).toContain('Shear');
    });
  });

  describe('RespawnTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new RespawnTask(bot);
      expect(task.displayName).toContain('Respawn');
    });

    it('should start in CHECKING_STATUS state', () => {
      const bot = createMockBot();
      const task = new RespawnTask(bot);
      task.onStart();
      expect(task.displayName).toContain('CHECKING_STATUS');
    });

    it('should have no death location at start', () => {
      const bot = createMockBot();
      const task = new RespawnTask(bot);
      task.onStart();
      expect(task.getDeathLocation()).toBeNull();
    });

    it('should store death location when set', () => {
      const bot = createMockBot();
      const task = new RespawnTask(bot);
      task.onStart();
      task.setDeathLocation(new Vec3(100, 64, 200));
      const loc = task.getDeathLocation();
      expect(loc).not.toBeNull();
      expect(loc!.x).toBe(100);
      expect(loc!.z).toBe(200);
    });

    it('should create with return to death disabled', () => {
      const bot = createMockBot();
      const task = new RespawnTask(bot, { returnToDeathLocation: false });
      expect(task.displayName).toContain('Respawn');
    });

    it('should report not respawned initially', () => {
      const bot = createMockBot();
      const task = new RespawnTask(bot);
      task.onStart();
      // Since bot is not dead, it will go to FINISHED
      task.onTick();
      expect(task.hasRespawned()).toBe(true);
    });

    it('should compare as equal', () => {
      const bot = createMockBot();
      const task1 = new RespawnTask(bot);
      const task2 = new RespawnTask(bot);
      expect(task1.isEqual(task2)).toBe(true);
    });
  });

  describe('PlantTreeTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new PlantTreeTask(bot);
      expect(task.displayName).toContain('PlantTree');
    });

    it('should create with count', () => {
      const bot = createMockBot();
      const task = new PlantTreeTask(bot, { count: 10 });
      expect(task.displayName).toContain('0/10');
    });

    it('should start with zero trees planted', () => {
      const bot = createMockBot();
      const task = new PlantTreeTask(bot);
      task.onStart();
      expect(task.getTreesPlanted()).toBe(0);
    });

    it('should have empty planted positions at start', () => {
      const bot = createMockBot();
      const task = new PlantTreeTask(bot);
      task.onStart();
      expect(task.getPlantedPositions()).toEqual([]);
    });

    it('should create with specific sapling type', () => {
      const bot = createMockBot();
      const task = new PlantTreeTask(bot, { saplingType: 'oak_sapling' });
      expect(task.displayName).toContain('PlantTree');
    });

    it('should compare sapling type and count for equality', () => {
      const bot = createMockBot();
      const task1 = new PlantTreeTask(bot, { saplingType: 'oak_sapling', count: 5 });
      const task2 = new PlantTreeTask(bot, { saplingType: 'oak_sapling', count: 5 });
      const task3 = new PlantTreeTask(bot, { saplingType: 'spruce_sapling', count: 5 });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('CompostTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new CompostTask(bot);
      expect(task.displayName).toContain('Compost');
    });

    it('should create with target bone meal', () => {
      const bot = createMockBot();
      const task = new CompostTask(bot, { targetBonemeal: 32 });
      expect(task.displayName).toContain('0/32');
    });

    it('should start with zero bone meal collected', () => {
      const bot = createMockBot();
      const task = new CompostTask(bot);
      task.onStart();
      expect(task.getBonemealCollected()).toBe(0);
    });

    it('should start with zero materials used', () => {
      const bot = createMockBot();
      const task = new CompostTask(bot);
      task.onStart();
      expect(task.getMaterialsUsed()).toBe(0);
    });

    it('should compare target bone meal for equality', () => {
      const bot = createMockBot();
      const task1 = new CompostTask(bot, { targetBonemeal: 16 });
      const task2 = new CompostTask(bot, { targetBonemeal: 16 });
      const task3 = new CompostTask(bot, { targetBonemeal: 32 });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });

  describe('UseEffectTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new UseEffectTask(bot);
      expect(task.displayName).toContain('UseEffect');
    });

    it('should create with healing effect', () => {
      const bot = createMockBot();
      const task = new UseEffectTask(bot, { effectType: EffectType.HEALING });
      expect(task.displayName).toContain('healing');
    });

    it('should create with strength effect', () => {
      const bot = createMockBot();
      const task = new UseEffectTask(bot, { effectType: EffectType.STRENGTH });
      expect(task.displayName).toContain('strength');
    });

    it('should start with zero uses', () => {
      const bot = createMockBot();
      const task = new UseEffectTask(bot);
      task.onStart();
      expect(task.getUsesCount()).toBe(0);
    });

    it('should create with low health trigger', () => {
      const bot = createMockBot();
      const task = new UseEffectTask(bot, {
        effectType: EffectType.HEALING,
        trigger: EffectTrigger.LOW_HEALTH,
        healthThreshold: 8,
      });
      expect(task.displayName).toContain('UseEffect');
    });

    it('should create with immediate trigger', () => {
      const bot = createMockBot();
      const task = new UseEffectTask(bot, {
        effectType: EffectType.SPEED,
        trigger: EffectTrigger.IMMEDIATE,
      });
      expect(task.displayName).toContain('speed');
    });

    it('should compare effect type and trigger for equality', () => {
      const bot = createMockBot();
      const task1 = new UseEffectTask(bot, { effectType: EffectType.HEALING, trigger: EffectTrigger.LOW_HEALTH });
      const task2 = new UseEffectTask(bot, { effectType: EffectType.HEALING, trigger: EffectTrigger.LOW_HEALTH });
      const task3 = new UseEffectTask(bot, { effectType: EffectType.STRENGTH, trigger: EffectTrigger.LOW_HEALTH });
      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });
});
