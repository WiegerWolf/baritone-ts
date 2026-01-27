# AltoClef/BaritonePlus Implementation Progress

This document tracks the implementation of features from AltoClef and BaritonePlus into baritone-ts.

## Completed Phases

### Phase 1: Core Infrastructure (Iterations 1-2)
- [x] Task system with hierarchical execution
- [x] Timers (TimerGame, TimerReal, Stopwatch)
- [x] Progress checkers (ProgressChecker, DistanceProgressChecker, LinearProgressChecker)
- [x] Base Task class with lifecycle management

### Phase 2: Tracker System (Iterations 2-3)
- [x] Block tracker for scanning and tracking blocks
- [x] Entity tracker for nearby entities
- [x] Item storage tracker for container contents

### Phase 3: Essential Chains (Iterations 3-4)
- [x] FoodChain - automatic eating when hungry
- [x] WorldSurvivalChain - handles drowning, burning, lava
- [x] MLGBucketChain - water bucket saves during falls
- [x] MobDefenseChain - combat and fleeing from hostile mobs

### Phase 4: Resource System (Iterations 4-5)
- [x] ItemTarget - flexible item matching
- [x] ResourceTask - base class for resource gathering
- [x] ItemTargets presets (logs, planks, tools, food, ores)
- [x] Helpers and utilities

### Phase 5: Additional Features (Iterations 5-6)
- [x] Crafting system (CraftingRecipe, RecipeTarget, COMMON_RECIPES)
- [x] Settings system for bot configuration
- [x] EventBus for decoupled event handling
- [x] Look utilities (LookHelper)
- [x] TaskRunner for priority-based chain management
- [x] TaskCatalogue for item acquisition strategies

### Phase 6: Integration Tests (Iteration 7)
- [x] TaskSystem.test.ts - Task, TaskChain, TaskRunner tests
- [x] ItemTarget.test.ts - ItemTarget and presets tests
- [x] Timers.test.ts - TimerGame, TimerReal, Stopwatch tests
- [x] CraftingRecipe.test.ts - Crafting system tests
- [x] EventBus.test.ts - Event system tests

## Bug Fixes (Iteration 7)
- Fixed TypeScript errors with `isInWater` property access (use `as any` cast)
- Fixed ChainPriority type narrowing in TaskRunner
- Fixed private property access (`targetCount` -> `getTargetCount()`)
- Fixed variadic argument spreading for `getContainersWithItem`
- Fixed readonly array sorting with spread operator
- Fixed TimerGame null check in constructor

## Test Results
All 320 tests passing:
- TaskSystem.test.ts: 24 tests
- ItemTarget.test.ts: 23 tests
- Timers.test.ts: 15 tests
- CraftingRecipe.test.ts: 34 tests
- EventBus.test.ts: 24 tests
- CompositeTasks.test.ts: 30 tests
- Plus existing pathfinding tests

## Architecture Overview

```
src/
├── tasks/           # Task system
│   ├── Task.ts           # Base task class
│   ├── TaskChain.ts      # Chain management
│   ├── TaskRunner.ts     # Priority-based execution
│   ├── ResourceTask.ts   # Resource gathering base
│   ├── TaskCatalogue.ts  # Item acquisition strategies
│   └── interfaces.ts     # Type definitions
├── chains/          # Priority chains
│   ├── FoodChain.ts
│   ├── WorldSurvivalChain.ts
│   ├── MLGBucketChain.ts
│   └── MobDefenseChain.ts
├── trackers/        # World state tracking
│   ├── BlockTracker.ts
│   ├── EntityTracker.ts
│   └── ItemStorageTracker.ts
├── crafting/        # Crafting system
│   └── CraftingRecipe.ts
├── events/          # Event system
│   └── EventBus.ts
├── utils/           # Utilities
│   ├── ItemTarget.ts
│   ├── LookHelper.ts
│   └── timers/
│       ├── BaseTimer.ts
│       ├── TimerGame.ts
│       ├── TimerReal.ts
│       └── Stopwatch.ts
└── settings/        # Configuration
    └── Settings.ts
```

