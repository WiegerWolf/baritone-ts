import type { Bot } from 'mineflayer';
import { Task } from './Task';
import { ItemTarget } from '../utils/ItemTarget';
import { ResourceTask } from './ResourceTask';

/**
 * Full resource task with mining support
 */
export class MineAndCollectTask extends ResourceTask {
  private sourceBlockMapping: Map<string, string[]>;

  constructor(
    bot: Bot,
    itemTargets: ItemTarget[],
    sourceBlocks?: Map<string, string[]>
  ) {
    super(bot, itemTargets, {
      craftingEnabled: false,
    });
    this.sourceBlockMapping = sourceBlocks ?? new Map();
  }

  get displayName(): string {
    const names = this.itemTargets.map(t => t.toString()).join(', ');
    return `MineAndCollect(${names})`;
  }

  /**
   * Set source block mapping (item → blocks)
   */
  setSourceBlocks(mapping: Map<string, string[]>): void {
    this.sourceBlockMapping = mapping;
  }

  protected getSourceBlocks(): string[] {
    const blocks: string[] = [];

    for (const target of this.itemTargets) {
      for (const itemName of target.getItemNames()) {
        const sources = this.sourceBlockMapping.get(itemName);
        if (sources) {
          blocks.push(...sources);
        }
      }
    }

    return [...new Set(blocks)];
  }

  protected onResourceTick(): Task | null {
    // No additional methods
    return null;
  }
}
