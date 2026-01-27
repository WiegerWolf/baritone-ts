/**
 * TrackerManager - Tracker Lifecycle Manager
 * Based on AltoClef's TrackerManager.java
 *
 * Manages multiple trackers and marks them all dirty each tick.
 * Also handles dimension changes and world resets.
 */

import type { Bot } from 'mineflayer';
import { Tracker, AsyncTracker } from './Tracker';

/**
 * Manages tracker lifecycle and updates
 */
export class TrackerManager {
  private bot: Bot;
  private trackers: Tracker[] = [];
  private asyncTrackers: AsyncTracker[] = [];
  private running: boolean = false;
  private lastDimension: string | null = null;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  /**
   * Register a tracker to be managed
   */
  register(tracker: Tracker): void {
    if (!this.trackers.includes(tracker)) {
      this.trackers.push(tracker);

      if (tracker instanceof AsyncTracker) {
        this.asyncTrackers.push(tracker);
      }
    }
  }

  /**
   * Unregister a tracker
   */
  unregister(tracker: Tracker): void {
    const index = this.trackers.indexOf(tracker);
    if (index !== -1) {
      this.trackers.splice(index, 1);
    }

    if (tracker instanceof AsyncTracker) {
      const asyncIndex = this.asyncTrackers.indexOf(tracker);
      if (asyncIndex !== -1) {
        this.asyncTrackers.splice(asyncIndex, 1);
      }
    }
  }

  /**
   * Get all registered trackers
   */
  getTrackers(): readonly Tracker[] {
    return this.trackers;
  }

  /**
   * Mark all trackers as dirty.
   * Called each tick before task processing.
   */
  tick(): void {
    // Check for dimension change
    this.checkDimensionChange();

    // Mark all trackers dirty
    for (const tracker of this.trackers) {
      tracker.setDirty();
    }

    // Tick async trackers
    for (const tracker of this.asyncTrackers) {
      if (tracker.isUpdateInProgress()) {
        tracker.tickAsyncUpdate();
      }
    }
  }

  /**
   * Reset all trackers (e.g., on dimension change)
   */
  resetAll(): void {
    for (const tracker of this.trackers) {
      tracker.reset();
    }
  }

  /**
   * Check for dimension changes and reset if needed
   */
  private checkDimensionChange(): void {
    const currentDimension = this.bot.game?.dimension ?? null;

    if (currentDimension !== this.lastDimension) {
      if (this.lastDimension !== null) {
        // Dimension changed - reset all trackers
        this.resetAll();
      }
      this.lastDimension = currentDimension;
    }
  }

  /**
   * Start the tracker manager (attaches to bot events)
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Track dimension changes
    this.bot.on('game', this.onGameEvent);
  }

  /**
   * Stop the tracker manager
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    this.bot.removeListener('game', this.onGameEvent);
  }

  /**
   * Handle game events (dimension changes)
   */
  private onGameEvent = (): void => {
    this.checkDimensionChange();
  };

  /**
   * Get debug information
   */
  getDebugInfo(): string {
    const lines: string[] = [];
    lines.push(`TrackerManager (${this.trackers.length} trackers)`);
    lines.push(`Dimension: ${this.lastDimension ?? 'unknown'}`);

    for (const tracker of this.trackers) {
      const dirty = tracker.isDirty() ? ' [dirty]' : '';
      const enabled = tracker.isEnabled() ? '' : ' [disabled]';
      let async = '';
      if (tracker instanceof AsyncTracker && tracker.isUpdateInProgress()) {
        async = ` [updating ${Math.floor(tracker.getUpdateProgress() * 100)}%]`;
      }
      lines.push(`  ${tracker.displayName}${dirty}${enabled}${async}`);
    }

    return lines.join('\n');
  }
}

/**
 * Create a tracker manager for a bot
 */
export function createTrackerManager(bot: Bot): TrackerManager {
  return new TrackerManager(bot);
}
