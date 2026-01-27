/**
 * Composite Task Exports
 *
 * High-level tasks that combine multiple concrete tasks
 * to accomplish complex goals.
 */

export { CollectWoodTask } from './CollectWoodTask';
export { GetToolTask, ensureTool, type ToolType } from './GetToolTask';
export {
  GatherResourcesTask,
  gatherResources,
  type GatherConfig,
} from './GatherResourcesTask';
export {
  MineOresTask,
  mineDiamonds,
  mineIron,
  mineCoal,
  mineGold,
  mineAllOres,
  type MineOreConfig,
} from './MineOresTask';
export {
  FarmTask,
  FarmMode,
  harvestCrops,
  harvestAndReplant,
  maintainFarm,
  harvestWheat,
  type FarmConfig,
} from './FarmTask';
export {
  ExploreTask,
  ExplorePattern,
  exploreSpiral,
  exploreTowards,
  exploreRandom,
  exploreArea,
  type ExploreConfig,
} from './ExploreTask';
export {
  BuildShelterTask,
  ShelterType,
  buildDirtHut,
  buildWoodCabin,
  digUnderground,
  buildEmergencyShelter,
  type ShelterConfig,
} from './BuildShelterTask';
export {
  CombatTask,
  CombatStyle,
  fightMobs,
  fightEntity,
  hitAndRun,
  defensiveCombat,
  type CombatConfig,
} from './CombatTask';
export {
  SurviveTask,
  SurvivalPriority,
  survive,
  survivePassive,
  surviveAndProgress,
  type SurvivalGoals,
} from './SurviveTask';
export {
  TradingTask,
  tradeWithVillager,
  buyItem,
  sellItem,
  tradeWithLibrarian,
  type TradingConfig,
} from './TradingTask';
export {
  EnchantTask,
  enchantItem,
  enchantBestAvailable,
  enchantCheap,
  type EnchantConfig,
} from './EnchantTask';
export {
  BrewingTask,
  brewPotion,
  brewHealingPotions,
  brewStrengthPotions,
  brewFireResistance,
  brewSpeedPotions,
  type BrewingConfig,
} from './BrewingTask';
export {
  BuildTask,
  BUILD_PATTERNS,
  buildCube,
  buildPlatform,
  buildWall,
  buildFromPattern,
  type BuildConfig,
  type BuildPattern,
  type BlockPlacement,
} from './BuildTask';
export {
  RepairTask,
  RepairMethod,
  repairWithAnvil,
  repairWithGrindstone,
  combineItems,
  repairDamagedItems,
  type RepairConfig,
} from './RepairTask';
export {
  StorageTask,
  StorageOperation,
  depositItems,
  depositAll,
  withdrawItems,
  organizeStorage,
  depositKeepMinimum,
  type StorageConfig,
} from './StorageTask';
export {
  ElytraTask,
  FlightPhase,
  flyToXZ,
  flyToPosition,
  flyHighAltitude,
  flyLowAltitude,
  type ElytraConfig,
} from './ElytraTask';
export {
  PortalTask,
  PortalType,
  Dimension,
  enterNether,
  enterEnd,
  buildAndEnterNether,
  findNearestPortal,
  type PortalConfig,
} from './PortalTask';
export {
  FishingTask,
  goFishing,
  fishUntilFull,
  fishForFood,
  type FishingConfig,
} from './FishingTask';
export {
  SleepTask,
  sleepInBed,
  sleepNow,
  setSpawnAndSleep,
  sleepWithoutPlacing,
  type SleepConfig,
} from './SleepTask';
export {
  BoatTask,
  boatToPosition,
  boatToVec3,
  enterNearestBoat,
  type BoatConfig,
} from './BoatTask';
export {
  ParkourTask,
  ParkourMoveType,
  parkourTo,
  sprintJumpTo,
  escapeWater,
  climbLadder,
  type ParkourConfig,
} from './ParkourTask';
export {
  SchematicTask,
  createEmptySchematic,
  createSchematic,
  createCubeSchematic,
  createHollowBoxSchematic,
  createWallSchematic,
  buildSchematic,
  buildCube as buildSchematicCube,
  buildHollowBox,
  buildWall as buildSchematicWall,
  type Schematic,
  type SchematicBlock,
  type SchematicConfig,
} from './SchematicTask';
export {
  DragonFightTask,
  fightDragon,
  fightDragonWithBeds,
  fightDragonSafe,
  type DragonFightConfig,
} from './DragonFightTask';
export {
  StrongholdTask,
  findStronghold,
  findStrongholdQuick,
  findStrongholdPrecise,
  type StrongholdConfig,
} from './StrongholdTask';
export {
  HuntTask,
  huntAnimals,
  huntForFood,
  huntCows,
  huntForLeather,
  huntChickens,
  type HuntConfig,
} from './HuntTask';
export {
  DefendAreaTask,
  defendArea,
  defendCurrentPosition,
  defendForDuration,
  defendWithPatrol,
  defendStationary,
  type DefendAreaConfig,
} from './DefendAreaTask';
export {
  FollowPlayerTask,
  followPlayer,
  followPlayerClose,
  followPlayerFar,
  followPlayerForDuration,
  followPlayerWithMimic,
  type FollowPlayerConfig,
} from './FollowPlayerTask';
