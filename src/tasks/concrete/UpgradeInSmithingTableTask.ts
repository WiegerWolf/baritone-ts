/**
 * UpgradeInSmithingTableTask - Smithing Table Interaction Task
 * Based on BaritonePlus's container interaction system
 *
 * Task to upgrade items in a smithing table.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import { DoStuffInContainerTask } from './DoStuffInContainerTask';

/**
 * Task to upgrade items in a smithing table.
 *
 * WHY: Smithing table operations are special - they upgrade
 * diamond gear to netherite. This requires specific item placement.
 */
export class UpgradeInSmithingTableTask extends DoStuffInContainerTask {
  private finished: boolean = false;

  constructor(bot: Bot) {
    super(bot, {
      containerBlocks: ['smithing_table'],
      containerItem: 'smithing_table',
      canPlaceNew: true,
    });
  }

  get displayName(): string {
    return 'UpgradeInSmithingTable';
  }

  protected containerSubTask(): Task | null {
    // Subclass should implement actual smithing logic
    this.finished = true;
    this.finishContainerWork();
    return null;
  }

  protected isContainerOpen(): boolean {
    const window = (this.bot as any).currentWindow;
    if (!window) return false;
    const type = (window.type || '').toLowerCase();
    return type.includes('smithing');
  }

  isFinished(): boolean {
    return this.finished || super.isFinished();
  }
}
