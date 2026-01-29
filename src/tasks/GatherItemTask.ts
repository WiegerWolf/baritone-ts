import type { Bot } from 'mineflayer';
import { Task } from './Task';
import { ItemTarget } from '../utils/ItemTarget';
import { ResourceTask } from './ResourceTask';

/**
 * Resource task with container looting
 */
export class GatherItemTask extends ResourceTask {
  constructor(bot: Bot, itemTargets: ItemTarget[]) {
    super(bot, itemTargets, {
      miningEnabled: false,
      craftingEnabled: false,
    });
  }

  get displayName(): string {
    const names = this.itemTargets.map(t => t.toString()).join(', ');
    return `GatherItem(${names})`;
  }

  protected onResourceTick(): Task | null {
    // No additional methods - pickup + container
    return null;
  }
}
