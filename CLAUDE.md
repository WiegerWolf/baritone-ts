# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
bun run build          # Compile TypeScript to dist/
bun run watch          # Watch mode compilation
bun run test           # Run Jest test suite
bun run lint           # Run ESLint on src/**/*.ts
```

Tests are colocated with source files as `.test.ts` files. Run a single test with `bun jest path/to/file.test.ts`.

## Project Overview

Baritone-TS is a TypeScript port of Baritone-quality pathfinding for Mineflayer Minecraft bots. It provides tick-accurate A* pathfinding with 20+ movement types, a hierarchical task system inspired by AltoClef, and high-level automation processes.

## Architecture

### Core Pathfinding (`src/pathing/`)
- **AStar.ts**: Multi-coefficient A* (7 variants: 1.5 to 10) with graceful degradation under timeout. Time checks every 64 nodes, dual timeout system (5s primary, 2.5s failure).
- **AsyncPathfinder.ts**: Non-blocking path computation with progress tracking, cancellation, and partial paths.
- **PathExecutor.ts**: Executes paths tick-by-tick with movement skipping for lag tolerance.
- **PathSmoother.ts**: Path optimization utilities (smoothing, simplification, merging).
- **BinaryHeap.ts**: O(log n) priority queue for A* open set.
- **Favoring.ts**: Mob avoidance, backtrack penalties for path cost adjustments.
- **BlockUpdateWatcher.ts**, **ChunkLoadingHelper.ts**: Runtime path invalidation and chunk awareness.

### Movement System (`src/movements/`)
- **Movement.ts**: Base class. Basic movements: MovementTraverse, MovementAscend, MovementDescend, MovementDiagonal, MovementPillar, MovementParkour, MovementParkourAscend.
- **MovementFall.ts**: Extended fall with water bucket MLG.
- **swim/**: MovementSwimHorizontal, MovementSwimUp, MovementSwimDown, MovementWaterEntry, MovementWaterExit.
- **climb/**: MovementClimbUp, MovementClimbDown, MovementMountLadder, MovementDismountLadder.
- **door/**: MovementThroughDoor, MovementThroughFenceGate, MovementThroughTrapdoor.
- **elytra/**: ElytraController, ElytraState, flight path planning.
- **boat/**: BoatController, BoatState, water navigation.
- All costs are tick-based (e.g., walk=4.633, sprint=3.564, ladder_up=5.0).

### Goals (`src/goals/`)
17 goal types: GoalBlock, GoalXZ, GoalYLevel, GoalNear, GoalGetToBlock, GoalFollow, GoalRunAway, GoalComposite, GoalInverted, GoalAABB, GoalAnd, GoalBlockSide, GoalChunk, GoalDirectionXZ, GoalTwoBlocks, GoalRunAwayFromEntities, GoalDodgeProjectiles.

### Caching (`src/cache/`)
- **ChunkCache.ts**: 2-bit encoded block storage (AIR=00, WATER=01, AVOID=10, SOLID=11) for 4x memory efficiency.
- **PrecomputedData.ts**: O(1) block property lookups.

### Task System (`src/tasks/`)
Hierarchical tasks inspired by AltoClef:
- **base/**: Task, WrapperTask, GroundedTask base classes with onStart/onTick/onStop lifecycle.
- **chain/**: TaskChain, SingleTaskChain, UserTaskChain, ChainPriority for priority-based execution.
- **resource/**: ResourceTask, CollectItemTask, GatherItemTask, MineAndCollectTask.
- **TaskRunner.ts**: Executes task trees; child tasks returned from onTick().
- **TaskCatalogue.ts**: Task factory registry with acquisition chains and smelting recipes.
- **composite/**: 44 composite tasks for complex workflows (farming, combat, building, etc.).
- **concrete/**: 150+ atomic tasks (navigation, mining, crafting, inventory, interaction, etc.).

### Processes (`src/behavior/`)
- **process/**: BaseProcess, IProcess, ProcessManager, ProcessPriority, ProcessState, ProcessTickResult.
- **BotBehaviour.ts**: Core bot behaviour coordination.
- 7 process implementations: MineProcess, FollowProcess, ExploreProcess, GatherProcess, FarmProcess, BuildProcess, CombatProcess.

### Trackers (`src/trackers/`)
Lazy-update tracking with TrackerManager coordination:
- **BlockTracker**: Block positions by type with search options.
- **EntityTracker**: Entity categorization (Hostile/Neutral/Passive/Projectile/Player), threat assessment.
- **ItemStorageTracker**: Container inventory contents.
- **MiscBlockTracker**: Special blocks (doors, water, portals) per dimension.
- **SimpleChunkTracker**: Chunk load state tracking.
- **blacklisting/**: WorldLocateBlacklist, EntityLocateBlacklist for failed attempt tracking.

### Survival Chains (`src/chains/`)
Emergency behaviors with priority-based activation:
- **FoodChain** (priority 55): Automatic eating with food scoring algorithm.
- **MLGBucketChain** (priority 100): Water bucket fall protection.
- **MobDefenseChain** (priority 100): Flee/fight/smart mode for hostile encounters.
- **WorldSurvivalChain** (priority 100): Escape lava, fire, suffocation, drowning.
- **DeathMenuChain** (priority 1000): Auto-respawn handling.
- **PlayerInteractionFixChain** (priority 50): Fix stuck player interactions.

### Core Utilities (`src/core/`)
- **ActionCosts.ts**: Tick-based movement cost constants.
- **CalculationContext.ts**: A* search context and state.
- **block/**: BlockBreakHelper, BlockPlaceHelper, WaterBucketHelper.
- **RotationHelper.ts**, **InputHelper.ts**: Look rotation and control state management.

### Utilities (`src/utils/`)
- **slot/**: Slot, PlayerInventorySlot, ArmorSlot, OffhandSlot, ContainerSlot, SlotHandler.
- **progress/**: IProgressChecker, LinearProgressChecker, DistanceProgressChecker, MovementProgressChecker.
- **timers/**: BaseTimer, TimerGame (tick-based), TimerReal (real-time), Stopwatch.
- ItemHelper, EntityHelper, WorldHelper, MathHelper, StorageHelper, ProjectileHelper, LookHelper.

### Control (`src/control/`)
- **InputControls**: Low-level input state management.
- **KillAura**: Combat automation with targeting strategies.
- **PlayerExtraController**: Extended player actions (shield blocking, attack management).

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
