# BaritonePlus → baritone-ts Port Progress

This document tracks the porting progress from BaritonePlus (Java) to baritone-ts (TypeScript).

## Summary

**Status**: In Progress
**Last Updated**: Iteration 6

### BaritonePlus Java Statistics:
- Total Tasks: 173 Java files in tasks/
- Chains: 8 Java files
- Key categories: movement, resources, container, construction, entity, slot, speedrun, misc

### baritone-ts TypeScript Statistics (Current):
- Composite Tasks: 46 files
- Concrete Tasks: 21 modules (GoTo, MineBlock, PlaceBlock, Craft, Smelt, Inventory, Interact, Slot, MovementUtil, Container, Construction, Entity, Escape, Resource, MineAndCollect, KillAndLoot, CollectFuel, BlockSearch, Portal, Armor, Bed, CollectLiquid, Dodge, Trade, MLG, ChunkSearch)
- Chains: 6 files (FoodChain, MLGBucketChain, MobDefenseChain, WorldSurvivalChain, DeathMenuChain, PlayerInteractionFixChain)
- Tests: 26 test files

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

#### Container Tasks (Completed Iteration 3)
- [x] LootChestTask (exists as LootChestTask)
- [x] StorageTask (exists - deposits/withdraws)
- [x] DoStuffInContainerTask (base class)
- [x] AbstractDoToStorageContainerTask (base class)
- [x] CraftInTableTask
- [x] CraftInAnvilTask
- [x] UpgradeInSmithingTableTask
- [x] SmeltInFurnaceBaseTask (furnace, blast_furnace, smoker)
- [ ] StoreInStashTask
- [ ] PickupFromContainerTask
- [ ] ContainerStoredTracker

#### Resource Collection Tasks (Completed Iteration 5)
- [x] CollectWoodTask (exists)
- [x] GatherResourcesTask (exists)
- [x] MineOresTask (exists)
- [x] ResourceTask (base class - Completed Iteration 5)
- [x] MineAndCollectTask (Completed Iteration 5)
- [x] KillAndLootTask (Completed Iteration 5)
- [x] CollectFuelTask (Completed Iteration 5)
- [ ] CollectBlazeRodsTask
- [ ] CollectFoodTask (partial - HuntTask exists)
- [ ] CollectBucketLiquidTask
- [ ] CollectObsidianTask
- [ ] CarveThenCollectTask
- [x] TradeWithPiglinsTask (Completed Iteration 6)

#### Movement Tasks (Partially Exists)
- [x] FleeTask/RunAwayFromEntitiesTask (exists)
- [x] ExploreTask (exists)
- [x] FollowPlayerTask (exists)
- [x] TimeoutWanderTask (Completed Iteration 2)
- [x] SearchChunkForBlockTask (Completed Iteration 6)
- [x] SearchChunksExploreTask (Completed Iteration 6)
- [ ] GetToChunkTask
- [x] GetToYTask (Completed Iteration 2)
- [x] GetWithinRangeOfBlockTask (Completed Iteration 5)
- [x] PickupDroppedItemTask (Exists as PickupItemTask)
- [x] DodgeProjectilesTask (Completed Iteration 6)
- [x] MLGBucketTask (Completed Iteration 6)
- [x] EnterNetherPortalTask (Completed Iteration 6)
- [x] EscapeFromLavaTask (Completed Iteration 4)
- [x] RunAwayFromCreepersTask (Completed Iteration 4)
- [x] RunAwayFromHostilesTask (Completed Iteration 4)
- [x] GoInDirectionXZTask (Completed Iteration 5)
- [x] SafeRandomShimmyTask (Completed Iteration 2)
- [x] IdleTask (Completed Iteration 2)
- [ ] FastTravelTask
- [x] WaitTask (Completed Iteration 2)
- [x] LookAtBlockTask (Completed Iteration 2)

#### Entity Tasks (Completed Iteration 4)
- [x] CombatTask/KillEntityTask (exists)
- [x] HuntTask (exists)
- [x] ShearTask (exists)
- [x] AbstractDoToEntityTask (Completed Iteration 4)
- [x] DoToClosestEntityTask (Completed Iteration 4)
- [x] GiveItemToPlayerTask (Completed Iteration 4)
- [x] KillPlayerTask (Completed Iteration 4)
- [x] InteractWithEntityTask (Completed Iteration 4)
- [ ] HeroTask

