/**
 * HeroTask - Autonomous hostile mob clearing
 * Based on BaritonePlus's HeroTask.java
 *
 * WHY this task matters:
 * - Keeps area safe from hostile mobs
 * - Collects XP orbs and mob drops
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { itemTarget } from './ResourceTask';
import { TimeoutWanderTask } from './MovementUtilTask';
import { KillAndLootTask } from './KillAndLootTask';
import { PickupItemTask } from './InventoryTask';
import { GetToBlockTask } from './GoToTask';

/**
 * Hostile mob types to hunt
 */
export const HOSTILE_MOBS = [
  'zombie',
  'skeleton',
  'spider',
  'creeper',
  'enderman',
  'witch',
  'slime',
  'phantom',
  'drowned',
  'husk',
  'stray',
  'zombie_villager',
];

/**
 * Drops from hostile mobs
 */
export const HOSTILE_MOB_DROPS = [
  'rotten_flesh',
  'bone',
  'arrow',
  'string',
  'spider_eye',
  'gunpowder',
  'ender_pearl',
  'slime_ball',
  'phantom_membrane',
];

/**
 * State for hero task
 */
export enum HeroState {
  EATING,
  COLLECTING_XP,
  KILLING_HOSTILE,
  COLLECTING_DROPS,
  SEARCHING,
}

/**
 * Task to autonomously clear hostile mobs.
 *
 * WHY: Keeping an area safe is important for:
 * - Protecting villagers and structures
 * - Collecting mob drops for resources
 * - Earning XP from combat
 *
 * Based on BaritonePlus HeroTask.java
 */
export class HeroTask extends Task {
  private state: HeroState = HeroState.SEARCHING;

  constructor(bot: Bot) {
    super(bot);
  }

  get displayName(): string {
    return `Hero(state: ${HeroState[this.state]})`;
  }

  onStart(): void {
    this.state = HeroState.SEARCHING;
  }

  onTick(): Task | null {
    // Check if we need to eat first
    if (this.needsToEat()) {
      this.state = HeroState.EATING;
      return null; // Let food chain handle eating
    }

    // Look for experience orbs
    const xpOrb = this.findNearbyEntity('experience_orb');
    if (xpOrb) {
      this.state = HeroState.COLLECTING_XP;
      return new GetToBlockTask(
        this.bot,
        Math.floor(xpOrb.position.x),
        Math.floor(xpOrb.position.y),
        Math.floor(xpOrb.position.z)
      );
    }

    // Look for hostile mobs
    const hostile = this.findNearbyHostile();
    if (hostile) {
      this.state = HeroState.KILLING_HOSTILE;
      return new KillAndLootTask(
        this.bot,
        HOSTILE_MOB_DROPS.map(drop => itemTarget(drop, 64)),
        [hostile.name || 'zombie'],
        {}
      );
    }

    // Look for mob drops
    const droppedItem = this.findDroppedHostileDrop();
    if (droppedItem) {
      this.state = HeroState.COLLECTING_DROPS;
      return new PickupItemTask(this.bot, droppedItem, 64);
    }

    // Wander to find more mobs
    this.state = HeroState.SEARCHING;
    return new TimeoutWanderTask(this.bot);
  }

  onStop(interruptTask: ITask | null): void {
    // Clean up
  }

  /**
   * Check if player needs to eat
   */
  private needsToEat(): boolean {
    const food = (this.bot as any).food || 20;
    return food < 14;
  }

  /**
   * Find nearby entity by name
   */
  private findNearbyEntity(entityName: string): any | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === entityName) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Find nearby hostile mob
   */
  private findNearbyHostile(): any | null {
    let closest: any = null;
    let closestDist = Infinity;
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name && HOSTILE_MOBS.includes(entity.name)) {
        const dist = entity.position.distanceTo(playerPos);
        if (dist < closestDist) {
          closest = entity;
          closestDist = dist;
        }
      }
    }

    return closest;
  }

  /**
   * Find dropped hostile mob item
   */
  private findDroppedHostileDrop(): string | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'item') {
        // Would need to check item stack for hostile drops
        // Simplified: return first item found
        return 'rotten_flesh';
      }
    }
    return null;
  }

  /**
   * Get current state
   */
  getState(): HeroState {
    return this.state;
  }

  isFinished(): boolean {
    // Hero task never finishes - it runs continuously
    return false;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof HeroTask;
  }
}

/**
 * Convenience function to create HeroTask
 */
export function beHero(bot: Bot): HeroTask {
  return new HeroTask(bot);
}
