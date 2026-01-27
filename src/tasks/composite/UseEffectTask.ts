/**
 * UseEffectTask - Strategic Potion/Effect Usage
 * Based on AltoClef combat and survival patterns
 *
 * Handles using potions and consumables strategically
 * based on game situation.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for effect usage
 */
enum EffectState {
  CHECKING_CONDITIONS,
  SELECTING_EFFECT,
  EQUIPPING,
  USING,
  WAITING,
  FINISHED,
  FAILED
}

/**
 * Effect types
 */
export enum EffectType {
  HEALING = 'healing',
  REGENERATION = 'regeneration',
  STRENGTH = 'strength',
  SPEED = 'speed',
  FIRE_RESISTANCE = 'fire_resistance',
  WATER_BREATHING = 'water_breathing',
  NIGHT_VISION = 'night_vision',
  INVISIBILITY = 'invisibility',
  SLOW_FALLING = 'slow_falling',
  RESISTANCE = 'resistance',
}

/**
 * Trigger condition for effect
 */
export enum EffectTrigger {
  /** Use when health is low */
  LOW_HEALTH = 'low_health',
  /** Use when in combat */
  IN_COMBAT = 'in_combat',
  /** Use when in fire/lava */
  IN_FIRE = 'in_fire',
  /** Use when underwater */
  UNDERWATER = 'underwater',
  /** Use when falling */
  FALLING = 'falling',
  /** Use immediately */
  IMMEDIATE = 'immediate',
  /** Use when effect wears off */
  EFFECT_EXPIRED = 'effect_expired',
}

/**
 * Configuration for effect usage
 */
export interface UseEffectConfig {
  /** Effect type to use */
  effectType: EffectType;
  /** When to trigger usage */
  trigger: EffectTrigger;
  /** Health threshold for LOW_HEALTH trigger (0-20) */
  healthThreshold: number;
  /** Whether to reapply when effect expires */
  maintainEffect: boolean;
  /** Maximum uses */
  maxUses: number;
}

const DEFAULT_CONFIG: UseEffectConfig = {
  effectType: EffectType.HEALING,
  trigger: EffectTrigger.LOW_HEALTH,
  healthThreshold: 10,
  maintainEffect: false,
  maxUses: 1,
};

/**
 * Mapping of effect types to potion items
 */
const EFFECT_ITEMS: Map<EffectType, string[]> = new Map([
  [EffectType.HEALING, ['potion', 'splash_potion', 'lingering_potion']], // with healing effect
  [EffectType.REGENERATION, ['potion', 'splash_potion', 'lingering_potion']],
  [EffectType.STRENGTH, ['potion', 'splash_potion', 'lingering_potion']],
  [EffectType.SPEED, ['potion', 'splash_potion', 'lingering_potion']],
  [EffectType.FIRE_RESISTANCE, ['potion', 'splash_potion', 'lingering_potion']],
  [EffectType.WATER_BREATHING, ['potion', 'splash_potion', 'lingering_potion']],
  [EffectType.NIGHT_VISION, ['potion', 'splash_potion', 'lingering_potion']],
  [EffectType.INVISIBILITY, ['potion', 'splash_potion', 'lingering_potion']],
  [EffectType.SLOW_FALLING, ['potion', 'splash_potion', 'lingering_potion']],
  [EffectType.RESISTANCE, ['enchanted_golden_apple', 'golden_apple']], // Resistance from notch apple
]);

/**
 * Food items that grant effects
 */
const EFFECT_FOODS: Map<EffectType, string[]> = new Map([
  [EffectType.REGENERATION, ['golden_apple', 'enchanted_golden_apple']],
  [EffectType.RESISTANCE, ['enchanted_golden_apple']],
]);

/**
 * Task for using effects strategically
 */
export class UseEffectTask extends Task {
  private config: UseEffectConfig;
  private state: EffectState = EffectState.CHECKING_CONDITIONS;
  private selectedItem: string | null = null;
  private usesCount: number = 0;
  private useTimer: TimerGame;
  private cooldownTimer: TimerGame;

