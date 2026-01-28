/**
 * KillAura - Combat Automation System
 * Based on AltoClef/BaritonePlus KillAura.java
 *
 * Manages automatic combat with configurable strategies:
 * - FASTEST: Attack as fast as possible
 * - DELAY: Wait for attack cooldown
 * - SMART: Adaptive strategy based on enemy count/type
 * - OFF: Disabled
 *
 * Features:
 * - Shield blocking when appropriate
 * - Automatic weapon equipping
 * - Target prioritization
 * - Projectile deflection (fireballs)
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import type { Item } from 'prismarine-item';
import { Vec3 } from 'vec3';
import { InputControls, Input } from './InputControls';
import { PlayerExtraController } from './PlayerExtraController';
import { TimerGame } from '../utils/timers/TimerGame';
import { LookHelper, createLookHelper } from '../utils/LookHelper';

/**
 * Kill aura strategy
 */
export enum KillAuraStrategy {
  /** Disabled */
  OFF = 'OFF',
  /** Attack as fast as possible */
  FASTEST = 'FASTEST',
  /** Wait for attack cooldown */
  DELAY = 'DELAY',
  /** Adaptive based on enemies */
  SMART = 'SMART',
}

/**
 * Entity types that should not trigger shielding
 */
const NO_SHIELD_ENTITIES = new Set([
  'creeper',
  'hoglin',
  'zoglin',
  'warden',
  'wither',
]);

/**
 * Entity types that are ranged attackers (benefit from smart delay)
 */
const RANGED_ENTITIES = new Set([
  'skeleton',
  'stray',
  'pillager',
  'witch',
  'piglin',
  'blaze',
]);

/**
 * KillAura configuration
 */
export interface KillAuraConfig {
  /** Attack strategy */
  strategy: KillAuraStrategy;
  /** Range for force field attacks */
  forceFieldRange: number;
  /** Minimum health before considering shielding */
  shieldHealthThreshold: number;
  /** Delay between attacks in SMART/FASTEST mode (seconds) */
  hitDelay: number;
  /** Whether to auto-equip weapons */
  autoEquipWeapon: boolean;
  /** Whether to auto-shield */
  autoShield: boolean;
}

const DEFAULT_CONFIG: KillAuraConfig = {
  strategy: KillAuraStrategy.SMART,
  forceFieldRange: Infinity,
  shieldHealthThreshold: 10,
  hitDelay: 0.2,
  autoEquipWeapon: true,
  autoShield: true,
};

/**
 * KillAura manages automatic combat
 */
export class KillAura {
  private bot: Bot;
  private inputControls: InputControls;
  private playerController: PlayerExtraController;
  private lookHelper: LookHelper;
  private config: KillAuraConfig;

  /**
   * Current targets for this tick
   */
  private targets: Entity[] = [];

  /**
   * Entity that must be hit (e.g., fireball)
   */
  private forceHit: Entity | null = null;

  /**
   * Timer for hit delay
   */
  private hitDelay: TimerGame;

  /**
   * Whether currently shielding
   */
  private shielding: boolean = false;

