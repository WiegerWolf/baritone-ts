/**
 * SettingsManager - JSON Persistence with Hot-Reload
 * Based on AltoClef's Settings system
 *
 * Features:
 * - Load settings from JSON file
 * - Save settings to JSON file
 * - Hot-reload on file changes
 * - Merge with defaults for missing values
 * - Validation on load
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  BotSettings,
  DEFAULT_SETTINGS,
  mergeSettings,
  validateSettings,
} from './BotSettings';

/**
 * Settings change callback
 */
export type SettingsChangeCallback = (
  oldSettings: BotSettings,
  newSettings: BotSettings
) => void;

/**
 * SettingsManager configuration
 */
export interface SettingsManagerConfig {
  /** Path to settings file */
  filePath: string;
  /** Enable hot-reload */
  hotReload: boolean;
  /** Hot-reload check interval (ms) */
  hotReloadInterval: number;
  /** Create file if not exists */
  createIfMissing: boolean;
  /** Log changes to console */
  logChanges: boolean;
}

const DEFAULT_CONFIG: SettingsManagerConfig = {
  filePath: './settings.json',
  hotReload: true,
  hotReloadInterval: 1000,
  createIfMissing: true,
  logChanges: false,
};

/**
 * SettingsManager - Manages bot configuration with file persistence
 */
export class SettingsManager {
  private config: SettingsManagerConfig;
  private settings: BotSettings;
  private lastMtime: number = 0;
  private watchInterval: NodeJS.Timer | null = null;
  private changeCallbacks: SettingsChangeCallback[] = [];

  constructor(config: Partial<SettingsManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.settings = this.load();

    if (this.config.hotReload) {
      this.startHotReload();
    }
  }

  /**
   * Get current settings
   */
  get(): BotSettings {
    return this.settings;
  }

  /**
   * Get a specific setting section
   */
  getSection<K extends keyof BotSettings>(section: K): BotSettings[K] {
    return this.settings[section];
  }

  /**
   * Update settings (partial update)
   */
  update(updates: Partial<BotSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = mergeSettings(this.settings, updates);
    this.notifyChange(oldSettings, this.settings);
  }

  /**
   * Save current settings to file
   */
  save(): void {
    try {
      const dir = path.dirname(this.config.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const json = JSON.stringify(this.settings, null, 2);
      fs.writeFileSync(this.config.filePath, json, 'utf-8');

      if (this.config.logChanges) {
        console.log(`[SettingsManager] Saved settings to ${this.config.filePath}`);
      }
    } catch (err) {
      console.error(`[SettingsManager] Failed to save settings:`, err);
    }
  }

  /**
   * Reload settings from file
   */
  reload(): void {
    const oldSettings = { ...this.settings };
    this.settings = this.load();

    // Check if settings actually changed
    if (JSON.stringify(oldSettings) !== JSON.stringify(this.settings)) {
      this.notifyChange(oldSettings, this.settings);
    }
  }

  /**
   * Reset settings to defaults
   */
  reset(): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...DEFAULT_SETTINGS };
    this.notifyChange(oldSettings, this.settings);
  }

  /**
   * Subscribe to settings changes
   */
  onChange(callback: SettingsChangeCallback): () => void {
    this.changeCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.changeCallbacks.indexOf(callback);
      if (index !== -1) {
        this.changeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Start hot-reload watching
   */
  startHotReload(): void {
    if (this.watchInterval) return;

    this.watchInterval = setInterval(() => {
      this.checkForChanges();
    }, this.config.hotReloadInterval);

    if (this.config.logChanges) {
      console.log(`[SettingsManager] Hot-reload enabled (${this.config.hotReloadInterval}ms)`);
    }
  }

  /**
   * Stop hot-reload watching
   */
  stopHotReload(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;

      if (this.config.logChanges) {
        console.log('[SettingsManager] Hot-reload disabled');
      }
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopHotReload();
    this.changeCallbacks = [];
  }

  /**
   * Load settings from file
   */
  private load(): BotSettings {
    try {
      // Check if file exists
      if (!fs.existsSync(this.config.filePath)) {
        if (this.config.createIfMissing) {
          // Create with defaults
          this.settings = { ...DEFAULT_SETTINGS };
          this.save();
          return this.settings;
        }
        return { ...DEFAULT_SETTINGS };
      }

      // Read and parse
      const json = fs.readFileSync(this.config.filePath, 'utf-8');
      const parsed = JSON.parse(json) as Partial<BotSettings>;

      // Validate
      const errors = validateSettings(parsed);
      if (errors.length > 0) {
        console.warn('[SettingsManager] Settings validation warnings:');
        for (const error of errors) {
          console.warn(`  - ${error}`);
        }
      }

      // Merge with defaults
      const merged = mergeSettings(DEFAULT_SETTINGS, parsed);

      // Update mtime for hot-reload
      const stat = fs.statSync(this.config.filePath);
      this.lastMtime = stat.mtimeMs;

      if (this.config.logChanges) {
        console.log(`[SettingsManager] Loaded settings from ${this.config.filePath}`);
      }

      return merged;
    } catch (err) {
      console.error(`[SettingsManager] Failed to load settings:`, err);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Check for file changes (hot-reload)
   */
  private checkForChanges(): void {
    try {
      if (!fs.existsSync(this.config.filePath)) return;

      const stat = fs.statSync(this.config.filePath);
      if (stat.mtimeMs > this.lastMtime) {
        if (this.config.logChanges) {
          console.log('[SettingsManager] Settings file changed, reloading...');
        }
        this.reload();
        this.lastMtime = stat.mtimeMs;
      }
    } catch {
      // Ignore errors during hot-reload check
    }
  }

  /**
   * Notify all callbacks of settings change
   */
  private notifyChange(oldSettings: BotSettings, newSettings: BotSettings): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback(oldSettings, newSettings);
      } catch (err) {
        console.error('[SettingsManager] Error in change callback:', err);
      }
    }

    if (this.config.logChanges) {
      console.log('[SettingsManager] Settings changed');
    }
  }
}

/**
 * Create a settings manager with default path
 */
export function createSettingsManager(
  filePath: string = './settings.json',
  hotReload: boolean = true
): SettingsManager {
  return new SettingsManager({ filePath, hotReload });
}

/**
 * Global settings manager instance (optional singleton)
 */
let globalSettingsManager: SettingsManager | null = null;

/**
 * Get or create global settings manager
 */
export function getGlobalSettingsManager(
  filePath: string = './settings.json'
): SettingsManager {
  if (!globalSettingsManager) {
    globalSettingsManager = createSettingsManager(filePath);
  }
  return globalSettingsManager;
}

/**
 * Set global settings manager
 */
export function setGlobalSettingsManager(manager: SettingsManager): void {
  globalSettingsManager = manager;
}
