import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos, PathNode, PathResult, Goal } from './types';
import { CalculationContextImpl, ContextOptions } from './core/CalculationContext';
import { AStar } from './pathing/AStar';
import { PathExecutor } from './pathing/PathExecutor';
import { Favoring, buildFavoring, createAvoidances } from './pathing/Favoring';

// Re-export types and classes (excluding COST_INF to avoid conflict with ActionCosts)
export {
  BlockPos,
  PathNode,
  MovementStatus,
  Passability,
  PathingBlockType,
  PathResult,
  CalculationContext as CalculationContextInterface,
  Goal,
  Movement as MovementInterface,
  MutableMoveResult
} from './types';
export * from './goals';
export {
  WALK_ONE_BLOCK_COST,
  SPRINT_ONE_BLOCK_COST,
  SPRINT_MULTIPLIER,
  SNEAK_ONE_BLOCK_COST,
  WALK_ONE_IN_WATER_COST,
  WALK_ONE_OVER_SOUL_SAND_COST,
  LADDER_UP_ONE_COST,
  LADDER_DOWN_ONE_COST,
  SWIM_UP_ONE_COST,
  SWIM_DOWN_ONE_COST,
  JUMP_ONE_BLOCK_COST,
  WALK_OFF_BLOCK_COST,
  CENTER_AFTER_FALL_COST,
  SQRT_2,
  FALL_N_BLOCKS_COST,
  getFallCost,
  getBreakCost,
  getTerrainCost,
  PLACE_ONE_BLOCK_COST,
  BACKPLACE_ADDITIONAL_PENALTY
} from './core/ActionCosts';
export { CalculationContextImpl as CalculationContext } from './core/CalculationContext';
export { AStar } from './pathing/AStar';
export { PathExecutor } from './pathing/PathExecutor';
export { Favoring } from './pathing/Favoring';
export { PrecomputedData } from './cache/PrecomputedData';
export { ChunkCache, createBlockClassifier } from './cache/ChunkCache';
export {
  MovementTraverse,
  MovementAscend,
  MovementDescend,
  MovementDiagonal,
  MovementPillar,
  MovementParkour,
  MovementParkourAscend
} from './movements/Movement';

// Swimming movements
export {
  MovementSwimHorizontal,
  MovementSwimUp,
  MovementSwimDown,
  MovementWaterExit,
  MovementWaterEntry
} from './movements/MovementSwim';

// Door movements
export {
  MovementThroughDoor,
  MovementThroughFenceGate,
  MovementThroughTrapdoor,
  isDoor,
  isFenceGate,
  isTrapdoor,
  isOpenable,
  requiresRedstone
} from './movements/MovementDoor';

// Ladder/vine climbing movements
export {
  MovementClimbUp,
  MovementClimbDown,
  MovementMountLadder,
  MovementDismountLadder,
  isClimbable,
  isLadder,
  isVine
} from './movements/MovementClimb';

// Elytra flight controller and utilities
export {
  ElytraController,
  ElytraState,
  hasElytraEquipped,
  hasFireworkRockets,
  planElytraPath,
  isElytraViable,
  type ElytraPathSegment
} from './movements/MovementElytra';

// Boat travel controller and utilities
export {
  BoatController,
  BoatState,
  isInBoat,
  findNearbyBoat,
  hasBoatItem,
  planBoatPath,
  isBoatViable,
  type BoatPathSegment
} from './movements/MovementBoat';

// Path smoothing utilities
export {
  smoothPath,
  simplifyPath,
  calculatePathCost,
  calculatePathDistance,
  pathContains,
  findInPath,
  getPathSegment,
  mergePaths
} from './pathing/PathSmoother';

// Async pathfinding
export {
  AsyncPathfinder,
  AsyncPathState,
  computePathAsync,
  type AsyncPathOptions,
  type AsyncPathProgress
} from './pathing/AsyncPathfinder';