#### Block Search Tasks (Completed Iteration 5)
- [x] DoToClosestBlockTask (Completed Iteration 5)
- [ ] AbstractDoToClosestObjectTask (base class - partially implemented)

#### Construction Tasks (Completed Iteration 3)
- [x] BuildTask (exists)
- [x] BridgeTask (exists)
- [x] ScaffoldTask (exists)
- [x] DestroyBlockTask (Completed Iteration 3)
- [x] PlaceBlockNearbyTask (Completed Iteration 3)
- [ ] PlaceSignTask
- [ ] PlaceObsidianBucketTask
- [ ] PlaceStructureBlockTask
- [x] ClearLiquidTask (Completed Iteration 3)
- [ ] ClearRegionTask
- [ ] CoverWithBlocksTask
- [x] PutOutFireTask (Completed Iteration 3)
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

### Iteration 3 (Complete)
- [x] Implemented container interaction tasks (ContainerTask.ts):
  - ContainerType enum with all Minecraft container types
  - getContainerBlocks() and isContainerBlock() utility functions
  - DoStuffInContainerTask - abstract base for container interactions
    - Handles finding, approaching, and opening containers
    - Supports placing new containers if none found
    - Delegates actual container work to subclasses
  - AbstractDoToStorageContainerTask - base for storage containers
    - Handles chest, barrel, shulker box interactions
    - Wanders when no container found
  - CraftInTableTask - crafting table interaction
  - SmeltInFurnaceBaseTask - furnace/blast furnace/smoker support
  - UpgradeInSmithingTableTask - smithing table interaction
  - CraftInAnvilTask - anvil interaction (all damage states)
- [x] Implemented construction tasks (ConstructionTask.ts):
  - DestroyBlockTask - destroy a block at a position
    - Handles stuck detection in annoying blocks (vines, cobwebs, etc.)
    - Automatic tool equipping for block type
    - Safety checks for standing on target block
    - Movement progress checking with timeout
  - PlaceBlockNearbyTask - place a block at nearest valid position
    - Finds placement spots with adjacent solid blocks
    - Avoids placing inside player
    - Supports custom placement predicates
    - Wandering retry on failure
  - ClearLiquidTask - clear water/lava by placing block
  - PutOutFireTask - extinguish fire
- [x] Added comprehensive tests for container tasks (ContainerTasks.test.ts):
  - 30 tests covering ContainerType utilities
  - Container task creation and initialization
  - State machine transitions
  - Edge cases (missing containers, blocked chests)
- [x] Added comprehensive tests for construction tasks (ConstructionTasks.test.ts):
  - 37 tests covering DestroyBlockTask
  - PlaceBlockNearbyTask placement logic
  - ClearLiquidTask and PutOutFireTask
  - Stuck detection, tool equipping, safety checks
- [x] Updated concrete task exports in index.ts
- [x] All 750 tests passing

### Iteration 4 (Complete)
- [x] Implemented entity interaction tasks (EntityTask.ts):
  - AbstractDoToEntityTask - base class for entity interactions
    - State machine: FINDING -> APPROACHING -> MAINTAINING_DISTANCE -> INTERACTING
    - Progress checking to detect unreachable entities
    - Look helper for proper entity orientation
    - Configurable maintain distance and reach range
  - DoToClosestEntityTask - find and interact with closest entity of types
    - Entity type filtering
    - Custom entity filter predicates
    - Origin position supplier for distance calculations
  - GiveItemToPlayerTask - give items to another player
    - Finds player by username
    - Approaches and drops items toward them
  - KillPlayerTask - PvP targeting task
    - Tracks specific player
    - Finishes when player dead or disconnected
  - InteractWithEntityTask - right-click entity interaction
    - Approaches entity within range
    - Performs useOn/activateEntity
  - killEntities() helper - convenience function to create kill task
  - KillEntitySubTask - internal subtask for killing single entity
