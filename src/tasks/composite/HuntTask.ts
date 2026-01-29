/**
 * HuntTask - Animal Hunting Automation
 * Based on AltoClef patterns
 *
 * Handles finding, tracking, and killing animals for food and resources.
 * Supports selective hunting and cooking automation.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { AttackEntityTask } from '../concrete/InteractTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for hunting
 */
enum HuntState {
  SEARCHING,
  APPROACHING,
  ATTACKING,
  COLLECTING_DROPS,
  FINISHED,
  FAILED
}

/**
 * Animal types and their drops
 */
const ANIMAL_DATA: Record<string, { food: string[]; other: string[] }> = {
  'pig': { food: ['porkchop'], other: [] },
  'cow': { food: ['beef'], other: ['leather'] },
  'sheep': { food: ['mutton'], other: ['white_wool'] },
  'chicken': { food: ['chicken'], other: ['feather'] },
  'rabbit': { food: ['rabbit'], other: ['rabbit_hide', 'rabbit_foot'] },
  'cod': { food: ['cod'], other: [] },
  'salmon': { food: ['salmon'], other: [] },
};

/**
 * All huntable animals
 */
const HUNTABLE_ANIMALS = Object.keys(ANIMAL_DATA);

/**
 * Configuration for hunting
 */
export interface HuntConfig {
  /** Target animals to hunt */
  targetAnimals: string[];
  /** Number of kills needed */
  targetKills: number;
  /** Search radius */
  searchRadius: number;
  /** Collect dropped items */
  collectDrops: boolean;
  /** Cook meat after hunting */
  cookMeat: boolean;
  /** Attack range */
  attackRange: number;
  /** Avoid baby animals */
  avoidBabies: boolean;
}

const DEFAULT_CONFIG: HuntConfig = {
  targetAnimals: HUNTABLE_ANIMALS,
  targetKills: 5,
  searchRadius: 64,
  collectDrops: true,
  cookMeat: false,
  attackRange: 3.5,
  avoidBabies: true,
};

/**
 * Task for hunting animals
 */
export class HuntTask extends Task {
  private config: HuntConfig;
  private state: HuntState = HuntState.SEARCHING;
  private currentTarget: Entity | null = null;
  private killCount: number = 0;
  private attackTimer: TimerGame;
  private searchTimer: TimerGame;
  private lastKillPos: Vec3 | null = null;

  constructor(bot: Bot, config: Partial<HuntConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.attackTimer = new TimerGame(bot, 0.5);
    this.searchTimer = new TimerGame(bot, 2.0);
  }

  get displayName(): string {
    return `Hunt(${this.killCount}/${this.config.targetKills}, ${HuntState[this.state]})`;
  }

  onStart(): void {
    this.state = HuntState.SEARCHING;
    this.currentTarget = null;
    this.killCount = 0;
    this.lastKillPos = null;
  }

  onTick(): Task | null {
    // Check if done
    if (this.killCount >= this.config.targetKills) {
      this.state = HuntState.FINISHED;
      return null;
    }

    switch (this.state) {
      case HuntState.SEARCHING:
        return this.handleSearching();

      case HuntState.APPROACHING:
        return this.handleApproaching();

      case HuntState.ATTACKING:
        return this.handleAttacking();

      case HuntState.COLLECTING_DROPS:
        return this.handleCollectingDrops();

      default:
        return null;
    }
  }

  private handleSearching(): Task | null {
    this.currentTarget = this.findNearestTarget();

    if (this.currentTarget) {
      this.state = HuntState.APPROACHING;
      return null;
    }

    // No targets found
    if (this.searchTimer.elapsed()) {
      this.state = HuntState.FAILED;
    }

    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.currentTarget || !this.currentTarget.isValid) {
      this.state = HuntState.SEARCHING;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentTarget.position);

