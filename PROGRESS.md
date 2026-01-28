# BaritonePlus → baritone-ts Porting Progress

## Overview
This document tracks the porting progress from the Java BaritonePlus project to the TypeScript baritone-ts implementation.

**Source**: BaritonePlus (371 Java files)
**Target**: baritone-ts (195 TypeScript files currently)
**Last Updated**: 2026-01-28, Iteration 5

---

## Iteration 4 Progress (Current)

### Completed in This Iteration:
1. **Blacklisting System** - NEW
   - `trackers/blacklisting/AbstractObjectBlacklist.ts` - Base class for intelligent failure tracking
   - `trackers/blacklisting/WorldLocateBlacklist.ts` - Block position blacklisting
   - `trackers/blacklisting/EntityLocateBlacklist.ts` - Entity blacklisting
   - `trackers/blacklisting/index.ts` - Module exports
   - Features distance-based reset (closer = reset failures) and tool tier tracking

2. **ThrowEnderPearlTask** - NEW
   - `tasks/concrete/ThrowEnderPearlTask.ts` - Ender pearl throwing for travel
   - Calculates projectile motion angles for accurate throws
   - Checks line of sight before throwing
   - Uses ProjectileHelper utilities

3. **Goal Types** - NEW (in `goals/index.ts`)
   - `GoalAnd` - Composite goal requiring ALL sub-goals to be met
   - `GoalBlockSide` - Approach block from specific direction
   - `GoalChunk` - Reach any position within a chunk
   - `GoalDirectionXZ` - Move in a direction indefinitely
   - `GoalRunAwayFromEntities` - Flee from multiple entities
   - `Direction` enum for directional goals

4. **Updated Exports**
   - `trackers/index.ts` updated with blacklisting exports
   - `tasks/concrete/index.ts` updated with ThrowEnderPearlTask exports

5. **Verified Existing (Container Tasks)**
   - `ContainerTask.ts` already well-implemented with:
     - DoStuffInContainerTask - Abstract base for container interactions
     - CraftInTableTask - Crafting table operations
     - SmeltInFurnaceBaseTask - Furnace smelting
     - UpgradeInSmithingTableTask - Smithing table upgrades
     - CraftInAnvilTask - Anvil operations

---

## Iteration 3 Progress (Completed)

### Completed in This Iteration:
1. **Pickup Item Tasks** - NEW
   - `PickupItemTask.ts` - Pick up dropped items from ground
   - `GetToEntityTask` - Navigate to entity position
   - `PickupDroppedItemTask` - Pick up items matching criteria
   - `PickupNearbyItemsTask` - Pick up any nearby items

2. **Flee From Entities Tasks** - NEW
   - `FleeFromEntitiesTask.ts` - Run away from entities
   - `RunAwayFromEntitiesTask` - Base flee task with direction calculation
   - `RunAwayFromHostilesTask` - Flee from hostile mobs
   - `RunAwayFromPlayersTask` - Flee from players
   - `RunAwayFromCreepersTask` - Special handling for creepers
   - `DodgeProjectilesTask` - Dodge incoming projectiles

3. **Already Existed (verified)**
   - `TimeoutWanderTask` in MovementUtilTask.ts
   - Entity interaction tasks in EntityTask.ts

4. **Updated Exports**
   - `concrete/index.ts` updated with new task exports

---

## Iteration 2 Progress (Completed)

### Completed in This Iteration:
1. **Entity Helper** - NEW
   - `EntityHelper.ts` - Entity state interpretation (hostility, damage calc, etc.)
   - Includes entity classification (hostile, neutral, passive mobs)
   - Damage calculation with armor/protection reduction
   - Utility functions for finding/filtering entities

2. **Mining Requirement** - NEW
   - `MiningRequirement.ts` - Tool tier requirements for mining blocks
   - Complete block-to-pickaxe-tier mapping
   - Functions for checking tool suitability

3. **Projectile Helper** - NEW
   - `ProjectileHelper.ts` - Projectile motion physics
   - Trajectory calculation and prediction
   - Launch angle calculations
   - Intercept point calculations

4. **Updated Exports**
   - `utils/index.ts` updated with all new exports
   - Main `index.ts` updated with new exports

---

## Iteration 1 Progress (Completed)

