/**
 * SearchChunkByConditionTask - Search for chunks matching a condition
 *
 * WHY: Finding specific biomes (like desert for temples) or structures
 * (like strongholds) requires checking chunk data rather than individual blocks.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { SearchChunksExploreTask, chunkToBlock, type ChunkPos, type ChunkSearchConfig } from './ChunkSearchTask';

/**
 * Task to search for chunks matching a biome or structure type.
 *
 * WHY: Finding specific biomes (like desert for temples) or structures
 * (like strongholds) requires checking chunk data rather than individual blocks.
 */
export class SearchChunkByConditionTask extends SearchChunksExploreTask {
  private condition: (chunk: ChunkPos, bot: Bot) => boolean;
  private onChunkFound: (chunk: ChunkPos) => void;
  private foundChunks: ChunkPos[] = [];

  constructor(
    bot: Bot,
    condition: (chunk: ChunkPos, bot: Bot) => boolean,
    onChunkFound: (chunk: ChunkPos) => void = () => {},
    config: Partial<ChunkSearchConfig> = {}
  ) {
    super(bot, config);
    this.condition = condition;
    this.onChunkFound = onChunkFound;
  }

  get displayName(): string {
    return 'SearchChunkByCondition';
  }

  protected isChunkWithinSearchSpace(chunk: ChunkPos): boolean {
    const matches = this.condition(chunk, this.bot);
    if (matches) {
      this.foundChunks.push(chunk);
      this.onChunkFound(chunk);
    }
    return matches;
  }

  protected searchWithinChunk(chunk: ChunkPos): Task | null {
    // Navigate to chunk center
    const target = chunkToBlock(chunk, this.bot.entity.position.y);
    return new GoToNearTask(
      this.bot,
      Math.floor(target.x),
      Math.floor(target.y),
      Math.floor(target.z),
      4
    );
  }

  protected isSearchComplete(): boolean {
    return this.foundChunks.length > 0;
  }

  /**
   * Get found chunks matching condition
   */
  getFoundChunks(): ChunkPos[] {
    return [...this.foundChunks];
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return other instanceof SearchChunkByConditionTask &&
           this.condition === other.condition;
  }
}
