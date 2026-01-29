/**
 * Concrete Task Implementations
 *
 * This module exports all concrete task implementations that can be
 * used directly or composed into more complex behaviors.
 */

// Navigation tasks
export { GoToTask } from './GoToTask';
export { GoToBlockTask } from './GoToBlockTask';
export { GetToBlockTask } from './GetToBlockTask';
export { GoToNearTask } from './GoToNearTask';
export { GoToXZTask } from './GoToXZTask';
export { FollowEntityTask } from './FollowEntityTask';

// Mining tasks
export { MineBlockTask } from './MineBlockTask';
export { MineBlockTypeTask } from './MineBlockTypeTask';

// Placement tasks
export { PlaceBlockTask } from './PlaceBlockTask';
export { PlaceAgainstTask } from './PlaceAgainstTask';

// Crafting tasks
export { CraftTask } from './CraftTask';
export { EnsureItemTask } from './EnsureItemTask';

// Smelting tasks
export {
  SmeltTask,
  isFuel,
  getFuelBurnTime,
} from './SmeltTask';

// Inventory tasks
export { EquipmentSlot, EquipTask } from './EquipTask';
export { PickupItemTask } from './InventoryPickupItemTask';
export { DropItemTask } from './DropItemTask';
export { MoveItemTask } from './MoveItemTask';

// Interaction tasks
export {
  InteractBlockTask,
  InteractEntityTask,
  AttackEntityTask,
  UseItemTask,
} from './InteractTask';

// Slot management tasks
export {
  ClickSlotTask,
  SlotActionType,
  SlotConstants,
  EnsureFreeCursorSlotTask,
  EnsureFreeInventorySlotTask,
  EnsureFreePlayerCraftingGridTask,
  ThrowCursorTask,
  ReceiveCraftingOutputTask,
  MoveItemToSlotTask,
  MoveItemsToSlotTask,
  MoveItemToSlotFromInventoryTask,
  MoveItemToSlotFromContainerTask,
  matchItemNames,
} from './SlotTask';
export type { ItemMatcher } from './SlotTask';

// Movement utility tasks
export { TimeoutWanderTask } from './TimeoutWanderTask';
export { IdleTask } from './IdleTask';
export { GetToYTask } from './GetToYTask';
export { SafeRandomShimmyTask } from './SafeRandomShimmyTask';
export { WaitTask } from './WaitTask';
export { LookAtBlockTask } from './LookAtBlockTask';

// Container interaction tasks
export {
  ContainerType,
  getContainerBlocks,
  isContainerBlock,
  DoStuffInContainerTask,
  AbstractDoToStorageContainerTask,
  CraftInTableTask,
  SmeltInFurnaceBaseTask,
  UpgradeInSmithingTableTask,
  CraftInAnvilTask,
} from './ContainerTask';

// Construction tasks
export {
  DestroyBlockTask,
  PlaceBlockNearbyTask,
  ClearLiquidTask,
  PutOutFireTask,
} from './ConstructionTask';

// Entity interaction tasks
export {
  AbstractDoToEntityTask,
  DoToClosestEntityTask,
  GiveItemToPlayerTask,
  KillPlayerTask,
  InteractWithEntityTask,
  killEntities,
} from './EntityTask';
export type { EntityTaskConfig, EntityFilter, EntityTaskFactory } from './EntityTask';

// Escape/safety tasks
export {
  EscapeFromLavaTask,
  RunAwayFromCreepersTask,
  RunAwayFromHostilesTask,
  RunAwayFromPositionTask,
  escapeFromLava,
  escapeFromLavaUrgent,
  runFromCreepers,
  runFromHostiles,
  runFromAllHostiles,
  runFromPositions,
  runFromPositionsAtY,
} from './EscapeTask';
export type { LavaEscapeConfig, CreeperFleeConfig, HostileFleeConfig, PositionFleeConfig } from './EscapeTask';

// Resource collection tasks
export {
  ResourceTask,
  itemTarget,
  Dimension,
} from './ResourceTask';
export type { ItemTarget } from './ResourceTask';

export {
  MineAndCollectTask,
  mineAndCollect,
  mineOre,
} from './MineAndCollectTask';
export type { MineAndCollectConfig } from './MineAndCollectTask';

