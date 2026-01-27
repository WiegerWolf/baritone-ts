import { PathingBlockType, BlockPos } from '../types';
import type { Bot } from 'mineflayer';

/**
 * ChunkCache provides 2-bit encoded block type caching for fast pathfinding lookups
 * Based on Baritone's CachedWorld/CachedRegion system
 *
 * Each block is stored as 2 bits:
 * - 00 (AIR): Passable, not water
 * - 01 (WATER): Passable, is water
 * - 10 (AVOID): Impassable, should be avoided (lava, fire, etc.)
 * - 11 (SOLID): Impassable, solid block
 *
 * This gives 4 blocks per byte, 4096 blocks per chunk section (16x16x16)
 * = 1024 bytes per section = 1KB per 16 Y-levels
 */

const SECTION_SIZE = 16;
const BLOCKS_PER_BYTE = 4;
const SECTION_BYTES = (SECTION_SIZE * SECTION_SIZE * SECTION_SIZE) / BLOCKS_PER_BYTE; // 1024 bytes

/**
 * Cached chunk section (16x16x16 blocks)
 */
class CachedSection {
  private data: Uint8Array;
  private timestamp: number;

  constructor() {
    this.data = new Uint8Array(SECTION_BYTES);
    this.timestamp = Date.now();
  }

  /**
   * Get the 2-bit block type at local coordinates
   */
  getBlockType(localX: number, localY: number, localZ: number): PathingBlockType {
    const index = localY * 256 + localZ * 16 + localX;
    const byteIndex = Math.floor(index / BLOCKS_PER_BYTE);
    const bitOffset = (index % BLOCKS_PER_BYTE) * 2;
    return (this.data[byteIndex] >> bitOffset) & 0b11;
  }

  /**
   * Set the 2-bit block type at local coordinates
   */
  setBlockType(localX: number, localY: number, localZ: number, type: PathingBlockType): void {
    const index = localY * 256 + localZ * 16 + localX;
    const byteIndex = Math.floor(index / BLOCKS_PER_BYTE);
    const bitOffset = (index % BLOCKS_PER_BYTE) * 2;

    // Clear existing bits and set new value
    const mask = ~(0b11 << bitOffset);
    this.data[byteIndex] = (this.data[byteIndex] & mask) | (type << bitOffset);
    this.timestamp = Date.now();
  }

  /**
   * Fill section with a single type (for initialization)
   */
  fill(type: PathingBlockType): void {
    const fillValue = type | (type << 2) | (type << 4) | (type << 6);
    this.data.fill(fillValue);
    this.timestamp = Date.now();
  }

  /**
   * Get age of this cached section in milliseconds
   */
  getAge(): number {
    return Date.now() - this.timestamp;
  }

  /**
   * Mark as recently accessed
   */
  touch(): void {
    this.timestamp = Date.now();
  }

  /**
   * Get raw data for serialization
   */
  getRawData(): Uint8Array {
    return this.data;
  }

  /**
   * Set raw data from deserialization
   */
  setRawData(data: Uint8Array): void {
    this.data.set(data);
    this.timestamp = Date.now();
  }
}

/**
 * Cached chunk column (16x384x16 in modern MC, 16x256x16 in older)
 */
class CachedColumn {
  private sections: Map<number, CachedSection> = new Map();
  private minY: number;
  private maxY: number;

  constructor(minY: number = -64, maxY: number = 320) {
    this.minY = minY;
    this.maxY = maxY;
  }

  /**
   * Get section for a Y coordinate, creating if necessary
   */
  private getOrCreateSection(y: number): CachedSection {
    const sectionY = Math.floor(y / SECTION_SIZE);
    let section = this.sections.get(sectionY);
    if (!section) {
      section = new CachedSection();
      this.sections.set(sectionY, section);
    }
    return section;
  }

  /**
   * Get block type at position
   */
  getBlockType(x: number, y: number, z: number): PathingBlockType | null {
    const sectionY = Math.floor(y / SECTION_SIZE);
    const section = this.sections.get(sectionY);
    if (!section) return null;

    const localX = ((x % 16) + 16) % 16;
    const localY = ((y % 16) + 16) % 16;
    const localZ = ((z % 16) + 16) % 16;
    return section.getBlockType(localX, localY, localZ);
  }

