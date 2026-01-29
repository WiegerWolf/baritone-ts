/**
 * ConstructIronGolemTask - Build an iron golem for defense/farming
 * Based on BaritonePlus's construction tasks
 *
 * WHY: Iron golems are useful for defending villages and bases,
 * iron farming, killing hostile mobs, and protecting players.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { DestroyBlockTask } from './ConstructionTask';
import { PlaceBlockTask } from './PlaceBlockTask';
import { BlockPos } from '../../types';

/**
 * State for iron golem construction
 */
export enum ConstructIronGolemState {
  GETTING_MATERIALS,
  FINDING_POSITION,
  PLACING_BASE,
  PLACING_CENTER,
  PLACING_ARMS,
  CLEARING_AREA,
  PLACING_HEAD,
  FINISHED,
}

/**
 * Task to construct an iron golem.
 *
 * WHY: Iron golems are useful for:
 * - Defending villages and bases
 * - Iron farming (iron farm designs)
 * - Killing hostile mobs
 * - Protecting players
 *
 * Construction pattern:
 *     [P]        (pumpkin head)
 *   [I][I][I]    (iron block arms)
 *     [I]        (iron block base)
 *
 * Based on BaritonePlus ConstructIronGolemTask.java
 */
export class ConstructIronGolemTask extends Task {
  private position: BlockPos | null;
  private state: ConstructIronGolemState = ConstructIronGolemState.GETTING_MATERIALS;
  private canBeFinished: boolean = false;

  constructor(bot: Bot, position: BlockPos | null = null) {
    super(bot);
    this.position = position;
  }

  get displayName(): string {
    return `ConstructIronGolem(state: ${ConstructIronGolemState[this.state]})`;
  }

  onStart(): void {
    this.state = ConstructIronGolemState.GETTING_MATERIALS;
    this.canBeFinished = false;
  }

  onTick(): Task | null {
    // Check if we have materials
    const ironBlocksNeeded = this.getIronBlocksNeeded();
    const hasPumpkin = this.hasItem('carved_pumpkin');

    if (this.getItemCount('iron_block') < ironBlocksNeeded || !hasPumpkin) {
      this.state = ConstructIronGolemState.GETTING_MATERIALS;
      // Would return task to get materials
      return null;
    }

    // Find position if not set
    if (!this.position) {
      this.state = ConstructIronGolemState.FINDING_POSITION;
      this.position = this.findBuildPosition();
      if (!this.position) {
        this.position = new BlockPos(
          Math.floor(this.bot.entity.position.x),
          Math.floor(this.bot.entity.position.y),
          Math.floor(this.bot.entity.position.z)
        );
      }
    }

    // Place base iron block
    if (!this.isBlock(this.position, 'iron_block')) {
      if (!this.isAir(this.position)) {
        this.state = ConstructIronGolemState.PLACING_BASE;
        return new DestroyBlockTask(this.bot, this.position.x, this.position.y, this.position.z);
      }
      this.state = ConstructIronGolemState.PLACING_BASE;
      return new PlaceBlockTask(this.bot, this.position.x, this.position.y, this.position.z, 'iron_block');
    }

    // Place center iron block (above base)
    const centerPos = this.position.offset(0, 1, 0);
    if (!this.isBlock(centerPos, 'iron_block')) {
      if (!this.isAir(centerPos)) {
        this.state = ConstructIronGolemState.PLACING_CENTER;
        return new DestroyBlockTask(this.bot, centerPos.x, centerPos.y, centerPos.z);
      }
      this.state = ConstructIronGolemState.PLACING_CENTER;
      return new PlaceBlockTask(this.bot, centerPos.x, centerPos.y, centerPos.z, 'iron_block');
    }

    // Place east arm
    const eastPos = centerPos.offset(1, 0, 0);
    if (!this.isBlock(eastPos, 'iron_block')) {
      if (!this.isAir(eastPos)) {
        this.state = ConstructIronGolemState.PLACING_ARMS;
        return new DestroyBlockTask(this.bot, eastPos.x, eastPos.y, eastPos.z);
      }
      this.state = ConstructIronGolemState.PLACING_ARMS;
      return new PlaceBlockTask(this.bot, eastPos.x, eastPos.y, eastPos.z, 'iron_block');
    }

    // Place west arm
    const westPos = centerPos.offset(-1, 0, 0);
    if (!this.isBlock(westPos, 'iron_block')) {
      if (!this.isAir(westPos)) {
        this.state = ConstructIronGolemState.PLACING_ARMS;
        return new DestroyBlockTask(this.bot, westPos.x, westPos.y, westPos.z);
      }
      this.state = ConstructIronGolemState.PLACING_ARMS;
      return new PlaceBlockTask(this.bot, westPos.x, westPos.y, westPos.z, 'iron_block');
    }

    // Clear area around base for golem to spawn
    const clearEast = this.position.offset(1, 0, 0);
    if (!this.isAir(clearEast)) {
      this.state = ConstructIronGolemState.CLEARING_AREA;
      return new DestroyBlockTask(this.bot, clearEast.x, clearEast.y, clearEast.z);
    }

    const clearWest = this.position.offset(-1, 0, 0);
    if (!this.isAir(clearWest)) {
      this.state = ConstructIronGolemState.CLEARING_AREA;
      return new DestroyBlockTask(this.bot, clearWest.x, clearWest.y, clearWest.z);
    }

    // Place pumpkin head (this spawns the golem!)
    const headPos = this.position.offset(0, 2, 0);
    if (!this.isAir(headPos)) {
      this.state = ConstructIronGolemState.PLACING_HEAD;
      return new DestroyBlockTask(this.bot, headPos.x, headPos.y, headPos.z);
    }

    this.canBeFinished = true;
    this.state = ConstructIronGolemState.PLACING_HEAD;
    return new PlaceBlockTask(this.bot, headPos.x, headPos.y, headPos.z, 'carved_pumpkin');
  }

