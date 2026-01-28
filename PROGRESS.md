# BaritonePlus → baritone-ts Port Progress

This document tracks the porting progress from BaritonePlus (Java) to baritone-ts (TypeScript).

## Summary

**Status**: In Progress
**Last Updated**: Iteration 13

### BaritonePlus Java Statistics:
- Total Tasks: 173 Java files in tasks/
- Chains: 8 Java files
- Key categories: movement, resources, container, construction, entity, slot, speedrun, misc

### baritone-ts TypeScript Statistics (Current):
- Composite Tasks: 46 files
- Concrete Tasks: 37 modules (GoTo, MineBlock, PlaceBlock, Craft, Smelt, Inventory, Interact, Slot, MovementUtil, Container, Construction, Entity, Escape, Resource, MineAndCollect, KillAndLoot, CollectFuel, BlockSearch, Portal, Armor, Bed, CollectLiquid, Dodge, Trade, MLG, ChunkSearch, InteractWithBlock, StorageContainer, CraftInInventory, GetToChunk, CollectFood, CollectBlazeRods, FastTravel, CollectObsidian, ConstructNetherPortal, LootDesertTemple, StoreInStash, RavageStructures, Stronghold, DragonFight, AdvancedConstruction, BeatMinecraft)
- Chains: 6 files (FoodChain, MLGBucketChain, MobDefenseChain, WorldSurvivalChain, DeathMenuChain, PlayerInteractionFixChain)
- Tests: 33 test files
- Utilities: BlockRange (3D region definition)

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

#### Container Tasks (Completed Iteration 3 & 7)
- [x] LootChestTask (exists as LootChestTask)
- [x] StorageTask (exists - deposits/withdraws)
- [x] DoStuffInContainerTask (base class)
- [x] AbstractDoToStorageContainerTask (base class)
- [x] CraftInTableTask
- [x] CraftInAnvilTask
- [x] UpgradeInSmithingTableTask
- [x] SmeltInFurnaceBaseTask (furnace, blast_furnace, smoker)
- [x] StoreInContainerTask (Completed Iteration 7)
- [x] PickupFromContainerTask (Completed Iteration 7)
- [x] LootContainerTask (Completed Iteration 7)
- [x] StoreInStashTask (Completed Iteration 10 - with BlockRange utility)
- [x] StoredItemTracker (Completed Iteration 10 - internal to StoreInStashTask)

#### Resource Collection Tasks (Completed Iteration 5 & 8)
- [x] CollectWoodTask (exists)
- [x] GatherResourcesTask (exists)
- [x] MineOresTask (exists)
- [x] ResourceTask (base class - Completed Iteration 5)
- [x] MineAndCollectTask (Completed Iteration 5)
- [x] KillAndLootTask (Completed Iteration 5)
- [x] CollectFuelTask (Completed Iteration 5)
- [x] CollectBlazeRodsTask (Completed Iteration 8)
- [x] CollectFoodTask (Completed Iteration 8)
- [x] CollectBucketLiquidTask (exists)
- [x] CollectObsidianTask (Completed Iteration 9)
- [ ] CarveThenCollectTask
- [x] TradeWithPiglinsTask (Completed Iteration 6)

#### Movement Tasks (Completed Iteration 8)
- [x] FleeTask/RunAwayFromEntitiesTask (exists)
- [x] ExploreTask (exists)
- [x] FollowPlayerTask (exists)
- [x] TimeoutWanderTask (Completed Iteration 2)
- [x] SearchChunkForBlockTask (Completed Iteration 6)
- [x] SearchChunksExploreTask (Completed Iteration 6)
- [x] GetToChunkTask (Completed Iteration 8)
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
- [x] FastTravelTask (Completed Iteration 8)
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
- [x] PlaceSignTask (Completed Iteration 12)
- [ ] PlaceObsidianBucketTask
- [ ] PlaceStructureBlockTask
- [x] ClearLiquidTask (Completed Iteration 3)
- [x] ClearRegionTask (Completed Iteration 12)
- [x] CoverWithBlocksTask (Completed Iteration 12)
- [x] PutOutFireTask (Completed Iteration 3)
- [x] ConstructNetherPortalBucketTask (Completed Iteration 9 - as ConstructNetherPortalTask)
- [x] ConstructNetherPortalObsidianTask (Completed Iteration 9 - as ConstructNetherPortalTask)
- [x] ConstructIronGolemTask (Completed Iteration 12)

