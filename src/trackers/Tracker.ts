/**
 * Tracker - Lazy-Update Tracker Base Class
 * Based on AltoClef's Tracker.java
 *
 * Trackers cache expensive computations (world scanning, entity queries).
 * They use a "lazy update" pattern:
 * 1. TrackerManager marks all trackers dirty each tick
 * 2. Trackers only update when first accessed (ensureUpdated)
 * 3. Multiple accesses in same tick use cached data
 *
 * This prevents redundant scanning when multiple tasks query same data.
 */

import type { Bot } from 'mineflayer';

/**
 * Abstract base class for trackers
 */
export abstract class Tracker {
  protected bot: Bot;
  protected dirty: boolean = true;
  private enabled: boolean = true;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  /**
   * Display name for logging/debugging
   */
  abstract readonly displayName: string;

  /**
   * Ensure the tracker state is up-to-date.
   * Call this before accessing cached data.
   */
  protected ensureUpdated(): void {
    if (this.dirty && this.enabled) {
      this.updateState();
      this.dirty = false;
    }
  }

  /**
   * Mark the tracker as dirty (needs update).
   * Called by TrackerManager each tick.
   */
  setDirty(): void {
    this.dirty = true;
  }

  /**
   * Check if the tracker is currently dirty
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Perform the actual state update.
   * Override this in subclasses to implement scanning logic.
   */
  protected abstract updateState(): void;

  /**
   * Reset the tracker state.
   * Override in subclasses to clear cached data.
   */
  abstract reset(): void;

  /**
   * Enable or disable the tracker.
   * Disabled trackers don't update but still mark dirty.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  /**
   * Check if the tracker is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Force an immediate update, ignoring dirty state
   */
  forceUpdate(): void {
    if (this.enabled) {
      this.updateState();
      this.dirty = false;
    }
  }
}

/**
 * Tracker that updates over multiple ticks to prevent frame drops.
 * Useful for expensive operations like world scanning.
 */
export abstract class AsyncTracker extends Tracker {
  private updateInProgress: boolean = false;
  private updateProgress: number = 0;

  /**
   * Get the update progress (0 to 1)
   */
  getUpdateProgress(): number {
    return this.updateProgress;
  }

  /**
   * Check if an update is currently in progress
   */
  isUpdateInProgress(): boolean {
    return this.updateInProgress;
  }

  /**
   * Override ensureUpdated for async behavior
   */
  protected override ensureUpdated(): void {
    if (this.dirty && this.isEnabled()) {
      if (!this.updateInProgress) {
        this.startAsyncUpdate();
      }
    }
  }

  /**
   * Start an async update
   */
  private startAsyncUpdate(): void {
    this.updateInProgress = true;
    this.updateProgress = 0;
    this.onAsyncUpdateStart();
  }

  /**
   * Called when async update starts
   */
  protected onAsyncUpdateStart(): void {
    // Override in subclasses
  }

  /**
   * Continue the async update (call each tick)
   * @returns true if update is complete
   */
  tickAsyncUpdate(): boolean {
    if (!this.updateInProgress) return true;

    const progress = this.doAsyncUpdateTick();
    this.updateProgress = Math.min(1, progress);

    if (progress >= 1) {
      this.updateInProgress = false;
      this.dirty = false;
      this.onAsyncUpdateComplete();
      return true;
    }

    return false;
  }

  /**
   * Perform one tick of async update.
   * @returns Progress (0 to 1, >= 1 means complete)
   */
  protected abstract doAsyncUpdateTick(): number;

  /**
   * Called when async update completes
   */
  protected onAsyncUpdateComplete(): void {
    // Override in subclasses
  }

  /**
   * For async trackers, updateState starts the async process
   */
  protected override updateState(): void {
    this.startAsyncUpdate();
  }
}
