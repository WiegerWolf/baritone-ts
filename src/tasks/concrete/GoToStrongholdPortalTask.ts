/**
 * GoToStrongholdPortalTask - Navigate to a Stronghold Portal
 * Based on BaritonePlus's GoToStrongholdPortalTask.java
 *
 * WHY: This combines triangulation with navigation:
 * - First, locate the stronghold using eye triangulation
 * - Then, fast travel to the estimated location
 * - Finally, search for stone bricks to find the actual structure
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { SearchChunkForBlockTask } from './SearchChunkForBlockTask';
import { BlockPos } from '../../types';
import { LocateStrongholdCoordinatesTask } from './LocateStrongholdCoordinatesTask';

/**
 * State for stronghold portal navigation
 */
enum GoToStrongholdState {
  LOCATING,
  TRAVELING,
  SEARCHING_STRUCTURE,
  FOUND,
}

/**
 * Task to navigate to a stronghold portal.
 *
 * WHY: This combines triangulation with navigation:
 * - First, locate the stronghold using eye triangulation
 * - Then, fast travel to the estimated location
 * - Finally, search for stone bricks to find the actual structure
 *
 * Based on BaritonePlus GoToStrongholdPortalTask.java
 */
export class GoToStrongholdPortalTask extends Task {
  private targetEyes: number;
  private state: GoToStrongholdState = GoToStrongholdState.LOCATING;
  private locateTask: LocateStrongholdCoordinatesTask;
  private strongholdCoordinates: BlockPos | null = null;

  constructor(bot: Bot, targetEyes: number = 2) {
    super(bot);
    this.targetEyes = targetEyes;
    this.locateTask = new LocateStrongholdCoordinatesTask(bot, targetEyes);
  }

  get displayName(): string {
    return `GoToStrongholdPortal(state: ${GoToStrongholdState[this.state]})`;
  }

  onStart(): void {
    this.state = GoToStrongholdState.LOCATING;
    this.strongholdCoordinates = null;
  }

  onTick(): Task | null {
    // Get coordinates if we don't have them yet
    if (this.strongholdCoordinates === null) {
      this.strongholdCoordinates = this.locateTask.getStrongholdCoordinates();

      if (this.strongholdCoordinates === null) {
        this.state = GoToStrongholdState.LOCATING;
        return this.locateTask;
      }
    }

    // We have coordinates, search for the actual structure
    this.state = GoToStrongholdState.SEARCHING_STRUCTURE;

    // Search for stone bricks (stronghold indicator), using fast travel to get there
    return new SearchChunkForBlockTask(
      this.bot,
      ['stone_bricks', 'cracked_stone_bricks', 'mossy_stone_bricks'],
      1,
      {
        maxChunksToSearch: 100,
        // Would override wander task to use fast travel to coordinates
      }
    );
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    // Finished when we find end portal frame blocks
    const portalFrame = this.findNearbyBlock('end_portal_frame');
    return portalFrame !== null;
  }

  /**
   * Find nearby block by name
   */
  private findNearbyBlock(blockName: string): Vec3 | null {
    const playerPos = this.bot.entity.position;

    for (let x = -16; x <= 16; x++) {
      for (let z = -16; z <= 16; z++) {
        for (let y = -16; y <= 16; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);
          if (block && block.name === blockName) {
            return pos;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get the stronghold coordinates
   */
  getStrongholdCoordinates(): BlockPos | null {
    return this.strongholdCoordinates;
  }

  /**
   * Get current state
   */
  getState(): GoToStrongholdState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof GoToStrongholdPortalTask;
  }
}

/**
 * Convenience function to go to stronghold portal
 */
export function goToStrongholdPortal(bot: Bot, targetEyes: number = 2): GoToStrongholdPortalTask {
  return new GoToStrongholdPortalTask(bot, targetEyes);
}

export { GoToStrongholdState };
