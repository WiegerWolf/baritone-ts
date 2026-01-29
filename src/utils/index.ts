/**
 * Utility System Exports
 */

// Item Target
export { ItemTarget, ItemTargets } from './ItemTarget';

// Recipe Target
export { RecipeTarget, simpleRecipeTarget } from './RecipeTarget';

// Smelt Target
export {
  SmeltTarget,
  SmeltTargets,
  smeltIronIngots,
  smeltGoldIngots,
  smeltCopperIngots,
  smeltCookedBeef,
  smeltCookedPorkchop,
  smeltCookedChicken,
  smeltCookedMutton,
  smeltCookedRabbit,
  smeltCookedCod,
  smeltCookedSalmon,
  smeltBakedPotato,
  smeltGlass,
  smeltCharcoal,
  smeltSmoothStone,
  smeltStone,
  smeltBrick,
  smeltNetherBrick,
  smeltDriedKelp,
} from './SmeltTarget';

// Armor Requirement
export {
  ArmorRequirement,
  ARMOR_SETS,
  ARMOR_PROTECTION,
  ARMOR_TOUGHNESS,
  getArmorItems,
  getArmorSet,
  getArmorTierIndex,
  compareArmorTiers,
  armorMeetsRequirement,
  getArmorTierFromItem,
  isArmorItem,
  getArmorSlotFromItem,
  getNextArmorTier,
  getMinimumTierForProtection,
} from './ArmorRequirement';
export type { ArmorSet } from './ArmorRequirement';

// Math Helper
export {
  projectVector,
  projectOntoPlane,
  calculateGenericHeuristic,
  calculateGenericHeuristicXYZ,
  clamp,
  lerp,
  lerpVec3,
  distanceSquared,
  distanceSquaredXZ,
  normalizeAngle,
  angleDifference,
  toRadians,
  toDegrees,
  yawFromDirection,
  pitchFromDirection,
  directionFromAngles,
} from './MathHelper';

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
  type SlotHandlerConfig,
} from './slot';

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

// Entity Helper
export {
  ENTITY_GRAVITY,
  isAngryAtPlayer,
  isGenerallyHostileToPlayer,
  isTradingPiglin,
  isGrounded,
  isPlayerGrounded,
  DamageSource,
  damageBypassesArmor,
  calculateArmorReduction,
  calculateProtectionReduction,
  calculateResultingPlayerDamage,
  getPlayerArmor,
  getPlayerArmorToughness,
  getPlayerProtectionLevel,
  getPlayerAbsorption,
  getEntityDistance,
  getEntityHorizontalDistance,
  isPlayer,
  isHostileMob,
  isPassiveMob,
  isNeutralMob,
  getNearestEntity,
  getEntitiesInRange,
  EntityHelperInstance,
  createEntityHelper,
} from './EntityHelper';

// Mining Requirement
export {
  MiningRequirement,
  PICKAXE_TIERS,
  MINIMUM_PICKAXE,
  getMinimumRequirementForBlock,
  getMinimumPickaxe,
  pickaxeMeetsRequirement,
  getPickaxeTier,
  isPickaxe as isPickaxeTool, // Alias to avoid conflict with ItemHelper.isPickaxe
  getSuitablePickaxes,
  compareMiningRequirements,
} from './MiningRequirement';

// Projectile Helper
export {
  ARROW_GRAVITY_ACCEL,
  THROWN_ENTITY_GRAVITY_ACCEL,
  FIREBALL_GRAVITY_ACCEL,
  ProjectileType,
  PROJECTILE_GRAVITY,
  hasGravity,
  getClosestPointOnFlatLine,
  getFlatDistanceSquared,
  getProjectileHeight,
  calculateArrowClosestApproach,
  calculateProjectileClosestApproach,
  calculateAnglesForSimpleProjectileMotion,
  getThrowOrigin,
  predictProjectilePosition,
  getTimeToDistance,
  willProjectileHit,
  calculateRequiredVelocity,
  type CachedProjectile,
} from './ProjectileHelper';