  constructor(bot: Bot, config: Partial<UseEffectConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.useTimer = new TimerGame(bot, 0.5);
    this.cooldownTimer = new TimerGame(bot, 1.0);
  }

  get displayName(): string {
    return `UseEffect(${this.config.effectType}, ${this.usesCount}/${this.config.maxUses})`;
  }

  onStart(): void {
    this.state = EffectState.CHECKING_CONDITIONS;
    this.selectedItem = null;
    this.usesCount = 0;
  }

  onTick(): Task | null {
    // Check if we've used enough
    if (this.usesCount >= this.config.maxUses) {
      this.state = EffectState.FINISHED;
      return null;
    }

    switch (this.state) {
      case EffectState.CHECKING_CONDITIONS:
        return this.handleCheckingConditions();

      case EffectState.SELECTING_EFFECT:
        return this.handleSelectingEffect();

      case EffectState.EQUIPPING:
        return this.handleEquipping();

      case EffectState.USING:
        return this.handleUsing();

      case EffectState.WAITING:
        return this.handleWaiting();

      default:
        return null;
    }
  }

  private handleCheckingConditions(): Task | null {
    // Check if trigger condition is met
    if (!this.shouldUseEffect()) {
      // If maintaining effect, check if it's expired
      if (this.config.maintainEffect && this.config.trigger === EffectTrigger.EFFECT_EXPIRED) {
        // Wait and check again
        this.state = EffectState.WAITING;
        this.cooldownTimer.reset();
        return null;
      }

      // If immediate, just finish if condition not met after first use
      if (this.usesCount > 0) {
        this.state = EffectState.FINISHED;
        return null;
      }

      // Wait and re-check
      this.state = EffectState.WAITING;
      this.cooldownTimer.reset();
      return null;
    }

    this.state = EffectState.SELECTING_EFFECT;
    return null;
  }

  private handleSelectingEffect(): Task | null {
    // Find item for this effect
    this.selectedItem = this.findEffectItem();

    if (!this.selectedItem) {
      this.state = EffectState.FAILED;
      return null;
    }

    this.state = EffectState.EQUIPPING;
    return null;
  }

  private handleEquipping(): Task | null {
    if (!this.selectedItem) {
      this.state = EffectState.SELECTING_EFFECT;
      return null;
    }

    if (this.equipItem(this.selectedItem)) {
      this.state = EffectState.USING;
      this.useTimer.reset();
    } else {
      this.state = EffectState.FAILED;
    }

    return null;
  }

  private handleUsing(): Task | null {
    if (this.useTimer.elapsed()) {
      // Use the item
      try {
        this.bot.activateItem();
        this.usesCount++;

        // For food items, wait for consumption
        if (this.isFood(this.selectedItem!)) {
          // Would need to wait for eating to complete
        }
      } catch {
        // May fail
      }

      this.selectedItem = null;

      // Check if we should continue
      if (this.config.maintainEffect) {
        this.state = EffectState.WAITING;
        this.cooldownTimer.reset();
      } else if (this.usesCount < this.config.maxUses) {
        this.state = EffectState.CHECKING_CONDITIONS;
      } else {
        this.state = EffectState.FINISHED;
      }
    }

    return null;
  }

  private handleWaiting(): Task | null {
    if (this.cooldownTimer.elapsed()) {
      this.state = EffectState.CHECKING_CONDITIONS;
    }
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.selectedItem = null;
  }

  isFinished(): boolean {
    return this.state === EffectState.FINISHED || this.state === EffectState.FAILED;
  }

  isFailed(): boolean {
    return this.state === EffectState.FAILED;
  }

  // ---- Helper Methods ----

  private shouldUseEffect(): boolean {
    switch (this.config.trigger) {
      case EffectTrigger.LOW_HEALTH:
        return this.getHealth() <= this.config.healthThreshold;

      case EffectTrigger.IN_COMBAT:
        return this.isInCombat();

      case EffectTrigger.IN_FIRE:
        return this.isInFireOrLava();

      case EffectTrigger.UNDERWATER:
        return this.isUnderwater();

      case EffectTrigger.FALLING:
        return this.isFalling();

      case EffectTrigger.IMMEDIATE:
        return true;

      case EffectTrigger.EFFECT_EXPIRED:
        return !this.hasEffect(this.config.effectType);

      default:
        return false;
    }
  }

