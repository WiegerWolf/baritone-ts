/**
 * MobDefenseChain - Combat Automation
 * Based on AltoClef's MobDefenseChain.java
 *
 * Automatically handles combat with hostile mobs:
 * - Threat assessment and prioritization
 * - Weapon selection (best sword)
 * - Attack timing (cooldown)
 * - Kiting patterns
 * - Creeper-specific handling
 *
 * Priority: 100 when hostile mobs are nearby
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { SingleTaskChain, ChainPriority } from '../tasks/TaskChain';
import { Task } from '../tasks/Task';
import { TimerGame } from '../utils/timers/TimerGame';
import { EntityTracker, type ThreatInfo } from '../trackers/EntityTracker';

/**
 * Combat configuration
 */
export interface MobDefenseConfig {
  /** Distance to detect hostiles (default: 16) */
  detectionRange: number;
  /** Distance to engage in combat (default: 5) */
  engageRange: number;
  /** Distance to maintain while kiting (default: 4.5) */
  kiteDistance: number;
  /** Distance to flee from creepers (default: 10) */
  creeperFleeDistance: number;
  /** Threat threshold to activate defense (default: 10) */
  threatThreshold: number;
  /** Attack cooldown in seconds (default: 0.5) */
  attackCooldown: number;
  /** Whether to use shield (default: true) */
  useShield: boolean;
}

const DEFAULT_CONFIG: MobDefenseConfig = {
  detectionRange: 16,
  engageRange: 5,
  kiteDistance: 4.5,
  creeperFleeDistance: 10,
  threatThreshold: 10,
  attackCooldown: 0.5,
  useShield: true,
};

/**
 * Combat states
 */
enum CombatState {
  IDLE = 'idle',
  APPROACHING = 'approaching',
  ATTACKING = 'attacking',
  KITING = 'kiting',
  FLEEING = 'fleeing',
  SHIELDING = 'shielding',
}

/**
 * Task to handle combat with a target
 */
class CombatTask extends Task {
  readonly displayName = 'Combat';

  private config: MobDefenseConfig;
  private target: Entity;
  private state: CombatState = CombatState.IDLE;
  private attackTimer: TimerGame;
  private shieldTimer: TimerGame;

  constructor(bot: Bot, target: Entity, config: MobDefenseConfig) {
    super(bot);
    this.target = target;
    this.config = config;
    this.attackTimer = new TimerGame(bot, config.attackCooldown);
    this.shieldTimer = new TimerGame(bot, 0.5);
    this.attackTimer.forceElapsed();
  }

  onStart(): void {
    this.state = CombatState.APPROACHING;
    this.equipBestWeapon();
  }

  onTick(): Task | null {
    // Check if target is still valid
    if (!this.target || !this.bot.entities[this.target.id]) {
      return null;
    }

    const distance = this.bot.entity.position.distanceTo(this.target.position);
    const isCreeperFusing = this.isCreeperFusing();

    // State machine
    if (isCreeperFusing && distance < this.config.creeperFleeDistance) {
      // FLEE from fusing creeper
      this.state = CombatState.FLEEING;
      this.flee();
    } else if (this.shouldShield()) {
      // SHIELD against ranged attacks
      this.state = CombatState.SHIELDING;
      this.shield();
    } else if (distance > this.config.engageRange) {
      // APPROACH target
      this.state = CombatState.APPROACHING;
      this.approach();
    } else if (distance < this.config.kiteDistance) {
      // KITE to maintain distance
      this.state = CombatState.KITING;
      this.kite();
      this.tryAttack();
    } else {
      // ATTACK
      this.state = CombatState.ATTACKING;
      this.attack();
    }

    // Always look at target
    this.lookAtTarget();

    return null;
  }

  /**
   * Equip the best available weapon (sword)
   */
  private async equipBestWeapon(): Promise<void> {
    const swords = this.bot.inventory.items()
      .filter(i => i.name.includes('sword'))
      .sort((a, b) => this.getWeaponDamage(b) - this.getWeaponDamage(a));

    if (swords.length > 0) {
      try {
        await this.bot.equip(swords[0], 'hand');
      } catch (err) {
        // Failed to equip
      }
    }
  }

  /**
   * Get weapon damage value
   */
  private getWeaponDamage(item: any): number {
    const damages: Record<string, number> = {
      'netherite_sword': 8,
      'diamond_sword': 7,
      'iron_sword': 6,
      'golden_sword': 4,
      'stone_sword': 5,
      'wooden_sword': 4,
    };
    return damages[item.name] ?? 1;
  }

  /**
   * Check if creeper is fusing
   */
  private isCreeperFusing(): boolean {
    if (!this.target.name?.includes('creeper')) return false;
    // Check metadata for fuse time
    const metadata = this.target.metadata as any;
    return metadata?.some?.((m: any) => typeof m === 'number' && m > 0) ?? false;
  }