// Behavior/Process system
export {
  IProcess,
  BaseProcess,
  ProcessManager,
  ProcessPriority,
  ProcessState,
  type ProcessTickResult
} from './behavior/Process';
export { MineProcess, type MineConfig } from './behavior/MineProcess';
export { FollowProcess, type FollowConfig } from './behavior/FollowProcess';
export { ExploreProcess, type ExploreConfig } from './behavior/ExploreProcess';
export { GatherProcess, type GatherConfig } from './behavior/GatherProcess';
export { FarmProcess, type FarmConfig } from './behavior/FarmProcess';
export { BuildProcess, type BuildConfig, type PlaceInstruction } from './behavior/BuildProcess';
export { CombatProcess, type CombatConfig, type CombatMode } from './behavior/CombatProcess';

// Benchmarking utilities
export {
  benchmark,
  compareBenchmarks,
  formatResults,
  BenchmarkSuite,
  Timer,
  MemoryProfiler,
  type BenchmarkResult,
  type BenchmarkOptions
} from './benchmark';

// Debug/visualization utilities
export {
  PathDebugger,
  pathDebugger,
  visualizePath,
  visualizeSearchState,
  formatPathResult,
  tracePathSteps,
  type DebugEvent,
  type DebugEventType,
  type VisualizationOptions
} from './debug';

/**
 * Baritone-TS Pathfinder Plugin
 *
 * A high-quality pathfinding implementation for Mineflayer based on Baritone's design.
 *
 * Features:
 * - Tick-based cost model for accurate path selection
 * - Multi-coefficient A* with graceful degradation
 * - Specialized movement classes (Traverse, Ascend, Descend, Diagonal, Pillar, Parkour)
 * - Block precomputation for O(1) property lookups
 * - Favoring system with mob avoidance and backtrack penalties
 * - Path execution with movement skipping and sprint optimization
 */
export interface BaritonePathfinder {
  // Settings
  readonly ctx: CalculationContextImpl;

  // Pathfinding
  setGoal(goal: Goal | null, dynamic?: boolean): void;
  getGoal(): Goal | null;

  getPathTo(goal: Goal): PathResult;
  getPathFromTo(start: Vec3, goal: Goal): PathResult;

  // Execution
  goto(goal: Goal): Promise<void>;
  stop(): void;

  isMoving(): boolean;
  isDigging(): boolean;
  isPlacing(): boolean;

  // Events
  on(event: 'goal_reached', listener: (goal: Goal) => void): void;
  on(event: 'path_update', listener: (result: PathResult) => void): void;
  on(event: 'path_reset', listener: (reason: string) => void): void;
  on(event: 'path_stop', listener: () => void): void;
}

/**
 * Plugin state
 */
interface PathfinderState {
  goal: Goal | null;
  dynamicGoal: boolean;
  executor: PathExecutor | null;
  astarContext: AStar | null;
  computing: boolean;
  digging: boolean;
  placing: boolean;
  lastPath: PathNode[];
}

/**
 * Inject the pathfinder plugin into a Mineflayer bot
 */
