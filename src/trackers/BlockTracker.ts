/**
 * BlockTracker - Async Block Scanning with Blacklisting
 * Based on AltoClef's BlockScanner.java
 *
 * Caches block positions for efficient queries. Features:
 * - Reference counting: trackBlock()/stopTracking() pairs
 * - Blacklisting: remember unreachable blocks
 * - Dimension-aware caching
 * - Async scanning to prevent frame drops
 * - Configurable scan intervals
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import type { Block } from 'prismarine-block';
import { AsyncTracker } from './Tracker';
import { TimerGame } from '../utils/timers/TimerGame';

/**
 * Configuration for BlockTracker
 */
export interface BlockTrackerConfig {
  /** Max cached positions per block type (default: 40) */
  maxPositionsPerBlock: number;
  /** Max total cached positions (default: 2500) */
  maxTotalCacheSize: number;
  /** Scan range in blocks (default: 128) */
  scanRange: number;
  /** Blocks to scan per tick during async update (default: 1000) */
  blocksPerTick: number;
  /** Rescan interval in seconds (default: 7) */
  rescanInterval: number;
  /** Rescan interval when new blocks found (default: 2) */
  rescanIntervalNewBlocks: number;
}

const DEFAULT_CONFIG: BlockTrackerConfig = {
  maxPositionsPerBlock: 40,
  maxTotalCacheSize: 2500,
  scanRange: 128,
  blocksPerTick: 1000,
  rescanInterval: 7,
  rescanIntervalNewBlocks: 2,
};

/**
 * Blacklist entry for unreachable blocks
 */
interface BlacklistEntry {
  position: Vec3;
  expireTime: number; // Server tick when this expires
  retryCount: number;
}

/**
 * Block position with distance for sorting
 */
interface TrackedPosition {
  pos: Vec3;
  distanceSq: number;
}

/**
 * BlockTracker - Caches block positions for efficient queries
 */
export class BlockTracker extends AsyncTracker {
  readonly displayName = 'BlockTracker';

  private config: BlockTrackerConfig;

  // Reference counting for tracked block types
  private trackingRefs: Map<string, number> = new Map();

  // Cached positions per block type
  private cache: Map<string, TrackedPosition[]> = new Map();

  // Blacklisted positions (unreachable)
  private blacklist: Map<string, BlacklistEntry> = new Map();

  // Async scanning state
  private scanIterator: Generator<void, void, unknown> | null = null;
  private scanProgress: number = 0;
  private totalBlocksToScan: number = 0;
  private blocksScanned: number = 0;

  // Rescan timer
  private rescanTimer: TimerGame;
  private foundNewBlocks: boolean = false;

  constructor(bot: Bot, config: Partial<BlockTrackerConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rescanTimer = new TimerGame(bot, this.config.rescanInterval);
  }

  /**
   * Start tracking a block type
   * Uses reference counting - call stopTracking() when done
   */
  trackBlock(blockName: string): void {
    const current = this.trackingRefs.get(blockName) ?? 0;
    this.trackingRefs.set(blockName, current + 1);

    // Initialize cache if needed
    if (!this.cache.has(blockName)) {
      this.cache.set(blockName, []);
    }

    // Trigger rescan
    this.setDirty();
  }

  /**
   * Stop tracking a block type
   */
  stopTracking(blockName: string): void {
    const current = this.trackingRefs.get(blockName) ?? 0;
    if (current <= 1) {
      this.trackingRefs.delete(blockName);
      this.cache.delete(blockName);
    } else {
      this.trackingRefs.set(blockName, current - 1);
    }
  }

  /**
   * Check if a block type is being tracked
   */
  isTracking(blockName: string): boolean {
    return (this.trackingRefs.get(blockName) ?? 0) > 0;
  }

  /**
   * Get tracked block types
   */
  getTrackedBlocks(): string[] {
    return Array.from(this.trackingRefs.keys());
  }

