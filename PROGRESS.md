# Test Migration Progress

## Status: COMPLETE

All 35 test files have been moved from `test/` to colocated positions next to their source files in `src/`.

## What was done

### Config updates
- [x] `jest.config.js`: Changed roots from `test` to `src`, excluded `*.test.ts` and `__test-utils__` from coverage
- [x] `tsconfig.json`: Added `src/**/*.test.ts` and `src/__test-utils__` to exclude list
- [x] Moved `test/mocks/` to `src/__test-utils__/`
- [x] Deleted old `test/` directory

### Files moved (35 total)

| Original | New Location |
|----------|-------------|
| test/AStar.test.ts | src/pathing/AStar.test.ts |
| test/ActionCosts.test.ts | src/core/ActionCosts.test.ts |
| test/BinaryHeap.test.ts | src/pathing/BinaryHeap.test.ts |
| test/AsyncPathfinder.test.ts | src/pathing/AsyncPathfinder.test.ts |
| test/BlockPos.test.ts | src/types.test.ts |
| test/CraftingRecipe.test.ts | src/crafting/CraftingRecipe.test.ts |
| test/EventBus.test.ts | src/events/EventBus.test.ts |
| test/PathSmoother.test.ts | src/pathing/PathSmoother.test.ts |
| test/ItemTarget.test.ts | src/utils/ItemTarget.test.ts |
| test/Timers.test.ts | src/utils/timers/timers.test.ts |
| test/Goals.test.ts | src/goals/Goals.test.ts |
| test/CompositeTasks.test.ts | src/tasks/composite/composite.test.ts |
| test/ConcreteTasks.test.ts | src/tasks/concrete/concrete.test.ts |
| test/TaskSystem.test.ts | src/tasks/TaskSystem.test.ts |
| test/Chains.test.ts | src/chains/Chains.test.ts |
| test/integration/Pathfinding.test.ts | src/pathing/Pathfinding.integration.test.ts |
| test/AdvancedConstructionTask.test.ts | src/tasks/concrete/AdvancedConstructionTask.test.ts |
| test/BeatMinecraftTask.test.ts | src/tasks/concrete/BeatMinecraftTask.test.ts |
| test/BlockSearchTasks.test.ts | src/tasks/concrete/BlockSearchTask.test.ts |
| test/ConstructionTasks.test.ts | src/tasks/concrete/ConstructionTask.test.ts |
| test/ContainerTasks.test.ts | src/tasks/concrete/ContainerTask.test.ts |
| test/EntityTasks.test.ts | src/tasks/concrete/EntityTask.test.ts |
| test/EscapeTasks.test.ts | src/tasks/concrete/EscapeTask.test.ts |
| test/MiscTask.test.ts | src/tasks/concrete/MiscTask.test.ts |
| test/MiscTasks.test.ts | src/tasks/concrete/MiscTasks.test.ts |
| test/MissingTasks.test.ts | src/tasks/concrete/MissingTasks.test.ts |
| test/MovementUtilTasks.test.ts | src/tasks/concrete/MovementUtilTask.test.ts |
| test/MovementAndResourceTasks.test.ts | src/tasks/concrete/MovementAndResourceTasks.test.ts |
| test/ObsidianAndPortalTasks.test.ts | src/tasks/concrete/ObsidianAndPortalTasks.test.ts |
| test/ResourceTasks.test.ts | src/tasks/concrete/ResourceTasks.test.ts |
| test/SlotTasks.test.ts | src/tasks/concrete/SlotTask.test.ts |
| test/SpeedrunTasks.test.ts | src/tasks/concrete/SpeedrunTasks.test.ts |
| test/StashAndRavageTasks.test.ts | src/tasks/concrete/StashAndRavageTasks.test.ts |
| test/StorageAndCraftingTasks.test.ts | src/tasks/concrete/StorageAndCraftingTasks.test.ts |
| test/TradeAndMLGTasks.test.ts | src/tasks/concrete/TradeAndMLGTasks.test.ts |

### Import path fixes
All import paths were updated from `../src/X` patterns to relative paths appropriate for each file's new location. No remaining broken import references.
