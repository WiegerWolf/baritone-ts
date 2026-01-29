/**
 * KillEnderDragonWithBedsTask - Bed explosion strategy for Ender Dragon combat
 * Based on BaritonePlus's KillEnderDragonWithBedsTask.java
 *
 * WHY: Beds explode in the End dimension (can't set spawn there).
 * This explosion deals massive damage - one of the fastest speedrun strats.
 * The bed must be placed at the right moment when dragon's head is close.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToBlockTask } from './GoToBlockTask';
import { BlockPos } from '../../types';
import type { IDragonWaiter } from './KillEnderDragonTask';

/**
 * State for bed-based dragon killing
 */
enum BedDragonState {
  FINDING_PORTAL,
  WAITING_FOR_DRAGON,
  POSITIONING,
  PLACING_BED,
  WAITING_FOR_HEAD,
  EXPLODING_BED,
  FINISHED,
}

/**
 * Bed types for the explosion strategy
 */
const BED_ITEMS = [
  'white_bed', 'orange_bed', 'magenta_bed', 'light_blue_bed',
  'yellow_bed', 'lime_bed', 'pink_bed', 'gray_bed',
  'light_gray_bed', 'cyan_bed', 'purple_bed', 'blue_bed',
  'brown_bed', 'green_bed', 'red_bed', 'black_bed',
];

/**
 * Task to kill the Ender Dragon using bed explosions.
 *
 * WHY: Beds explode in the End dimension (can't set spawn there).
 * This explosion deals massive damage - one of the fastest speedrun strats.
 * The bed must be placed at the right moment when dragon's head is close.
 *
 * Strategy:
 * 1. Position near the exit portal
 * 2. Wait for dragon to perch
 * 3. Place bed on top of portal bedrock
 * 4. Wait for dragon's head to be close enough
 * 5. Right-click bed to explode it
 *
 * Based on BaritonePlus KillEnderDragonWithBedsTask.java
 */
export class KillEnderDragonWithBedsTask extends Task {
  private state: BedDragonState = BedDragonState.FINDING_PORTAL;
  private exitPortalTop: BlockPos | null = null;
  private whenNotPerchingTask: Task & IDragonWaiter;
  private bedClickDistance: number;

  constructor(bot: Bot, notPerchingTask: Task & IDragonWaiter, bedClickDistance: number = 4.0) {
    super(bot);
    this.whenNotPerchingTask = notPerchingTask;
    this.bedClickDistance = bedClickDistance;
  }

  get displayName(): string {
    return `KillDragonWithBeds(${BedDragonState[this.state]})`;
  }

  onStart(): void {
    this.state = BedDragonState.FINDING_PORTAL;
    this.exitPortalTop = null;
  }

  onTick(): Task | null {
    // Find the exit portal if we haven't yet
    if (!this.exitPortalTop) {
      this.exitPortalTop = this.findExitPortalTop();
      if (this.exitPortalTop) {
        this.whenNotPerchingTask.setExitPortalTop(this.exitPortalTop);
      } else {
        this.state = BedDragonState.FINDING_PORTAL;
        // Navigate to 0,0 to find the portal
        return new GoToBlockTask(this.bot, 0, 70, 0);
      }
    }

    // Check if dragon exists
    const dragon = this.findEnderDragon();
    if (!dragon) {
      // Dragon is dead or not found
      this.state = BedDragonState.FINISHED;
      return null;
    }

    // Check if dragon is perching
    const isPerching = this.isDragonPerching(dragon);
    this.whenNotPerchingTask.setPerchState(isPerching);

    // When dragon is not perching, run the alternative task
    if (!isPerching) {
      if (!this.whenNotPerchingTask.isFinished()) {
        return this.whenNotPerchingTask;
      }
    }

    if (isPerching) {
      return this.handlePerching(dragon);
    }

    // Run the not-perching task as fallback
    return this.whenNotPerchingTask;
  }