### Phase 7: Concrete Task Implementations (Iteration 8)
- [x] GoToTask - Base navigation task with pathfinder integration
- [x] GoToBlockTask - Navigate to specific block
- [x] GetToBlockTask - Get within reach of a block
- [x] GoToNearTask - Get within radius of position
- [x] GoToXZTask - Navigate to XZ coordinates
- [x] FollowEntityTask - Follow a moving entity
- [x] MineBlockTask - Mine a specific block
- [x] MineBlockTypeTask - Find and mine block types
- [x] PlaceBlockTask - Place a block at position
- [x] PlaceAgainstTask - Place against existing block
- [x] CraftTask - Craft items using recipes
- [x] EnsureItemTask - Ensure have item (craft if needed)

## New Files (Iteration 8)
```
src/tasks/concrete/
├── index.ts           # Exports all concrete tasks
├── GoToTask.ts        # Navigation tasks
├── MineBlockTask.ts   # Mining tasks
├── PlaceBlockTask.ts  # Placement tasks
└── CraftTask.ts       # Crafting tasks
```

### Phase 8: Additional Concrete Tasks (Iteration 9)
- [x] SmeltTask - Smelt items in furnaces
- [x] isFuel/getFuelBurnTime - Fuel utilities
- [x] PickupItemTask - Pick up dropped items
- [x] EquipTask - Equip items to equipment slots
- [x] DropItemTask - Drop items from inventory
- [x] MoveItemTask - Move items between slots
- [x] InteractBlockTask - Right-click blocks
- [x] InteractEntityTask - Right-click entities
- [x] AttackEntityTask - Attack entities
- [x] UseItemTask - Use held item

## New Files (Iteration 9)
```
src/tasks/concrete/
├── SmeltTask.ts       # Furnace smelting
├── InventoryTask.ts   # Item management (pickup, equip, drop, move)
└── InteractTask.ts    # Block/entity interaction, attacking
```

### Phase 9: Composite Task Chains (Iteration 10)
- [x] CollectWoodTask - Find trees, mine logs, collect drops
- [x] GetToolTask - Ensure bot has required tool, crafting if necessary
- [x] ensureTool() - Convenience function for tool acquisition
- [x] ToolType type - 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe'
- [x] GatherResourcesTask - Flexible multi-item gathering with multiple methods
- [x] gatherResources() - Convenience function for resource gathering
- [x] GatherConfig - Configuration for gather behavior

### Phase 10: Specialized Composite Tasks (Iteration 11)
- [x] MineOresTask - Find and mine ore deposits with tool tier management
- [x] mineDiamonds, mineIron, mineCoal, mineGold, mineAllOres - Convenience functions
- [x] MineOreConfig - Configuration with priority, search radius, auto-tool
- [x] FarmTask - Agricultural automation (plant, harvest, replant)
- [x] FarmMode enum - HARVEST_ONLY, PLANT_ONLY, HARVEST_AND_REPLANT, MAINTAIN
- [x] harvestCrops, harvestAndReplant, maintainFarm, harvestWheat - Convenience functions
- [x] FarmConfig - Configuration for farming behavior

### Phase 11: Exploration and Construction (Iteration 12)
- [x] ExploreTask - Systematic terrain exploration
- [x] ExplorePattern enum - SPIRAL, CARDINAL, RANDOM, TOWARDS
- [x] exploreSpiral, exploreTowards, exploreRandom, exploreArea - Convenience functions
- [x] ExploreConfig - Configuration with pattern, distance, chunk tracking
- [x] BuildShelterTask - Emergency shelter construction
- [x] ShelterType enum - DIRT_HUT, WOOD_CABIN, UNDERGROUND, NERD_POLE
- [x] buildDirtHut, buildWoodCabin, digUnderground, buildEmergencyShelter - Convenience functions
- [x] ShelterConfig - Configuration for shelter building

### Phase 12: Combat and Survival Automation (Iteration 13)
- [x] CombatTask - Coordinated combat behavior
- [x] CombatStyle enum - MELEE, RANGED, HIT_AND_RUN, DEFENSIVE
- [x] fightMobs, fightEntity, hitAndRun, defensiveCombat - Convenience functions
- [x] CombatConfig - Configuration for combat engagement
- [x] SurviveTask - High-level survival automation
- [x] SurvivalPriority enum - CRITICAL, URGENT, NORMAL, LOW
- [x] survive, survivePassive, surviveAndProgress - Convenience functions
- [x] SurvivalGoals - Configuration for survival behavior

