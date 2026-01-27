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
export { Task, WrapperTask, GroundedTask } from './Task';
export {
  TaskChain,
  SingleTaskChain,
  UserTaskChain,
  ChainPriority,
} from './TaskChain';
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
} from './ResourceTask';
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
  type ToolType,
  type GatherConfig,
} from './composite';
