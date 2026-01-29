/**
 * SmeltInFurnaceBaseTask - Furnace Interaction Task
 * Based on BaritonePlus's container interaction system
 *
 * Task to smelt items in a furnace.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import { DoStuffInContainerTask } from './DoStuffInContainerTask';

/**
 * Task to smelt items in a furnace.
 *
 * WHY: Smelting requires putting fuel, input items, and waiting
 * for the output. This base class handles furnace interaction.
 */
export class SmeltInFurnaceBaseTask extends DoStuffInContainerTask {
  private finished: boolean = false;

  constructor(bot: Bot, furnaceType: 'furnace' | 'blast_furnace' | 'smoker' = 'furnace') {
    super(bot, {
      containerBlocks: [furnaceType],
      containerItem: furnaceType,
      canPlaceNew: true,
    });
  }

  get displayName(): string {
    return `SmeltInFurnace(${this.config.containerBlocks[0]})`;
  }

  protected containerSubTask(): Task | null {
    // Subclass should implement actual smelting logic
    this.finished = true;
    this.finishContainerWork();
    return null;
  }

  protected isContainerOpen(): boolean {
    const window = (this.bot as any).currentWindow;
    if (!window) return false;
    const type = (window.type || '').toLowerCase();
    return type.includes('furnace') || type.includes('smoker') || type.includes('blast');
  }

  isFinished(): boolean {
    return this.finished || super.isFinished();
  }
}