  /**
   * Check if we should use shield
   */
  private shouldShield(): boolean {
    if (!this.config.useShield) return false;
    if (!this.hasShield()) return false;

    // Shield against skeletons, drowned with tridents, etc.
    const name = this.target.name ?? '';
    const isRanged = name.includes('skeleton') || name.includes('drowned') ||
                     name.includes('blaze') || name.includes('ghast');

    const distance = this.bot.entity.position.distanceTo(this.target.position);

    // Shield if ranged mob is targeting us and in range
    return isRanged && distance < 20 && this.isTargetingPlayer();
  }

  /**
   * Check if we have a shield
   */
  private hasShield(): boolean {
    const offhand = this.bot.inventory.slots[45]; // Offhand slot
    return offhand?.name === 'shield';
  }

  /**
   * Check if target is targeting the player
   */
  private isTargetingPlayer(): boolean {
    // Check if looking at player
    const toPlayer = this.bot.entity.position.minus(this.target.position);
    const distance = toPlayer.norm();
    if (distance < 0.1) return true;

    const lookDir = new Vec3(
      -Math.sin(this.target.yaw) * Math.cos(this.target.pitch),
      -Math.sin(this.target.pitch),
      -Math.cos(this.target.yaw) * Math.cos(this.target.pitch)
    );

    const dot = toPlayer.normalize().dot(lookDir);
    return dot > 0.7;
  }

  /**
   * Approach the target
   */
  private approach(): void {
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);
    this.bot.setControlState('back', false);
  }

  /**
   * Attack the target
   */
  private attack(): void {
    this.approach();
    this.tryAttack();
  }

  /**
   * Kite (attack while backing up)
   */
  private kite(): void {
    this.bot.setControlState('forward', false);
    this.bot.setControlState('back', true);
    this.bot.setControlState('sprint', false);
  }

  /**
   * Try to attack if cooldown elapsed
   */
  private tryAttack(): void {
    const distance = this.bot.entity.position.distanceTo(this.target.position);
    if (distance > 4) return; // Too far

    // Check cooldown
    if (!this.attackTimer.elapsed()) return;

    // Check if attack cooldown is ready (vanilla mechanic)
    const cooldown = this.getAttackCooldown();
    if (cooldown < 1.0) return;

    // Check if grounded or falling (better for crits)
    const onGround = this.bot.entity.onGround;
    const falling = this.bot.entity.velocity.y < 0;
    if (!onGround && !falling) return;

    // Attack!
    this.bot.attack(this.target);
    this.attackTimer.reset();
  }

  /**
   * Get attack cooldown progress (0 to 1+)
   */
  private getAttackCooldown(): number {
    // Mineflayer doesn't directly expose this, estimate based on time
    return 1.0; // Assume ready
  }

  /**
   * Flee from danger
   */
  private flee(): void {
    const awayDir = this.bot.entity.position.minus(this.target.position).normalize();
    const yaw = Math.atan2(-awayDir.x, awayDir.z);

    this.bot.look(yaw, 0, true);
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);
    this.bot.setControlState('back', false);
  }

  /**
   * Raise shield
   */
  private shield(): void {
    this.bot.setControlState('forward', false);
    this.bot.setControlState('back', false);

    // Right-click to raise shield
    if (this.shieldTimer.elapsed()) {
      this.bot.activateItem(true); // offhand
      this.shieldTimer.reset();
    }
  }

  /**
   * Look at the target
   */
  private lookAtTarget(): void {
    const eyePos = this.target.position.offset(0, this.target.height * 0.8, 0);
    this.bot.lookAt(eyePos);
  }

  onStop(): void {
    this.bot.clearControlStates();
    this.bot.deactivateItem();
  }

  isFinished(): boolean {
    // Finished if target is dead or gone
    if (!this.target) return true;
    if (!this.bot.entities[this.target.id]) return true;
    if (this.target.health !== undefined && this.target.health <= 0) return true;

    // Finished if target is far away
    const distance = this.bot.entity.position.distanceTo(this.target.position);
    return distance > this.config.detectionRange * 1.5;
  }

  isEqual(other: Task | null): boolean {
    if (!(other instanceof CombatTask)) return false;
    return other.target.id === this.target.id;
  }

  getState(): CombatState {
    return this.state;
  }
}

/**
 * MobDefenseChain - Automatic combat automation
 */
export class MobDefenseChain extends SingleTaskChain {
  readonly displayName = 'MobDefenseChain';

  private config: MobDefenseConfig;
  private entityTracker: EntityTracker | null = null;
  private currentTarget: Entity | null = null;