### Completed in This Iteration:
1. **Control System** - NEW
   - `InputControls.ts` - Keyboard/mouse state management
   - `PlayerExtraController.ts` - Extended player actions (attack, dig, etc.)
   - `KillAura.ts` - Combat automation with strategies (FASTEST, DELAY, SMART)
   - `control/index.ts` - Module exports

2. **Utility Helpers** - NEW
   - `WorldHelper.ts` - Dimension detection, terrain analysis, block utilities
   - `ItemHelper.ts` - Item categories, log/plank mappings, fuel calculations

3. **Updated Exports**
   - Main `index.ts` updated with all new exports
   - `utils/index.ts` updated with WorldHelper and ItemHelper exports

---

## Completed Components

### Core Task System ✅
- [x] `Task.java` → `Task.ts` - Base task class with lifecycle management
- [x] `TaskChain.java` → `TaskChain.ts` - Task chain management
- [x] `TaskRunner.java` → `TaskRunner.ts` - Task execution engine
- [x] `ITaskCanForce`, `ITaskRequiresGrounded`, `ITaskOverridesGrounded` interfaces

### Pathfinding Core ✅
- [x] A* implementation (`AStar.ts`)
- [x] Goal types (`GoalBlock`, `GoalNear`, `GoalXZ`, `GoalGetToBlock`)
- [x] Path executor (`PathExecutor.ts`)
- [x] Movement calculations (`Movement.ts`)
- [x] Calculation context (`CalculationContext.ts`)
- [x] Action costs (`ActionCosts.ts`)

### Movement Types ✅
- [x] `MovementTraverse` - Walking on flat ground
- [x] `MovementAscend` - Jumping up one block
- [x] `MovementDescend` - Dropping down
- [x] `MovementDiagonal` - Diagonal movement
- [x] `MovementPillar` - Towering up
- [x] `MovementParkour` - Jumping gaps
- [x] `MovementParkourAscend` - Parkour with ascent
- [x] `MovementSwim*` - Swimming movements
- [x] `MovementClimb*` - Ladder/vine climbing
- [x] `MovementDoor*` - Door/gate traversal
- [x] `MovementElytra` - Elytra flight
- [x] `MovementBoat` - Boat travel

### Tracker System ✅
- [x] `Tracker.java` → `Tracker.ts` - Base tracker
- [x] `TrackerManager.java` → `TrackerManager.ts`
- [x] `BlockTracker.java` → `BlockTracker.ts`
- [x] `EntityTracker.java` → `EntityTracker.ts`
- [x] `ItemStorageTracker.java` → `ItemStorageTracker.ts`

### Event System ✅
- [x] `EventBus.java` → `EventBus.ts`

### Utility Classes (Partial) ⚠️
- [x] `ItemTarget.java` → `ItemTarget.ts`
- [x] `StorageHelper.java` → `StorageHelper.ts`
- [x] `SlotHandler.java` → `SlotHandler.ts`
- [x] `LookHelper.java` → `LookHelper.ts`
- [x] Timer classes (`TimerGame`, `TimerReal`)
- [x] Progress checkers

### Settings System ✅
- [x] `BotSettings.ts` with comprehensive settings
- [x] `SettingsManager.ts`

### Behavior/Process System ✅
- [x] `BaseProcess.ts`
- [x] `ProcessManager.ts`
- [x] `MineProcess.ts`
- [x] `FollowProcess.ts`
- [x] `ExploreProcess.ts`
- [x] `GatherProcess.ts`
- [x] `FarmProcess.ts`
- [x] `BuildProcess.ts`
- [x] `CombatProcess.ts`

### Chain System ✅
- [x] `FoodChain.ts`
- [x] `WorldSurvivalChain.ts`
- [x] `MLGBucketChain.ts`
- [x] `MobDefenseChain.ts`

### Resource Tasks (Partial) ⚠️
- [x] `ResourceTask.java` → `ResourceTask.ts` (base class)
- [x] Basic resource task variants

### Composite Tasks (Stubs/Partial) ⚠️
Many composite tasks exist as stubs:
- [x] `GoToTask.ts` (navigation tasks)
- [x] `FollowPlayerTask.ts`
- [ ] Most composite tasks need full implementation

---

## Missing/Incomplete Components

### Control System ✅ (Iteration 1)
**BaritonePlus files in `api/control/`:**
- [x] `InputControls.java` → `InputControls.ts` - Keyboard/mouse input management
- [x] `KillAura.java` → `KillAura.ts` - Combat automation with shielding
- [x] `PlayerExtraController.java` → `PlayerExtraController.ts` - Extended player actions
- [x] `SlotHandler.java` - Already ported (in utils/)