  /**
   * Check if position has specific block
   */
  private isBlock(pos: BlockPos, blockName: string): boolean {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    return block !== null && block.name === blockName;
  }

  /**
   * Check if position is air
   */
  private isAir(pos: BlockPos): boolean {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    return block === null || block.name === 'air';
  }

  /**
   * Check if player has item
   */
  private hasItem(itemName: string): boolean {
    return this.bot.inventory.items().some((item) => item.name.includes(itemName));
  }

  /**
   * Get count of item in inventory
   */
  private getItemCount(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Calculate iron blocks needed
   */
  private getIronBlocksNeeded(): number {
    if (!this.position) return 4;

    let needed = 0;
    if (!this.isBlock(this.position, 'iron_block')) needed++;
    if (!this.isBlock(this.position.offset(0, 1, 0), 'iron_block')) needed++;
    if (!this.isBlock(this.position.offset(1, 1, 0), 'iron_block')) needed++;
    if (!this.isBlock(this.position.offset(-1, 1, 0), 'iron_block')) needed++;

    return needed;
  }

  /**
   * Find a suitable position to build the golem
   */
  private findBuildPosition(): BlockPos | null {
    const playerPos = this.bot.entity.position;

    // Search for air space
    for (let y = 64; y <= 128; y++) {
      const pos = new Vec3(playerPos.x, y, playerPos.z);
      const block = this.bot.blockAt(pos);
      if (block && block.name === 'air') {
        return new BlockPos(
          Math.floor(pos.x),
          Math.floor(pos.y),
          Math.floor(pos.z)
        );
      }
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    if (!this.position || !this.canBeFinished) return false;

    // Check if an iron golem spawned nearby
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'iron_golem') {
        const dist = entity.position.distanceTo(
          new Vec3(this.position.x, this.position.y, this.position.z)
        );
        if (dist < 3) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get current state
   */
  getState(): ConstructIronGolemState {
    return this.state;
  }

  /**
   * Get build position
   */
  getPosition(): BlockPos | null {
    return this.position;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof ConstructIronGolemTask;
  }
}

/**
 * Convenience function to construct an iron golem
 */
export function constructIronGolem(bot: Bot, position?: BlockPos): ConstructIronGolemTask {
  return new ConstructIronGolemTask(bot, position || null);
}