### Phase 13: Composite Task Testing (Iteration 14)
- [x] CompositeTasks.test.ts - 30 tests for all composite tasks
- [x] CollectWoodTask tests - creation, state management
- [x] GetToolTask tests - tool types, tiers, equality
- [x] GatherResourcesTask tests - string/array targets
- [x] MineOresTask tests - default config, specific ores
- [x] FarmTask tests - modes, crop targeting
- [x] ExploreTask tests - patterns, chunk tracking
- [x] BuildShelterTask tests - shelter types, states
- [x] CombatTask tests - styles, target types, kill tracking
- [x] SurviveTask tests - goals, continuous operation

## New Files (Iteration 10)
```
src/tasks/composite/
├── index.ts              # Exports all composite tasks
├── CollectWoodTask.ts    # Wood collection workflow
├── GetToolTask.ts        # Tool acquisition with crafting
└── GatherResourcesTask.ts # Multi-item resource gathering
```

## New Files (Iteration 11)
```
src/tasks/composite/
├── MineOresTask.ts       # Ore mining with tool tier management
└── FarmTask.ts           # Agricultural automation
```

## New Files (Iteration 12)
```
src/tasks/composite/
├── ExploreTask.ts        # Terrain exploration with patterns
└── BuildShelterTask.ts   # Emergency shelter construction
```

## New Files (Iteration 13)
```
src/tasks/composite/
├── CombatTask.ts         # Combat behavior with styles
└── SurviveTask.ts        # Automated survival gameplay
```

## Updated Architecture Overview

```
src/
├── tasks/           # Task system
│   ├── Task.ts           # Base task class
│   ├── TaskChain.ts      # Chain management
│   ├── TaskRunner.ts     # Priority-based execution
│   ├── ResourceTask.ts   # Resource gathering base
│   ├── TaskCatalogue.ts  # Item acquisition strategies
│   ├── interfaces.ts     # Type definitions
│   ├── concrete/         # Low-level atomic tasks
│   │   ├── GoToTask.ts        # Navigation tasks
│   │   ├── MineBlockTask.ts   # Mining tasks
│   │   ├── PlaceBlockTask.ts  # Placement tasks
│   │   ├── CraftTask.ts       # Crafting tasks
│   │   ├── SmeltTask.ts       # Furnace smelting
│   │   ├── InventoryTask.ts   # Item management
│   │   └── InteractTask.ts    # Block/entity interaction
│   └── composite/        # High-level orchestrating tasks
│       ├── CollectWoodTask.ts    # Wood gathering workflow
│       ├── GetToolTask.ts        # Tool acquisition
│       ├── GatherResourcesTask.ts # Multi-item gathering
│       ├── MineOresTask.ts       # Ore mining
│       ├── FarmTask.ts           # Agricultural automation
│       ├── ExploreTask.ts        # Terrain exploration
│       ├── BuildShelterTask.ts   # Shelter construction
│       ├── CombatTask.ts         # Combat behavior
│       ├── SurviveTask.ts        # Survival automation
│       ├── TradingTask.ts        # Villager trading
│       ├── EnchantTask.ts        # Enchanting workflow
│       ├── BrewingTask.ts        # Potion brewing
│       ├── FishingTask.ts        # Automated fishing
│       ├── SleepTask.ts          # Bed sleeping automation
│       ├── BoatTask.ts           # Boat/vehicle navigation
│       ├── ParkourTask.ts        # Advanced parkour movement
│       └── SchematicTask.ts      # Schematic-based building
├── chains/          # Priority chains
│   ├── FoodChain.ts
│   ├── WorldSurvivalChain.ts
│   ├── MLGBucketChain.ts
│   └── MobDefenseChain.ts
├── trackers/        # World state tracking
│   ├── BlockTracker.ts
│   ├── EntityTracker.ts
│   └── ItemStorageTracker.ts
├── crafting/        # Crafting system
│   └── CraftingRecipe.ts
├── events/          # Event system
│   └── EventBus.ts
├── utils/           # Utilities
│   ├── ItemTarget.ts
│   ├── LookHelper.ts
│   └── timers/
│       ├── BaseTimer.ts
│       ├── TimerGame.ts
│       ├── TimerReal.ts
│       └── Stopwatch.ts
└── settings/        # Configuration
    └── Settings.ts
```

