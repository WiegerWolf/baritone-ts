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
All 290 tests passing:
- TaskSystem.test.ts: 24 tests
- ItemTarget.test.ts: 23 tests
- Timers.test.ts: 15 tests
- CraftingRecipe.test.ts: 34 tests
- EventBus.test.ts: 24 tests
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

## New Files (Iteration 10)
```
src/tasks/composite/
├── index.ts              # Exports all composite tasks
├── CollectWoodTask.ts    # Wood collection workflow
├── GetToolTask.ts        # Tool acquisition with crafting
└── GatherResourcesTask.ts # Multi-item resource gathering
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
│       └── GatherResourcesTask.ts # Multi-item gathering
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

## Next Steps (Future Iterations)

1. **More Composite Tasks**
   - MineOresTask (find and mine ore deposits)
   - BuildShelterTask (create basic shelter)
   - FarmTask (plant/harvest crops)

2. **Testing and Polish**
   - Integration tests for concrete tasks
   - Integration tests for composite tasks
   - Performance optimization
   - Error handling improvements

3. **High-Level Tasks**
   - BuildTask - Build structures from patterns
   - ExploreTask - Explore and map terrain
   - SurviveTask - Automated survival gameplay