### Utility Helpers (Mostly Complete) ✅
**From `api/util/helpers/`:**
- [ ] `BaritoneHelper.java` - Baritone API integration (not needed for mineflayer)
- [ ] `ConfigHelper.java` - Configuration file handling (using SettingsManager instead)
- [x] `EntityHelper.java` → `EntityHelper.ts` - Entity utility functions (Iteration 2)
- [ ] `InputHelper.java` - Input state management (covered by InputControls)
- [x] `ItemHelper.java` → `ItemHelper.ts` - Item manipulation utilities (Iteration 1)
- [ ] `MathsHelper.java` - Math utility functions (basic - will add as needed)
- [x] `ProjectileHelper.java` → `ProjectileHelper.ts` - Projectile calculations (Iteration 2)
- [ ] `StlHelper.java` - Stream/collection utilities (not needed in TypeScript)
- [x] `WorldHelper.java` → `WorldHelper.ts` - World/dimension utilities (Iteration 1)

### Baritone Goal Types ⚠️
**From `api/util/baritone/`:**
- [x] `GoalAnd.java` → `goals/index.ts` (Iteration 4)
- [x] `GoalBlockSide.java` → `goals/index.ts` (Iteration 4)
- [x] `GoalChunk.java` → `goals/index.ts` (Iteration 4)
- [x] `GoalDirectionXZ.java` → `goals/index.ts` (Iteration 4)
- [ ] `GoalDodgeProjectiles.java` - Avoid projectiles
- [x] `GoalFollowEntity.java` → `goals/index.ts` (existing as GoalFollow)
- [x] `GoalRunAwayFromEntities.java` → `goals/index.ts` (Iteration 4)

### Data Types ⚠️
- [ ] `ArmorRequirement.java`
- [ ] `CraftingRecipe.java` - Partially ported
- [x] `Dimension.java` → in `WorldHelper.ts` - Dimension enum (Iteration 1)
- [x] `MiningRequirement.java` → `MiningRequirement.ts` (Iteration 2)
- [ ] `RecipeTarget.java`
- [ ] `SmeltTarget.java`
- [x] `WoodType.java` → in `ItemHelper.ts` - Wood type enum (Iteration 1)

### Main Tasks ❌
**BaritonePlus `main/tasks/` - Core task implementations:**

#### Movement Tasks (~25 files) - Mostly Complete ✅
- [x] `CustomBaritoneGoalTask.java` → GoToTask.ts (goals)
- [x] `DefaultGoToDimensionTask.java` → PortalTask.ts
- [x] `DodgeProjectilesTask.java` → FleeFromEntitiesTask.ts (Iteration 3)
- [x] `EnterNetherPortalTask.java` → PortalTask.ts
- [x] `EscapeFromLavaTask.java` → EscapeTask.ts
- [x] `FastTravelTask.java` → FastTravelTask.ts
- [x] `FollowPlayerTask.java` → EntityTask.ts
- [x] `GetCloseToBlockTask.java` → BlockSearchTask.ts
- [x] `GetToBlockTask.java` → GoToTask.ts
- [x] `GetToChunkTask.java` → GetToChunkTask.ts
- [x] `GetToEntityTask.java` → PickupItemTask.ts (Iteration 3)
- [ ] `GetToOuterEndIslandsTask.java`
- [x] `GetToXZTask.java` → GoToTask.ts
- [ ] `GetToXZWithElytraTask.java`
- [x] `GetToYTask.java` → MovementUtilTask.ts
- [x] `GetWithinRangeOfBlockTask.java` → BlockSearchTask.ts
- [x] `GoInDirectionXZTask.java` → BlockSearchTask.ts
- [x] `GoToStrongholdPortalTask.java` → StrongholdTask.ts
- [x] `IdleTask.java` → MovementUtilTask.ts
- [x] `LocateDesertTempleTask.java` → BiomeSearchTask.ts
- [x] `LocateStrongholdCoordinatesTask.java` → StrongholdTask.ts
- [x] `MLGBucketTask.java` → MLGTask.ts
- [x] `PickupDroppedItemTask.java` → PickupItemTask.ts (Iteration 3)
- [x] `RunAwayFrom*Task.java` → FleeFromEntitiesTask.ts (Iteration 3)
- [x] `SafeRandomShimmyTask.java` → MovementUtilTask.ts
- [x] `SearchChunk*Task.java` → ChunkSearchTask.ts
- [x] `ThrowEnderPearlSimpleProjectileTask.java` → `ThrowEnderPearlTask.ts` (Iteration 4)
- [x] `TimeoutWanderTask.java` → MovementUtilTask.ts