export {
  KillAndLootTask,
  killAndLoot,
  huntForFood,
  huntMobForDrop,
} from './KillAndLootTask';
export type { KillAndLootConfig } from './KillAndLootTask';

export {
  CollectFuelTask,
  collectFuel,
  collectFuelForSmelting,
  FUEL_SOURCES,
} from './CollectFuelTask';
export type { FuelSource, CollectFuelConfig } from './CollectFuelTask';

// Block search and interaction tasks
export {
  DoToClosestBlockTask,
  GetWithinRangeOfBlockTask,
  GoInDirectionXZTask,
  GetCloseToBlockTask,
  doToClosestBlock,
  getWithinRangeOf,
  goInDirection,
  getCloseTo,
  getCloseToVec,
} from './BlockSearchTask';
export type { BlockFilter, BlockTaskFactory, DoToClosestBlockConfig } from './BlockSearchTask';

// Portal/dimension tasks - re-exported from composite for backwards compatibility
export {
  EnterNetherPortalTask,
  GoToDimensionTask,
  enterNetherLegacy as enterNether,
  returnToOverworld,
  goToDimension,
  type NetherPortalConfig as PortalConfig,
} from '../composite/PortalTask';

// Armor tasks
export {
  ArmorSlot,
  ArmorMaterial,
  EquipArmorTask,
  equipBestArmor,
} from './EquipArmorTask';
export type { ArmorPiece, EquipArmorConfig } from './EquipArmorTask';
export {
  EquipSpecificArmorTask,
  equipArmor,
} from './EquipSpecificArmorTask';

// Bed/sleep tasks
export { PlaceBedAndSetSpawnTask, placeBedAndSetSpawn } from './PlaceBedAndSetSpawnTask';
export { SleepInBedTask, sleepInBed } from './SleepInBedTask';
export type { BedTaskConfig } from './PlaceBedAndSetSpawnTask';

// Liquid collection tasks
export {
  LiquidType,
  CollectBucketLiquidTask,
  CollectWaterBucketTask,
  CollectLavaBucketTask,
  collectWater,
  collectLava,
} from './CollectLiquidTask';
export type { CollectLiquidConfig } from './CollectLiquidTask';

// Dodge/evasion tasks
export {
  DodgeProjectilesTask,
  dodgeProjectiles,
} from './DodgeProjectilesTask';
export type { DodgeProjectilesConfig } from './DodgeProjectilesTask';
export {
  StrafeAndDodgeTask,
  strafeAndDodge,
} from './StrafeAndDodgeTask';

// Trading tasks
export {
  TradeWithPiglinsTask,
  tradeWithPiglins,
  tradeForEnderPearls,
  tradeForFireResistance,
} from './TradeTask';
export type { PiglinTradeConfig } from './TradeTask';

// MLG/fall damage prevention tasks
export {
  MLGBucketTask,
  mlgBucket,
  shouldMLG,
} from './MLGBucketTask';
export type { MLGConfig } from './MLGBucketTask';
export {
  MLGBucketMonitorTask,
  monitorForMLG,
} from './MLGBucketMonitorTask';

// Chunk search/exploration tasks
export {
  blockToChunk,
  chunkToBlock,
  SearchChunksExploreTask,
} from './ChunkSearchTask';
export type { ChunkPos, ChunkSearchConfig } from './ChunkSearchTask';
export {
  SearchChunkForBlockTask,
  searchForBlocks,
  searchForStronghold,
  searchForNetherFortress,
} from './SearchChunkForBlockTask';
export {
  SearchChunkByConditionTask,
} from './SearchChunkByConditionTask';

// Enhanced block interaction tasks
export {
  Direction,
  InteractInput,
  ClickResponse,
  InteractWithBlockTask,
  interactWithBlock,
  placeBlockAt,
} from './InteractWithBlockTask';
export type { InteractWithBlockConfig } from './InteractWithBlockTask';

// Storage container shared types
export { containerItemTarget, itemMatchesTarget } from './ContainerItemTarget';
export type { ContainerItemTarget } from './ContainerItemTarget';

// Storage container tasks
export { PickupFromContainerTask, pickupFromContainer } from './PickupFromContainerTask';
export { StoreInContainerTask, storeInContainer } from './StoreInContainerTask';
export { LootContainerTask, lootContainer } from './LootContainerTask';

