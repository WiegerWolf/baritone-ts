/**
 * Utility System Exports
 */

// Item Target
export { ItemTarget, ItemTargets } from './ItemTarget';

// Storage Helper
export {
  StorageHelper,
  SlotType,
  SLOT_MAPPINGS,
} from './StorageHelper';

// Slot Handler
export {
  SlotHandler,
  ClickType,
  Slot,
  PlayerInventorySlot,
  ArmorSlot,
  OffhandSlot,
  ContainerSlot,
  createSlotHandler,
  type SlotHandlerConfig,
} from './SlotHandler';

// Timers
export * from './timers';

// Progress Checkers
export * from './progress';

// Look Helper
export {
  LookHelper,
  createLookHelper,
  calculateLookRotation,
  getEyeDistance,
  type LookRotation,
  type LookConfig,
} from './LookHelper';

// Block Range
export {
  BlockRange,
  blockRange,
  blockRangeAround,
} from './BlockRange';

// World Helper
export {
  WORLD_CEILING_Y,
  WORLD_FLOOR_Y,
  Dimension,
  type BlockPos,
  getTicks,
  toVec3,
  toBlockPos,
  getCurrentDimension,
  isSourceBlock,
  distanceXZSquared,
  distanceXZ,
  inRangeXZ,
  isSolid,
  isAir,
  isAirBlock,
  getGroundHeight,
  isInteractableBlock,
  isChest,
  isLava,
  isWater,
  isFallingBlock,
  dangerousToBreakIfRightAbove,
  canSleep,
  getBlocksTouchingPlayer,
  scanRegion,
  getOverworldPosition,
  getNetherPosition,
  isOcean,
  WorldHelperInstance,
  createWorldHelper,
} from './WorldHelper';

// Item Helper
export {
  WoodType,
  DyeColor,
  SAPLINGS,
  PLANKS,
  LOGS,
  LEAVES,
  WOOL,
  BEDS,
  ALL_PICKAXES,
  ALL_AXES,
  ALL_SWORDS,
  BOATS,
  LOG_TO_PLANKS,
  PLANKS_TO_LOG,
  COOKABLE_FOOD,
  RAW_FOODS,
  FUEL_TIMES,
  logToPlanks,
  planksToLog,
  getCookedFood,
  isRawFood,
  isFuel,
  getFuelAmount,
  isLog,
  isPlanks,
  isPickaxe,
  isAxe,
  isSword,
  isBed,
  isWool,
  isBoat,
  getToolTier,
  getArmorTier,
  areShearsEffective,
  stripItemName,
  getWoodTypeFromItem,
  getColorFromItem,
  getWoodItems,
  type WoodItems,
} from './ItemHelper';