  /**
   * Set block type at position
   */
  setBlockType(x: number, y: number, z: number, type: PathingBlockType): void {
    const section = this.getOrCreateSection(y);
    const localX = ((x % 16) + 16) % 16;
    const localY = ((y % 16) + 16) % 16;
    const localZ = ((z % 16) + 16) % 16;
    section.setBlockType(localX, localY, localZ, type);
  }

  /**
   * Check if section at Y level exists
   */
  hasSection(y: number): boolean {
    const sectionY = Math.floor(y / SECTION_SIZE);
    return this.sections.has(sectionY);
  }

  /**
   * Get all section Y indices
   */
  getSectionYs(): number[] {
    return Array.from(this.sections.keys());
  }

  /**
   * Get section at Y level
   */
  getSection(y: number): CachedSection | undefined {
    const sectionY = Math.floor(y / SECTION_SIZE);
    return this.sections.get(sectionY);
  }

  /**
   * Clear all sections
   */
  clear(): void {
    this.sections.clear();
  }
}

/**
 * Main chunk cache for the world
 */
export class ChunkCache {
  private columns: Map<string, CachedColumn> = new Map();
  private bot: Bot;
  private minY: number;
  private maxY: number;
  private maxCachedColumns: number;
  private classifyBlock: (block: any) => PathingBlockType;

  constructor(
    bot: Bot,
    classifyBlock: (block: any) => PathingBlockType,
    maxCachedColumns: number = 1024
  ) {
    this.bot = bot;
    this.classifyBlock = classifyBlock;
    this.maxCachedColumns = maxCachedColumns;

    // Determine world height limits
    this.minY = (bot.game as any)?.minY ?? -64;
    this.maxY = (bot.game as any)?.maxY ?? 320;

    // Set up event listeners
    this.setupListeners();
  }

  /**
   * Get column key from chunk coordinates
   */
  private getColumnKey(chunkX: number, chunkZ: number): string {
    return `${chunkX},${chunkZ}`;
  }

  /**
   * Get or create column for chunk coordinates
   */
  private getOrCreateColumn(chunkX: number, chunkZ: number): CachedColumn {
    const key = this.getColumnKey(chunkX, chunkZ);
    let column = this.columns.get(key);
    if (!column) {
      // Evict old columns if over limit
      if (this.columns.size >= this.maxCachedColumns) {
        this.evictOldest();
      }
      column = new CachedColumn(this.minY, this.maxY);
      this.columns.set(key, column);
    }
    return column;
  }

  /**
   * Evict oldest cached column
   */
  private evictOldest(): void {
    // Simple LRU-like eviction - remove first entry (oldest)
    const firstKey = this.columns.keys().next().value;
    if (firstKey) {
      this.columns.delete(firstKey);
    }
  }

  /**
   * Set up event listeners for block updates
   */
  private setupListeners(): void {
    // Block update
    this.bot.on('blockUpdate', (oldBlock, newBlock) => {
      if (newBlock) {
        this.updateBlock(newBlock.position.x, newBlock.position.y, newBlock.position.z);
      }
    });

    // Chunk column load
    this.bot.on('chunkColumnLoad', (point) => {
      this.cacheChunkColumn(point.x, point.z);
    });

    // Chunk column unload
    this.bot.on('chunkColumnUnload', (point) => {
      const key = this.getColumnKey(point.x, point.z);
      this.columns.delete(key);
    });
  }

  /**
   * Cache an entire chunk column from the world
   */
  cacheChunkColumn(chunkX: number, chunkZ: number): void {
    const column = this.getOrCreateColumn(chunkX, chunkZ);
    const worldX = chunkX * 16;
    const worldZ = chunkZ * 16;

    for (let y = this.minY; y < this.maxY; y++) {
      for (let localX = 0; localX < 16; localX++) {
        for (let localZ = 0; localZ < 16; localZ++) {
          const x = worldX + localX;
          const z = worldZ + localZ;
          const block = this.bot.blockAt({ x, y, z } as any);
          const type = this.classifyBlock(block);
          column.setBlockType(x, y, z, type);
        }
      }
    }
  }

  /**
   * Update a single block in the cache
   */
  updateBlock(x: number, y: number, z: number): void {
    const chunkX = Math.floor(x / 16);
    const chunkZ = Math.floor(z / 16);
    const column = this.columns.get(this.getColumnKey(chunkX, chunkZ));

    if (column) {
      const block = this.bot.blockAt({ x, y, z } as any);
      const type = this.classifyBlock(block);
      column.setBlockType(x, y, z, type);
    }
  }