### Phase 14: Interaction Composite Tasks (Iteration 15)
- [x] TradingTask - Villager trading automation with profession filtering
- [x] EnchantTask - Enchanting workflow with level/slot selection
- [x] BrewingTask - Potion brewing automation with ingredient management
- [x] Tests for TradingTask, EnchantTask, BrewingTask (14 new tests)

## New Files (Iteration 15)
```
src/tasks/composite/
├── TradingTask.ts        # Villager trading automation
├── EnchantTask.ts        # Enchanting workflow
└── BrewingTask.ts        # Potion brewing
```

### Phase 15: Concrete Task Tests (Iteration 16)
- [x] ConcreteTasks.test.ts - Comprehensive tests for all concrete tasks
- [x] Navigation task tests (GoToBlockTask, GetToBlockTask, GoToNearTask, GoToXZTask, FollowEntityTask)
- [x] Mining task tests (MineBlockTask, MineBlockTypeTask)
- [x] Placement task tests (PlaceBlockTask, PlaceAgainstTask)
- [x] Crafting task tests (CraftTask, EnsureItemTask)
- [x] Smelting task tests (SmeltTask, fuel utilities)
- [x] Inventory task tests (PickupItemTask, EquipTask, DropItemTask, MoveItemTask)
- [x] Interaction task tests (InteractBlockTask, InteractEntityTask, AttackEntityTask, UseItemTask)

## New Files (Iteration 16)
```
test/
└── ConcreteTasks.test.ts    # 40 tests for concrete tasks
```

### Phase 16: Advanced Composite Tasks (Iteration 17)
- [x] BuildTask - Structure building from patterns/blueprints
- [x] BUILD_PATTERNS - Common patterns (cube, platform, room, tower)
- [x] RepairTask - Item repair with anvils and grindstones
- [x] RepairMethod enum (ANVIL, GRINDSTONE, COMBINE)
- [x] StorageTask - Container storage management
- [x] StorageOperation enum (DEPOSIT, WITHDRAW, ORGANIZE, DUMP_ALL)
- [x] Tests for BuildTask, RepairTask, StorageTask (17 new tests)

## New Files (Iteration 17)
```
src/tasks/composite/
├── BuildTask.ts        # Structure building with patterns
├── RepairTask.ts       # Item repair automation
└── StorageTask.ts      # Container storage management
```

### Phase 17: Movement and Navigation Tasks (Iteration 18)
- [x] ElytraTask - Elytra flight automation with takeoff, cruising, landing
- [x] FlightPhase enum (PREPARING, TAKING_OFF, ASCENDING, CRUISING, DESCENDING, LANDING)
- [x] PortalTask - Dimension portal navigation (nether, end)
- [x] PortalType enum (NETHER, END)
- [x] Coordinate conversion utilities (overworldToNether, netherToOverworld)
- [x] Tests for ElytraTask, PortalTask (11 new tests)

## New Files (Iteration 18)
```
src/tasks/composite/
├── ElytraTask.ts       # Elytra flight automation
└── PortalTask.ts       # Dimension portal navigation
```

### Phase 18: Utility Composite Tasks (Iteration 19)
- [x] FishingTask - Automated fishing with rod management
- [x] FishingState enum (FINDING_WATER, APPROACHING, EQUIPPING_ROD, CASTING, WAITING, REELING, COLLECTING)
- [x] SleepTask - Bed sleeping automation with time checking
- [x] SleepState enum (CHECKING_TIME, FINDING_BED, APPROACHING, PLACING_BED, ENTERING_BED, SLEEPING, WAKING)
- [x] BoatTask - Boat/vehicle navigation for water travel
- [x] BoatState enum (FINDING_BOAT, APPROACHING, ENTERING, NAVIGATING, EXITING)
- [x] BOAT_TYPES constant for all boat variants
- [x] Tests for FishingTask, SleepTask, BoatTask (17 new tests)

