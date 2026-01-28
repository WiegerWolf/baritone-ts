/**
 * Concrete Task Implementations
 *
 * This module exports all concrete task implementations that can be
 * used directly or composed into more complex behaviors.
 */

// Navigation tasks
export {
  GoToTask,
  GoToBlockTask,
  GetToBlockTask,
  GoToNearTask,
  GoToXZTask,
  FollowEntityTask,
} from './GoToTask';

// Mining tasks
export {
  MineBlockTask,
  MineBlockTypeTask,
} from './MineBlockTask';

// Placement tasks
export {
  PlaceBlockTask,
  PlaceAgainstTask,
} from './PlaceBlockTask';

// Crafting tasks
export {
  CraftTask,
  EnsureItemTask,
} from './CraftTask';

// Smelting tasks
export {
  SmeltTask,
  isFuel,
  getFuelBurnTime,
} from './SmeltTask';

// Inventory tasks
export {
  EquipmentSlot,
  PickupItemTask,
  EquipTask,
  DropItemTask,
  MoveItemTask,
} from './InventoryTask';

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
} from './SlotTask';

// Movement utility tasks
export {
  TimeoutWanderTask,
  IdleTask,
  GetToYTask,
  SafeRandomShimmyTask,
  WaitTask,
  LookAtBlockTask,
} from './MovementUtilTask';

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

// Portal/dimension tasks
export {
  EnterNetherPortalTask,
  GoToDimensionTask,
  enterNether,
  returnToOverworld,
  goToDimension,
} from './PortalTask';
export type { PortalConfig } from './PortalTask';

// Armor tasks
export {
  ArmorSlot,
  ArmorMaterial,
  EquipArmorTask,
  EquipSpecificArmorTask,
  equipBestArmor,
  equipArmor,
} from './ArmorTask';
export type { ArmorPiece, EquipArmorConfig } from './ArmorTask';

// Bed/sleep tasks
export {
  PlaceBedAndSetSpawnTask,
  SleepInBedTask,
  placeBedAndSetSpawn,
  sleepInBed,
} from './BedTask';
export type { BedTaskConfig } from './BedTask';

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
  StrafeAndDodgeTask,
  dodgeProjectiles,
  strafeAndDodge,
} from './DodgeTask';
export type { DodgeProjectilesConfig } from './DodgeTask';

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
  MLGBucketMonitorTask,
  mlgBucket,
  monitorForMLG,
  shouldMLG,
} from './MLGTask';
export type { MLGConfig } from './MLGTask';

// Chunk search/exploration tasks
export {
  blockToChunk,
  chunkToBlock,
  SearchChunksExploreTask,
  SearchChunkForBlockTask,
  SearchChunkByConditionTask,
  searchForBlocks,
  searchForStronghold,
  searchForNetherFortress,
} from './ChunkSearchTask';
export type { ChunkPos, ChunkSearchConfig } from './ChunkSearchTask';

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

// Storage container tasks
export {
  containerItemTarget,
  itemMatchesTarget,
  PickupFromContainerTask,
  StoreInContainerTask,
  LootContainerTask,
  pickupFromContainer,
  storeInContainer,
  lootContainer,
} from './StorageContainerTask';
export type { ContainerItemTarget } from './StorageContainerTask';

// Inventory crafting tasks
export {
  INVENTORY_RECIPES,
  CraftInInventoryTask,
  CraftWithRecipeBookTask,
  craftPlanks,
  craftSticks,
  craftCraftingTable,
} from './CraftInInventoryTask';
export type { RecipeSlot, InventoryRecipe, InventoryRecipeTarget } from './CraftInInventoryTask';

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
  RavageRuinedPortalsTask,
  RavageState,
  ravageDesertTemples,
  ravageRuinedPortals,
  DESERT_TEMPLE_LOOT,
  RUINED_PORTAL_LOOT,
} from './RavageStructuresTask';

// Stronghold location tasks
export {
  LocateStrongholdCoordinatesTask,
  GoToStrongholdPortalTask,
  LocateState,
  GoToStrongholdState,
  locateStronghold,
  goToStrongholdPortal,
  calculateIntersection,
} from './StrongholdTask';

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
  GetBuildingMaterialsTask,
  satisfyMiningRequirement,
  ensureStonePickaxe,
  ensureIronPickaxe,
  ensureDiamondPickaxe,
  getBuildingMaterials,
  miningRequirementMet,
  getBlockMiningRequirement,
  BUILDING_MATERIALS,
} from './MiningRequirementTask';

// Biome search tasks
export {
  Biomes,
  SearchWithinBiomeTask,
  LocateDesertTempleTask,
  searchWithinBiome,
  locateDesertTemple,
  getCurrentBiome,
  isInBiome,
} from './BiomeSearchTask';
export type { BiomeKey, LocateDesertTempleConfig } from './BiomeSearchTask';

// Pickup item tasks
export {
  GetToEntityTask,
  PickupDroppedItemTask,
  PickupNearbyItemsTask,
} from './PickupItemTask';

// Flee from entities tasks
export {
  RunAwayFromEntitiesTask,
  RunAwayFromHostilesTask as FleeFromHostilesTask,
  RunAwayFromPlayersTask as FleeFromPlayersTask,
  RunAwayFromCreepersTask as FleeFromCreepersTask,
  DodgeProjectilesTask as FleeFromProjectilesTask,
} from './FleeFromEntitiesTask';
export type { EntitySupplier } from './FleeFromEntitiesTask';

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
export type { ShearSheepConfig } from './ShearSheepTask';

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