    if (dist <= this.config.attackRange) {
      this.state = HuntState.ATTACKING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.currentTarget.position.x),
      Math.floor(this.currentTarget.position.y),
      Math.floor(this.currentTarget.position.z),
      Math.floor(this.config.attackRange - 0.5)
    );
  }

  private handleAttacking(): Task | null {
    if (!this.currentTarget || !this.currentTarget.isValid) {
      // Target died or despawned
      this.killCount++;
      this.lastKillPos = this.currentTarget?.position.clone() ?? null;

      if (this.config.collectDrops && this.lastKillPos) {
        this.state = HuntState.COLLECTING_DROPS;
      } else {
        this.state = HuntState.SEARCHING;
      }
      this.currentTarget = null;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentTarget.position);

    // Target ran away
    if (dist > this.config.attackRange + 2) {
      this.state = HuntState.APPROACHING;
      return null;
    }

    // Attack
    if (this.attackTimer.elapsed()) {
      this.attackTimer.reset();
      return new AttackEntityTask(this.bot, this.currentTarget.id);
    }

    // Look at target while waiting for cooldown
    try {
      this.bot.lookAt(this.currentTarget.position.offset(0, 1, 0));
    } catch {
      // May fail
    }

    return null;
  }

  private handleCollectingDrops(): Task | null {
    if (!this.lastKillPos) {
      this.state = HuntState.SEARCHING;
      return null;
    }

    // Look for dropped items near kill location
    const droppedItem = this.findNearbyDrop();

    if (!droppedItem) {
      // No more drops or already collected
      this.state = HuntState.SEARCHING;
      this.lastKillPos = null;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(droppedItem.position);
    if (dist < 2) {
      // Should auto-pickup, move on
      this.state = HuntState.SEARCHING;
      return null;
    }

    // Move toward dropped item to pick it up
    return new GoToNearTask(
      this.bot,
      Math.floor(droppedItem.position.x),
      Math.floor(droppedItem.position.y),
      Math.floor(droppedItem.position.z),
      1
    );
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.currentTarget = null;
  }

  isFinished(): boolean {
    return this.state === HuntState.FINISHED || this.state === HuntState.FAILED;
  }

  isFailed(): boolean {
    return this.state === HuntState.FAILED;
  }

  // ---- Helper Methods ----

  private findNearestTarget(): Entity | null {
    const playerPos = this.bot.entity.position;
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;
      if (!this.isValidTarget(entity)) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist <= this.config.searchRadius && dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private isValidTarget(entity: Entity): boolean {
    const name = entity.name ?? '';

    // Check if it's a target animal
    if (!this.config.targetAnimals.includes(name)) {
      return false;
    }

    // Check if it's a baby (if avoiding babies)
    if (this.config.avoidBabies && this.isBaby(entity)) {
      return false;
    }

    return true;
  }

  private isBaby(entity: Entity): boolean {
    // Check metadata for baby flag
    const metadata = (entity as any).metadata;
    if (metadata) {
      // Baby animals typically have a specific metadata flag
      return metadata[16] === true || metadata.isBaby === true;
    }
    return false;
  }

  private findNearbyDrop(): Entity | null {
    if (!this.lastKillPos) return null;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity.name !== 'item') continue;

      const dist = entity.position.distanceTo(this.lastKillPos);
      if (dist < 10) {
        return entity;
      }
    }

    return null;
  }

  /**
   * Get kill count
   */
  getKillCount(): number {
    return this.killCount;
  }

  /**
   * Get current state
   */
  getCurrentState(): HuntState {
    return this.state;
  }

  /**
   * Get current target
   */
  getCurrentTarget(): Entity | null {
    return this.currentTarget;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof HuntTask)) return false;

    return this.config.targetKills === other.config.targetKills &&
           JSON.stringify(this.config.targetAnimals) === JSON.stringify(other.config.targetAnimals);
  }
}

/**
 * Convenience functions
 */
export function huntAnimals(bot: Bot, count: number = 5): HuntTask {
  return new HuntTask(bot, { targetKills: count });
}

export function huntForFood(bot: Bot): HuntTask {
  return new HuntTask(bot, {
    targetAnimals: ['pig', 'cow', 'sheep', 'chicken'],
    targetKills: 10,
  });
}

export function huntCows(bot: Bot, count: number = 5): HuntTask {
  return new HuntTask(bot, {
    targetAnimals: ['cow'],
    targetKills: count,
  });
}

export function huntForLeather(bot: Bot): HuntTask {
  return new HuntTask(bot, {
    targetAnimals: ['cow', 'rabbit'],
    targetKills: 10,
  });
}

export function huntChickens(bot: Bot, count: number = 5): HuntTask {
  return new HuntTask(bot, {
    targetAnimals: ['chicken'],
    targetKills: count,
  });
}