## New Files (Iteration 19)
```
src/tasks/composite/
├── FishingTask.ts      # Automated fishing
├── SleepTask.ts        # Bed sleeping automation
└── BoatTask.ts         # Boat/vehicle navigation
```

### Phase 19: Advanced Movement and Building (Iteration 20)
- [x] ParkourTask - Advanced parkour movement automation
- [x] ParkourMoveType enum (SPRINT_JUMP, WALK_JUMP, STEP_UP, LADDER_CLIMB, WATER_ESCAPE, NEO, HEAD_HITTER)
- [x] ParkourState enum (ANALYZING, APPROACHING_START, ALIGNING, SPRINTING, JUMPING, IN_AIR, LANDING, CLIMBING, SWIMMING)
- [x] Jump distance constants (SOUL_SAND: 2, WALK: 3, SPRINT: 4)
- [x] SchematicTask - Schematic-based building automation
- [x] Schematic creation utilities (createCubeSchematic, createHollowBoxSchematic, createWallSchematic)
- [x] SchematicState enum (LOADING, ANALYZING, GATHERING_MATERIALS, CLEARING_AREA, BUILDING, VERIFYING)
- [x] Tests for ParkourTask, SchematicTask (16 new tests)

## New Files (Iteration 20)
```
src/tasks/composite/
├── ParkourTask.ts      # Advanced parkour movement
└── SchematicTask.ts    # Schematic-based building
```

## Test Results
All 435 tests passing:
- TaskSystem.test.ts: 24 tests
- ItemTarget.test.ts: 23 tests
- Timers.test.ts: 15 tests
- CraftingRecipe.test.ts: 34 tests
- EventBus.test.ts: 24 tests
- CompositeTasks.test.ts: 105 tests (89 + 16 new)
- ConcreteTasks.test.ts: 40 tests
- Plus existing pathfinding tests

## Implementation Summary

The baritone-ts project now includes a comprehensive implementation of features from AltoClef and BaritonePlus:

### Core Systems
- Hierarchical Task System with lifecycle management
- Priority-based Chain System (FoodChain, WorldSurvivalChain, MLGBucketChain, MobDefenseChain)
- Tracker System (BlockTracker, EntityTracker, ItemStorageTracker)
- Timer System (TimerGame, TimerReal, Stopwatch)
- Progress Checkers (Linear, Distance, Movement)
- Event Bus for decoupled communication
- Settings System for configuration

### Concrete Tasks (Low-level atomic operations)
- Navigation: GoToBlockTask, GetToBlockTask, GoToNearTask, GoToXZTask, FollowEntityTask
- Mining: MineBlockTask, MineBlockTypeTask
- Placement: PlaceBlockTask, PlaceAgainstTask
- Crafting: CraftTask, EnsureItemTask
- Smelting: SmeltTask
- Inventory: PickupItemTask, EquipTask, DropItemTask, MoveItemTask
- Interaction: InteractBlockTask, InteractEntityTask, AttackEntityTask, UseItemTask

### Composite Tasks (High-level orchestrating workflows)
- Resource Gathering: CollectWoodTask, GatherResourcesTask, MineOresTask
- Tools: GetToolTask
- Agriculture: FarmTask (harvest, plant, maintain)
- Exploration: ExploreTask (spiral, cardinal, random patterns)
- Construction: BuildShelterTask, BuildTask
- Combat: CombatTask (melee, ranged, hit-and-run, defensive)
- Survival: SurviveTask (automated survival gameplay)
- Trading: TradingTask (villager trading)
- Enchanting: EnchantTask
- Brewing: BrewingTask
- Repair: RepairTask (anvil, grindstone)
- Storage: StorageTask (deposit, withdraw, organize)
- Flight: ElytraTask (takeoff, cruise, land)
- Portals: PortalTask (nether, end navigation)
- Fishing: FishingTask (automated fishing)
- Sleep: SleepTask (bed sleeping automation)
- Boats: BoatTask (boat/vehicle navigation)
- Parkour: ParkourTask (4-block jumps, ladder climbing, water escape)
- Schematics: SchematicTask (schematic-based building)

## Next Steps (Future Iterations)

1. **Performance and Polish**
   - Performance optimization
   - Error handling improvements
   - Documentation updates
   - Integration testing