  /**
   * Check if any blocks of the given type are known
   */
  anyFound(blockName: string): boolean {
    this.ensureUpdated();
    const positions = this.cache.get(blockName);
    return positions !== undefined && positions.length > 0;
  }

  /**
   * Get the nearest known position of a block type
   * Returns null if none found or all blacklisted
   */
  getNearestBlock(blockName: string): Vec3 | null {
    this.ensureUpdated();
    const positions = this.cache.get(blockName);
    if (!positions || positions.length === 0) return null;

    // Filter out blacklisted positions
    const playerPos = this.bot.entity.position;
    for (const entry of positions) {
      const key = this.posKey(entry.pos);
      if (!this.blacklist.has(key)) {
        return entry.pos.clone();
      }
    }

    return null;
  }

  /**
   * Get all known positions of a block type (sorted by distance)
   */
  getKnownPositions(blockName: string, maxCount?: number): Vec3[] {
    this.ensureUpdated();
    const positions = this.cache.get(blockName);
    if (!positions) return [];

    const result: Vec3[] = [];
    for (const entry of positions) {
      const key = this.posKey(entry.pos);
      if (!this.blacklist.has(key)) {
        result.push(entry.pos.clone());
        if (maxCount && result.length >= maxCount) break;
      }
    }
    return result;
  }

  /**
   * Mark a block position as unreachable (blacklist)
   * @param pos The position to blacklist
   * @param delaySeconds How long to blacklist (0 = permanent until reset)
   */
  requestBlockUnreachable(pos: Vec3, delaySeconds: number = 60): void {
    const key = this.posKey(pos);
    const existing = this.blacklist.get(key);
    const retryCount = existing ? existing.retryCount + 1 : 1;

    // Exponential backoff for repeat failures
    const adjustedDelay = delaySeconds * Math.pow(1.5, retryCount - 1);
    const expireTime = delaySeconds === 0
      ? Number.MAX_SAFE_INTEGER
      : this.bot.time.age + (adjustedDelay * 20);

    this.blacklist.set(key, {
      position: pos.clone(),
      expireTime,
      retryCount,
    });
  }

  /**
   * Clear blacklist entry for a position
   */
  clearBlacklist(pos: Vec3): void {
    this.blacklist.delete(this.posKey(pos));
  }