export function pathfinder(bot: Bot, options: ContextOptions = {}): void {
  // Create calculation context
  const ctx = new CalculationContextImpl(bot, options);

  // Plugin state
  const state: PathfinderState = {
    goal: null,
    dynamicGoal: false,
    executor: null,
    astarContext: null,
    computing: false,
    digging: false,
    placing: false,
    lastPath: []
  };

  // Timeouts
  const thinkTimeout = 5000;  // ms, total pathfinding timeout
  const tickTimeout = 40;     // ms, per-tick computation limit

  /**
   * Set the current goal
   */
  function setGoal(goal: Goal | null, dynamic: boolean = false): void {
    state.goal = goal;
    state.dynamicGoal = dynamic;

    if (state.executor) {
      state.executor.cancel();
      state.executor = null;
    }

    state.lastPath = [];
    bot.emit('goal_updated' as any, goal, dynamic);
  }

  /**
   * Get current goal
   */
  function getGoal(): Goal | null {
    return state.goal;
  }

  /**
   * Calculate path to goal
   */
  function getPathTo(goal: Goal): PathResult {
    const pos = bot.entity.position;
    return getPathFromTo(pos, goal);
  }

  /**
   * Calculate path from start to goal
   */
  function getPathFromTo(start: Vec3, goal: Goal): PathResult {
    const startX = Math.floor(start.x);
    const startY = Math.floor(start.y);
    const startZ = Math.floor(start.z);

    // Update favoring with mob avoidance
    ctx.updateFavoring(state.lastPath, true);

    // Create A* instance
    const astar = new AStar(
      startX, startY, startZ,
      goal,
      ctx,
      thinkTimeout,
      thinkTimeout / 2  // Failure timeout is half of primary
    );

    state.astarContext = astar;

    // Compute until done or timeout
    let result = astar.compute(tickTimeout);
    while (result.status === 'partial') {
      result = astar.compute(tickTimeout);
    }

    state.lastPath = result.path;
    return result;
  }

  /**
   * Navigate to a goal
   */
  async function goto(goal: Goal): Promise<void> {
    return new Promise((resolve, reject) => {
      setGoal(goal, false);

      const onGoalReached = (reached: Goal) => {
        if (reached === goal) {
          cleanup();
          resolve();
        }
      };

      const onPathStop = () => {
        cleanup();
        reject(new Error('Path stopped'));
      };

      const cleanup = () => {
        bot.removeListener('goal_reached' as any, onGoalReached);
        bot.removeListener('path_stop' as any, onPathStop);
      };

      bot.on('goal_reached' as any, onGoalReached);
      bot.on('path_stop' as any, onPathStop);
    });
  }

  /**
   * Stop pathfinding
   */
  function stop(): void {
    if (state.executor) {
      state.executor.cancel();
      state.executor = null;
    }

    state.goal = null;
    state.lastPath = [];
    bot.clearControlStates();
    bot.emit('path_stop' as any);
  }

  /**
   * Physics tick handler
   */
  function onPhysicsTick(): void {
    // No goal, nothing to do
    if (!state.goal) return;

    // Check if goal is reached
    const pos = bot.entity.position;
    const blockPos = new BlockPos(
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z)
    );

    if (state.goal.isEnd(blockPos.x, blockPos.y, blockPos.z)) {
      if (!state.dynamicGoal) {
        bot.emit('goal_reached' as any, state.goal);
        state.goal = null;
        state.executor = null;
        bot.clearControlStates();
        return;
      }
    }

    // If we have an executor, run it
    if (state.executor) {
      const done = state.executor.onTick();
      if (done) {
        state.executor = null;

        // Check if we reached the goal
        if (state.goal?.isEnd(blockPos.x, blockPos.y, blockPos.z)) {
          if (!state.dynamicGoal) {
            bot.emit('goal_reached' as any, state.goal);
            state.goal = null;
          }
        } else {
          // Need to calculate new path
          bot.emit('path_reset' as any, 'execution_complete');
        }
      }
      return;
    }

    // Calculate path
    if (!state.computing) {
      state.computing = true;

      const result = getPathTo(state.goal);
      bot.emit('path_update' as any, result);

      state.computing = false;

      if (result.status === 'success' || result.status === 'partial') {
        state.executor = new PathExecutor(bot, ctx, result.path);
      } else if (result.status === 'noPath') {
        // No path found, emit event and clear goal
        bot.emit('path_reset' as any, 'no_path');
        if (!state.dynamicGoal) {
          state.goal = null;
        }
      }
    }
  }

  // Register physics tick handler
  bot.on('physicsTick', onPhysicsTick);

  // Clear tool cache on inventory changes
  bot.inventory.on('updateSlot' as any, () => {
    ctx.clearToolCache();
  });

  // Expose pathfinder API
  (bot as any).pathfinder = {
    ctx,
    setGoal,
    getGoal,
    getPathTo,
    getPathFromTo,
    goto,
    stop,
    isMoving: () => state.executor !== null,
    isDigging: () => state.digging,
    isPlacing: () => state.placing,

    // Settings shortcuts
    thinkTimeout,
    tickTimeout
  };
}

// Default export
export default pathfinder;

// ============================================================================
// AltoClef/BaritonePlus Feature Exports
// ============================================================================
// Hierarchical task system, survival chains, trackers, and utilities
// Based on architectural patterns from AltoClef and BaritonePlus Java projects