#### Construction Tasks (~20 files)
- [ ] `ClearLiquidTask.java`
- [ ] `ClearRegionTask.java`
- [ ] `CoverWithBlocksTask.java`
- [ ] `DestroyBlockTask.java`
- [ ] `PlaceBlockTask.java` - Stub exists
- [ ] `PlaceBlockNearbyTask.java`
- [ ] `PlaceObsidianBucketTask.java`
- [ ] `PlaceSignTask.java`
- [ ] `PlaceStructureBlockTask.java`
- [ ] `PutOutFireTask.java`
- [ ] Nether portal construction tasks

#### Container Tasks (~15 files)
- [ ] `DoStuffInContainerTask.java`
- [ ] `CraftInTableTask.java`
- [ ] `CraftInAnvilTask.java`
- [ ] `SmeltInFurnaceTask.java`
- [ ] `SmeltInBlastFurnaceTask.java`
- [ ] `SmeltInSmokerTask.java`
- [ ] `LootContainerTask.java`
- [ ] `PickupFromContainerTask.java`
- [ ] `StoreIn*Task.java` (multiple)
- [ ] `UpgradeInSmithingTableTask.java`

#### Resource Collection Tasks (~40 files)
- [ ] `MineAndCollectTask.java` - Full implementation
- [ ] `CollectBlazeRodsTask.java`
- [ ] `CollectFoodTask.java`
- [ ] `CollectFuelTask.java`
- [ ] `CollectObsidianTask.java`
- [ ] All `Collect*Task.java` files
- [ ] `CraftWithMatching*Task.java`
- [ ] `KillAndLootTask.java`
- [ ] `SatisfyMiningRequirementTask.java`
- [ ] `TradeWithPiglinsTask.java`

#### Entity Tasks (~10 files)
- [ ] `AbstractDoToEntityTask.java`
- [ ] `AbstractKillEntityTask.java`
- [ ] `DoToClosestEntityTask.java`
- [ ] `GiveItemToPlayerTask.java`
- [ ] `HeroTask.java`
- [ ] `KillEntitiesTask.java`
- [ ] `KillEntityTask.java`
- [ ] `KillPlayerTask.java`
- [ ] `ShearSheepTask.java`

#### Slot/Inventory Tasks (~10 files)
- [ ] `ClickSlotTask.java`
- [ ] `EnsureFree*Task.java` (multiple)
- [ ] `MoveItem*Task.java` (multiple)
- [ ] `ReceiveCraftingOutputSlotTask.java`
- [ ] `ThrowCursorTask.java`

#### Misc Tasks (~10 files)
- [ ] `EquipArmorTask.java`
- [ ] `LootDesertTempleTask.java`
- [ ] `PlaceBedAndSetSpawnTask.java`
- [ ] `RavageDesertTemplesTask.java`
- [ ] `RavageRuinedPortalsTask.java`
- [ ] `RepairToolTask.java`
- [ ] `SleepThroughNightTask.java`

#### Speedrun Tasks (~10 files)
- [ ] `BeatMinecraft2Task.java`
- [ ] `BeatMinecraftConfig.java`
- [ ] `KillEnderDragonTask.java`
- [ ] `KillEnderDragonWithBedsTask.java`
- [ ] `MarvionBeatMinecraftTask.java`
- [ ] Dragon-related tasks

### Tracker Subsystems ⚠️
**Missing from `api/trackers/`:**
- [ ] `MiscBlockTracker.java`
- [ ] `SimpleChunkTracker.java`
- [x] `blacklisting/AbstractObjectBlacklist.java` → `blacklisting/AbstractObjectBlacklist.ts` (Iteration 4)
- [x] `blacklisting/EntityLocateBlacklist.java` → `blacklisting/EntityLocateBlacklist.ts` (Iteration 4)
- [x] `blacklisting/WorldLocateBlacklist.java` → `blacklisting/WorldLocateBlacklist.ts` (Iteration 4)
- [ ] `storage/ContainerSubTracker.java`
- [ ] `storage/InventorySubTracker.java`