- [x] Implemented escape/safety tasks (EscapeTask.ts):
  - EscapeFromLavaTask - escape from lava urgently
    - Sprint and jump through lava for faster escape
    - Finds safe ground (solid, not adjacent to lava)
    - Prefers positions near water to cool off
    - Progress checking with direction change on stuck
    - Timeout safety (30 seconds max)
  - RunAwayFromCreepersTask - flee from creepers
    - Weighted flee direction based on creeper proximity
    - Extra distance for charged creepers
    - Detects fusing creepers (need more distance)
    - Sprint while fleeing
  - RunAwayFromHostilesTask - flee from all hostile mobs
    - Configurable hostile types list
    - Option to include/exclude skeletons
    - Calculates average hostile position and flees opposite
    - Sprint while fleeing
  - Convenience functions: escapeFromLava, escapeFromLavaUrgent, runFromCreepers, runFromHostiles, runFromAllHostiles
- [x] Added comprehensive tests for entity tasks (EntityTasks.test.ts):
  - 19 tests covering AbstractDoToEntityTask state machine
  - DoToClosestEntityTask finding and filtering
  - GiveItemToPlayerTask inventory checks
  - KillPlayerTask targeting
  - InteractWithEntityTask interaction
  - killEntities helper function
  - Equality checks for task deduplication
- [x] Added comprehensive tests for escape tasks (EscapeTasks.test.ts):
  - 36 tests covering EscapeFromLavaTask lava detection
  - Sprint/jump behavior through lava
  - Safe ground finding algorithm
  - RunAwayFromCreepersTask detection and flee direction
  - Charged creeper handling
  - RunAwayFromHostilesTask filtering
  - Multiple hostile handling
  - Convenience function tests
- [x] Updated concrete task exports in index.ts
- [x] Fixed MovementProgressChecker API usage (setProgress + failed, not check)
- [x] All 805 tests passing

### Iteration 5 (Complete)
- [x] Implemented resource collection base class (ResourceTask.ts):
  - ResourceTask abstract base class for item collection tasks
  - ItemTarget interface for specifying items and counts
  - itemTarget() helper function for creating targets
  - Dimension enum for dimension-specific behavior
  - Item count tracking and completion detection
- [x] Implemented mine and collect task (MineAndCollectTask.ts):
  - MineAndCollectTask - mines blocks and collects dropped items
    - State machine: SEARCHING -> APPROACHING -> MINING -> COLLECTING
    - Blacklists unreachable positions
    - Progress checking for stuck detection
    - Configurable search radius
    - Prefers nearby dropped items when preferDrops enabled
  - mineAndCollect() and mineOre() helper functions
- [x] Implemented kill and loot task (KillAndLootTask.ts):
  - KillAndLootTask - kills entities and collects their drops
    - State machine: SEARCHING -> KILLING -> LOOTING -> WANDERING
    - Entity type filtering
    - Custom entity filter predicates
    - Attack cooldown management
    - Loot collection with timeout
  - killAndLoot(), huntForFood(), huntMobForDrop() helper functions
- [x] Implemented fuel collection task (CollectFuelTask.ts):
  - CollectFuelTask - collects fuel for smelting
    - Dimension-aware fuel source selection
    - Fuel value calculation from inventory
    - Mining subtask delegation
  - FUEL_SOURCES constant with all standard fuels
  - collectFuel(), collectFuelForSmelting() helper functions
- [x] Implemented block search tasks (BlockSearchTask.ts):
  - DoToClosestBlockTask - find closest block and run task
    - Block type filtering
    - Custom block filter predicates
    - Blacklisting unreachable blocks
    - Wander on missing (configurable)
  - GetWithinRangeOfBlockTask - navigate within range of position
    - Simple range checking
    - Returns navigation subtask
  - GoInDirectionXZTask - move in XZ direction
    - Normalized direction vector
    - Distance tracking
    - Target point calculation
  - doToClosestBlock(), getWithinRangeOf(), goInDirection() helpers
- [x] Added comprehensive tests for resource tasks (ResourceTasks.test.ts):
  - 31 tests covering ItemTarget helper
  - MineAndCollectTask creation, block finding, completion
  - KillAndLootTask creation, entity finding, filtering
  - CollectFuelTask creation, fuel calculation, fuel sources
  - Convenience function tests
  - Equality checks
