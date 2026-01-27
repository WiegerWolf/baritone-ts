import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { BaseProcess, ProcessPriority, ProcessTickResult, ProcessState } from './Process';
import { Goal } from '../types';
import { GoalNear, GoalInverted, GoalFollow } from '../goals';

/**
 * CombatProcess handles combat and flee behaviors
 * Based on Baritone's combat patterns
 *
 * Features:
 * - Attack hostile mobs
 * - Flee from danger
 * - Kiting (hit and run)
 * - Target prioritization
 * - Shield blocking
 */

/**
 * Combat mode
 */
export type CombatMode = 'attack' | 'flee' | 'kite' | 'defend';

/**
 * Combat configuration
 */
export interface CombatConfig {
  // Combat mode
  mode: CombatMode;
  // Attack range
  attackRange: number;
  // Flee distance (how far to run)
  fleeDistance: number;
  // Entities to target (empty = all hostile)
  targetTypes: string[];
  // Entities to flee from (empty = all hostile)
  fleeFrom: string[];
  // Use shield when available
  useShield: boolean;
  // Kite distance (for kite mode)
  kiteDistance: number;
  // Attack cooldown (ticks)
  attackCooldown: number;
  // Search radius for targets
  searchRadius: number;
  // Prioritize low health targets
  prioritizeLowHealth: boolean;
}

const DEFAULT_CONFIG: CombatConfig = {
  mode: 'attack',
  attackRange: 3.5,
  fleeDistance: 16,
  targetTypes: [],
  fleeFrom: [],
  useShield: true,
  kiteDistance: 5,
  attackCooldown: 10,
  searchRadius: 16,
  prioritizeLowHealth: true
};

// Default hostile mobs
const HOSTILE_MOBS = new Set([
  'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider',
  'enderman', 'witch', 'slime', 'magma_cube', 'blaze',
  'ghast', 'zombie_pigman', 'piglin_brute', 'wither_skeleton',
  'drowned', 'husk', 'stray', 'phantom', 'pillager',
  'vindicator', 'evoker', 'ravager', 'vex', 'hoglin',
  'zoglin', 'piglin', 'warden'
]);

type CombatState = 'searching' | 'approaching' | 'attacking' | 'fleeing' | 'kiting' | 'blocking';

export class CombatProcess extends BaseProcess {
  readonly displayName = 'Combat';

  private config: CombatConfig;
  private currentTarget: Entity | null = null;
  private combatState: CombatState = 'searching';
  private lastAttackTick: number = 0;
  private killCount: number = 0;
  private fleeStartPos: Vec3 | null = null;

