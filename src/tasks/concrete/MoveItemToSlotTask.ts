/**
 * MoveItemToSlotTask - Move item between slots
 * Based on AltoClef's slot tasks
 *
 * Move a specific item from source slot to destination slot.
 * Handles the full pick-up and place sequence.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ClickSlotTask, SlotActionType } from './ClickSlotTask';

/**
 * Task to move item from one slot to another
 *
 * Intent: Move a specific item from source slot to destination slot.
 * Handles the full pick-up and place sequence.
 */
export class MoveItemToSlotTask extends Task {
  private sourceSlot: number;
  private destSlot: number;
  private phase: 'pickup' | 'place' | 'done' = 'pickup';

  constructor(bot: Bot, sourceSlot: number, destSlot: number) {
    super(bot);
    this.sourceSlot = sourceSlot;
    this.destSlot = destSlot;
  }

  get displayName(): string {
    return `MoveSlot(${this.sourceSlot} -> ${this.destSlot})`;
  }

  onStart(): void {
    this.phase = 'pickup';
  }

  onTick(): Task | null {
    switch (this.phase) {
      case 'pickup': {
        const cursor = (this.bot.inventory as any).cursor;
        if (cursor) {
          // Already have something in cursor
          this.phase = 'place';
          return null;
        }
        // Pick up from source
        return new ClickSlotTask(this.bot, this.sourceSlot, 0, SlotActionType.PICKUP);
      }

      case 'place': {
        const cursor = (this.bot.inventory as any).cursor;
        if (!cursor) {
          // Nothing to place
          this.phase = 'done';
          return null;
        }
        // Place at destination
        return new ClickSlotTask(this.bot, this.destSlot, 0, SlotActionType.PICKUP);
      }

      default:
        return null;
    }
  }

  isFinished(): boolean {
    return this.phase === 'done';
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof MoveItemToSlotTask)) return false;
    return this.sourceSlot === other.sourceSlot && this.destSlot === other.destSlot;
  }
}