  /**
   * Check if a position is blacklisted
   */
  isBlacklisted(pos: Vec3): boolean {
    const key = this.posKey(pos);
    const entry = this.blacklist.get(key);
    if (!entry) return false;

    // Check if expired
    if (this.bot.time.age > entry.expireTime) {
      this.blacklist.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Handle block updates (place/break)
   */
  onBlockUpdate(pos: Vec3, oldBlock: Block | null, newBlock: Block | null): void {
    // Remove old block from cache
    if (oldBlock && this.isTracking(oldBlock.name)) {
      this.removeFromCache(oldBlock.name, pos);
    }

    // Add new block to cache
    if (newBlock && this.isTracking(newBlock.name)) {
      this.addToCache(newBlock.name, pos);
      this.foundNewBlocks = true;
    }

    // Clear from blacklist on change
    this.blacklist.delete(this.posKey(pos));
  }

  /**
   * Clean up expired blacklist entries
   */
  private cleanBlacklist(): void {
    const now = this.bot.time.age;
    for (const [key, entry] of this.blacklist) {
      if (now > entry.expireTime) {
        this.blacklist.delete(key);
      }
    }
  }

  // ---- Async Update Implementation ----

  protected onAsyncUpdateStart(): void {
    this.scanIterator = this.createScanIterator();
    this.blocksScanned = 0;

    // Calculate total blocks to scan
    const range = this.config.scanRange;
    this.totalBlocksToScan = Math.pow(range * 2, 3);
  }

  protected doAsyncUpdateTick(): number {
    if (!this.scanIterator) return 1;

    // Process blocks for this tick
    for (let i = 0; i < this.config.blocksPerTick; i++) {
      const result = this.scanIterator.next();
      this.blocksScanned++;

      if (result.done) {
        return 1; // Complete
      }
    }

    return this.blocksScanned / this.totalBlocksToScan;
  }

  protected onAsyncUpdateComplete(): void {
    this.scanIterator = null;
    this.cleanBlacklist();

    // Adjust rescan interval based on whether new blocks were found
    const interval = this.foundNewBlocks
      ? this.config.rescanIntervalNewBlocks
      : this.config.rescanInterval;
    this.rescanTimer.resetWithInterval(interval);
    this.foundNewBlocks = false;
  }

  /**
   * Generator for async block scanning
   */
  private *createScanIterator(): Generator<void, void, unknown> {
    const playerPos = this.bot.entity.position;
    const range = this.config.scanRange;

    // Clear existing cache
    for (const blockName of this.cache.keys()) {
      this.cache.set(blockName, []);
    }

    // Scan in spiral pattern from player position
    const centerX = Math.floor(playerPos.x);
    const centerY = Math.floor(playerPos.y);
    const centerZ = Math.floor(playerPos.z);

    // Simple iteration - could be optimized to spiral
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        for (let dz = -range; dz <= range; dz++) {
          const x = centerX + dx;
          const y = centerY + dy;
          const z = centerZ + dz;

          // Skip if out of world bounds
          if (y < ((this.bot.game as any).minY ?? -64) || y > ((this.bot.game as any).maxY ?? 320)) continue;

          const pos = new Vec3(x, y, z);
          const block = this.bot.blockAt(pos);

          if (block && this.isTracking(block.name)) {
            this.addToCache(block.name, pos);
          }

          yield; // Yield control after each block
        }
      }
    }
  }

  protected override updateState(): void {
    // For non-async path, just mark for async update
    if (!this.isUpdateInProgress()) {
      this.onAsyncUpdateStart();
    }
  }

  // ---- Cache Management ----

  private addToCache(blockName: string, pos: Vec3): void {
    let positions = this.cache.get(blockName);
    if (!positions) {
      positions = [];
      this.cache.set(blockName, positions);
    }

    // Calculate distance
    const playerPos = this.bot.entity.position;
    const distanceSq = pos.distanceSquared(playerPos);

    // Check if already in cache
    const key = this.posKey(pos);
    for (const entry of positions) {
      if (this.posKey(entry.pos) === key) {
        entry.distanceSq = distanceSq;
        return;
      }
    }

    // Add new entry
    positions.push({ pos: pos.clone(), distanceSq });

    // Sort by distance
    positions.sort((a, b) => a.distanceSq - b.distanceSq);

    // Trim if too many
    if (positions.length > this.config.maxPositionsPerBlock) {
      positions.length = this.config.maxPositionsPerBlock;
    }
  }

  private removeFromCache(blockName: string, pos: Vec3): void {
    const positions = this.cache.get(blockName);
    if (!positions) return;

    const key = this.posKey(pos);
    const index = positions.findIndex(e => this.posKey(e.pos) === key);
    if (index !== -1) {
      positions.splice(index, 1);
    }
  }

  private posKey(pos: Vec3): string {
    return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
  }

  // ---- Reset ----

  reset(): void {
    this.cache.clear();
    this.blacklist.clear();
    this.scanIterator = null;
    this.foundNewBlocks = false;
    this.rescanTimer.reset();
  }

  // ---- Debug ----

  getDebugInfo(): string {
    const lines: string[] = [];
    lines.push(`BlockTracker (${this.trackingRefs.size} types tracked)`);
    lines.push(`Blacklist: ${this.blacklist.size} entries`);

    for (const [blockName, count] of this.trackingRefs) {
      const positions = this.cache.get(blockName);
      const posCount = positions?.length ?? 0;
      lines.push(`  ${blockName}: ${posCount} positions (refs: ${count})`);
    }

    return lines.join('\n');
  }
}