  constructor(bot: Bot, pathfinder: any, config: Partial<CombatConfig> = {}) {
    super(bot, pathfinder, ProcessPriority.HIGH); // Combat is high priority
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set combat mode
   */
  setMode(mode: CombatMode): void {
    this.config.mode = mode;
    this.combatState = 'searching';
  }

  /**
   * Set target types to attack
   */
  setTargetTypes(types: string[]): void {
    this.config.targetTypes = types;
  }

  /**
   * Set entity types to flee from
   */
  setFleeFrom(types: string[]): void {
    this.config.fleeFrom = types;
  }

  /**
   * Set attack range
   */
  setAttackRange(range: number): void {
    this.config.attackRange = range;
  }

  /**
   * Set flee distance
   */
  setFleeDistance(distance: number): void {
    this.config.fleeDistance = distance;
  }

  onActivate(): void {
    super.onActivate();
    this.killCount = 0;
    this.combatState = 'searching';
    this.currentTarget = null;
  }

  onDeactivate(): void {
    super.onDeactivate();
    this.currentTarget = null;
    this.stopBlocking();
  }

  tick(): ProcessTickResult {
    // Update target validity
    if (this.currentTarget && !this.isValidTarget(this.currentTarget)) {
      this.currentTarget = null;
      this.combatState = 'searching';
    }

    switch (this.config.mode) {
      case 'attack':
        return this.tickAttackMode();
      case 'flee':
        return this.tickFleeMode();
      case 'kite':
        return this.tickKiteMode();
      case 'defend':
        return this.tickDefendMode();
    }
  }

  private tickAttackMode(): ProcessTickResult {
    switch (this.combatState) {
      case 'searching':
        return this.handleSearching();
      case 'approaching':
        return this.handleApproaching();
      case 'attacking':
        return this.handleAttacking();
      case 'blocking':
        return this.handleBlocking();
      default:
        this.combatState = 'searching';
        return this.waitResult('Resetting combat state');
    }
  }

  private tickFleeMode(): ProcessTickResult {
    // Find nearest threat
    const threat = this.findNearestThreat();

    if (!threat) {
      return this.completeResult('No threats nearby');
    }

    const pos = this.bot.entity.position;
    const threatDist = pos.distanceTo(threat.position);

    if (threatDist >= this.config.fleeDistance) {
      return this.completeResult('Fled to safe distance');
    }

    // Run away from threat
    const goal = new GoalInverted(new GoalNear(
      threat.position.x,
      threat.position.y,
      threat.position.z,
      this.config.fleeDistance
    ));

    return this.newGoalResult(goal, `Fleeing from ${threat.name}`);
  }

  private tickKiteMode(): ProcessTickResult {
    if (!this.currentTarget) {
      this.currentTarget = this.findBestTarget();
      if (!this.currentTarget) {
        return this.waitResult('Searching for targets...');
      }
    }

    const pos = this.bot.entity.position;
    const targetDist = pos.distanceTo(this.currentTarget.position);

    // If too close, back up
    if (targetDist < this.config.kiteDistance - 1) {
      this.combatState = 'fleeing';
      const awayDir = pos.minus(this.currentTarget.position).normalize();
      const fleeTarget = pos.plus(awayDir.scaled(this.config.kiteDistance));

      const goal = new GoalNear(fleeTarget.x, fleeTarget.y, fleeTarget.z, 1);
      return this.newGoalResult(goal, 'Kiting - backing up');
    }

    // If in attack range, attack
    if (targetDist <= this.config.attackRange) {
      return this.handleAttacking();
    }

    // Move closer
    const goal = new GoalNear(
      this.currentTarget.position.x,
      this.currentTarget.position.y,
      this.currentTarget.position.z,
      this.config.attackRange - 0.5
    );
    return this.newGoalResult(goal, 'Kiting - approaching');
  }

  private tickDefendMode(): ProcessTickResult {
    // In defend mode, only attack if being attacked
    const attacker = this.findAttacker();

    if (!attacker) {
      // No one attacking us, just stand guard
      if (this.config.useShield) {
        this.startBlocking();
      }
      return this.waitResult('Defending position');
    }

    // Counter-attack
    this.currentTarget = attacker;
    this.combatState = 'attacking';
    return this.handleAttacking();
  }

  private handleSearching(): ProcessTickResult {
    this.currentTarget = this.findBestTarget();

    if (!this.currentTarget) {
      return this.waitResult('No targets found');
    }

    this.combatState = 'approaching';
    return this.waitResult(`Found target: ${this.currentTarget.name}`);
  }

  private handleApproaching(): ProcessTickResult {
    if (!this.currentTarget) {
      this.combatState = 'searching';
      return this.waitResult('Target lost');
    }

    const pos = this.bot.entity.position;
    const targetDist = pos.distanceTo(this.currentTarget.position);

    if (targetDist <= this.config.attackRange) {
      this.combatState = 'attacking';
      return this.waitResult('In attack range');
    }

    // Check if target is attacking us - maybe block
    if (this.config.useShield && this.isTargetAttacking()) {
      this.combatState = 'blocking';
      return this.handleBlocking();
    }

    // Move toward target
    const goal = new GoalNear(
      this.currentTarget.position.x,
      this.currentTarget.position.y,
      this.currentTarget.position.z,
      this.config.attackRange - 0.5
    );

    return this.newGoalResult(goal, `Approaching ${this.currentTarget.name}`);
  }

  private handleAttacking(): ProcessTickResult {
    if (!this.currentTarget) {
      this.combatState = 'searching';
      return this.waitResult('Target lost');
    }

    const pos = this.bot.entity.position;
    const targetDist = pos.distanceTo(this.currentTarget.position);

    // Check if we need to move closer
    if (targetDist > this.config.attackRange) {
      this.combatState = 'approaching';
      return this.waitResult('Target moved away');
    }

    // Check attack cooldown
    const currentTick = Date.now();
    if (currentTick - this.lastAttackTick < this.config.attackCooldown * 50) {
      return this.waitResult('Attack on cooldown');
    }

    // Stop blocking to attack
    this.stopBlocking();

    // Look at target
    this.bot.lookAt(this.currentTarget.position.offset(0, this.currentTarget.height * 0.8, 0));

    // Attack!
    this.bot.attack(this.currentTarget);
    this.lastAttackTick = currentTick;

    // Check if target died
    if (!this.currentTarget.isValid || (this.currentTarget as any).health <= 0) {
      this.killCount++;
      this.currentTarget = null;
      this.combatState = 'searching';
      return this.waitResult('Target eliminated');
    }

    return this.waitResult(`Attacking ${this.currentTarget.name}`);
  }

  private handleBlocking(): ProcessTickResult {
    if (!this.currentTarget) {
      this.stopBlocking();
      this.combatState = 'searching';
      return this.waitResult('No target to block');
    }

    // Check if target is still attacking
    if (!this.isTargetAttacking()) {
      this.stopBlocking();
      this.combatState = 'approaching';
      return this.waitResult('Target stopped attacking');
    }

    // Start blocking
    this.startBlocking();

    // Look at target while blocking
    this.bot.lookAt(this.currentTarget.position.offset(0, this.currentTarget.height * 0.8, 0));

    return this.waitResult('Blocking attack');
  }

  /**
   * Find the best target to attack
   */
  private findBestTarget(): Entity | null {
    const pos = this.bot.entity.position;
    const radiusSq = this.config.searchRadius * this.config.searchRadius;

    let bestTarget: Entity | null = null;
    let bestScore = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!this.isValidTarget(entity)) continue;

      const distSq = entity.position.distanceSquared(pos);
      if (distSq > radiusSq) continue;

      // Calculate score (lower is better)
      let score = Math.sqrt(distSq);

      // Prioritize low health
      if (this.config.prioritizeLowHealth && (entity as any).health) {
        score -= (20 - (entity as any).health) * 0.5;
      }

      if (score < bestScore) {
        bestScore = score;
        bestTarget = entity;
      }
    }

