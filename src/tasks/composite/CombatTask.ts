/**
 * CombatTask - Coordinated Combat Behavior
 * Based on AltoClef's combat system
 *
 * Handles fighting mobs with weapon management,
 * shield blocking, and tactical positioning.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { AttackEntityTask } from '../concrete/InteractTask';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { EquipTask, EquipmentSlot } from '../concrete/InventoryTask';
import { GetToolTask } from './GetToolTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Combat style
 */
export enum CombatStyle {
  MELEE,      // Close range sword/axe fighting
  RANGED,     // Bow/crossbow attacks
  HIT_AND_RUN, // Attack then retreat
  DEFENSIVE,  // Shield blocking focus
}

/**
 * State for combat
 */
enum CombatState {
  IDLE,
  FINDING_TARGET,
  EQUIPPING_WEAPON,
  APPROACHING,
  ATTACKING,
  RETREATING,
  BLOCKING,
  FINISHED
}

/**
 * Combat configuration
 */
export interface CombatConfig {
  /** Combat style */
  style: CombatStyle;
  /** Target specific entity types */
  targetTypes: string[];
  /** Attack radius */
  attackRadius: number;
  /** Retreat distance for hit-and-run */
  retreatDistance: number;
  /** Health threshold to retreat (0-20) */
  retreatHealthThreshold: number;
  /** Auto-equip best weapon */
  autoEquipWeapon: boolean;
  /** Use shield if available */
  useShield: boolean;
  /** Maximum engagement distance */
  maxEngageDistance: number;
}

const DEFAULT_CONFIG: CombatConfig = {
  style: CombatStyle.MELEE,
  targetTypes: [],
  attackRadius: 3.5,
  retreatDistance: 8,
  retreatHealthThreshold: 6,
  autoEquipWeapon: true,
  useShield: true,
  maxEngageDistance: 32,
};

/**
 * Weapon tier info
 */
const WEAPON_TIERS = [
  'netherite_sword', 'netherite_axe',
  'diamond_sword', 'diamond_axe',
  'iron_sword', 'iron_axe',
  'stone_sword', 'stone_axe',
  'wooden_sword', 'wooden_axe',
];

/**
 * Task for combat engagement
 */
export class CombatTask extends Task {
  private config: CombatConfig;
  private state: CombatState = CombatState.FINDING_TARGET;
  private targetEntity: Entity | null = null;
  private attackTimer: TimerGame;
  private blockTimer: TimerGame;
  private retreatPosition: Vec3 | null = null;
  private killCount: number = 0;

  constructor(bot: Bot, config: Partial<CombatConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.attackTimer = new TimerGame(bot, 0.6); // Attack cooldown
    this.blockTimer = new TimerGame(bot, 2.0); // Block duration
  }

  get displayName(): string {
    const target = this.targetEntity?.name ?? 'none';
    return `Combat(${CombatStyle[this.config.style]}, target: ${target}, kills: ${this.killCount})`;
  }

  onStart(): void {
    this.state = CombatState.FINDING_TARGET;
    this.targetEntity = null;
    this.retreatPosition = null;
    this.killCount = 0;
  }

  onTick(): Task | null {
    // Check health for retreat
    const health = this.bot.health ?? 20;
    if (health <= this.config.retreatHealthThreshold && this.config.style !== CombatStyle.DEFENSIVE) {
      this.state = CombatState.RETREATING;
    }

    switch (this.state) {
      case CombatState.IDLE:
        this.state = CombatState.FINDING_TARGET;
        return null;

      case CombatState.FINDING_TARGET:
        return this.handleFindingTarget();

      case CombatState.EQUIPPING_WEAPON:
        return this.handleEquippingWeapon();

      case CombatState.APPROACHING:
        return this.handleApproaching();

      case CombatState.ATTACKING:
        return this.handleAttacking();

      case CombatState.RETREATING:
        return this.handleRetreating();

      case CombatState.BLOCKING:
        return this.handleBlocking();

      default:
        return null;
    }
  }

  private handleFindingTarget(): Task | null {
    this.targetEntity = this.findTarget();
    if (!this.targetEntity) {
      this.state = CombatState.FINISHED;
      return null;
    }

    // Equip weapon if needed
    if (this.config.autoEquipWeapon && !this.hasWeaponEquipped()) {
      this.state = CombatState.EQUIPPING_WEAPON;
      return null;
    }

    this.state = CombatState.APPROACHING;
    return null;
  }

  private handleEquippingWeapon(): Task | null {
    if (this.hasWeaponEquipped()) {
      this.state = CombatState.APPROACHING;
      return null;
    }

    const weapon = this.findBestWeapon();
    if (!weapon) {
      // No weapon, try to get a sword
      return new GetToolTask(this.bot, 'sword');
    }

    return new EquipTask(this.bot, weapon.name, EquipmentSlot.HAND);
  }

  private handleApproaching(): Task | null {
    if (!this.targetEntity || !this.targetEntity.isValid) {
      // Target died or despawned
      this.killCount++;
      this.state = CombatState.FINDING_TARGET;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.targetEntity.position);

    // Check if target is too far
    if (dist > this.config.maxEngageDistance) {
      this.targetEntity = null;
      this.state = CombatState.FINDING_TARGET;
      return null;
    }

    // In attack range
    if (dist <= this.config.attackRadius) {
      this.state = CombatState.ATTACKING;
      return null;
    }

    // Move towards target
    return new GoToNearTask(
      this.bot,
      Math.floor(this.targetEntity.position.x),
      Math.floor(this.targetEntity.position.y),
      Math.floor(this.targetEntity.position.z),
      Math.floor(this.config.attackRadius - 0.5)
    );
  }

