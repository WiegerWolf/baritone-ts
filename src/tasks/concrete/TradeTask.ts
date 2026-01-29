/**
 * TradeTask - Trading Tasks
 * Based on BaritonePlus's TradeWithPiglinsTask.java
 *
 * WHY: Trading is essential for progression in Minecraft. Piglins trade
 * gold for items needed for the nether (ender pearls, fire resistance).
 * This task handles the complex mechanics of piglin bartering.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ResourceTask, ItemTarget, itemTarget, Dimension } from './ResourceTask';
import { AbstractDoToEntityTask } from './EntityTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for piglin trading task
 */
enum TradeState {
  CHECKING_GOLD,
  FINDING_PIGLIN,
  TRADING,
  WANDERING,
  FINISHED,
  FAILED
}

/**
 * Configuration for TradeWithPiglinsTask
 */
export interface PiglinTradeConfig {
  /** Buffer of gold ingots to keep in reserve */
  goldBuffer: number;
  /** Radius to avoid hoglins when trading */
  hoglinAvoidRadius: number;
  /** Timeout for barter interaction */
  barterTimeout: number;
  /** Distance considered "too far" from trading piglin */
  maxTradingDistance: number;
}

const DEFAULT_CONFIG: PiglinTradeConfig = {
  goldBuffer: 8,
  hoglinAvoidRadius: 64,
  barterTimeout: 2,
  maxTradingDistance: 72,
};

/**
 * Task to trade with piglins for items.
 *
 * WHY: Piglins are the only way to get certain items in survival mode
 * (like ender pearls in the nether). This task handles:
 * - Finding adult piglins
 * - Avoiding hoglins that distract piglins
 * - Giving gold ingots and collecting drops
 * - Blacklisting unresponsive piglins
 *
 * Based on BaritonePlus TradeWithPiglinsTask.java
 */
export class TradeWithPiglinsTask extends ResourceTask {
  private config: PiglinTradeConfig;
  private state: TradeState = TradeState.CHECKING_GOLD;
  private barterTimeout: TimerGame;
  private intervalTimeout: TimerGame;
  private currentPiglin: Entity | null = null;
  private blacklistedPiglins: Set<number> = new Set();

  constructor(
    bot: Bot,
    itemTargets: ItemTarget[],
    config: Partial<PiglinTradeConfig> = {}
  ) {
    super(bot, itemTargets);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.barterTimeout = new TimerGame(bot, this.config.barterTimeout);
    this.intervalTimeout = new TimerGame(bot, 10);
  }

  get displayName(): string {
    const targetNames = this.itemTargets.map(t => t.items[0]).join(', ');
    return `TradeWithPiglins(${targetNames})`;
  }

  protected onResourceStart(): void {
    this.state = TradeState.CHECKING_GOLD;
    this.currentPiglin = null;
    this.blacklistedPiglins.clear();
    this.barterTimeout.reset();
  }

  protected onResourceTick(): Task | null {
    // Check dimension - piglins only spawn in nether
    if (this.getCurrentDimension() !== Dimension.NETHER) {
      this.markFailed();
      return null;
    }

    switch (this.state) {
      case TradeState.CHECKING_GOLD:
        return this.handleCheckingGold();

      case TradeState.FINDING_PIGLIN:
        return this.handleFindingPiglin();

      case TradeState.TRADING:
        return this.handleTrading();

      case TradeState.WANDERING:
        return this.handleWandering();

      default:
        return null;
    }
  }

  private handleCheckingGold(): Task | null {
    // Check if we have gold to trade
    const goldCount = this.countItem('gold_ingot');

    if (goldCount === 0) {
      // No gold - fail for now (could add gold mining subtask)
      this.markFailed();
      return null;
    }

    this.state = TradeState.FINDING_PIGLIN;
    return null;
  }

  private handleFindingPiglin(): Task | null {
    // Find an available piglin
    const piglin = this.findTradablePiglin();

    if (!piglin) {
      // No piglin found, wander
      this.state = TradeState.WANDERING;
      return null;
    }

    this.currentPiglin = piglin;
    this.state = TradeState.TRADING;
    this.barterTimeout.reset();
    return null;
  }

  private handleTrading(): Task | null {
    if (!this.currentPiglin || !this.currentPiglin.isValid) {
      this.currentPiglin = null;
      this.state = TradeState.FINDING_PIGLIN;
      return null;
    }

    // Reset barter timeout if piglin is still trading
    if (this.isPiglinTrading(this.currentPiglin)) {
      this.barterTimeout.reset();
    }

    // Check for barter timeout
    if (this.barterTimeout.elapsed()) {
      // Blacklist this piglin
      this.blacklistedPiglins.add(this.currentPiglin.id);
      this.currentPiglin = null;
      this.state = TradeState.FINDING_PIGLIN;
      return null;
    }

    // Check for nearby hoglins
    if (this.isHoglinNearby(this.currentPiglin)) {
      this.blacklistedPiglins.add(this.currentPiglin.id);
      this.currentPiglin = null;
      this.state = TradeState.FINDING_PIGLIN;
      return null;
    }

    // Return subtask to interact with piglin
    return new PerformPiglinTradeTask(
      this.bot,
      this.currentPiglin,
      () => {
        // On success callback
        this.intervalTimeout.reset();
      },
      () => {
        // On fail callback
        if (this.currentPiglin) {
          this.blacklistedPiglins.add(this.currentPiglin.id);
        }
        this.currentPiglin = null;
        this.state = TradeState.FINDING_PIGLIN;
      }
    );
  }

