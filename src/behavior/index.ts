/**
 * Behavior module exports
 */
export {
  IProcess,
  BaseProcess,
  ProcessManager,
  ProcessPriority,
  ProcessState,
  type ProcessTickResult
} from './process';

export { MineProcess, type MineConfig } from './MineProcess';
export { FollowProcess, type FollowConfig } from './FollowProcess';
export { ExploreProcess, type ExploreConfig } from './ExploreProcess';
export { GatherProcess, type GatherConfig } from './GatherProcess';
export { FarmProcess, type FarmConfig } from './FarmProcess';
export { BuildProcess, type BuildConfig, type PlaceInstruction } from './BuildProcess';
export { CombatProcess, type CombatConfig, type CombatMode } from './CombatProcess';

// Bot Behaviour (runtime configuration)
export {
  BotBehaviour,
  createBotBehaviour,
  type EntityPredicate,
  type BlockPosPredicate,
  type ForceToolPredicate,
  type HeuristicModifier,
  type ConversionSlot,
  type BehaviourState,
} from './BotBehaviour';