// Inventory crafting tasks
export {
  INVENTORY_RECIPES,
  CraftInInventoryTask,
  craftPlanks,
  craftSticks,
  craftCraftingTable,
} from './CraftInInventoryTask';
export type { RecipeSlot, InventoryRecipe, InventoryRecipeTarget } from './CraftInInventoryTask';
export { CraftWithRecipeBookTask } from './CraftWithRecipeBookTask';

// Chunk navigation tasks
export {
  GetToChunkTask,
  getToChunk,
  getToChunkContaining,
} from './GetToChunkTask';

// Food collection tasks
export {
  CollectFoodTask,
  FoodCollectionState,
  collectFood,
  collectFoodUntilFull,
} from './CollectFoodTask';
export type { CollectFoodConfig } from './CollectFoodTask';

// Blaze rod collection tasks
export {
  CollectBlazeRodsTask,
  BlazeCollectionState,
  collectBlazeRods,
  collectBlazeRodsForSpeedrun,
} from './CollectBlazeRodsTask';
export type { CollectBlazeRodsConfig } from './CollectBlazeRodsTask';

// Fast travel tasks
export {
  FastTravelTask,
  FastTravelState,
  fastTravelTo,
  fastTravelToPos,
} from './FastTravelTask';
export type { FastTravelConfig } from './FastTravelTask';

// Obsidian collection tasks
export {
  CollectObsidianTask,
  ObsidianCollectionState,
  collectObsidian,
  collectObsidianForPortal,
} from './CollectObsidianTask';
export type { CollectObsidianConfig } from './CollectObsidianTask';

// Nether portal construction tasks
export {
  ConstructNetherPortalTask,
  PortalConstructionState,
  constructPortalAt,
  constructPortal,
} from './ConstructNetherPortalTask';
export type { ConstructNetherPortalConfig } from './ConstructNetherPortalTask';

// Desert temple looting tasks
export {
  LootDesertTempleTask,
  TempleLootState,
  lootDesertTemple,
  lootDesertTempleFor,
} from './LootDesertTempleTask';
export type { LootDesertTempleConfig } from './LootDesertTempleTask';

// Stash storage tasks
export {
  StoreInStashTask,
  StashStorageState,
  storeInStash,
  STORAGE_BLOCKS,
} from './StoreInStashTask';
export type { StoreInStashConfig } from './StoreInStashTask';

// Structure ravaging tasks
export {
  RavageDesertTemplesTask,
  RavageState,
  ravageDesertTemples,
  DESERT_TEMPLE_LOOT,
} from './RavageDesertTemplesTask';
export {
  RavageRuinedPortalsTask,
  ravageRuinedPortals,
  RUINED_PORTAL_LOOT,
} from './RavageRuinedPortalsTask';

// Stronghold location tasks
export {
  LocateStrongholdCoordinatesTask,
  LocateState,
  locateStronghold,
  calculateIntersection,
} from './LocateStrongholdCoordinatesTask';
export {
  GoToStrongholdPortalTask,
  GoToStrongholdState,
  goToStrongholdPortal,
} from './GoToStrongholdPortalTask';

// Dragon fight tasks
export {
  KillEnderDragonTask,
  WaitForDragonAndPearlTask,
  KillEnderDragonWithBedsTask,
  DragonFightState,
  PearlStrategyState,
  BedDragonState,
  killEnderDragon,
  waitForDragonAndPearl,
  killDragonWithBeds,
  DIAMOND_ARMOR,
  FOOD_ITEMS,
  BED_ITEMS,
} from './DragonFightTask';
export type { IDragonWaiter } from './DragonFightTask';

// Advanced construction tasks
export {
  PlaceSignTask,
  PlaceSignState,
  ClearRegionTask,
  ClearRegionState,
  CoverWithBlocksTask,
  CoverWithBlocksState,
  ConstructIronGolemTask,
  ConstructIronGolemState,
  PlaceStructureBlockTask,
  PlaceStructureBlockState,
  placeSign,
  clearRegion,
  coverWithBlocks,
  constructIronGolem,
  placeStructureBlock,
  placeStructureBlockAt,
  THROWAWAY_BLOCKS,
  WOOD_SIGNS,
} from './AdvancedConstructionTask';

