# BaritonePlus → baritone-ts Porting Progress

## Overview
This document tracks the porting progress from the Java BaritonePlus project to the TypeScript baritone-ts implementation.

**Source**: BaritonePlus (371 Java files)
**Target**: baritone-ts (185 TypeScript files currently)
**Last Updated**: 2026-01-28, Iteration 1

---

## Iteration 1 Progress (Current)

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

### Utility Helpers (Partial) ⚠️
**From `api/util/helpers/`:**
- [ ] `BaritoneHelper.java` - Baritone API integration
- [ ] `ConfigHelper.java` - Configuration file handling
- [ ] `EntityHelper.java` - Entity utility functions
- [ ] `InputHelper.java` - Input state management
- [x] `ItemHelper.java` → `ItemHelper.ts` - Item manipulation utilities (Iteration 1)
- [ ] `MathsHelper.java` - Math utility functions
- [ ] `ProjectileHelper.java` - Projectile calculations
- [ ] `StlHelper.java` - Stream/collection utilities
- [x] `WorldHelper.java` → `WorldHelper.ts` - World/dimension utilities (Iteration 1)

### Baritone Goal Types ⚠️
**Missing from `api/util/baritone/`:**
- [ ] `GoalAnd.java` - Composite goals
- [ ] `GoalBlockSide.java` - Approach block from side
- [ ] `GoalChunk.java` - Go to chunk
- [ ] `GoalDirectionXZ.java` - Move in direction
- [ ] `GoalDodgeProjectiles.java` - Avoid projectiles
- [ ] `GoalFollowEntity.java` - Follow moving entity
- [ ] `GoalRunAwayFromEntities.java` - Flee from entities

### Data Types ⚠️
- [ ] `ArmorRequirement.java`
- [ ] `CraftingRecipe.java` - Partially ported
- [ ] `Dimension.java` - Dimension enum
- [ ] `MiningRequirement.java`
- [ ] `RecipeTarget.java`
- [ ] `SmeltTarget.java`
- [ ] `WoodType.java`

### Main Tasks ❌
**BaritonePlus `main/tasks/` - Core task implementations:**

#### Movement Tasks (~25 files)
- [ ] `CustomBaritoneGoalTask.java` - Base for Baritone goals
- [ ] `DefaultGoToDimensionTask.java`
- [ ] `DodgeProjectilesTask.java`
- [ ] `EnterNetherPortalTask.java`
- [ ] `EscapeFromLavaTask.java`
- [ ] `FastTravelTask.java`
- [ ] `FollowPlayerTask.java` - Needs full port
- [ ] `GetCloseToBlockTask.java`
- [ ] `GetToBlockTask.java` - Partially done
- [ ] `GetToChunkTask.java`
- [ ] `GetToEntityTask.java`
- [ ] `GetToOuterEndIslandsTask.java`
- [ ] `GetToXZTask.java`
- [ ] `GetToXZWithElytraTask.java`
- [ ] `GetToYTask.java`
- [ ] `GetWithinRangeOfBlockTask.java`
- [ ] `GoInDirectionXZTask.java`
- [ ] `GoToStrongholdPortalTask.java`
- [ ] `IdleTask.java`
- [ ] `LocateDesertTempleTask.java`
- [ ] `LocateStrongholdCoordinatesTask.java`
- [ ] `MLGBucketTask.java`
- [ ] `PickupDroppedItemTask.java`
- [ ] `RunAwayFrom*Task.java` (multiple variants)
- [ ] `SafeRandomShimmyTask.java`
- [ ] `SearchChunk*Task.java` (multiple)
- [ ] `ThrowEnderPearlSimpleProjectileTask.java`
- [ ] `TimeoutWanderTask.java`

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
- [ ] `blacklisting/AbstractObjectBlacklist.java`
- [ ] `blacklisting/EntityLocateBlacklist.java`
- [ ] `blacklisting/WorldLocateBlacklist.java`
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

### Iteration 2 - Entity Helper & Mining Requirements
1. Port `EntityHelper.java` → `EntityHelper.ts`
2. Port `MiningRequirement.java` → `MiningRequirement.ts`
3. Port `ProjectileHelper.java` → `ProjectileHelper.ts`

### Iteration 3 - Core Movement Tasks
1. Full port of `TimeoutWanderTask`
2. Full port of `PickupDroppedItemTask`
3. Port `RunAwayFromEntitiesTask` and variants

### Iteration 4 - Container Tasks
1. Port `DoStuffInContainerTask.java`
2. Port `CraftInTableTask.java`
3. Port `SmeltInFurnaceTask.java`

### Iteration 5+ - Resource Collection
1. Full implementation of resource collection tasks
2. Container interaction tasks
3. Crafting integration

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
- **TypeScript Files**: 185 (was 179)
- **Estimated Completion**: ~45%
- **Core Systems**: ~80% complete (up from ~70%)
- **Task Implementations**: ~20% complete
- **Utility/Helper**: ~50% complete (up from ~30%)

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
- Ready for next iteration focusing on EntityHelper and MiningRequirement