#### Misc Tasks
- [x] SleepTask (exists)
- [x] RepairTask (exists)
- [x] EquipArmorTask (exists)
- [x] PlaceBedAndSetSpawnTask (exists)
- [x] LootDesertTempleTask (Completed Iteration 9)
- [x] RavageDesertTemplesTask (Completed Iteration 10)
- [x] RavageRuinedPortalsTask (Completed Iteration 10)

### Priority 3: Speedrun/Advanced Tasks
- [x] BeatMinecraft2Task (Completed Iteration 13 - as BeatMinecraftTask)
- [x] KillEnderDragonTask (Completed Iteration 11)
- [x] MarvionBeatMinecraftTask (Completed Iteration 13 - merged into BeatMinecraftTask)
- [x] LocateStrongholdCoordinatesTask (Completed Iteration 11)
- [x] WaitForDragonAndPearlTask (Completed Iteration 11)
- [x] GoToStrongholdPortalTask (Completed Iteration 11)

### Priority 4: Utility Tasks
- [x] CraftInInventoryTask (Completed Iteration 7)
- [x] CraftWithRecipeBookTask (Completed Iteration 7 - simplified version)
- [x] InteractWithBlockTask (Completed Iteration 7 - enhanced version with direction, item, stuck detection)
- [ ] CraftGenericManuallyTask (low priority - mineflayer has built-in crafting)

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

### Iteration 7 (Complete)
- [x] Implemented enhanced block interaction task (InteractWithBlockTask.ts):
  - Direction enum for specifying block face to interact from
  - InteractInput enum for left/right click
  - ClickResponse for interaction state machine
  - Item equipping before interaction
  - Stuck detection in annoying blocks (vines, tall grass, etc.)
  - Nether portal escape handling
  - Progress checking with wandering fallback
  - interactWithBlock(), placeBlockAt() helper functions
- [x] Implemented storage container tasks (StorageContainerTask.ts):
  - ContainerItemTarget interface for specifying items to pickup/store
  - containerItemTarget(), itemMatchesTarget() helpers
  - PickupFromContainerTask - retrieves items from containers
    - Smart slot selection prioritizing optimal stack sizes
    - Handles full inventory scenarios
  - StoreInContainerTask - stores items in containers
    - Shift-click for quick transfer
    - Container full detection
  - LootContainerTask - grab all matching items from container
  - pickupFromContainer(), storeInContainer(), lootContainer() helpers
- [x] Implemented inventory crafting tasks (CraftInInventoryTask.ts):
  - InventoryRecipe interface for 2x2 crafting recipes
  - InventoryRecipeTarget for specifying what to craft
  - INVENTORY_RECIPES - pre-defined common recipes (planks, sticks, crafting_table, torches)
  - CraftInInventoryTask - crafts using 2x2 inventory grid
    - State machine: OPENING -> CLEARING -> PLACING -> RECEIVING -> FINISHED
    - Ingredient checking
    - Output collection
  - CraftWithRecipeBookTask - faster crafting via recipe book (when supported)
  - craftPlanks(), craftSticks(), craftCraftingTable() convenience functions
- [x] Added comprehensive tests (StorageAndCraftingTasks.test.ts):
  - 58 tests covering all new tasks
  - WHY/intent tests explaining purpose
  - containerItemTarget and itemMatchesTarget helper tests
  - PickupFromContainerTask creation, finishing, equality
  - StoreInContainerTask creation and state
  - LootContainerTask with custom filters
  - INVENTORY_RECIPES coverage
  - CraftInInventoryTask state machine
  - InteractWithBlockTask direction and input handling
  - Integration scenarios (loot-and-store, early game crafting)
- [x] Updated concrete task exports in index.ts
- [x] All 1017 tests passing

