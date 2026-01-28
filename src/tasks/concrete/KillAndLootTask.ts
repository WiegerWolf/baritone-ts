/**
 * KillAndLootTask - Kill Entities and Collect Dropped Items
 * Based on BaritonePlus's KillAndLootTask.java
 *
 * WHY: Many items come from killing mobs - meat from animals, string
 * from spiders, ender pearls from endermen. This task handles finding
 * and killing entities while also collecting their drops.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ResourceTask, ItemTarget, itemTarget } from './ResourceTask';
import { DoToClosestEntityTask } from './EntityTask';
import { PickupItemTask } from './InventoryTask';
import { TimeoutWanderTask } from './MovementUtilTask';
import { FollowEntityTask } from './GoToTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for kill and loot task
 */
enum KillLootState {
  SEARCHING,
  KILLING,
  LOOTING,
  WANDERING,
  FINISHED,
  FAILED
}

/**
 * Configuration for KillAndLootTask
 */
export interface KillAndLootConfig {
  /** Entity types to hunt */
  entityTypes: string[];
  /** Custom entity filter */
  entityFilter?: (entity: Entity) => boolean;
  /** Attack cooldown in seconds */
  attackCooldown: number;
  /** Search radius for entities */
  searchRadius: number;
  /** Loot collection radius */
  lootRadius: number;
}

const DEFAULT_CONFIG: KillAndLootConfig = {
  entityTypes: [],
  attackCooldown: 0.5,
  searchRadius: 64,
  lootRadius: 16,
};

/**
 * Task to kill entities and collect their drops.
 *
 * WHY: Mob drops are essential resources - food, crafting materials,
 * and special items. This task hunts, kills, and automatically
 * collects any dropped loot matching our item targets.
 *
 * Based on BaritonePlus KillAndLootTask.java
 */
export class KillAndLootTask extends ResourceTask {
  private config: KillAndLootConfig;
  private state: KillLootState = KillLootState.SEARCHING;
  private currentTarget: Entity | null = null;
  private attackTimer: TimerGame;
  private lootingTimer: TimerGame;

  constructor(
    bot: Bot,
    itemTargets: ItemTarget[],
    entityTypes: string[],
    config: Partial<KillAndLootConfig> = {}
  ) {
    super(bot, itemTargets);
    this.config = { ...DEFAULT_CONFIG, ...config, entityTypes };
    this.attackTimer = new TimerGame(bot, this.config.attackCooldown);
    this.lootingTimer = new TimerGame(bot, 3); // Wait 3 seconds for loot to drop
  }

  get displayName(): string {
    const entityName = this.config.entityTypes.length === 1
      ? this.config.entityTypes[0]
      : `${this.config.entityTypes.length} types`;
    return `KillAndLoot(${entityName})`;
  }

  protected onResourceStart(): void {
    this.state = KillLootState.SEARCHING;
    this.currentTarget = null;
    this.attackTimer.reset();
    this.lootingTimer.reset();
  }

  protected onResourceTick(): Task | null {
    switch (this.state) {
      case KillLootState.SEARCHING:
        return this.handleSearching();

      case KillLootState.KILLING:
        return this.handleKilling();

      case KillLootState.LOOTING:
        return this.handleLooting();

      case KillLootState.WANDERING:
        return this.handleWandering();

      default:
        return null;
    }
  }

  private handleSearching(): Task | null {
    // Find a matching entity
    const entity = this.findTargetEntity();

    if (!entity) {
      // No entity found - wander
      this.state = KillLootState.WANDERING;
      return null;
    }

    this.currentTarget = entity;
    this.state = KillLootState.KILLING;
    return null;
  }

  private handleKilling(): Task | null {
    // Verify target is still valid
    if (!this.currentTarget || !this.isValidTarget(this.currentTarget)) {
      // Target died or disappeared - collect loot
      this.state = KillLootState.LOOTING;
      this.lootingTimer.reset();
      this.currentTarget = null;
      return null;
    }

    // Get distance to target
    const playerPos = this.bot.entity.position;
    const dist = playerPos.distanceTo(this.currentTarget.position);

    // In attack range?
    if (dist <= 4) {
      // Attack if cooldown is ready
      if (this.attackTimer.elapsed()) {
        try {
          this.bot.attack(this.currentTarget);
          this.attackTimer.reset();
        } catch {
          // Attack failed - will retry
        }
      }

      // Return null to keep attacking
      return null;
    }

    // Chase the entity
    return new FollowEntityTask(this.bot, this.currentTarget.id, 2);
  }