- [x] Added comprehensive tests for block search tasks (BlockSearchTasks.test.ts):
  - 27 tests covering DoToClosestBlockTask
  - GetWithinRangeOfBlockTask range checking
  - GoInDirectionXZTask directional movement
  - Block filtering
  - Unreachable handling
  - Convenience functions
  - Equality checks
- [x] Updated concrete task exports in index.ts
- [x] All 863 tests passing

### Iteration 6 (Complete)
- [x] Fixed TypeScript errors in CollectLiquidTask (private/protected method conflict)
- [x] Verified existing implementations:
  - PortalTask.ts (EnterNetherPortalTask, GoToDimensionTask)
  - ArmorTask.ts (EquipArmorTask, EquipSpecificArmorTask)
  - BedTask.ts (PlaceBedAndSetSpawnTask, SleepInBedTask)
  - DodgeTask.ts (DodgeProjectilesTask, StrafeAndDodgeTask)
  - CollectLiquidTask.ts (CollectBucketLiquidTask)
- [x] Implemented trading tasks (TradeTask.ts):
  - TradeWithPiglinsTask - bartering with piglins
  - Piglin blacklisting for unresponsive piglins
  - Hoglin avoidance during trading
  - tradeWithPiglins(), tradeForEnderPearls() helpers
- [x] Implemented MLG/fall damage prevention tasks (MLGTask.ts):
  - MLGBucketTask - emergency water bucket placement
  - MLGBucketMonitorTask - continuous fall monitoring
  - Dimension awareness (water evaporates in nether)
  - Water pickup after landing
  - mlgBucket(), monitorForMLG(), shouldMLG() helpers
- [x] Implemented chunk search/exploration tasks (ChunkSearchTask.ts):
  - ChunkPos type and blockToChunk/chunkToBlock utilities
  - SearchChunksExploreTask - abstract base for chunk exploration
  - SearchChunkForBlockTask - find specific blocks across chunks
  - SearchChunkByConditionTask - find chunks matching conditions
  - searchForBlocks(), searchForStronghold(), searchForNetherFortress() helpers
- [x] Added comprehensive tests for new tasks (TradeAndMLGTasks.test.ts):
  - 48 tests covering trading, MLG, and chunk search
  - WHY/intent tests explaining purpose of each task
  - Dimension handling tests
  - Chunk coordinate utility tests
  - Equality and convenience function tests
- [x] Updated concrete task exports in index.ts
- [x] All 959 tests passing

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
5. ~~Add container interaction base classes (DoStuffInContainerTask)~~ ✅ Done
6. ~~Implement construction tasks (DestroyBlockTask, PlaceBlockNearbyTask)~~ ✅ Done
7. ~~Implement entity interaction base classes (AbstractDoToEntityTask, DoToClosestEntityTask)~~ ✅ Done
8. ~~Implement escape/safety tasks (EscapeFromLavaTask, RunAwayFromCreepersTask)~~ ✅ Done
9. ~~Implement resource collection tasks (MineAndCollectTask, KillAndLootTask, CollectFuelTask)~~ ✅ Done
10. ~~Implement block search tasks (DoToClosestBlockTask, GetWithinRangeOfBlockTask, GoInDirectionXZTask)~~ ✅ Done
11. ~~Implement nether tasks (EnterNetherPortalTask, TradeWithPiglinsTask)~~ ✅ Done
12. ~~Implement search/exploration tasks (SearchChunkForBlockTask)~~ ✅ Done
13. ~~Implement misc tasks (EquipArmorTask, PlaceBedAndSetSpawnTask, DodgeProjectilesTask)~~ ✅ Done
14. ~~Implement MLG/fall prevention tasks~~ ✅ Done
15. Implement remaining container tasks (StoreInStashTask, PickupFromContainerTask)
16. Implement remaining movement tasks (GetToChunkTask, FastTravelTask)
17. Implement crafting tasks (CraftInInventoryTask, CraftGenericManuallyTask)
18. Implement construction compound tasks (ConstructNetherPortalBucketTask)
