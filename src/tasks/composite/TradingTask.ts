/**
 * TradingTask - Villager Trading Automation
 * Based on AltoClef's trading behavior
 *
 * Handles finding villagers, opening trades, and executing trades.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { InteractEntityTask } from '../concrete/InteractEntityTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Trade offer information
 */
interface TradeOffer {
  inputItem1: { name: string; count: number };
  inputItem2?: { name: string; count: number };
  outputItem: { name: string; count: number };
  tradeDisabled: boolean;
  maxUses: number;
  uses: number;
}

/**
 * State for trading
 */
enum TradingState {
  FINDING_VILLAGER,
  APPROACHING,
  OPENING_TRADE,
  SELECTING_TRADE,
  TRADING,
  CLOSING,
  FINISHED,
  FAILED
}

/**
 * Configuration for trading
 */
export interface TradingConfig {
  /** Target villager professions (empty = any) */
  professions: string[];
  /** Items to buy */
  wantedItems: string[];
  /** Items to sell */
  sellableItems: string[];
  /** Search radius for villagers */
  searchRadius: number;
  /** Maximum trades to perform (0 = until can't trade more) */
  maxTrades: number;
  /** Only trade with discounted offers */
  preferDiscounts: boolean;
}

const DEFAULT_CONFIG: TradingConfig = {
  professions: [],
  wantedItems: [],
  sellableItems: [],
  searchRadius: 32,
  maxTrades: 0,
  preferDiscounts: false,
};

/**
 * Villager professions
 */
const VILLAGER_PROFESSIONS = [
  'armorer', 'butcher', 'cartographer', 'cleric', 'farmer',
  'fisherman', 'fletcher', 'leatherworker', 'librarian', 'mason',
  'nitwit', 'none', 'shepherd', 'toolsmith', 'weaponsmith',
];

/**
 * Task for trading with villagers
 */
export class TradingTask extends Task {
  private config: TradingConfig;
  private state: TradingState = TradingState.FINDING_VILLAGER;
  private targetVillager: Entity | null = null;
  private currentTrade: number = -1;
  private tradeCount: number = 0;
  private tradeTimer: TimerGame;
  private windowOpen: boolean = false;

  constructor(bot: Bot, config: Partial<TradingConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tradeTimer = new TimerGame(bot, 1.0);
  }

  get displayName(): string {
    const target = this.targetVillager?.name ?? 'none';
    return `Trading(villager: ${target}, trades: ${this.tradeCount})`;
  }

  onStart(): void {
    this.state = TradingState.FINDING_VILLAGER;
    this.targetVillager = null;
    this.currentTrade = -1;
    this.tradeCount = 0;
    this.windowOpen = false;
  }

  onTick(): Task | null {
    // Check max trades
    if (this.config.maxTrades > 0 && this.tradeCount >= this.config.maxTrades) {
      this.state = TradingState.CLOSING;
    }

    switch (this.state) {
      case TradingState.FINDING_VILLAGER:
        return this.handleFindingVillager();

      case TradingState.APPROACHING:
        return this.handleApproaching();

      case TradingState.OPENING_TRADE:
        return this.handleOpeningTrade();

      case TradingState.SELECTING_TRADE:
        return this.handleSelectingTrade();

      case TradingState.TRADING:
        return this.handleTrading();

      case TradingState.CLOSING:
        return this.handleClosing();

      default:
        return null;
    }
  }

