# BaritonePlus → baritone-ts Port Progress

This document tracks the porting progress from BaritonePlus (Java) to baritone-ts (TypeScript).

## Summary

**Status**: In Progress
**Last Updated**: Iteration 2

### BaritonePlus Java Statistics:
- Total Tasks: 173 Java files in tasks/
- Chains: 8 Java files
- Key categories: movement, resources, container, construction, entity, slot, speedrun, misc

### baritone-ts TypeScript Statistics (Current):
- Composite Tasks: 46 files
- Concrete Tasks: 7 modules (GoTo, MineBlock, PlaceBlock, Craft, Smelt, Inventory, Interact)
- Chains: 4 files (FoodChain, MLGBucketChain, MobDefenseChain, WorldSurvivalChain)
- Tests: 15 test files

## Missing Components to Port

### Priority 1: Missing Chains
- [x] DeathMenuChain - Auto respawn/reconnect handling (Completed Iteration 1)
- [x] PlayerInteractionFixChain - Tool equipping, inventory fixes, screen closing (Completed Iteration 1)
- [x] SingleTaskChain base class improvements (DONE - exists as base)
- [x] UserTaskChain improvements (DONE - exists)

### Priority 2: Core Missing Tasks

#### Slot Management Tasks (Completed Iteration 2)
- [x] ClickSlotTask
- [x] EnsureFreeCursorSlotTask
- [x] EnsureFreeInventorySlotTask
- [x] EnsureFreePlayerCraftingGridTask
- [x] MoveItemToSlotTask (and variants)
- [x] ReceiveCraftingOutputTask
- [x] ThrowCursorTask

#### Container Tasks (Partially Exists)
- [x] LootChestTask (exists as LootChestTask)
- [x] StorageTask (exists - deposits/withdraws)
- [ ] DoStuffInContainerTask (base class)
- [ ] CraftInTableTask
- [ ] CraftInAnvilTask
- [ ] UpgradeInSmithingTableTask
- [ ] SmeltInFurnaceTask (basic exists as SmeltTask)
- [ ] SmeltInBlastFurnaceTask
- [ ] SmeltInSmokerTask
- [ ] StoreInStashTask
- [ ] PickupFromContainerTask
- [ ] ContainerStoredTracker

#### Resource Collection Tasks (Partially Exists)
- [x] CollectWoodTask (exists)
- [x] GatherResourcesTask (exists)
- [x] MineOresTask (exists)
- [ ] CollectBlazeRodsTask
- [ ] CollectFoodTask (partial - HuntTask exists)
- [ ] CollectFuelTask
- [ ] CollectBucketLiquidTask
- [ ] CollectObsidianTask
- [ ] MineAndCollectTask (base class)
- [ ] CarveThenCollectTask
- [ ] KillAndLootTask
- [ ] TradeWithPiglinsTask

#### Movement Tasks (Partially Exists)
- [x] FleeTask/RunAwayFromEntitiesTask (exists)
- [x] ExploreTask (exists)
- [x] FollowPlayerTask (exists)
- [x] TimeoutWanderTask (Completed Iteration 2)
- [ ] SearchChunkForBlockTask
- [ ] SearchChunksExploreTask
- [ ] GetToChunkTask
- [x] GetToYTask (Completed Iteration 2)
- [ ] GetWithinRangeOfBlockTask
- [x] PickupDroppedItemTask (Exists as PickupItemTask)
- [ ] DodgeProjectilesTask
- [ ] MLGBucketTask (task version)
- [ ] EnterNetherPortalTask
- [ ] EscapeFromLavaTask
- [ ] RunAwayFromCreepersTask
- [ ] RunAwayFromHostilesTask
- [ ] GoInDirectionXZTask
- [x] SafeRandomShimmyTask (Completed Iteration 2)
- [x] IdleTask (Completed Iteration 2)
- [ ] FastTravelTask
- [x] WaitTask (Completed Iteration 2)
- [x] LookAtBlockTask (Completed Iteration 2)

#### Entity Tasks
- [x] CombatTask/KillEntityTask (exists)
- [x] HuntTask (exists)
- [x] ShearTask (exists)
- [ ] AbstractDoToEntityTask (base class)
- [ ] DoToClosestEntityTask
- [ ] GiveItemToPlayerTask
- [ ] KillPlayerTask
- [ ] HeroTask