  /**
   * Get cached block type at position
   * Returns null if not cached (caller should fall back to direct lookup)
   */
  getBlockType(x: number, y: number, z: number): PathingBlockType | null {
    const chunkX = Math.floor(x / 16);
    const chunkZ = Math.floor(z / 16);
    const column = this.columns.get(this.getColumnKey(chunkX, chunkZ));

    if (!column) return null;
    return column.getBlockType(x, y, z);
  }

  /**
   * Check if position is cached
   */
  isCached(x: number, y: number, z: number): boolean {
    const chunkX = Math.floor(x / 16);
    const chunkZ = Math.floor(z / 16);
    const column = this.columns.get(this.getColumnKey(chunkX, chunkZ));
    return column !== undefined && column.hasSection(y);
  }

  /**
   * Get number of cached columns
   */
  getCachedColumnCount(): number {
    return this.columns.size;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.columns.clear();
  }

  /**
   * Check if block is passable based on cached type
   */
  isPassable(x: number, y: number, z: number): boolean | null {
    const type = this.getBlockType(x, y, z);
    if (type === null) return null;
    return type === PathingBlockType.AIR || type === PathingBlockType.WATER;
  }

  /**
   * Check if block is solid based on cached type
   */
  isSolid(x: number, y: number, z: number): boolean | null {
    const type = this.getBlockType(x, y, z);
    if (type === null) return null;
    return type === PathingBlockType.SOLID;
  }

  /**
   * Check if block is water based on cached type
   */
  isWater(x: number, y: number, z: number): boolean | null {
    const type = this.getBlockType(x, y, z);
    if (type === null) return null;
    return type === PathingBlockType.WATER;
  }

  /**
   * Check if block should be avoided based on cached type
   */
  shouldAvoid(x: number, y: number, z: number): boolean | null {
    const type = this.getBlockType(x, y, z);
    if (type === null) return null;
    return type === PathingBlockType.AVOID;
  }

  // ============ Disk Persistence ============

  /**
   * Save all cached chunks to a directory
   * Uses region-based file format (32x32 chunks per region file)
   */
  async saveToDirectory(dirPath: string): Promise<void> {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Group columns by region
    const regions = new Map<string, Map<string, CachedColumn>>();

    for (const [key, column] of this.columns.entries()) {
      const [chunkXStr, chunkZStr] = key.split(',');
      const chunkX = parseInt(chunkXStr, 10);
      const chunkZ = parseInt(chunkZStr, 10);

      const regionX = Math.floor(chunkX / 32);
      const regionZ = Math.floor(chunkZ / 32);
      const regionKey = `${regionX},${regionZ}`;

      if (!regions.has(regionKey)) {
        regions.set(regionKey, new Map());
      }
      regions.get(regionKey)!.set(key, column);
    }

    // Save each region
    for (const [regionKey, regionColumns] of regions.entries()) {
      const [regionX, regionZ] = regionKey.split(',').map(s => parseInt(s, 10));
      const filename = path.join(dirPath, `r.${regionX}.${regionZ}.cache`);
      await this.saveRegion(filename, regionColumns);
    }
  }

  /**
   * Save a region file
   */
  private async saveRegion(filename: string, columns: Map<string, CachedColumn>): Promise<void> {
    const fs = await import('fs').then(m => m.promises);

    // Build region data
    // Format: [numColumns:4][for each column: chunkX:4, chunkZ:4, numSections:4, [sectionY:4, data:1024]...]
    const chunks: Buffer[] = [];

    // Header: number of columns
    const header = Buffer.alloc(4);
    header.writeInt32LE(columns.size, 0);
    chunks.push(header);

    for (const [key, column] of columns.entries()) {
      const [chunkXStr, chunkZStr] = key.split(',');
      const chunkX = parseInt(chunkXStr, 10);
      const chunkZ = parseInt(chunkZStr, 10);

      const sectionYs = column.getSectionYs();

      // Column header: chunkX, chunkZ, numSections
      const colHeader = Buffer.alloc(12);
      colHeader.writeInt32LE(chunkX, 0);
      colHeader.writeInt32LE(chunkZ, 4);
      colHeader.writeInt32LE(sectionYs.length, 8);
      chunks.push(colHeader);

      // Each section
      for (const sectionY of sectionYs) {
        const section = column.getSection(sectionY * 16);
        if (!section) continue;

        const sectionHeader = Buffer.alloc(4);
        sectionHeader.writeInt32LE(sectionY, 0);
        chunks.push(sectionHeader);

        // Section data (1024 bytes)
        chunks.push(Buffer.from(section.getRawData()));
      }
    }

    // Write to file
    await fs.writeFile(filename, Buffer.concat(chunks));
  }