  constructor(
    bot: Bot,
    inputControls: InputControls,
    playerController: PlayerExtraController,
    config: Partial<KillAuraConfig> = {}
  ) {
    this.bot = bot;
    this.inputControls = inputControls;
    this.playerController = playerController;
    this.lookHelper = createLookHelper(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.hitDelay = new TimerGame(bot, this.config.hitDelay);
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<KillAuraConfig>): void {
    this.config = { ...this.config, ...config };
    this.hitDelay = new TimerGame(this.bot, this.config.hitDelay);
  }

  /**
   * Set attack strategy
   */
  setStrategy(strategy: KillAuraStrategy): void {
    this.config.strategy = strategy;
  }

  /**
   * Set force field range
   */
  setRange(range: number): void {
    this.config.forceFieldRange = range;
  }

  /**
   * Called at start of each tick to reset targets
   */
  tickStart(): void {
    this.targets = [];
    this.forceHit = null;
  }

  /**
   * Add an entity to the aura target list
   */
  applyAura(entity: Entity): void {
    this.targets.push(entity);

    // Always hit fireballs (ghast balls)
    if (entity.name === 'fireball' || entity.name === 'small_fireball') {
      this.forceHit = entity;
    }
  }

  /**
   * Called at end of each tick to process attacks
   */
  tickEnd(): void {
    if (this.config.strategy === KillAuraStrategy.OFF) {
      this.stopShielding();
      return;
    }

    if (this.targets.length === 0) {
      this.stopShielding();
      return;
    }

    // Check if conditions allow combat
    if (!this.canEngageCombat()) {
      this.stopShielding();
      return;
    }

    // Find closest entity
    const closest = this.getClosestTarget();
    if (!closest) {
      this.stopShielding();
      return;
    }

    // Handle shielding
    if (this.shouldShield(closest)) {
      this.handleShielding(closest);
    } else {
      this.stopShielding();
      this.performAttacks();
    }
  }

  /**
   * Check if combat can be engaged
   */
  private canEngageCombat(): boolean {
    // TODO: Check these conditions via event system or state manager
    // - Not eating (needsToEat)
    // - Not MLG bucketing (isFallingOhNo, doneMLG)
    // - Not chorus fruiting
    return true;
  }

  /**
   * Check if should shield against this entity
   */
  private shouldShield(entity: Entity): boolean {
    if (!this.config.autoShield) return false;

    // Don't shield if health is low (need to attack)
    const health = this.bot.health ?? 20;
    if (health < this.config.shieldHealthThreshold) return false;

    // Don't shield against certain entities
    if (entity.name && NO_SHIELD_ENTITIES.has(entity.name.toLowerCase())) {
      return false;
    }

    // Check if we have a shield
    if (!this.hasShield()) return false;

    // Don't shield if entity is too far
    const dist = this.getDistanceToEntity(entity);
    if (dist > 6) return false;

    return true;
  }

  /**
   * Handle shielding behavior
   */
  private handleShielding(entity: Entity): void {
    // Fire-and-forget look (no await needed for combat)
    void this.lookHelper.lookAt(entity.position.offset(0, (entity.height ?? 1.8) * 0.8, 0));

    // Make sure shield is in offhand
    if (!this.hasShieldInOffhand()) {
      this.equipShieldToOffhand();
      return;
    }

    this.startShielding();
    this.performDelayedAttack();
  }

  /**
   * Get the closest target entity
   */
  private getClosestTarget(): Entity | null {
    if (this.targets.length === 0) return null;

    let closest: Entity | null = null;
    let closestDist = Infinity;

    for (const entity of this.targets) {
      const dist = this.getDistanceToEntity(entity);
      if (dist < closestDist) {
        closest = entity;
        closestDist = dist;
      }
    }

    return closest;
  }

  /**
   * Get distance to an entity
   */
  private getDistanceToEntity(entity: Entity): number {
    if (!this.bot.entity) return Infinity;
    return this.bot.entity.position.distanceTo(entity.position);
  }

  /**
   * Check if entity is in range
   */
  private isInRange(entity: Entity): boolean {
    const dist = this.getDistanceToEntity(entity);
    if (this.config.forceFieldRange === Infinity) {
      return dist <= 6; // Default melee range
    }
    return dist <= this.config.forceFieldRange || dist < Math.sqrt(40);
  }

  /**
   * Perform attacks based on strategy
   */
  private performAttacks(): void {
    switch (this.config.strategy) {
      case KillAuraStrategy.FASTEST:
        this.performFastestAttack();
        break;
      case KillAuraStrategy.SMART:
        this.performSmartAttack();
        break;
      case KillAuraStrategy.DELAY:
        this.performDelayedAttack();
        break;
    }
  }

  /**
   * Attack as fast as possible (all targets)
   */
  private performFastestAttack(): void {
    for (const entity of this.targets) {
      this.attack(entity);
    }
  }

  /**
   * Smart attack - adapts to situation
   */
  private performSmartAttack(): void {
    // Force hit fireballs
    if (this.forceHit) {
      this.attack(this.forceHit, true);
    }

    // Use delayed attack for few targets or ranged enemies
    const allRanged = this.targets.every(e =>
      e.name && RANGED_ENTITIES.has(e.name.toLowerCase())
    );

    if (this.targets.length <= 2 || allRanged) {
      this.performDelayedAttack();
    } else {
      // Multiple melee enemies - use timed attacks
      if (this.hitDelay.elapsed()) {
        this.hitDelay.reset();
        const closest = this.getClosestTarget();
        if (closest) {
          this.attack(closest, true);
        }
      }
    }
  }

  /**
   * Attack with cooldown delay
   */
  private performDelayedAttack(): void {
    // Force hit
    if (this.forceHit) {
      this.attack(this.forceHit, true);
    }

    if (this.targets.length === 0) return;

    // Wait for attack cooldown (1.6 seconds in vanilla)
    // Mineflayer doesn't expose this directly, so we use hitDelay
    if (!this.hitDelay.elapsed()) {
      return;
    }

    const closest = this.getClosestTarget();
    if (closest) {
      this.attack(closest, true);
      this.hitDelay.reset();
    }
  }

  /**
   * Attack an entity
   */
  private attack(entity: Entity, equipSword: boolean = false): void {
    if (!entity) return;

    // Look at entity (except fireballs - need precise timing)
    if (entity.name !== 'fireball' && entity.name !== 'small_fireball') {
      // Fire-and-forget look (no await needed for combat)
      void this.lookHelper.lookAt(entity.position.offset(0, (entity.height ?? 1.8) * 0.8, 0));
    }

    // Check range
    if (!this.isInRange(entity)) return;

    // Equip weapon if needed
    if (equipSword && this.config.autoEquipWeapon) {
      this.equipBestWeapon();
    }

    // Check attack conditions
    const onGround = this.bot.entity?.onGround ?? false;
    const inWater = (this.bot.entity as any)?.isInWater ?? false;
    const falling = (this.bot.entity?.velocity?.y ?? 0) < 0;

    if (onGround || inWater || falling) {
      this.playerController.attack(entity);
    }
  }

  /**
   * Start shielding
   */
  private startShielding(): void {
    this.shielding = true;
    this.inputControls.hold(Input.SNEAK);
    this.inputControls.hold(Input.CLICK_RIGHT);
    // Note: Would need to pause baritone pathfinding here
  }

  /**
   * Stop shielding
   */
  private stopShielding(): void {
    if (this.shielding) {
      this.inputControls.release(Input.SNEAK);
      this.inputControls.release(Input.CLICK_RIGHT);
      this.shielding = false;
    }
  }

  /**
   * Check if player has a shield
   */
  private hasShield(): boolean {
    // Check inventory for shield
    const items = this.bot.inventory.items();
    return items.some(item => item.name === 'shield');
  }

  /**
   * Check if shield is in offhand
   */
  private hasShieldInOffhand(): boolean {
    const offhand = this.bot.inventory.slots[45]; // Offhand slot
    return offhand?.name === 'shield';
  }

  /**
   * Equip shield to offhand
   */
  private async equipShieldToOffhand(): Promise<void> {
    const shield = this.bot.inventory.items().find(item => item.name === 'shield');
    if (shield) {
      try {
        await this.bot.equip(shield, 'off-hand');
      } catch (e) {
        // Ignore equip errors
      }
    }
  }

  /**
   * Equip the best weapon
   */
  private equipBestWeapon(): void {
    const weapons = this.bot.inventory.items().filter(item =>
      item.name.includes('sword') || item.name.includes('axe')
    );

    if (weapons.length === 0) return;

    // Sort by damage (rough approximation based on material)
    const materialOrder = ['netherite', 'diamond', 'iron', 'stone', 'gold', 'wood'];
    weapons.sort((a, b) => {
      const aIdx = materialOrder.findIndex(m => a.name.includes(m));
      const bIdx = materialOrder.findIndex(m => b.name.includes(m));
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

    // Prefer swords over axes for attack speed
    const swords = weapons.filter(w => w.name.includes('sword'));
    const bestWeapon = swords[0] ?? weapons[0];

    if (bestWeapon) {
      try {
        this.bot.equip(bestWeapon, 'hand');
      } catch (e) {
        // Ignore equip errors
      }
    }
  }

  /**
   * Get current shielding state
   */
  isShielding(): boolean {
    return this.shielding;
  }

  /**
   * Get current target count
   */
  getTargetCount(): number {
    return this.targets.length;
  }

  /**
   * Static method to equip best weapon
   */
  static async equipWeapon(bot: Bot): Promise<void> {
    const weapons = bot.inventory.items().filter(item =>
      item.name.includes('sword') || item.name.includes('axe')
    );

    if (weapons.length === 0) return;

    const materialOrder = ['netherite', 'diamond', 'iron', 'stone', 'gold', 'wood'];
    weapons.sort((a, b) => {
      const aIdx = materialOrder.findIndex(m => a.name.includes(m));
      const bIdx = materialOrder.findIndex(m => b.name.includes(m));
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

    const swords = weapons.filter(w => w.name.includes('sword'));
    const bestWeapon = swords[0] ?? weapons[0];

    if (bestWeapon) {
      try {
        await bot.equip(bestWeapon, 'hand');
      } catch (e) {
        // Ignore
      }
    }
  }
}

/**
 * Create a KillAura instance
 */
export function createKillAura(
  bot: Bot,
  inputControls: InputControls,
  playerController: PlayerExtraController,
  config?: Partial<KillAuraConfig>
): KillAura {
  return new KillAura(bot, inputControls, playerController, config);
}

export default KillAura;
