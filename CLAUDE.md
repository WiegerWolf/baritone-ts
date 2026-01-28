# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build          # Compile TypeScript to dist/
npm run watch          # Watch mode compilation
npm run test           # Run Jest test suite
npm run lint           # Run ESLint on src/**/*.ts
```

Tests are in `test/` directory with `.test.ts` suffix. Run a single test with `npx jest test/path/to/file.test.ts`.

## Project Overview

Baritone-TS is a TypeScript port of Baritone-quality pathfinding for Mineflayer Minecraft bots. It provides tick-accurate A* pathfinding with 20+ movement types, a hierarchical task system inspired by AltoClef, and high-level automation processes.

## Architecture

### Core Pathfinding (`src/pathing/`)
- **AStar.ts**: Multi-coefficient A* (7 variants: 1.5 to 10) with graceful degradation under timeout. Time checks every 64 nodes, dual timeout system (5s primary, 2.5s failure).
- **PathExecutor.ts**: Executes paths tick-by-tick with movement skipping for lag tolerance.
- **BinaryHeap.ts**: O(log n) priority queue for A* open set.

### Movement System (`src/movements/`)
- **Movement.ts**: Basic movements (Traverse, Ascend, Descend, Diagonal, Pillar, Parkour).
- Specialized: **MovementSwim.ts**, **MovementClimb.ts**, **MovementDoor.ts**, **MovementFall.ts**, **MovementElytra.ts**, **MovementBoat.ts**.
- All costs are tick-based (e.g., walk=4.633, sprint=3.564, ladder_up=5.0).

### Goals (`src/goals/`)
17 goal types: GoalBlock, GoalXZ, GoalYLevel, GoalNear, GoalGetToBlock, GoalFollow, GoalRunAway, GoalComposite, GoalInverted, GoalAABB, etc.

### Caching (`src/cache/`)
- **ChunkCache.ts**: 2-bit encoded block storage (AIR=00, WATER=01, AVOID=10, SOLID=11) for 4x memory efficiency.
- **PrecomputedData.ts**: O(1) block property lookups.

### Task System (`src/tasks/`)
Hierarchical tasks inspired by AltoClef:
- **Task.ts**: Base class with onStart/onTick/onStop lifecycle.
- **TaskRunner.ts**: Executes task trees; child tasks returned from onTick().
- **composite/**: 40+ composite tasks for complex workflows.
- **concrete/**: 20+ atomic tasks.

### Processes (`src/behavior/`)
Priority-based automation: MineProcess, FollowProcess, ExploreProcess, GatherProcess, FarmProcess, BuildProcess, CombatProcess.

### Trackers (`src/trackers/`)
Lazy-update tracking: BlockTracker (block positions), EntityTracker (threat assessment), StorageTracker (container inventories).

### Survival Chains (`src/chains/`)
Emergency behaviors: FoodChain, MLGBucketChain, MobDefenseChain, WorldSurvivalChain.

## Key Patterns

- **Cost model**: All movement costs in game ticks, COST_INF = 1,000,000 for invalid paths.
- **Object pooling**: MutableMoveResult for A* heap operations, reusable BlockPos instances.
- **Plugin injection**: `pathfinder(bot, options)` adds pathfinder to bot instance.
- **Events**: goal_reached, path_update, path_reset, path_stop.

## Important Constants

```typescript
// ActionCosts.ts tick values
WALK_ONE_BLOCK = 4.633
SPRINT_ONE_BLOCK = 3.564
LADDER_UP = 5.0
LADDER_DOWN = 1.43
COST_INF = 1_000_000
```

## Dependencies

Uses patches in `patches/` for minecraft-data, minecraft-protocol, mineflayer, and protodef.