  /**
   * Load cached chunks from a directory
   */
  async loadFromDirectory(dirPath: string): Promise<number> {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');

    let loadedColumns = 0;

    try {
      const files = await fs.readdir(dirPath);

      for (const file of files) {
        if (!file.startsWith('r.') || !file.endsWith('.cache')) continue;

        const filepath = path.join(dirPath, file);
        const count = await this.loadRegion(filepath);
        loadedColumns += count;
      }
    } catch (err) {
      // Directory doesn't exist or can't be read
      return 0;
    }

    return loadedColumns;
  }

  /**
   * Load a region file
   */
  private async loadRegion(filename: string): Promise<number> {
    const fs = await import('fs').then(m => m.promises);

    let loadedColumns = 0;

    try {
      const data = await fs.readFile(filename);
      let offset = 0;

      // Read header
      const numColumns = data.readInt32LE(offset);
      offset += 4;

      for (let i = 0; i < numColumns; i++) {
        // Read column header
        const chunkX = data.readInt32LE(offset);
        offset += 4;
        const chunkZ = data.readInt32LE(offset);
        offset += 4;
        const numSections = data.readInt32LE(offset);
        offset += 4;

        const column = this.getOrCreateColumn(chunkX, chunkZ);

        // Read sections
        for (let j = 0; j < numSections; j++) {
          const sectionY = data.readInt32LE(offset);
          offset += 4;

          // Read section data
          const sectionData = data.subarray(offset, offset + SECTION_BYTES);
          offset += SECTION_BYTES;

          // Create section and set data
          const y = sectionY * 16;
          column.setBlockType(0, y, 0, PathingBlockType.AIR); // Force section creation
          const section = column.getSection(y);
          if (section) {
            section.setRawData(new Uint8Array(sectionData));
          }
        }

        loadedColumns++;
      }
    } catch (err) {
      // File doesn't exist or is corrupted
      return 0;
    }

    return loadedColumns;
  }

  /**
   * Get cache directory path for a world
   */
  static getCacheDir(worldName: string, serverAddress?: string): string {
    const os = require('os');
    const path = require('path');

    const baseDir = path.join(os.homedir(), '.baritone-ts', 'cache');

    if (serverAddress) {
      // Sanitize server address for use as directory name
      const sanitized = serverAddress.replace(/[^a-zA-Z0-9.-]/g, '_');
      return path.join(baseDir, sanitized, worldName);
    }

    return path.join(baseDir, worldName);
  }

  /**
   * Save cache to default location based on world info
   */
  async saveCache(worldName: string, serverAddress?: string): Promise<void> {
    const cacheDir = ChunkCache.getCacheDir(worldName, serverAddress);
    await this.saveToDirectory(cacheDir);
  }

  /**
   * Load cache from default location based on world info
   */
  async loadCache(worldName: string, serverAddress?: string): Promise<number> {
    const cacheDir = ChunkCache.getCacheDir(worldName, serverAddress);
    return this.loadFromDirectory(cacheDir);
  }
}

/**
 * Create a block classifier function for use with ChunkCache
 */
export function createBlockClassifier(precomputedData: any): (block: any) => PathingBlockType {
  return (block: any): PathingBlockType => {
    if (!block || block.name === 'air' || block.name === 'cave_air' || block.name === 'void_air') {
      return PathingBlockType.AIR;
    }

    // Check for water
    if (block.name === 'water' || block.name === 'flowing_water') {
      return PathingBlockType.WATER;
    }

    // Check for dangerous blocks to avoid
    const avoidBlocks = new Set([
      'lava', 'flowing_lava', 'fire', 'soul_fire',
      'cactus', 'sweet_berry_bush', 'wither_rose',
      'magma_block', 'campfire', 'soul_campfire'
    ]);
    if (avoidBlocks.has(block.name)) {
      return PathingBlockType.AVOID;
    }

    // Check if solid (can walk on / blocks movement)
    if (block.boundingBox === 'block' || block.boundingBox === 'empty') {
      // boundingBox 'block' = full block, 'empty' = passable
      return block.boundingBox === 'block' ? PathingBlockType.SOLID : PathingBlockType.AIR;
    }

    // Default to solid for unknown
    return PathingBlockType.SOLID;
  };
}
