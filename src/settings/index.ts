/**
 * Settings System Exports
 */

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
} from './BotSettings';

export {
  SettingsManager,
  createSettingsManager,
  getGlobalSettingsManager,
  setGlobalSettingsManager,
  type SettingsChangeCallback,
  type SettingsManagerConfig,
} from './SettingsManager';
