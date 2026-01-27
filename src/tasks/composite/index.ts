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