    return bestTarget;
  }

  /**
   * Find nearest threat to flee from
   */
  private findNearestThreat(): Entity | null {
    const pos = this.bot.entity.position;
    const radiusSq = this.config.searchRadius * this.config.searchRadius;

    let nearestThreat: Entity | null = null;
    let nearestDistSq = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!this.isThreat(entity)) continue;

      const distSq = entity.position.distanceSquared(pos);
      if (distSq > radiusSq) continue;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestThreat = entity;
      }
    }

    return nearestThreat;
  }

  /**
   * Find entity that is attacking us
   */
  private findAttacker(): Entity | null {
    // Check recent damage source or entities looking at us
    for (const entity of Object.values(this.bot.entities)) {
      if (!this.isHostile(entity)) continue;

      const pos = this.bot.entity.position;
      const dist = entity.position.distanceTo(pos);

      // If hostile and close, consider it an attacker
      if (dist < 5) {
        return entity;
      }
    }

    return null;
  }

  /**
   * Check if entity is a valid attack target
   */
  private isValidTarget(entity: Entity): boolean {
    if (!entity || !entity.isValid) return false;
    if (entity === this.bot.entity) return false;

    // Check if in target list
    if (this.config.targetTypes.length > 0) {
      return this.config.targetTypes.includes(entity.name || '');
    }

    // Default to hostile mobs
    return this.isHostile(entity);
  }

  /**
   * Check if entity is a threat to flee from
   */
  private isThreat(entity: Entity): boolean {
    if (!entity || !entity.isValid) return false;
    if (entity === this.bot.entity) return false;

    // Check if in flee list
    if (this.config.fleeFrom.length > 0) {
      return this.config.fleeFrom.includes(entity.name || '');
    }

    // Default to hostile mobs
    return this.isHostile(entity);
  }

  /**
   * Check if entity is hostile
   */
  private isHostile(entity: Entity): boolean {
    return HOSTILE_MOBS.has(entity.name || '');
  }

  /**
   * Check if current target is attacking us
   */
  private isTargetAttacking(): boolean {
    if (!this.currentTarget) return false;

    // Simple heuristic: target is close and facing us
    const pos = this.bot.entity.position;
    const dist = this.currentTarget.position.distanceTo(pos);

    return dist < 4;
  }

  /**
   * Start blocking with shield
   */
  private startBlocking(): void {
    // Check if we have a shield
    const shield = this.bot.inventory.items().find(i => i.name === 'shield');
    if (shield) {
      this.bot.equip(shield, 'off-hand').then(() => {
        this.bot.activateItem(true); // Use off-hand
      }).catch(() => {});
    }
  }

  /**
   * Stop blocking
   */
  private stopBlocking(): void {
    this.bot.deactivateItem();
  }

  /**
   * Get kill count
   */
  getKillCount(): number {
    return this.killCount;
  }

  /**
   * Get current target
   */
  getCurrentTarget(): Entity | null {
    return this.currentTarget;
  }

  /**
   * Get current combat state
   */
  getCombatState(): CombatState {
    return this.combatState;
  }
}