  private handlePerching(dragon: any): Task | null {
    const playerPos = this.bot.entity.position;

    // Target stand position: one block below and offset from portal
    const targetStandPos = new Vec3(
      this.exitPortalTop!.x - 1,
      this.exitPortalTop!.y - 1,
      this.exitPortalTop!.z
    );

    // Check if we're in position
    const inRangeXZ = Math.abs(playerPos.x - targetStandPos.x) < 1 &&
                      Math.abs(playerPos.z - targetStandPos.z) < 1;
    const atCorrectY = playerPos.y >= targetStandPos.y;

    if (!inRangeXZ || !atCorrectY) {
      this.state = BedDragonState.POSITIONING;
      return new GoToBlockTask(
        this.bot,
        Math.floor(targetStandPos.x),
        Math.floor(targetStandPos.y),
        Math.floor(targetStandPos.z)
      );
    }

    // We're positioned. Check for bed placement
    const bedTargetPos = new Vec3(
      this.exitPortalTop!.x,
      this.exitPortalTop!.y + 1,
      this.exitPortalTop!.z
    );

    // Check if bed is already placed
    const bedBlock = this.bot.blockAt(bedTargetPos);
    const bedPlaced = bedBlock && BED_ITEMS.some(bed => bedBlock.name.includes(bed.replace('_bed', '')));

    if (!bedPlaced) {
      this.state = BedDragonState.PLACING_BED;

      // Check if we can place (camera above bed position)
      const canPlace = this.bot.entity.position.y + 1.6 > bedTargetPos.y;

      if (canPlace) {
        // Find and equip a bed
        const bed = this.bot.inventory.items().find(item =>
          BED_ITEMS.includes(item.name)
        );

        if (bed) {
          this.bot.equip(bed, 'hand');
          // Look at the position below the bed (place on portal bedrock)
          const placePos = new Vec3(
            bedTargetPos.x,
            bedTargetPos.y - 1,
            bedTargetPos.z
          );
          this.bot.lookAt(placePos);
          // Place the bed
          this.bot.activateItem();
        }
      } else {
        // Need to jump to place bed
        if (this.bot.entity.onGround) {
          this.bot.setControlState('jump', true);
        } else {
          this.bot.setControlState('jump', false);
        }
      }

      return null;
    }

    // Bed is placed! Wait for dragon's head to be close enough
    this.state = BedDragonState.WAITING_FOR_HEAD;

    // Make sure we're on the ground to not blow ourselves up
    if (!this.bot.entity.onGround) {
      return null; // Wait to fall
    }

    // Calculate distance to dragon's head
    const dragonHeadPos = new Vec3(
      dragon.position.x,
      dragon.position.y + 2, // Approximate head position
      dragon.position.z
    );

    const distToBedHead = dragonHeadPos.distanceTo(bedTargetPos);

    if (distToBedHead < this.bedClickDistance) {
      // Dragon's head is close enough - EXPLODE THE BED!
      this.state = BedDragonState.EXPLODING_BED;

      // Look at bed and interact
      this.bot.lookAt(bedTargetPos);

      // Activate block to trigger bed explosion
      const bedBlockRef = this.bot.blockAt(bedTargetPos);
      if (bedBlockRef) {
        this.bot.activateBlock(bedBlockRef);
      }
    }

    return null;
  }

  private findExitPortalTop(): BlockPos | null {
    // The exit portal is at 0,0 in the end
    for (let y = 70; y >= 50; y--) {
      const block = this.bot.blockAt(new Vec3(0, y, 0));
      if (block && block.name === 'bedrock') {
        return new BlockPos(0, y, 0);
      }
    }
    return null;
  }

  private findEnderDragon(): any | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'ender_dragon') {
        return entity;
      }
    }
    return null;
  }

  private isDragonPerching(dragon: any): boolean {
    // Dragon perches when near 0,0 and low altitude
    const dragonPos = dragon.position;
    const nearCenter = Math.abs(dragonPos.x) < 15 && Math.abs(dragonPos.z) < 15;
    const lowAltitude = dragonPos.y < 75;

    // Also check if dragon is below exit portal height
    if (this.exitPortalTop && dragonPos.y < this.exitPortalTop.y + 2) {
      return false; // Already perched/too low
    }

    return nearCenter && lowAltitude;
  }

  /**
   * Count beds in inventory
   */
  getBedCount(): number {
    return this.bot.inventory.items()
      .filter(item => BED_ITEMS.includes(item.name))
      .reduce((sum, item) => sum + item.count, 0);
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.setControlState('jump', false);
  }

  isFinished(): boolean {
    return this.state === BedDragonState.FINISHED ||
           this.findEnderDragon() === null;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof KillEnderDragonWithBedsTask;
  }
}

/**
 * Convenience function for bed-based dragon killing
 */
export function killDragonWithBeds(
  bot: Bot,
  notPerchingTask: Task & IDragonWaiter
): KillEnderDragonWithBedsTask {
  return new KillEnderDragonWithBedsTask(bot, notPerchingTask);
}

export {
  BedDragonState,
  BED_ITEMS,
};