#### Construction Tasks (Partially Exists)
- [x] BuildTask (exists)
- [x] BridgeTask (exists)
- [x] ScaffoldTask (exists)
- [ ] DestroyBlockTask
- [ ] PlaceBlockNearbyTask
- [ ] PlaceSignTask
- [ ] PlaceObsidianBucketTask
- [ ] PlaceStructureBlockTask
- [ ] ClearLiquidTask
- [ ] ClearRegionTask
- [ ] CoverWithBlocksTask
- [ ] PutOutFireTask
- [ ] ConstructNetherPortalBucketTask
- [ ] ConstructNetherPortalObsidianTask
- [ ] ConstructIronGolemTask

#### Misc Tasks
- [x] SleepTask (exists)
- [x] RepairTask (exists)
- [ ] EquipArmorTask
- [ ] PlaceBedAndSetSpawnTask
- [ ] LootDesertTempleTask
- [ ] RavageDesertTemplesTask
- [ ] RavageRuinedPortalsTask

### Priority 3: Speedrun/Advanced Tasks
- [ ] BeatMinecraft2Task
- [ ] KillEnderDragonTask (DragonFightTask exists but needs enhancement)
- [ ] MarvionBeatMinecraftTask
- [ ] LocateStrongholdCoordinatesTask
- [ ] WaitForDragonAndPearlTask

### Priority 4: Utility Tasks
- [ ] CraftInInventoryTask
- [ ] CraftGenericManuallyTask
- [ ] CraftGenericWithRecipeBooksTask
- [ ] AbstractDoToClosestObjectTask
- [ ] DoToClosestBlockTask
- [ ] InteractWithBlockTask

## Completed This Iteration

### Iteration 1 (Complete)
- [x] Initial codebase analysis
- [x] Created PROGRESS.md tracking file
- [x] Identified ~80+ missing task implementations
- [x] Identified 2 missing chain implementations
- [x] Prioritized work based on importance
- [x] Implemented DeathMenuChain - handles auto-respawn and death tracking
- [x] Implemented PlayerInteractionFixChain - auto-equips best tools, fixes stuck controls
- [x] Added comprehensive tests for both chains (28 new tests)
- [x] All 623 tests passing

### Iteration 2 (Complete)
- [x] Implemented slot management tasks (SlotTask.ts):
  - ClickSlotTask - atomic slot click operations
  - EnsureFreeCursorSlotTask - clear cursor before inventory ops
  - EnsureFreeInventorySlotTask - ensure free space in inventory
  - EnsureFreePlayerCraftingGridTask - clear crafting grid
  - ThrowCursorTask - throw items from cursor
  - ReceiveCraftingOutputTask - receive crafted items
  - MoveItemToSlotTask - move items between slots
  - SlotActionType enum and SlotConstants
- [x] Implemented movement utility tasks (MovementUtilTask.ts):
  - TimeoutWanderTask - escape from stuck positions
  - IdleTask - do nothing placeholder
  - GetToYTask - navigate to specific Y level
  - SafeRandomShimmyTask - random movement to escape
  - WaitTask - wait for duration
  - LookAtBlockTask - orient player view
- [x] Added comprehensive tests for all new tasks (60 new tests)
- [x] Updated concrete task exports in index.ts
- [x] All 683 tests passing

## Test Coverage Goals

For each ported task, we need tests that verify:
1. **Intent**: What the task is supposed to accomplish (the WHY)
2. **State Machine**: Correct state transitions
3. **Edge Cases**: Error handling, interruption, timeout
4. **Integration**: Works with TaskRunner and chains

## Architecture Notes

### Key Differences from Java
1. TypeScript uses mineflayer Bot interface instead of MinecraftClient
2. No Baritone pathfinding integration - uses mineflayer-pathfinder
3. Event system uses Node.js EventEmitter patterns
4. No access to Minecraft internals like slot handlers
5. Inventory operations are async in mineflayer

### Patterns to Follow
1. Tasks extend base Task class from Task.ts
2. Chains extend TaskChain or SingleTaskChain
3. Use TimerGame for game-tick based timing
4. Configuration via interface with defaults
5. Factory functions for common configurations

## Next Steps

1. ~~Implement DeathMenuChain for auto-respawn~~ ✅ Done
2. ~~Implement PlayerInteractionFixChain~~ ✅ Done
3. ~~Implement slot management tasks~~ ✅ Done
4. ~~Implement movement utility tasks~~ ✅ Done
5. Add container interaction base classes (DoStuffInContainerTask)
6. Implement resource collection tasks (CollectBlazeRodsTask, CollectFuelTask)
7. Implement entity interaction base classes (AbstractDoToEntityTask)
8. Implement construction tasks (DestroyBlockTask, PlaceBlockNearbyTask)
9. Add comprehensive tests for new tasks