  private getHealth(): number {
    return (this.bot as any).health ?? 20;
  }

  private isInCombat(): boolean {
    // Check for nearby hostile mobs
    const pos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;

      const type = (entity as any).type ?? '';
      if (type !== 'mob') continue;

      const dist = pos.distanceTo(entity.position);
      if (dist < 10) {
        return true;
      }
    }

    return false;
  }

  private isInFireOrLava(): boolean {
    return (this.bot.entity as any).isOnFire ?? false;
  }

  private isUnderwater(): boolean {
    return (this.bot as any).isInWater ?? false;
  }

  private isFalling(): boolean {
    const velocity = this.bot.entity.velocity;
    return velocity.y < -0.5;
  }

  private hasEffect(effectType: EffectType): boolean {
    // In mineflayer, check bot.entity.effects
    // For now, return false to trigger reapplication
    return false;
  }

  private findEffectItem(): string | null {
    // Check for potions with matching effect
    const potionTypes = EFFECT_ITEMS.get(this.config.effectType) ?? [];
    const foodTypes = EFFECT_FOODS.get(this.config.effectType) ?? [];

    // Check inventory for matching items
    for (const item of this.bot.inventory.items()) {
      // Check food items first (simpler)
      if (foodTypes.includes(item.name)) {
        return item.name;
      }

      // Check potion items (would need to check NBT for effect)
      if (potionTypes.includes(item.name)) {
        // In full implementation, check potion effect in NBT
        // For now, assume potion matches
        return item.name;
      }
    }

    return null;
  }

  private equipItem(name: string): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === name) {
        try {
          this.bot.equip(item, 'hand');
          return true;
        } catch {
          // May fail
        }
      }
    }
    return false;
  }

  private isFood(itemName: string): boolean {
    const foods = ['golden_apple', 'enchanted_golden_apple', 'chorus_fruit'];
    return foods.includes(itemName);
  }

  /**
   * Get uses count
   */
  getUsesCount(): number {
    return this.usesCount;
  }

  /**
   * Get current state
   */
  getCurrentState(): EffectState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof UseEffectTask)) return false;
    return (
      this.config.effectType === other.config.effectType &&
      this.config.trigger === other.config.trigger
    );
  }
}

/**
 * Convenience functions
 */
export function useHealing(bot: Bot, healthThreshold: number = 10): UseEffectTask {
  return new UseEffectTask(bot, {
    effectType: EffectType.HEALING,
    trigger: EffectTrigger.LOW_HEALTH,
    healthThreshold,
  });
}

export function useStrength(bot: Bot): UseEffectTask {
  return new UseEffectTask(bot, {
    effectType: EffectType.STRENGTH,
    trigger: EffectTrigger.IN_COMBAT,
  });
}

export function useFireResistance(bot: Bot): UseEffectTask {
  return new UseEffectTask(bot, {
    effectType: EffectType.FIRE_RESISTANCE,
    trigger: EffectTrigger.IN_FIRE,
  });
}

export function useWaterBreathing(bot: Bot): UseEffectTask {
  return new UseEffectTask(bot, {
    effectType: EffectType.WATER_BREATHING,
    trigger: EffectTrigger.UNDERWATER,
    maintainEffect: true,
  });
}

export function useSlowFalling(bot: Bot): UseEffectTask {
  return new UseEffectTask(bot, {
    effectType: EffectType.SLOW_FALLING,
    trigger: EffectTrigger.FALLING,
  });
}

export function maintainEffect(bot: Bot, effectType: EffectType): UseEffectTask {
  return new UseEffectTask(bot, {
    effectType,
    trigger: EffectTrigger.EFFECT_EXPIRED,
    maintainEffect: true,
    maxUses: 100,
  });
}

export function useGoldenApple(bot: Bot): UseEffectTask {
  return new UseEffectTask(bot, {
    effectType: EffectType.REGENERATION,
    trigger: EffectTrigger.LOW_HEALTH,
    healthThreshold: 8,
  });
}
