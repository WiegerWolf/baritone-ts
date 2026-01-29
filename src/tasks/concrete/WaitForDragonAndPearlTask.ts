/**
 * WaitForDragonAndPearlTask - Pearl strategy for Ender Dragon combat
 * Based on BaritonePlus's WaitForDragonAndPearlTask.java
 *
 * WHY: This is an advanced speedrun strategy:
 * - Pillar up to get a clear view of the portal
 * - Wait for dragon to perch
 * - Throw ender pearl onto the portal
 * - Quickly attack dragon while it's vulnerable
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { GetToYTask } from './GetToYTask';
import { MineAndCollectTask } from './MineAndCollectTask';
import { BlockPos } from '../../types';
import { itemTarget } from './ResourceTask';
import type { IDragonWaiter } from './KillEnderDragonTask';

/**
 * Height for pearling strategy
 */
const PEARL_HEIGHT = 42;

/**
 * XZ radius from portal center
 */
const XZ_RADIUS = 30;
const XZ_RADIUS_TOO_FAR = 38;

/**
 * State for pearl strategy
 */
enum PearlStrategyState {
  COLLECTING_MATERIALS,
  MOVING_TO_POSITION,
  PILLARING_UP,
  WAITING_FOR_PERCH,
  THROWING_PEARL,
  FINISHED,
}

/**
 * Task to wait for dragon perch and pearl onto the portal.
 *
 * WHY: This is an advanced speedrun strategy:
 * - Pillar up to get a clear view of the portal
 * - Wait for dragon to perch
 * - Throw ender pearl onto the portal
 * - Quickly attack dragon while it's vulnerable
 *
 * Based on BaritonePlus WaitForDragonAndPearlTask.java
 */
export class WaitForDragonAndPearlTask extends Task implements IDragonWaiter {
  private state: PearlStrategyState = PearlStrategyState.COLLECTING_MATERIALS;
  private exitPortalTop: BlockPos | null = null;
  private dragonIsPerching: boolean = false;

  constructor(bot: Bot) {
    super(bot);
  }

  setExitPortalTop(top: BlockPos): void {
    this.exitPortalTop = top;
  }

  setPerchState(perching: boolean): void {
    this.dragonIsPerching = perching;
  }

  get displayName(): string {
    return `WaitForDragonAndPearl(state: ${PearlStrategyState[this.state]})`;
  }

  onStart(): void {
    this.state = PearlStrategyState.COLLECTING_MATERIALS;
    this.dragonIsPerching = false;
  }

  onTick(): Task | null {
    if (!this.exitPortalTop) {
      // Find exit portal
      this.exitPortalTop = this.findExitPortalTop();
      if (!this.exitPortalTop) {
        return new TimeoutWanderTask(this.bot, 5);
      }
    }

    // Check if we have ender pearl
    if (!this.hasItem('ender_pearl')) {
      this.state = PearlStrategyState.COLLECTING_MATERIALS;
      // Would return task to get ender pearl
      return null;
    }

    // Check if we have building materials
    const buildingMaterialCount = this.getBuildingMaterialCount();
    if (buildingMaterialCount < PEARL_HEIGHT + 10) {
      this.state = PearlStrategyState.COLLECTING_MATERIALS;
      return new MineAndCollectTask(
        this.bot,
        [itemTarget('end_stone', PEARL_HEIGHT + 10)],
        ['end_stone'],
        {}
      );
    }

    const playerPos = this.bot.entity.position;
    const minHeight = this.exitPortalTop.y + PEARL_HEIGHT - 3;

    // If dragon is perching and we have line of sight, throw pearl!
    if (this.dragonIsPerching && playerPos.y >= minHeight) {
      this.state = PearlStrategyState.THROWING_PEARL;
      return this.throwPearlTask();
    }

    // Need to pillar up
    if (playerPos.y < minHeight) {
      this.state = PearlStrategyState.PILLARING_UP;
      return new GetToYTask(this.bot, minHeight);
    }

    // At correct height, wait for perch
    this.state = PearlStrategyState.WAITING_FOR_PERCH;

    // Update perch state by checking dragon
    const dragon = this.findEnderDragon();
    if (dragon) {
      this.dragonIsPerching = this.isDragonPerching(dragon);
    }

    // Look at dragon while waiting
    if (dragon) {
      this.bot.lookAt(dragon.position);
    }

    return null;
  }

  /**
   * Find the exit portal top
   */
  private findExitPortalTop(): BlockPos | null {
    for (let y = 70; y >= 50; y--) {
      const block = this.bot.blockAt(new Vec3(0, y, 0));
      if (block && block.name === 'bedrock') {
        return new BlockPos(0, y, 0);
      }
    }
    return null;
  }

  /**
   * Check if player has item
   */
  private hasItem(itemName: string): boolean {
    return this.bot.inventory.items().some((item) => item.name.includes(itemName));
  }

  /**
   * Get count of building materials
   */
  private getBuildingMaterialCount(): number {
    const materials = ['dirt', 'cobblestone', 'netherrack', 'end_stone'];
    let count = 0;

    for (const item of this.bot.inventory.items()) {
      if (materials.includes(item.name)) {
        count += item.count;
      }
    }

    return count;
  }

  /**
   * Find ender dragon
   */
  private findEnderDragon(): any | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'ender_dragon') {
        return entity;
      }
    }
    return null;
  }

  /**
   * Check if dragon is perching
   */
  private isDragonPerching(dragon: any): boolean {
    const dragonPos = dragon.position;
    const nearCenter = Math.abs(dragonPos.x) < 10 && Math.abs(dragonPos.z) < 10;
    const lowAltitude = dragonPos.y < 70;

    return nearCenter && lowAltitude;
  }

  /**
   * Create task to throw ender pearl at portal
   */
  private throwPearlTask(): Task | null {
    // Equip ender pearl and throw at portal
    const pearl = this.bot.inventory.items().find((item) => item.name.includes('ender_pearl'));
    if (pearl && this.exitPortalTop) {
      const targetPos = new Vec3(
        this.exitPortalTop.x,
        this.exitPortalTop.y - 1,
        this.exitPortalTop.z
      );

      // Look at target and throw
      this.bot.equip(pearl, 'hand');
      this.bot.lookAt(targetPos);
      this.bot.activateItem();
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    if (!this.exitPortalTop) return false;

    // Finished when we're close to portal center after pearling
    const playerPos = this.bot.entity.position;
    const distXZ = Math.sqrt(
      Math.pow(playerPos.x - this.exitPortalTop.x, 2) +
        Math.pow(playerPos.z - this.exitPortalTop.z, 2)
    );

    return this.dragonIsPerching && distXZ < 15;
  }

  /**
   * Get current state
   */
  getState(): PearlStrategyState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof WaitForDragonAndPearlTask;
  }
}

/**
 * Convenience function for pearl strategy
 */
export function waitForDragonAndPearl(bot: Bot): WaitForDragonAndPearlTask {
  return new WaitForDragonAndPearlTask(bot);
}

export {
  PearlStrategyState,
  PEARL_HEIGHT,
  XZ_RADIUS,
  XZ_RADIUS_TOO_FAR,
};
