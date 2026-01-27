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

## Next Steps (Future Iterations)

1. **Concrete Task Implementations**
   - GetItemTask - acquire specific items
   - MineBlockTask - mine specific block types
   - PlaceBlockTask - place blocks
   - CraftTask - craft items
   - SmeltTask - smelt items in furnace

2. **Movement Integration**
   - Integrate task system with existing pathfinder
   - GoToBlockTask, GoToEntityTask
   - FollowTask for following entities

3. **Complex Task Chains**
   - CollectWoodTask (find tree, mine logs, collect drops)
   - BuildShelterTask (gather materials, find location, build)
   - GetToolTask (ensure have tool for task)

4. **Testing and Polish**
   - Integration tests with mock Minecraft world
   - Performance optimization
   - Error handling improvements