  constructor(bot: Bot, config: Partial<MobDefenseConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the entity tracker to use
   */
  setEntityTracker(tracker: EntityTracker): void {
    this.entityTracker = tracker;
  }

  getPriority(): number {
    const threat = this.getHighestThreat();
    if (threat && threat.threatLevel >= this.config.threatThreshold) {
      return ChainPriority.DANGER;
    }
    return ChainPriority.INACTIVE;
  }

  isActive(): boolean {
    const threat = this.getHighestThreat();
    return threat !== null && threat.threatLevel >= this.config.threatThreshold;
  }

  protected getTaskForTick(): Task | null {
    const threat = this.getHighestThreat();
    if (!threat) return null;

    this.currentTarget = threat.entity;
    return new CombatTask(this.bot, threat.entity, this.config);
  }

  /**
   * Get the highest threat hostile
   */
  getHighestThreat(): ThreatInfo | null {
    const hostiles = this.getHostilesInRange();
    if (hostiles.length === 0) return null;

    // Assess threats
    const threats: ThreatInfo[] = hostiles.map(e => this.assessThreat(e));

    // Sort by threat level
    threats.sort((a, b) => b.threatLevel - a.threatLevel);

    return threats[0] ?? null;
  }

  /**
   * Get hostiles in detection range
   */
  private getHostilesInRange(): Entity[] {
    const playerPos = this.bot.entity.position;
    const result: Entity[] = [];

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;
      if (!this.isHostile(entity)) continue;

      const distance = entity.position.distanceTo(playerPos);
      if (distance <= this.config.detectionRange) {
        result.push(entity);
      }
    }

    return result;
  }

  /**
   * Check if an entity is hostile
   */
  private isHostile(entity: Entity): boolean {
    const name = entity.name ?? entity.displayName ?? '';

    const hostiles = new Set([
      'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider',
      'enderman', 'witch', 'slime', 'magma_cube', 'blaze',
      'ghast', 'wither_skeleton', 'zombified_piglin',
      'piglin_brute', 'hoglin', 'zoglin', 'phantom', 'drowned',
      'husk', 'stray', 'vex', 'vindicator', 'pillager', 'ravager',
      'evoker', 'guardian', 'elder_guardian', 'shulker', 'warden',
    ]);

    return hostiles.has(name);
  }

  /**
   * Assess threat level of an entity
   */
  assessThreat(entity: Entity): ThreatInfo {
    const playerPos = this.bot.entity.position;
    const distance = entity.position.distanceTo(playerPos);

    let threatLevel = 0;

    // Distance factor
    threatLevel += Math.max(0, (20 - distance)) * 0.5;

    // Entity type factor
    const name = entity.name ?? '';

    if (name.includes('creeper')) {
      threatLevel += 20;
      // Check if fusing (much more dangerous)
      const metadata = entity.metadata as any;
      if (metadata?.some?.((m: any) => typeof m === 'number' && m > 0)) {
        threatLevel += 50;
      }
    } else if (name.includes('skeleton') || name.includes('drowned')) {
      threatLevel += 15;
    } else if (name.includes('wither') || name.includes('warden')) {
      threatLevel += 30;
    } else if (name.includes('zombie') || name.includes('spider')) {
      threatLevel += 10;
    }

    // Targeting factor
    const isTargeting = this.isTargetingPlayer(entity);
    if (isTargeting) {
      threatLevel *= 1.5;
    }

    // Health factor
    const health = entity.health ?? 20;
    const maxHealth = (entity as any).maxHealth ?? 20;
    if (health < maxHealth * 0.3) {
      threatLevel *= 0.5;
    }

    return {
      entity,
      threatLevel,
      distance,
      isTargetingPlayer: isTargeting,
    };
  }

  /**
   * Check if entity is targeting the player
   */
  private isTargetingPlayer(entity: Entity): boolean {
    const toPlayer = this.bot.entity.position.minus(entity.position);
    const distance = toPlayer.norm();
    if (distance < 0.1) return true;

    const lookDir = new Vec3(
      -Math.sin(entity.yaw) * Math.cos(entity.pitch),
      -Math.sin(entity.pitch),
      -Math.cos(entity.yaw) * Math.cos(entity.pitch)
    );

    const dot = toPlayer.normalize().dot(lookDir);
    return dot > 0.7 && distance < 16;
  }

  /**
   * Get current target
   */
  getCurrentTarget(): Entity | null {
    return this.currentTarget;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<MobDefenseConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---- Debug ----

  getDebugInfo(): string {
    const threat = this.getHighestThreat();
    const hostiles = this.getHostilesInRange();
    return [
      `MobDefenseChain`,
      `  Hostiles in range: ${hostiles.length}`,
      `  Highest threat: ${threat?.entity.name ?? 'none'} (${threat?.threatLevel.toFixed(1) ?? 0})`,
      `  Current target: ${this.currentTarget?.name ?? 'none'}`,
    ].join('\n');
  }
}
