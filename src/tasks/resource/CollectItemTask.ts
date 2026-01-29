/**
 * CollectItemTask - Simple resource task that just collects dropped items
 */

import type { Bot } from 'mineflayer';
import { ResourceTask } from './ResourceTask';
import { Task } from '../base/Task';
import { ItemTarget } from '../../utils/ItemTarget';

/**
 * Simple resource task that just collects dropped items
 */
export class CollectItemTask extends ResourceTask {
    constructor(bot: Bot, itemTargets: ItemTarget[]) {
        super(bot, itemTargets, {
            containerLootEnabled: false,
            miningEnabled: false,
            craftingEnabled: false,
        });
    }

    get displayName(): string {
        const names = this.itemTargets.map(t => t.toString()).join(', ');
        return `CollectItem(${names})`;
    }

    protected onResourceTick(): Task | null {
        // No additional methods - just pickup
        return null;
    }
}