### Butler/Command System ❌
**Not ported at all:**
- [ ] `Butler.java` - Chat command handling
- [ ] `ButlerConfig.java`
- [ ] `UserAuth.java`
- [ ] `UserListFile.java`
- [ ] `WhisperChecker.java`
- [ ] `PlusCommand.java`
- [ ] Command datatypes

### Serialization ❌
**Missing:**
- [ ] Various serializers/deserializers for Vec3d, BlockPos, Items, etc.

---

## Priority Tasks for Next Iterations

### Iteration 5 - Advanced Movement Tasks
1. Port `GetToOuterEndIslandsTask.java` - End dimension travel
2. Port `GetToXZWithElytraTask.java` - Elytra flight navigation
3. Port remaining movement utility tasks

### Iteration 6 - Slot/Inventory Tasks
1. Port `ClickSlotTask.java` - Verify existing implementation
2. Port `EnsureFree*Task.java` (multiple) - Verify existing
3. Port `MoveItem*Task.java` (multiple) - Verify existing
4. Port `ThrowCursorTask.java` - Verify existing

### Iteration 7+ - Resource Collection & Speedrun
1. Full implementation of resource collection tasks
2. Speedrun tasks (BeatMinecraft2Task)
3. Dragon fight tasks

---

## Notes

### Architecture Differences
- Java uses inheritance heavily; TypeScript uses more composition
- Java's Optional → TypeScript's `| null` or `| undefined`
- Java enums → TypeScript enums or union types
- Minecraft item/block registries handled differently

### Mineflayer Considerations
- Bot instance replaces `BaritonePlus` mod reference
- Physics handled by prismarine-physics
- Inventory API differs from Minecraft's

### Testing Status
- Unit tests: Minimal
- Integration tests: None
- Manual testing needed for ported components

---

## Statistics
- **Java Files**: 371
- **TypeScript Files**: 195 (was 190)
- **Estimated Completion**: ~58%
- **Core Systems**: ~88% complete
- **Task Implementations**: ~38% complete (up from ~35%)
- **Utility/Helper**: ~75% complete

## Files Added in Iteration 1
1. `src/control/InputControls.ts`
2. `src/control/PlayerExtraController.ts`
3. `src/control/KillAura.ts`
4. `src/control/index.ts`
5. `src/utils/WorldHelper.ts`
6. `src/utils/ItemHelper.ts`

### Iteration 1 Summary
- Added complete Control System (InputControls, KillAura, PlayerExtraController)
- Added WorldHelper with dimension detection, terrain utilities, and more
- Added ItemHelper with comprehensive item category definitions
- All type errors fixed, project compiles successfully

## Files Added in Iteration 2
1. `src/utils/EntityHelper.ts`
2. `src/utils/MiningRequirement.ts`
3. `src/utils/ProjectileHelper.ts`

### Iteration 2 Summary
- Added EntityHelper for entity state interpretation, hostility detection, damage calculation
- Added MiningRequirement for tool tier requirements and block mining capabilities
- Added ProjectileHelper for projectile physics and trajectory calculations
- All type errors fixed, project compiles successfully

## Files Added in Iteration 3
1. `src/tasks/concrete/PickupItemTask.ts`
2. `src/tasks/concrete/FleeFromEntitiesTask.ts`

### Iteration 3 Summary
- Added PickupDroppedItemTask for collecting items from ground
- Added GetToEntityTask for navigating to entities
- Added RunAwayFromEntitiesTask family for fleeing from threats
- Added DodgeProjectilesTask for avoiding arrows/fireballs
- All type errors fixed, project compiles successfully

## Files Added in Iteration 4
1. `src/trackers/blacklisting/AbstractObjectBlacklist.ts`
2. `src/trackers/blacklisting/WorldLocateBlacklist.ts`
3. `src/trackers/blacklisting/EntityLocateBlacklist.ts`
4. `src/trackers/blacklisting/index.ts`
5. `src/tasks/concrete/ThrowEnderPearlTask.ts`

### Iteration 4 Summary
- Added intelligent blacklisting system with distance/tool-based reset
- Added ThrowEnderPearlTask for ender pearl travel
- Added 5 new goal types (GoalAnd, GoalBlockSide, GoalChunk, GoalDirectionXZ, GoalRunAwayFromEntities)
- Verified container tasks are already well-implemented
- All type errors fixed, project compiles successfully
- Ready for next iteration focusing on slot/inventory tasks