### Iteration 8 (Complete)
- [x] Implemented chunk navigation task (GetToChunkTask.ts):
  - GetToChunkTask - navigate to a specific chunk (more lenient than block position)
  - Uses ChunkPos from ChunkSearchTask for chunk coordinates
  - fromBlockPos() and fromVec3() factory methods for convenience
  - isInTargetChunk() completion check
  - getToChunk(), getToChunkContaining() helper functions
- [x] Implemented food collection task (CollectFoodTask.ts):
  - CollectFoodTask - autonomous food collection through multiple means
  - COOKABLE_FOODS array mapping raw food to cooked variants with mob types
  - CROPS array for harvestable crops with food values
  - calculateFoodPotential() - accounts for raw food cooking potential
    - Only counts cooked value for raw food (not raw + cooked)
    - Counts wheat -> bread potential (3 wheat = 1 bread = 5 hunger)
    - Counts hay blocks -> wheat -> bread potential
  - State machine: SEARCHING -> HUNTING -> HARVESTING -> PICKING_UP -> COOKING -> etc.
  - findNearestMob() for hunting targets
  - findNearestCropBlock() for harvest targets
  - collectFood(), collectFoodUntilFull() helper functions
- [x] Implemented blaze rod collection task (CollectBlazeRodsTask.ts):
  - CollectBlazeRodsTask - multi-step resource collection for Nether progression
  - State machine: GOING_TO_NETHER -> SEARCHING_FORTRESS -> GOING_TO_SPAWNER -> WAITING_FOR_BLAZES -> KILLING_BLAZES -> FLEEING
  - Searches for nether bricks to find fortress
  - findBlazeSpawner() for locating spawners
  - Safety checks: flee if low health or too many blazes
  - isHoveringAboveLavaOrTooHigh() to avoid unreachable blazes
  - collectBlazeRods(), collectBlazeRodsForSpeedrun() helper functions
- [x] Implemented fast travel task (FastTravelTask.ts):
  - FastTravelTask - Nether portal-based fast travel (8:1 coordinate scaling)
  - State machine: CHECKING_THRESHOLD -> COLLECTING_MATERIALS -> ENTERING_NETHER -> TRAVELING_NETHER -> BUILDING_EXIT_PORTAL -> EXITING_NETHER -> WALKING_OVERWORLD
  - getNetherTarget() - calculates Nether coordinates (Overworld / 8)
  - getOverworldThreshold() - determines when Nether travel is worth it (default 500 blocks)
  - canBuildPortal() and canLightPortal() checks
  - NETHER_CLOSE_ENOUGH_THRESHOLD for accepting "close enough" positions
  - fastTravelTo(), fastTravelToPos() helper functions
- [x] Added comprehensive tests (MovementAndResourceTasks.test.ts):
  - 49 tests covering all new tasks
  - WHY/intent tests explaining purpose of each task
  - Chunk coordinate utility tests (blockToChunk, chunkToBlock)
  - GetToChunkTask creation, completion, equality
  - CollectFoodTask food potential calculation (cooked food, raw food, wheat, hay)
  - CollectBlazeRodsTask creation, spawner finding, safety states
  - FastTravelTask creation, threshold calculation, Nether coordinate scaling
  - Convenience function tests
- [x] Fixed API compatibility issues:
  - chunkToBlock() takes ChunkPos, not separate x,z
  - GoToDimensionTask takes Dimension, not config object
  - KillAndLootTask signature: (bot, itemTargets, entityTypes, config?)
  - DoToClosestBlockTask signature: (bot, taskFactory, blockTypes, config?)
  - DestroyBlockTask signature: (bot, x, y, z, config?)
  - RunAwayFromHostilesTask uses fleeDistance not distance
  - SearchChunkForBlockTask signature: (bot, blocks, maxResults?, config?)
- [x] Updated concrete task exports in index.ts
- [x] All 1066 tests passing

