/**
 * CraftInTableTask - Crafting Table Interaction Task
 * Based on BaritonePlus's container interaction system
 *
 * Task to do something at a crafting table.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import { DoStuffInContainerTask } from './DoStuffInContainerTask';

/**
 * Task to do something at a crafting table.
 *
 * WHY: Crafting table operations require opening the table,
 * placing items in the grid, and receiving the output.
 * This task handles finding/placing a crafting table and opening it.
 */
export class CraftInTableTask extends DoStuffInContainerTask {
  private finished: boolean = false;

  constructor(bot: Bot) {
    super(bot, {
      containerBlocks: ['crafting_table'],
      containerItem: 'crafting_table',
      canPlaceNew: true,
    });
  }

  get displayName(): string {
    return 'CraftInTable';
  }

  protected containerSubTask(): Task | null {
    // Subclass should implement actual crafting logic
    // This base implementation just opens the table
    this.finished = true;
    this.finishContainerWork();
    return null;
  }

  protected isContainerOpen(): boolean {
    const window = (this.bot as any).currentWindow;
    if (!window) return false;
    const type = (window.type || '').toLowerCase();
    return type.includes('crafting');
  }

  isFinished(): boolean {
    return this.finished || super.isFinished();
  }
}
