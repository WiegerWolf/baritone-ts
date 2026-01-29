/**
 * Task System Exports
 */

export type {
  ITask,
  ITaskChain,
  ITaskCanForce,
  ITaskRequiresGrounded,
  ITaskOverridesGrounded,
} from './interfaces';
export {
  taskOverridesGrounded,
  isGroundedOrSafe,
  defaultGroundedShouldForce,
} from './interfaces';
export { Task, WrapperTask, GroundedTask } from './base';
export {
  TaskChain,
  SingleTaskChain,
  UserTaskChain,
  ChainPriority,
} from './chain';
export {
  TaskRunner,
  createTaskRunner,
  type TaskRunnerEvents,
} from './TaskRunner';
export {
  ResourceTask,
  CollectItemTask,
  GatherItemTask,
  MineAndCollectTask,
  ITEM_SOURCE_BLOCKS,
  createSourceBlockMap,
  type ResourceTaskConfig,
} from './resource';
export {
  TaskCatalogue,
  createTaskCatalogue,
  getAcquisitionChain,
  SMELTING_RECIPES,
  getSmeltingRecipe,
  type TaskProvider,
  type SmeltingRecipe,
} from './TaskCatalogue';

// Concrete task implementations
export {
  // Navigation
  GoToTask,
  GoToBlockTask,
  GetToBlockTask,
  GoToNearTask,
  GoToXZTask,
  FollowEntityTask,
  // Mining
  MineBlockTask,
  MineBlockTypeTask,
  // Placement
  PlaceBlockTask,
  PlaceAgainstTask,
  // Crafting
  CraftTask,
  EnsureItemTask,
  // Smelting
  SmeltTask,
  isFuel,
  getFuelBurnTime,
  // Inventory
  EquipmentSlot,
  PickupItemTask,
  EquipTask,
  DropItemTask,
  MoveItemTask,
  // Interaction
  InteractBlockTask,
  InteractEntityTask,
  AttackEntityTask,
  UseItemTask,
} from './concrete';

// Composite task implementations
export {
  CollectWoodTask,
  GetToolTask,
  ensureTool,
  GatherResourcesTask,
  gatherResources,
  MineOresTask,
  mineDiamonds,
  mineIron,
  mineCoal,
  mineGold,
  mineAllOres,
  FarmTask,
  FarmMode,
  harvestCrops,
  harvestAndReplant,
  maintainFarm,
  harvestWheat,
  ExploreTask,
  ExplorePattern,
  exploreSpiral,
  exploreTowards,
  exploreRandom,
  exploreArea,
  BuildShelterTask,
  ShelterType,
  buildDirtHut,
  buildWoodCabin,
  digUnderground,
  buildEmergencyShelter,
  CombatTask,
  CombatStyle,
  fightMobs,
  fightEntity,
  hitAndRun,
  defensiveCombat,
  SurviveTask,
  SurvivalPriority,
  survive,
  survivePassive,
  surviveAndProgress,
  type ToolType,
  type GatherConfig,
  type MineOreConfig,
  type FarmConfig,
  type ExploreConfig,
  type ShelterConfig,
  type CombatConfig,
  type SurvivalGoals,
} from './composite';

// Beat Minecraft task
export {
  BeatMinecraftTask,
  beatMinecraft,
  speedrunMinecraft,
  BeatMinecraftState,
  BEAT_MINECRAFT_DEFAULT_CONFIG,
  type BeatMinecraftConfig,
} from './concrete';