### Iteration 9 (Complete)
- [x] Implemented obsidian collection task (CollectObsidianTask.ts):
  - CollectObsidianTask - collects obsidian blocks
  - Requires diamond or netherite pickaxe (hardness 50)
  - Mines existing obsidian or creates from lava sources
  - Dimension awareness (can't place water in Nether)
  - Lava blacklisting for unreachable sources
  - forPortal() and forFullPortal() factory methods
  - collectObsidian(), collectObsidianForPortal() helpers
- [x] Implemented nether portal construction task (ConstructNetherPortalTask.ts):
  - ConstructNetherPortalTask - builds nether portal using bucket method
  - State machine: GETTING_MATERIALS -> SEARCHING_LOCATION -> BUILDING_FRAME -> CLEARING_INTERIOR -> LIGHTING_PORTAL
  - PORTAL_FRAME and PORTAL_INTERIOR position arrays
  - Lava lake finding with flood-fill counting
  - Portal spot validation (no lava/water/bedrock in region)
  - Progress checking with wander fallback
  - constructPortalAt(), constructPortal() helpers
- [x] Implemented desert temple looting task (LootDesertTempleTask.ts):
  - LootDesertTempleTask - safely loots desert temple chests
  - CHEST_POSITIONS_RELATIVE for 4 chest locations
  - Pressure plate (TNT trap) disarming before looting
  - State machine: CHECKING_TRAP -> DISARMING_TRAP -> LOOTING_CHEST -> FINISHED
  - Wanted items filtering
  - lootDesertTemple(), lootDesertTempleFor() helpers
- [x] Added comprehensive tests (ObsidianAndPortalTasks.test.ts):
  - 45 tests covering all new tasks
  - WHY/intent tests for each feature
  - Pickaxe requirement tests (diamond/netherite)
  - Dimension awareness tests
  - Material checking tests
  - Trap disarming tests
  - Completion state tests
  - Integration scenarios (obsidian to portal flow)
- [x] Updated concrete task exports in index.ts
- [x] All 1111 tests passing

### Iteration 10 (Complete)
- [x] Implemented BlockRange utility class (BlockRange.ts):
  - BlockRange class - 3D rectangular region definition
  - Start/end position normalization (min/max corners)
  - Dimension awareness (overworld, nether, end)
  - contains(), containsVec3() - position containment checking
  - getCenter(), getSize(), getVolume() - geometry methods
  - expand() - region expansion
  - positions() generator - iterate all blocks in range
  - fromPositions(), aroundPoint(), aroundPointUniform() factory methods
  - blockRange(), blockRangeAround() convenience functions
- [x] Implemented stash storage task (StoreInStashTask.ts):
  - StoreInStashTask - stores items in containers within designated stash area
  - State machine: CHECKING_INVENTORY -> FINDING_CONTAINER -> STORING -> TRAVELING_TO_STASH
  - StoredItemTracker - tracks what items have been deposited
  - STORAGE_BLOCKS - all valid container types (chest, barrel, shulker boxes)
  - Finds containers within BlockRange
  - Navigates to stash center if no containers visible
  - storeItems() factory method, storeInStash() helper function
- [x] Implemented structure ravaging tasks (RavageStructuresTask.ts):
  - RavageDesertTemplesTask - continuously finds and loots desert temples
    - Identifies temples by stone pressure plate (trap indicator)
    - Uses SearchChunkForBlockTask for discovery
    - Tracks looted temples to avoid revisiting
    - DESERT_TEMPLE_LOOT array - all valuable temple items
  - RavageRuinedPortalsTask - continuously finds and loots ruined portals
    - Identifies portals by netherrack proximity to chests
    - Skips underwater chests (shipwrecks) and low-level chests (mineshafts)
    - Dimension awareness (only works in overworld)
    - RUINED_PORTAL_LOOT array - portal chest items
  - RavageState enum, ravageDesertTemples(), ravageRuinedPortals() helpers
- [x] Added comprehensive tests (StashAndRavageTasks.test.ts):
  - 49 tests covering all new tasks
  - BlockRange construction, normalization, containment tests
  - Geometry methods (center, size, volume, expand) tests
  - Position generator tests
  - StoreInStashTask creation, state management, container detection tests
  - RavageDesertTemplesTask loot config, state machine, temple detection tests
  - RavageRuinedPortalsTask portal identification, dimension awareness tests
  - Integration scenario tests
- [x] Updated exports in index.ts (tasks and utils)
- [x] All 1160 tests passing

### Iteration 11 (Complete)
- [x] Implemented stronghold location tasks (StrongholdTask.ts):
  - calculateIntersection() - triangulation math for two eye directions
  - EyeDirection class - tracks eye of ender flight path
  - LocateStrongholdCoordinatesTask - finds stronghold via triangulation
    - State machine: GOING_TO_OVERWORLD -> THROWING_FIRST_EYE -> WAITING -> MOVING -> THROWING_SECOND -> CALCULATING
    - Throws two eyes from different positions
    - Calculates intersection of flight directions
  - GoToStrongholdPortalTask - navigates to stronghold
    - Uses LocateStrongholdCoordinatesTask for coordinates
    - Searches for stone bricks to find actual structure
  - locateStronghold(), goToStrongholdPortal() helper functions
- [x] Implemented dragon fight tasks (DragonFightTask.ts):
  - KillEnderDragonTask - complete dragon fight logic
    - State machine: EQUIPPING -> DESTROYING_CRYSTALS -> WAITING_FOR_PERCH -> ATTACKING_DRAGON -> ENTERING_PORTAL
    - Prioritizes End Crystal destruction (they heal dragon)
    - Waits for dragon to perch for melee attacks
    - Looks down periodically to avoid angering endermen
    - Enters end portal when dragon is killed
  - WaitForDragonAndPearlTask - advanced pearl strategy
    - State machine: COLLECTING_MATERIALS -> MOVING_TO_POSITION -> PILLARING_UP -> WAITING_FOR_PERCH -> THROWING_PEARL
    - Implements IDragonWaiter interface
    - Pillars up to get clear view of portal
    - Throws pearl onto portal when dragon perches
  - DIAMOND_ARMOR, FOOD_ITEMS constants
  - killEnderDragon(), waitForDragonAndPearl() helper functions
- [x] Added comprehensive tests (SpeedrunTasks.test.ts):
  - 36 tests covering all new tasks
  - calculateIntersection triangulation math tests
  - Stronghold state management tests
  - Dragon fight state machine tests
  - IDragonWaiter interface tests
  - Integration scenario tests
- [x] Updated exports in index.ts
- [x] All 1196 tests passing

### Iteration 12 (Complete)
- [x] Implemented advanced construction tasks (AdvancedConstructionTask.ts):
  - PlaceSignTask - places signs with messages at specific or any location
    - State machine: GETTING_SIGN -> CLEARING_POSITION -> PLACING_SIGN -> EDITING_SIGN -> FINISHED
    - WOOD_SIGNS array with all wood sign types (oak, spruce, birch, jungle, etc.)
    - Position clearing before placement
    - getMessage() for retrieving the sign text
  - ClearRegionTask - clears all blocks in a 3D region
    - State machine: SCANNING -> DESTROYING -> FINISHED
    - Coordinate normalization (min/max corners)
    - Top-down iteration for gravity-affected blocks
    - getRegion() for accessing the clear area
  - CoverWithBlocksTask - covers lava with throwaway blocks for Nether safety
    - State machine: GETTING_BLOCKS -> GOING_TO_NETHER -> SEARCHING_LAVA -> COVERING
    - THROWAWAY_BLOCKS array (cobblestone, dirt, netherrack, etc.)
    - Dimension awareness (collects blocks in overworld, covers lava in nether)
    - Edge detection (prioritizes lava at pool edges)
    - Continuous task (never finishes, runs until interrupted)
  - ConstructIronGolemTask - builds iron golem from materials
    - State machine: GETTING_MATERIALS -> FINDING_POSITION -> PLACING_BASE -> PLACING_CENTER -> PLACING_ARMS -> CLEARING_AREA -> PLACING_HEAD -> FINISHED
    - Classic T-shape pattern with pumpkin head
    - Automatic position finding if not specified
    - Detects successful golem spawn nearby
  - placeSign(), clearRegion(), coverWithBlocks(), constructIronGolem() helper functions
- [x] Added comprehensive tests (AdvancedConstructionTask.test.ts):
  - 49 tests covering all new tasks
  - WHY/intent tests explaining purpose
  - PlaceSignTask message handling and position tests
  - ClearRegionTask coordinate normalization and completion tests
  - CoverWithBlocksTask throwaway blocks and dimension tests
  - ConstructIronGolemTask state machine and material tests
  - State machine enum coverage tests
  - Material requirements tests
  - Integration scenario tests
- [x] Updated exports in index.ts
- [x] All 1245 tests passing

### Iteration 13 (Complete)
- [x] Implemented BeatMinecraftTask (BeatMinecraftTask.ts):
  - BeatMinecraftTask - main speedrun orchestrator task
    - Combines features from BeatMinecraft2Task.java and MarvionBeatMinecraftTask.java
    - State machine: GETTING_FOOD -> GETTING_GEAR -> GETTING_BEDS -> GOING_TO_NETHER -> GETTING_BLAZE_RODS -> GETTING_ENDER_PEARLS -> LEAVING_NETHER -> LOCATING_STRONGHOLD -> OPENING_PORTAL -> SETTING_SPAWN -> ENTERING_END -> FIGHTING_DRAGON -> FINISHED
    - BeatMinecraftConfig interface with all configurable options:
      - targetEyes, minimumEyes for eye of ender requirements
      - placeSpawnNearEndPortal, barterPearlsInsteadOfEndermanHunt strategies
      - sleepThroughNight, searchRuinedPortals, searchDesertTemples options
      - minFoodUnits, foodUnits, requiredBeds, minBuildMaterialCount thresholds
    - DEFAULT_CONFIG with balanced speedrun settings
    - DIAMOND_ARMOR, IRON_ARMOR constants
    - END_PORTAL_FRAME_OFFSETS for portal detection
    - Dimension handling (overworld, nether, the_end)
    - Resource tracking (eyes, blaze rods, ender pearls, beds, food)
    - End portal detection and frame counting
  - beatMinecraft() convenience function
  - speedrunMinecraft() with aggressive speedrun settings (no sleep, barter for pearls)
- [x] Added comprehensive tests (BeatMinecraftTask.test.ts):
  - 37 tests covering all aspects
  - Task creation and config tests
  - State machine phase tests
  - Default config value tests
  - Armor constant tests
  - Dimension handling tests
  - Resource tracking tests
  - Equality tests
  - Speedrun strategy tests (bartering vs hunting, sleep, structure looting)
  - Phase progression logic tests
  - Eye/blaze rod/pearl requirement calculation tests
  - Dragon fight preparation tests
- [x] Updated exports in index.ts
- [x] All 1282 tests passing

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
15. ~~Implement container storage tasks (PickupFromContainerTask, StoreInContainerTask)~~ ✅ Done
16. ~~Implement enhanced interaction task (InteractWithBlockTask)~~ ✅ Done
17. ~~Implement inventory crafting tasks (CraftInInventoryTask)~~ ✅ Done
18. ~~Implement movement tasks (GetToChunkTask, FastTravelTask)~~ ✅ Done
19. ~~Implement resource collection tasks (CollectBlazeRodsTask, CollectFoodTask)~~ ✅ Done
20. ~~Implement remaining resource tasks (CollectObsidianTask)~~ ✅ Done
21. ~~Implement portal construction tasks (ConstructNetherPortalTask)~~ ✅ Done
22. ~~Implement structure looting tasks (LootDesertTempleTask)~~ ✅ Done
23. ~~Implement stash management (StoreInStashTask - needs BlockRange utility)~~ ✅ Done
24. ~~Implement remaining structure tasks (RavageDesertTemplesTask, RavageRuinedPortalsTask)~~ ✅ Done
25. ~~Implement speedrun tasks (KillEnderDragonTask, LocateStrongholdCoordinatesTask)~~ ✅ Done
26. ~~Implement speedrun tasks (BeatMinecraft2Task, MarvionBeatMinecraftTask)~~ ✅ Done (as BeatMinecraftTask)
27. ~~Implement construction tasks (PlaceSignTask, ClearRegionTask, CoverWithBlocksTask, ConstructIronGolemTask)~~ ✅ Done
28. Implement remaining misc tasks (HeroTask, CarveThenCollectTask)
29. Implement remaining construction tasks (PlaceObsidianBucketTask, PlaceStructureBlockTask)
