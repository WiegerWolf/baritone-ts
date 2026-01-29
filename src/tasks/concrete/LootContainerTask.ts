/**
 * LootContainerTask - Loot all valuable items from a container
 *
 * When exploring structures, we want to grab everything useful.
 * Opens a chest and picks up items based on a filter.
 */

import type { Bot } from 'mineflayer';
import type { Window } from 'prismarine-windows';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { AbstractDoToStorageContainerTask } from './ContainerTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Task to loot a chest - picks up all valuable items.
 */
export class LootContainerTask extends AbstractDoToStorageContainerTask {
  private targetContainerPos: BlockPos;
  private itemFilter: (itemName: string) => boolean;
  private clickTimer: TimerGame;
  private looted: boolean = false;

  constructor(
    bot: Bot,
    containerPos: BlockPos,
    itemFilter: (itemName: string) => boolean = () => true
  ) {
    super(bot);
    this.targetContainerPos = containerPos;
    this.itemFilter = itemFilter;
    this.clickTimer = new TimerGame(bot, 0.1);
  }

  get displayName(): string {
    return `LootContainer(${this.targetContainerPos.x},${this.targetContainerPos.y},${this.targetContainerPos.z})`;
  }

  protected getContainerTarget(): BlockPos | null {
    return this.targetContainerPos;
  }

  protected onContainerOpenSubtask(containerPos: BlockPos): Task | null {
    const window = (this.bot as any).currentWindow as Window;
    if (!window) return null;

    const containerSlotCount = this.getContainerSlotCount(window);

    // Look for items to loot
    for (let i = 0; i < containerSlotCount; i++) {
      const item = window.slots[i];
      if (item && this.itemFilter(item.name)) {
        if (this.clickTimer.elapsed()) {
          // Shift-click to quick transfer
          this.bot.clickWindow(i, 0, 1);
          this.clickTimer.reset();
          return null;
        }
      }
    }

    // No more items to loot
    this.looted = true;
    return null;
  }

  private getContainerSlotCount(window: Window): number {
    const type = String(window.type || '').toLowerCase();
    if (type.includes('chest') || type.includes('generic_9x3')) return 27;
    if (type.includes('barrel')) return 27;
    if (type.includes('generic_9x6')) return 54;
    if (type.includes('shulker')) return 27;
    if (type.includes('hopper')) return 5;
    if (type.includes('dispenser') || type.includes('dropper')) return 9;
    return 27;
  }

  isFinished(): boolean {
    return this.looted;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof LootContainerTask)) return false;
    return this.targetContainerPos.equals(other.targetContainerPos);
  }
}

/**
 * Convenience function to loot all items from a container
 */
export function lootContainer(
  bot: Bot,
  containerPos: BlockPos,
  itemFilter?: (itemName: string) => boolean
): LootContainerTask {
  return new LootContainerTask(bot, containerPos, itemFilter);
}
