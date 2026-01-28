/**
 * AbstractObjectBlacklist - Intelligent Failure Tracking
 * Based on AltoClef/BaritonePlus AbstractObjectBlacklist.java
 *
 * Sometimes we will try to access something and fail TOO many times.
 * This lets us know that an object is unreachable, and will ignore it
 * from searches intelligently.
 *
 * The blacklist resets failures when:
 * - We get significantly closer to the target
 * - We acquire a better tool (higher mining requirement)
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { MiningRequirement, getPickaxeTier } from '../../utils/MiningRequirement';

/**
 * Entry tracking failure attempts for a single object
 */
interface BlacklistEntry {
  /** Maximum failures allowed before considered unreachable */
  numberOfFailuresAllowed: number;
  /** Current failure count */
  numberOfFailures: number;
  /** Best (closest) squared distance we've achieved */
  bestDistanceSq: number;
  /** Best tool tier we've had when attempting */
  bestTool: MiningRequirement;
}

/**
 * Abstract base class for blacklisting unreachable objects
 * @typeParam T The type of object being blacklisted
 */
export abstract class AbstractObjectBlacklist<T> {
  protected bot: Bot;
  private entries: Map<string, BlacklistEntry> = new Map();

  constructor(bot: Bot) {
    this.bot = bot;
  }

  /**
   * Get the position of an object (for distance calculations)
   */
  protected abstract getPos(item: T): Vec3;

  /**
   * Get a unique key for an object
   */
  protected abstract getKey(item: T): string;

  /**
   * Record a failure to access an object
   * @param item The object that couldn't be accessed
   * @param numberOfFailuresAllowed Max failures before blacklisting
   */
  blacklistItem(item: T, numberOfFailuresAllowed: number = 3): void {
    const key = this.getKey(item);
    let entry = this.entries.get(key);

    if (!entry) {
      entry = {
        numberOfFailuresAllowed,
        numberOfFailures: 0,
        bestDistanceSq: Number.POSITIVE_INFINITY,
        bestTool: MiningRequirement.HAND,
      };
      this.entries.set(key, entry);
    }

    const playerPos = this.bot.entity.position;
    const itemPos = this.getPos(item);
    const newDistanceSq = playerPos.distanceSquared(itemPos);
    const newTool = this.getCurrentMiningRequirement();

    // For distance, add a slight threshold so it doesn't reset EVERY time
    // we move a tiny bit closer
    const shouldReset =
      newTool > entry.bestTool ||
      newDistanceSq < entry.bestDistanceSq - 1;

    if (shouldReset) {
      if (newTool > entry.bestTool) {
        entry.bestTool = newTool;
      }
      if (newDistanceSq < entry.bestDistanceSq) {
        entry.bestDistanceSq = newDistanceSq;
      }
      entry.numberOfFailures = 0;
    }

    entry.numberOfFailures++;
    entry.numberOfFailuresAllowed = numberOfFailuresAllowed;
  }

  /**
   * Check if an object has exceeded its failure limit
   */
  unreachable(item: T): boolean {
    const key = this.getKey(item);
    const entry = this.entries.get(key);

    if (!entry) {
      return false;
    }

    return entry.numberOfFailures > entry.numberOfFailuresAllowed;
  }

  /**
   * Check if an object is being tracked (has any failures)
   */
  isTracked(item: T): boolean {
    return this.entries.has(this.getKey(item));
  }

  /**
   * Get the current failure count for an object
   */
  getFailureCount(item: T): number {
    const entry = this.entries.get(this.getKey(item));
    return entry?.numberOfFailures ?? 0;
  }

  /**
   * Clear blacklist entry for a specific object
   */
  clearItem(item: T): void {
    this.entries.delete(this.getKey(item));
  }

  /**
   * Clear all blacklist entries
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get the number of tracked items
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Get all currently blacklisted keys
   */
  getBlacklistedKeys(): string[] {
    const result: string[] = [];
    for (const [key, entry] of this.entries) {
      if (entry.numberOfFailures > entry.numberOfFailuresAllowed) {
        result.push(key);
      }
    }
    return result;
  }

  /**
   * Get the current mining requirement based on equipped tools
   */
  private getCurrentMiningRequirement(): MiningRequirement {
    // Check held item
    const heldItem = this.bot.heldItem;
    if (heldItem) {
      const tier = getPickaxeTier(heldItem.name);
      if (tier > MiningRequirement.HAND) {
        return tier;
      }
    }

    // Check inventory for best pickaxe
    let bestTier = MiningRequirement.HAND;
    for (const item of this.bot.inventory.items()) {
      const tier = getPickaxeTier(item.name);
      if (tier > bestTier) {
        bestTier = tier;
      }
    }

    return bestTier;
  }
}

export default AbstractObjectBlacklist;