  private handleWandering(): Task | null {
    // Check for piglins while wandering
    const piglin = this.findTradablePiglin();
    if (piglin) {
      this.currentPiglin = piglin;
      this.state = TradeState.TRADING;
      return null;
    }

    return new TimeoutWanderTask(this.bot, 15);
  }

  protected onResourceStop(interruptTask: ITask | null): void {
    this.currentPiglin = null;
    this.blacklistedPiglins.clear();
  }

  protected isEqualResource(other: ResourceTask): boolean {
    if (!(other instanceof TradeWithPiglinsTask)) return false;
    return true; // All piglin trading tasks are effectively equal
  }

  // ---- Helper methods ----

  private findTradablePiglin(): Entity | null {
    const playerPos = this.bot.entity.position;
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || !entity.isValid) continue;

      // Check if it's a piglin
      const name = entity.name ?? entity.type;
      if (!name?.includes('piglin') || name.includes('zombified')) continue;

      // Skip blacklisted
      if (this.blacklistedPiglins.has(entity.id)) continue;

      // Skip baby piglins
      if (this.isBabyPiglin(entity)) continue;

      // Skip if already trading
      if (this.isPiglinTrading(entity)) continue;

      // Skip if hoglin nearby
      if (this.isHoglinNearby(entity)) continue;

      // Check distance
      const dist = playerPos.distanceTo(entity.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private isBabyPiglin(entity: Entity): boolean {
    // In mineflayer, check metadata for baby status
    const metadata = entity.metadata;
    if (Array.isArray(metadata)) {
      // Baby flag is typically at index 16 or check type
      return (metadata as any).isBaby === true;
    }
    return false;
  }

  private isPiglinTrading(entity: Entity): boolean {
    // Check if piglin is holding a gold ingot (trading animation)
    // This is approximated - actual implementation depends on mineflayer's entity data
    const metadata = entity.metadata;
    return false; // Simplified - would need to check entity equipment
  }

  private isHoglinNearby(piglin: Entity): boolean {
    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || !entity.isValid) continue;

      const name = entity.name ?? entity.type;
      if (!name?.includes('hoglin')) continue;

      const dist = piglin.position.distanceTo(entity.position);
      if (dist < this.config.hoglinAvoidRadius) {
        return true;
      }
    }
    return false;
  }

  private countItem(itemName: string): number {
    return this.bot.inventory.items()
      .filter(item => item.name === itemName)
      .reduce((sum, item) => sum + item.count, 0);
  }
}

/**
 * Internal task to perform the actual piglin interaction
 */
class PerformPiglinTradeTask extends Task {
  private piglin: Entity;
  private onSuccess: () => void;
  private onFail: () => void;
  private finished: boolean = false;
  private interacted: boolean = false;

  constructor(
    bot: Bot,
    piglin: Entity,
    onSuccess: () => void,
    onFail: () => void
  ) {
    super(bot);
    this.piglin = piglin;
    this.onSuccess = onSuccess;
    this.onFail = onFail;
  }

  get displayName(): string {
    return 'PerformPiglinTrade';
  }

  onStart(): void {
    this.finished = false;
    this.interacted = false;
  }

  onTick(): Task | null {
    if (!this.piglin || !this.piglin.isValid) {
      this.onFail();
      this.finished = true;
      return null;
    }

    // Check distance to piglin
    const dist = this.bot.entity.position.distanceTo(this.piglin.position);

    if (dist > 3) {
      // Need to get closer - would return navigation task
      // For now, move toward piglin
      this.bot.setControlState('forward', true);
      this.bot.lookAt(this.piglin.position.offset(0, 1.6, 0));
      return null;
    }

    // Stop moving
    this.bot.clearControlStates();

    // Equip gold ingot and interact
    if (!this.interacted) {
      this.tryInteract();
    }

    this.onSuccess();
    this.finished = true;
    return null;
  }

  private tryInteract(): void {
    // Find gold ingot in inventory
    const goldItem = this.bot.inventory.items().find(item => item.name === 'gold_ingot');
    if (!goldItem) {
      this.onFail();
      return;
    }

    try {
      // Equip gold
      this.bot.equip(goldItem, 'hand');

      // Look at piglin
      this.bot.lookAt(this.piglin.position.offset(0, 1.6, 0));

      // Use item on piglin (right-click)
      this.bot.useOn(this.piglin);
      this.interacted = true;
    } catch {
      this.onFail();
    }
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.finished;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PerformPiglinTradeTask)) return false;
    return this.piglin.id === other.piglin.id;
  }
}

/**
 * Helper to trade with piglins for a specific item
 */
export function tradeWithPiglins(
  bot: Bot,
  item: string,
  count: number,
  goldBuffer: number = 8
): TradeWithPiglinsTask {
  return new TradeWithPiglinsTask(bot, [itemTarget(item, count)], { goldBuffer });
}

/**
 * Helper to trade for ender pearls
 */
export function tradeForEnderPearls(bot: Bot, count: number): TradeWithPiglinsTask {
  return tradeWithPiglins(bot, 'ender_pearl', count);
}

/**
 * Helper to trade for fire resistance potions
 */
export function tradeForFireResistance(bot: Bot, count: number): TradeWithPiglinsTask {
  return tradeWithPiglins(bot, 'potion', count); // Simplified - would need splash/lingering detection
}