  private handleAttacking(): Task | null {
    if (!this.targetEntity || !this.targetEntity.isValid) {
      this.killCount++;
      this.state = CombatState.FINDING_TARGET;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.targetEntity.position);

    // Too far - approach again
    if (dist > this.config.attackRadius + 0.5) {
      this.state = CombatState.APPROACHING;
      return null;
    }

    // Check attack cooldown
    if (!this.attackTimer.elapsed()) {
      // Could block while waiting
      if (this.config.useShield && this.hasShield()) {
        this.state = CombatState.BLOCKING;
        this.blockTimer.reset();
        return null;
      }
      return null;
    }

    // Attack
    this.attackTimer.reset();

    // For hit-and-run, retreat after attack
    if (this.config.style === CombatStyle.HIT_AND_RUN) {
      this.retreatPosition = this.calculateRetreatPosition();
      this.state = CombatState.RETREATING;
    }

    return new AttackEntityTask(this.bot, this.targetEntity.id);
  }

  private handleRetreating(): Task | null {
    // Check if we're safe
    const health = this.bot.health ?? 20;
    if (health > this.config.retreatHealthThreshold + 4) {
      // Recovered enough health
      this.state = CombatState.FINDING_TARGET;
      return null;
    }

    if (!this.retreatPosition) {
      this.retreatPosition = this.calculateRetreatPosition();
    }

    const dist = this.bot.entity.position.distanceTo(this.retreatPosition);
    if (dist <= 2) {
      // Reached retreat position
      if (this.config.style === CombatStyle.HIT_AND_RUN) {
        // Go back to attacking
        this.state = CombatState.APPROACHING;
      } else {
        // Stay in finished state for low health retreat
        this.state = CombatState.FINISHED;
      }
      this.retreatPosition = null;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.retreatPosition.x),
      Math.floor(this.retreatPosition.y),
      Math.floor(this.retreatPosition.z),
      1
    );
  }

  private handleBlocking(): Task | null {
    // Block with shield
    if (this.hasShield()) {
      try {
        this.bot.activateItem(true); // Use off-hand (shield)
      } catch {
        // May fail if no shield
      }
    }

    if (this.blockTimer.elapsed()) {
      // Stop blocking
      try {
        this.bot.deactivateItem();
      } catch {
        // May fail
      }
      this.state = CombatState.ATTACKING;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.targetEntity = null;
    this.retreatPosition = null;
    try {
      this.bot.deactivateItem(); // Stop blocking
    } catch {
      // Ignore
    }
  }

  isFinished(): boolean {
    return this.state === CombatState.FINISHED;
  }

  // ---- Helper Methods ----

  private findTarget(): Entity | null {
    const playerPos = this.bot.entity.position;
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;

      // Check if valid target
      if (!this.isValidTarget(entity)) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist <= this.config.maxEngageDistance && dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private isValidTarget(entity: Entity): boolean {
    // Filter by target types if specified
    if (this.config.targetTypes.length > 0) {
      return this.config.targetTypes.includes(entity.name ?? '');
    }

    // Default: target hostile mobs
    const hostileMobs = [
      'zombie', 'skeleton', 'spider', 'creeper', 'enderman',
      'witch', 'slime', 'phantom', 'drowned', 'husk', 'stray',
      'zombie_villager', 'pillager', 'vindicator', 'evoker',
      'ravager', 'vex', 'hoglin', 'piglin_brute', 'zoglin',
      'warden', 'wither_skeleton', 'blaze', 'ghast', 'magma_cube',
    ];

    return hostileMobs.includes(entity.name ?? '');
  }

  private findBestWeapon(): any | null {
    let best: any = null;
    let bestIndex = Infinity;

    for (const item of this.bot.inventory.items()) {
      const index = WEAPON_TIERS.indexOf(item.name);
      if (index !== -1 && index < bestIndex) {
        bestIndex = index;
        best = item;
      }
    }

    return best;
  }

  private hasWeaponEquipped(): boolean {
    const held = this.bot.heldItem;
    if (!held) return false;

    return held.name.includes('sword') || held.name.includes('axe');
  }

  private hasShield(): boolean {
    const offHand = this.bot.inventory.slots[45];
    return offHand?.name === 'shield';
  }

  private calculateRetreatPosition(): Vec3 {
    const pos = this.bot.entity.position;

    // Retreat away from target
    if (this.targetEntity) {
      const toTarget = this.targetEntity.position.minus(pos);
      const away = toTarget.scaled(-1).normalize();
      return pos.plus(away.scaled(this.config.retreatDistance));
    }

    // Random retreat
    const angle = Math.random() * Math.PI * 2;
    return pos.offset(
      Math.cos(angle) * this.config.retreatDistance,
      0,
      Math.sin(angle) * this.config.retreatDistance
    );
  }

  /**
   * Get kill count
   */
  getKillCount(): number {
    return this.killCount;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof CombatTask)) return false;

    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Convenience functions
 */
export function fightMobs(bot: Bot): CombatTask {
  return new CombatTask(bot);
}

export function fightEntity(bot: Bot, entityType: string): CombatTask {
  return new CombatTask(bot, { targetTypes: [entityType] });
}

export function hitAndRun(bot: Bot): CombatTask {
  return new CombatTask(bot, { style: CombatStyle.HIT_AND_RUN });
}

export function defensiveCombat(bot: Bot): CombatTask {
  return new CombatTask(bot, { style: CombatStyle.DEFENSIVE, useShield: true });
}