// ---- Task System ----
export {
  // Interfaces
  type ITask,
  type ITaskChain,
  type ITaskCanForce,
  type ITaskRequiresGrounded,
  type ITaskOverridesGrounded,
  // Utilities
  taskOverridesGrounded,
  isGroundedOrSafe,
  defaultGroundedShouldForce,
  // Task classes
  Task,
  WrapperTask,
  GroundedTask,
  // Chain classes
  TaskChain,
  SingleTaskChain,
  UserTaskChain,
  ChainPriority,
  // Task runner
  TaskRunner,
  createTaskRunner,
  type TaskRunnerEvents,
  // Resource tasks
  ResourceTask,
  CollectItemTask,
  GatherItemTask,
  MineAndCollectTask,
  ITEM_SOURCE_BLOCKS,
  createSourceBlockMap,
  type ResourceTaskConfig,
  // Task catalogue
  TaskCatalogue,
  createTaskCatalogue,
  getAcquisitionChain,
  SMELTING_RECIPES,
  getSmeltingRecipe,
  type TaskProvider,
  type SmeltingRecipe,
} from './tasks';

// ---- Tracker System ----
export {
  // Base trackers
  Tracker,
  AsyncTracker,
  // Tracker manager
  TrackerManager,
  createTrackerManager,
  // Block tracker
  BlockTracker,
  type BlockTrackerConfig,
  // Entity tracker
  EntityTracker,
  EntityCategory,
  type CachedProjectile,
  type ThreatInfo,
  // Storage tracker
  ItemStorageTracker,
  ContainerType,
  type ContainerCache,
  type CachedItem,
  type StorageTrackerConfig,
} from './trackers';

// ---- Chain System ----
export {
  FoodChain,
  type FoodChainConfig,
  WorldSurvivalChain,
  type WorldSurvivalConfig,
  MLGBucketChain,
  type MLGConfig,
  MobDefenseChain,
  type MobDefenseConfig,
} from './chains';

// ---- Event System ----
export {
  EventBus,
  HandlerPriority,
  createEventBus,
  createBotEventBridge,
  getGlobalEventBus,
  type EventTypes,
  type EventHandler,
} from './events';

// ---- Crafting System ----
export {
  CraftingRecipe,
  RecipeTarget,
  CraftingGridSize,
  COMMON_RECIPES,
  getRecipe,
  isCraftable,
  registerRecipe,
} from './crafting';

// ---- Settings System ----
export {
  type BotSettings,
  type PathfindingSettings,
  type CombatSettings,
  type FoodSettings,
  type SafetySettings,
  type MiningSettings,
  type StorageSettings,
  type MiscSettings,
  DEFAULT_SETTINGS,
  DEFAULT_PATHFINDING,
  DEFAULT_COMBAT,
  DEFAULT_FOOD,
  DEFAULT_SAFETY,
  DEFAULT_MINING,
  DEFAULT_STORAGE,
  DEFAULT_MISC,
  mergeSettings,
  validateSettings,
  SettingsManager,
  createSettingsManager,
  getGlobalSettingsManager,
  setGlobalSettingsManager,
  type SettingsChangeCallback,
  type SettingsManagerConfig,
} from './settings';

// ---- Utility System (AltoClef additions) ----
export {
  // Item Target
  ItemTarget,
  ItemTargets,
  // Storage Helper
  StorageHelper,
  SlotType,
  SLOT_MAPPINGS,
  // Slot Handler
  SlotHandler,
  ClickType,
  Slot,
  PlayerInventorySlot,
  ArmorSlot,
  OffhandSlot,
  ContainerSlot,
  createSlotHandler,
  type SlotHandlerConfig,
  // Look Helper
  LookHelper,
  createLookHelper,
  calculateLookRotation,
  getEyeDistance,
  type LookRotation,
  type LookConfig,
  // Timers
  BaseTimer,
  TimerGame,
  TimerReal,
  Stopwatch,
  createGameTimer,
  createRealTimer,
  // Progress Checkers
  type IProgressChecker,
  withRetry,
  LinearProgressChecker,
  DistanceProgressChecker,
  createApproachChecker,
  createMovementChecker,
  MovementProgressChecker,
  ProgressCheckerRetry,
} from './utils';