  private handleLooting(): Task | null {
    // Look for dropped items
    const nearbyLoot = this.findNearbyLoot();

    if (nearbyLoot) {
      // Pick up the loot
      const itemName = this.itemTargets[0]?.items[0] ?? '';
      return new PickupItemTask(this.bot, itemName);
    }

    // Wait a bit for items to drop
    if (!this.lootingTimer.elapsed()) {
      return null;
    }

    // No more loot, search for more entities
    this.state = KillLootState.SEARCHING;
    return null;
  }

  private handleWandering(): Task | null {
    // Wander to find more entities
    const subtask = new TimeoutWanderTask(this.bot, 15);

    // Check if we found an entity
    const entity = this.findTargetEntity();
    if (entity) {
      this.currentTarget = entity;
      this.state = KillLootState.KILLING;
      return null;
    }

    return subtask;
  }

  protected onResourceStop(interruptTask: ITask | null): void {
    this.currentTarget = null;
  }

  protected isEqualResource(other: ResourceTask): boolean {
    if (!(other instanceof KillAndLootTask)) return false;
    return JSON.stringify(this.config.entityTypes) === JSON.stringify(other.config.entityTypes);
  }

  // ---- Helper methods ----

  private findTargetEntity(): Entity | null {
    const playerPos = this.bot.entity.position;
    let nearest: Entity | null = null;
    let nearestDist = this.config.searchRadius;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;

      // Check entity type
      const entityName = entity.name ?? '';
      if (!this.config.entityTypes.includes(entityName)) continue;

      // Check custom filter
      if (this.config.entityFilter && !this.config.entityFilter(entity)) continue;

      // Check if valid
      if (!this.isValidTarget(entity)) continue;

      // Check distance
      const dist = playerPos.distanceTo(entity.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private isValidTarget(entity: Entity): boolean {
    if (entity.isValid === false) return false;

    // Check if entity has health (not dead)
    const health = (entity as any).health;
    if (health !== undefined && health <= 0) return false;

    return true;
  }

  private findNearbyLoot(): any | null {
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity.type !== 'object') continue;

      // Check if it's an item entity
      const itemEntity = entity as any;
      if (itemEntity.objectType !== 'Item' && itemEntity.entityType !== 'item') continue;

      // Check distance
      const dist = playerPos.distanceTo(entity.position);
      if (dist > this.config.lootRadius) continue;

      // Check if item matches our targets
      const itemName = itemEntity.metadata?.[8]?.itemId ?? '';
      if (this.itemTargets.some(target =>
        target.items.some(name => itemName.includes(name))
      )) {
        return entity;
      }
    }

    return null;
  }
}

/**
 * Helper function to create a kill and loot task
 */
export function killAndLoot(
  bot: Bot,
  entityType: string,
  itemName: string,
  count: number
): KillAndLootTask {
  return new KillAndLootTask(
    bot,
    [itemTarget(itemName, count)],
    [entityType]
  );
}

/**
 * Hunt animals for food
 */
export function huntForFood(
  bot: Bot,
  count: number
): KillAndLootTask {
  const animalTypes = ['cow', 'pig', 'sheep', 'chicken', 'rabbit'];
  const foodItems = ['beef', 'porkchop', 'mutton', 'chicken', 'rabbit'];

  return new KillAndLootTask(
    bot,
    foodItems.map(item => itemTarget(item, Math.ceil(count / foodItems.length))),
    animalTypes
  );
}

/**
 * Hunt specific mob for specific drop
 */
export function huntMobForDrop(
  bot: Bot,
  mobType: string,
  dropName: string,
  count: number,
  filter?: (entity: Entity) => boolean
): KillAndLootTask {
  return new KillAndLootTask(
    bot,
    [itemTarget(dropName, count)],
    [mobType],
    { entityFilter: filter }
  );
}