  private handleFindingVillager(): Task | null {
    this.targetVillager = this.findVillager();
    if (!this.targetVillager) {
      this.state = TradingState.FAILED;
      return null;
    }

    this.state = TradingState.APPROACHING;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.targetVillager || !this.targetVillager.isValid) {
      this.state = TradingState.FINDING_VILLAGER;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.targetVillager.position);
    if (dist <= 3.0) {
      this.state = TradingState.OPENING_TRADE;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.targetVillager.position.x),
      Math.floor(this.targetVillager.position.y),
      Math.floor(this.targetVillager.position.z),
      2
    );
  }

  private handleOpeningTrade(): Task | null {
    if (!this.targetVillager || !this.targetVillager.isValid) {
      this.state = TradingState.FINDING_VILLAGER;
      return null;
    }

    // Check if trade window is already open
    const window = (this.bot as any).currentWindow;
    if (window && window.type === 'minecraft:merchant') {
      this.windowOpen = true;
      this.state = TradingState.SELECTING_TRADE;
      return null;
    }

    // Right-click villager to open trade
    return new InteractEntityTask(this.bot, this.targetVillager.id);
  }

  private handleSelectingTrade(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (!window || window.type !== 'minecraft:merchant') {
      this.windowOpen = false;
      this.state = TradingState.OPENING_TRADE;
      return null;
    }

    // Find a suitable trade
    const trades = this.getTradeOffers(window);
    this.currentTrade = this.findBestTrade(trades);

    if (this.currentTrade === -1) {
      // No suitable trade found
      this.state = TradingState.CLOSING;
      return null;
    }

    this.state = TradingState.TRADING;
    this.tradeTimer.reset();
    return null;
  }

  private handleTrading(): Task | null {
    if (!this.tradeTimer.elapsed()) {
      return null;
    }

    const window = (this.bot as any).currentWindow;
    if (!window) {
      this.state = TradingState.OPENING_TRADE;
      return null;
    }

    // Check if we have the required items
    const trades = this.getTradeOffers(window);
    if (this.currentTrade >= trades.length) {
      this.state = TradingState.SELECTING_TRADE;
      return null;
    }

    const trade = trades[this.currentTrade];
    if (!this.canAffordTrade(trade)) {
      this.state = TradingState.SELECTING_TRADE;
      return null;
    }

    // Execute trade
    try {
      // Select the trade slot
      (this.bot as any).trade.select(this.currentTrade);
      // Attempt trade
      (this.bot as any).trade.once();
      this.tradeCount++;
    } catch {
      // Trade failed
    }

    this.tradeTimer.reset();

    // Check if we can continue trading
    if (trade.uses >= trade.maxUses - 1) {
      this.state = TradingState.SELECTING_TRADE;
    }

    return null;
  }

  private handleClosing(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (window) {
      try {
        this.bot.closeWindow(window);
      } catch {
        // Ignore close errors
      }
    }

    this.windowOpen = false;
    this.state = TradingState.FINISHED;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Close any open windows
    const window = (this.bot as any).currentWindow;
    if (window) {
      try {
        this.bot.closeWindow(window);
      } catch {
        // Ignore
      }
    }
    this.targetVillager = null;
    this.windowOpen = false;
  }

  isFinished(): boolean {
    return this.state === TradingState.FINISHED || this.state === TradingState.FAILED;
  }

  isFailed(): boolean {
    return this.state === TradingState.FAILED;
  }

  // ---- Helper Methods ----

  private findVillager(): Entity | null {
    const playerPos = this.bot.entity.position;
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;

      // Check if villager
      if (entity.name !== 'villager') continue;

      // Check profession if specified
      if (this.config.professions.length > 0) {
        const profession = this.getVillagerProfession(entity);
        if (!this.config.professions.includes(profession)) continue;
      }

      const dist = playerPos.distanceTo(entity.position);
      if (dist <= this.config.searchRadius && dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private getVillagerProfession(entity: Entity): string {
    // Try to get profession from metadata
    const metadata = (entity as any).metadata;
    if (metadata) {
      // Villager data is usually in index 17 or similar
      for (const entry of metadata) {
        if (entry && typeof entry === 'object' && 'profession' in entry) {
          return entry.profession;
        }
      }
    }
    return 'unknown';
  }

  private getTradeOffers(window: any): TradeOffer[] {
    const offers: TradeOffer[] = [];

    if (!window.trades) return offers;

    for (const trade of window.trades) {
      offers.push({
        inputItem1: {
          name: trade.inputItem1?.name ?? 'unknown',
          count: trade.inputItem1?.count ?? 1,
        },
        inputItem2: trade.inputItem2 ? {
          name: trade.inputItem2.name,
          count: trade.inputItem2.count,
        } : undefined,
        outputItem: {
          name: trade.outputItem?.name ?? 'unknown',
          count: trade.outputItem?.count ?? 1,
        },
        tradeDisabled: trade.tradeDisabled ?? false,
        maxUses: trade.maxTradeUses ?? 1,
        uses: trade.tradeUses ?? 0,
      });
    }

    return offers;
  }

  private findBestTrade(trades: TradeOffer[]): number {
    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];

      // Skip disabled trades
      if (trade.tradeDisabled) continue;

      // Skip used up trades
      if (trade.uses >= trade.maxUses) continue;

      // Check if we want the output
      if (this.config.wantedItems.length > 0) {
        if (this.config.wantedItems.includes(trade.outputItem.name)) {
          if (this.canAffordTrade(trade)) return i;
        }
      }

      // Check if we can sell input items
      if (this.config.sellableItems.length > 0) {
        if (this.config.sellableItems.includes(trade.inputItem1.name)) {
          if (this.canAffordTrade(trade)) return i;
        }
      }

      // If no specific items, accept any trade we can afford
      if (this.config.wantedItems.length === 0 && this.config.sellableItems.length === 0) {
        if (this.canAffordTrade(trade)) return i;
      }
    }

    return -1;
  }

  private canAffordTrade(trade: TradeOffer): boolean {
    // Check if we have enough of input item 1
    const count1 = this.countItem(trade.inputItem1.name);
    if (count1 < trade.inputItem1.count) return false;

    // Check input item 2 if present
    if (trade.inputItem2) {
      const count2 = this.countItem(trade.inputItem2.name);
      if (count2 < trade.inputItem2.count) return false;
    }

    return true;
  }

  private countItem(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName) {
        count += item.count;
      }
    }
    return count;
  }

  getTradeCount(): number {
    return this.tradeCount;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof TradingTask)) return false;

    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Convenience functions
 */
export function tradeWithVillager(bot: Bot, profession?: string): TradingTask {
  return new TradingTask(bot, {
    professions: profession ? [profession] : [],
  });
}

export function buyItem(bot: Bot, itemName: string): TradingTask {
  return new TradingTask(bot, {
    wantedItems: [itemName],
  });
}

export function sellItem(bot: Bot, itemName: string): TradingTask {
  return new TradingTask(bot, {
    sellableItems: [itemName],
  });
}

export function tradeWithLibrarian(bot: Bot): TradingTask {
  return new TradingTask(bot, {
    professions: ['librarian'],
  });
}
