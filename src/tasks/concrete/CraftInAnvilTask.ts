/**
 * CraftInAnvilTask - Anvil Interaction Task
 * Based on BaritonePlus's container interaction system
 *
 * Task to repair/combine items in an anvil.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import { DoStuffInContainerTask } from './DoStuffInContainerTask';

/**
 * Task to repair/combine items in an anvil.
 *
 * WHY: Anvil operations can rename, repair, or combine items.
 * Each operation has an XP cost that needs to be checked.
 */
export class CraftInAnvilTask extends DoStuffInContainerTask {
  private finished: boolean = false;

  constructor(bot: Bot) {
    super(bot, {
      containerBlocks: ['anvil', 'chipped_anvil', 'damaged_anvil'],
      containerItem: 'anvil',
      canPlaceNew: true,
    });
  }

  get displayName(): string {
    return 'CraftInAnvil';
  }

  protected containerSubTask(): Task | null {
    // Subclass should implement actual anvil logic
    this.finished = true;
    this.finishContainerWork();
    return null;
  }

  protected isContainerOpen(): boolean {
    const window = (this.bot as any).currentWindow;
    if (!window) return false;
    const type = (window.type || '').toLowerCase();
    return type.includes('anvil');
  }

  isFinished(): boolean {
    return this.finished || super.isFinished();
  }
}