// Beat Minecraft (speedrun) task
export {
  BeatMinecraftTask,
  BeatMinecraftState,
  beatMinecraft,
  speedrunMinecraft,
  BEAT_MINECRAFT_DEFAULT_CONFIG,
  DIAMOND_ARMOR as SPEEDRUN_DIAMOND_ARMOR,
  IRON_ARMOR,
} from './BeatMinecraftTask';
export type { BeatMinecraftConfig } from './BeatMinecraftTask';

// Miscellaneous tasks
export {
  CarveThenCollectTask,
  CarveState,
  HeroTask,
  HeroState,
  PlaceObsidianBucketTask,
  ObsidianBucketState,
  collectCarvedPumpkins,
  beHero,
  placeObsidianWithBucket,
  HOSTILE_MOBS,
  HOSTILE_MOB_DROPS,
  OBSIDIAN_CAST_FRAME,
} from './MiscTask';

// Abstract closest object base class
export {
  AbstractDoToClosestObjectTask,
  DoToClosestObjectTask,
  doToClosestObject,
} from './AbstractDoToClosestObjectTask';
export type { DoToClosestObjectConfig } from './AbstractDoToClosestObjectTask';

// Mining requirement tasks
export {
  MiningRequirement,
  SatisfyMiningRequirementTask,
  satisfyMiningRequirement,
  ensureStonePickaxe,
  ensureIronPickaxe,
  ensureDiamondPickaxe,
  miningRequirementMet,
  getBlockMiningRequirement,
} from './SatisfyMiningRequirementTask';

export {
  GetBuildingMaterialsTask,
  getBuildingMaterials,
  BUILDING_MATERIALS,
} from './GetBuildingMaterialsTask';

// Biome search tasks
export {
  Biomes,
  SearchWithinBiomeTask,
  searchWithinBiome,
  getCurrentBiome,
  isInBiome,
} from './SearchWithinBiomeTask';
export type { BiomeKey } from './SearchWithinBiomeTask';

export {
  LocateDesertTempleTask,
  locateDesertTemple,
} from './LocateDesertTempleTask';
export type { LocateDesertTempleConfig } from './LocateDesertTempleTask';

// Pickup item tasks
export { GetToEntityTask } from './GetToEntityTask';
export { PickupDroppedItemTask } from './PickupDroppedItemTask';
export { PickupNearbyItemsTask } from './PickupNearbyItemsTask';

// Flee from entities tasks
export { RunAwayFromEntitiesTask, type EntitySupplier } from './RunAwayFromEntitiesTask';
export { FleeFromHostilesTask } from './FleeFromHostilesTask';
export { FleeFromPlayersTask } from './FleeFromPlayersTask';
export { FleeFromCreepersTask } from './FleeFromCreepersTask';
export { FleeFromProjectilesTask } from './FleeFromProjectilesTask';

// Ender pearl throwing tasks
export {
  ThrowEnderPearlSimpleProjectileTask,
  throwEnderPearl,
} from './ThrowEnderPearlTask';
export type { ThrowEnderPearlConfig } from './ThrowEnderPearlTask';

// Outer End islands task
export {
  GetToOuterEndIslandsTask,
  OuterEndIslandsState,
  getToOuterEndIslands,
  END_ISLAND_START_RADIUS,
} from './GetToOuterEndIslandsTask';

// Sheep shearing task
export {
  ShearSheepTask,
  shearSheep,
  shearSheepOfColor,
} from './ShearSheepTask';
export type { ShearSheepConfig, WoolColor } from './ShearSheepTask';

// Tool repair task
export {
  RepairToolTask,
  repairTools,
  hasItemsNeedingRepair,
  REPAIRABLE_ITEMS,
} from './RepairToolTask';
export type { RepairToolConfig } from './RepairToolTask';

// Elytra navigation task
export {
  GetToXZWithElytraTask,
  flyToXZWithElytra,
  flyToPositionWithElytra,
} from './GetToXZWithElytraTask';
export type { GetToXZWithElytraConfig } from './GetToXZWithElytraTask';

// Craft with matching materials tasks
export {
  CraftWithMatchingMaterialsTask,
  craftSlot,
} from './CraftWithMatchingMaterialsTask';
export type { CraftingSlot, CraftingRecipe } from './CraftWithMatchingMaterialsTask';
export { CraftWithMatchingPlanksTask, craftFence } from './CraftWithMatchingPlanksTask';
export { CraftWithMatchingWoolTask, craftBed } from './CraftWithMatchingWoolTask';
