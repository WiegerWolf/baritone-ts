# Test Migration Progress

## Status: COMPLETE

All tests moved from `test/` to colocated positions next to source files in `src/`. Multi-source test files have been split into per-source-file tests.

## Final test file count: 59 files (up from 35 original, due to splitting aggregate test files)

## What was done

### Phase 1: Move tests from test/ to src/
- Moved all 35 test files from `test/` to their corresponding locations in `src/`
- Fixed all import paths
- Moved mock utilities from `test/mocks/` to `src/__test-utils__/`
- Updated `jest.config.js` (roots: src, exclude test files from coverage)
- Updated `tsconfig.json` (exclude test files from build)
- Deleted old `test/` directory

### Phase 2: Split aggregate test files
Split 11 aggregate test files into 35 per-source-file test files:

| Original Aggregate | Split Into |
|---|---|
| Chains.test.ts | DeathMenuChain.test.ts, PlayerInteractionFixChain.test.ts |
| MiscTasks.test.ts | PortalTask.test.ts, ArmorTask.test.ts, BedTask.test.ts, CollectLiquidTask.test.ts, DodgeTask.test.ts |
| MissingTasks.test.ts | EscapeTask.RunAway.test.ts, BlockSearchTask.GetCloseTo.test.ts, MiningRequirementTask.test.ts, BiomeSearchTask.test.ts, DragonFightTask.test.ts |
| MovementAndResourceTasks.test.ts | GetToChunkTask.test.ts, CollectFoodTask.test.ts, CollectBlazeRodsTask.test.ts, FastTravelTask.test.ts |
| ObsidianAndPortalTasks.test.ts | CollectObsidianTask.test.ts, ConstructNetherPortalTask.test.ts, LootDesertTempleTask.test.ts |
| ResourceTasks.test.ts | ResourceTask.test.ts, MineAndCollectTask.test.ts, KillAndLootTask.test.ts, CollectFuelTask.test.ts |
| SpeedrunTasks.test.ts | StrongholdTask.test.ts, DragonFightTask.Speedrun.test.ts |
| StashAndRavageTasks.test.ts | BlockRange.test.ts (in src/utils/), StoreInStashTask.test.ts, RavageStructuresTask.test.ts |
| StorageAndCraftingTasks.test.ts | StorageContainerTask.test.ts, CraftInInventoryTask.test.ts, InteractWithBlockTask.test.ts |
| TradeAndMLGTasks.test.ts | TradeTask.test.ts, MLGTask.test.ts, ChunkSearchTask.test.ts |

### Files kept as-is (already properly named or test system-level)
- TaskSystem.test.ts (tests Task, TaskChain, TaskRunner - tightly coupled system)
- composite.test.ts (tests composite task barrel exports)
- concrete.test.ts (tests concrete task barrel exports)
- Goals.test.ts (tests goals barrel exports)
- Pathfinding.integration.test.ts (integration test)
