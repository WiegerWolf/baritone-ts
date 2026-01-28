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
