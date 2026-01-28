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
  escapeFromLava,
  escapeFromLavaUrgent,
  runFromCreepers,
  runFromHostiles,
  runFromAllHostiles,
} from './EscapeTask';
export type { LavaEscapeConfig, CreeperFleeConfig, HostileFleeConfig } from './EscapeTask';

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
  doToClosestBlock,
  getWithinRangeOf,
  goInDirection,
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
