/**
 * EntityTracker - Entity Categorization and Caching
 * Based on AltoClef's EntityTracker.java
 *
 * Categorizes and caches entities for efficient queries:
 * - Hostile mobs (targeting player or aggressive)
 * - Passive mobs
 * - Item entities (dropped items)
 * - Players
 * - Projectiles with velocity prediction
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Tracker } from './Tracker';

/**
 * Entity categories
 */
export enum EntityCategory {
  HOSTILE = 'hostile',
  PASSIVE = 'passive',
  ITEM = 'item',
  PLAYER = 'player',
  PROJECTILE = 'projectile',
  OTHER = 'other',
}

/**
 * Cached projectile with velocity prediction
 */
export interface CachedProjectile {
  entity: Entity;
  position: Vec3;
  velocity: Vec3;
  predictedImpact: Vec3 | null;
  distanceToPlayer: number;
  isTargetingPlayer: boolean;
}

/**
 * Threat assessment result
 */
export interface ThreatInfo {
  entity: Entity;
  threatLevel: number;
  distance: number;
  isTargetingPlayer: boolean;
}

/**
 * Known hostile mob types
 */
const HOSTILE_MOBS = new Set([
  'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider',
  'enderman', 'witch', 'slime', 'magma_cube', 'blaze',
  'ghast', 'wither_skeleton', 'zombie_pigman', 'zombified_piglin',
  'piglin_brute', 'hoglin', 'zoglin', 'phantom', 'drowned',
  'husk', 'stray', 'vex', 'vindicator', 'pillager', 'ravager',
  'evoker', 'guardian', 'elder_guardian', 'shulker', 'warden',
  'wither', 'ender_dragon', 'endermite', 'silverfish',
]);

/**
 * Passive mob types
 */
const PASSIVE_MOBS = new Set([
  'cow', 'pig', 'sheep', 'chicken', 'horse', 'donkey', 'mule',
  'rabbit', 'wolf', 'cat', 'ocelot', 'parrot', 'villager',
  'iron_golem', 'snow_golem', 'bat', 'squid', 'dolphin', 'turtle',
  'cod', 'salmon', 'tropical_fish', 'pufferfish', 'bee', 'fox',
  'panda', 'llama', 'trader_llama', 'wandering_trader', 'mooshroom',
  'strider', 'axolotl', 'glow_squid', 'goat', 'frog', 'tadpole',
  'allay', 'camel', 'sniffer', 'armadillo',
]);

/**
 * Projectile types
 */
const PROJECTILES = new Set([
  'arrow', 'spectral_arrow', 'trident', 'fireball', 'small_fireball',
  'dragon_fireball', 'wither_skull', 'shulker_bullet', 'llama_spit',
  'snowball', 'egg', 'ender_pearl', 'potion', 'experience_bottle',
]);

/**
 * EntityTracker - Categorizes and caches entities
 */
export class EntityTracker extends Tracker {
  readonly displayName = 'EntityTracker';

  // Cached entities by category
  private hostiles: Entity[] = [];
  private passives: Entity[] = [];
  private items: Entity[] = [];
  private players: Entity[] = [];
  private projectiles: CachedProjectile[] = [];

  // Close entities (within reach)
  private closeEntities: Entity[] = [];

  // Configuration
  private closeRange: number = 5;
  private projectileWarningRange: number = 12;

  constructor(bot: Bot) {
    super(bot);
  }

  /**
   * Set the range for "close entities"
   */
  setCloseRange(range: number): void {
    this.closeRange = range;
  }

  // ---- Query Methods ----

  /**
   * Get all hostile mobs
   */
  getHostiles(): readonly Entity[] {
    this.ensureUpdated();
    return this.hostiles;
  }

  /**
   * Get hostile mobs within range
   */
  getHostilesInRange(range: number): Entity[] {
    this.ensureUpdated();
    const playerPos = this.bot.entity.position;
    return this.hostiles.filter(e =>
      e.position.distanceTo(playerPos) <= range
    );
  }

  /**
   * Get the closest hostile mob
   */
  getClosestHostile(): Entity | null {
    this.ensureUpdated();
    return this.hostiles[0] ?? null;
  }

  /**
   * Check if any hostile is targeting the player
   */
  anyHostileTargetingPlayer(): boolean {
    this.ensureUpdated();
    return this.hostiles.some(e => this.isTargetingPlayer(e));
  }

  /**
   * Get passive mobs
   */
  getPassives(): readonly Entity[] {
    this.ensureUpdated();
    return this.passives;
  }

  /**
   * Get dropped items
   */
  getItems(): readonly Entity[] {
    this.ensureUpdated();
    return this.items;
  }

  /**
   * Check if an item type has been dropped
   */
  itemDropped(itemNames: string[]): boolean {
    this.ensureUpdated();
    for (const entity of this.items) {
      const metadata = entity.metadata;
      // Item entity metadata structure varies by version
      const itemStack = (metadata as any)?.item ?? (metadata as any)?.[7];
      if (itemStack && itemNames.includes(itemStack.name)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get closest dropped item of a type
   */
  getClosestItemDrop(itemNames: string[]): Entity | null {
    this.ensureUpdated();
    const playerPos = this.bot.entity.position;

    let closest: Entity | null = null;
    let closestDist = Infinity;

    for (const entity of this.items) {
      const metadata = entity.metadata;
      const itemStack = (metadata as any)?.item ?? (metadata as any)?.[7];
      if (itemStack && itemNames.includes(itemStack.name)) {
        const dist = entity.position.distanceTo(playerPos);
        if (dist < closestDist) {
          closestDist = dist;
          closest = entity;
        }
      }
    }

    return closest;
  }

  /**
   * Get other players
   */
  getPlayers(): readonly Entity[] {
    this.ensureUpdated();
    return this.players;
  }

  /**
   * Get entities within close range
   */
  getCloseEntities(): readonly Entity[] {
    this.ensureUpdated();
    return this.closeEntities;
  }

  /**
   * Get projectiles that might hit the player
   */
  getProjectilesTargetingPlayer(): readonly CachedProjectile[] {
    this.ensureUpdated();
    return this.projectiles.filter(p => p.isTargetingPlayer);
  }

  /**
   * Check if any dangerous projectile is incoming
   */
  anyDangerousProjectile(): boolean {
    this.ensureUpdated();
    return this.projectiles.some(p =>
      p.isTargetingPlayer && p.distanceToPlayer < this.projectileWarningRange
    );
  }

  // ---- Threat Assessment ----

  /**
   * Assess threat level of an entity
   */
  assessThreat(entity: Entity): ThreatInfo {
    const playerPos = this.bot.entity.position;
    const distance = entity.position.distanceTo(playerPos);
    const isTargeting = this.isTargetingPlayer(entity);

    let threatLevel = 0;

    // Distance factor (closer = more threatening)
    threatLevel += Math.max(0, (20 - distance)) * 0.5;

    // Entity type factor
    const name = entity.name ?? entity.displayName ?? '';
    if (name.includes('creeper')) {
      threatLevel += 20; // Explodes!
      // Check if fusing
      const fuseTime = (entity as any).metadata?.find((m: any) =>
        typeof m === 'number' && m > 0
      );
      if (fuseTime) threatLevel += 30; // Actively fusing
    } else if (name.includes('skeleton') || name.includes('drowned')) {
      threatLevel += 15; // Ranged
    } else if (name.includes('wither') || name.includes('warden')) {
      threatLevel += 25; // Very dangerous
    } else if (name.includes('zombie') || name.includes('spider')) {
      threatLevel += 10;
    }

    // Targeting factor
    if (isTargeting) {
      threatLevel *= 2;
    }

    // Health factor (low health = less threat)
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
   * Get threats sorted by threat level
   */
  getThreats(): ThreatInfo[] {
    this.ensureUpdated();
    return this.hostiles
      .map(e => this.assessThreat(e))
      .sort((a, b) => b.threatLevel - a.threatLevel);
  }

  // ---- Entity Classification ----

  /**
   * Categorize an entity
   */
  categorizeEntity(entity: Entity): EntityCategory {
    const name = entity.name ?? entity.displayName ?? '';

    // Check for item
    if (name === 'item' || entity.displayName === 'Item') {
      return EntityCategory.ITEM;
    }

    // Check for player
    if (entity.type === 'player') {
      return EntityCategory.PLAYER;
    }

    // Check for projectile
    if (PROJECTILES.has(name)) {
      return EntityCategory.PROJECTILE;
    }

    // Check for hostile
    if (HOSTILE_MOBS.has(name)) {
      return EntityCategory.HOSTILE;
    }

    // Check for passive
    if (PASSIVE_MOBS.has(name)) {
      return EntityCategory.PASSIVE;
    }

    return EntityCategory.OTHER;
  }

  /**
   * Check if an entity is targeting the player
   */
  isTargetingPlayer(entity: Entity): boolean {
    // Check if mob has player as target
    const target = (entity as any).target;
    if (target && target === this.bot.entity) {
      return true;
    }

    // Check if looking at player (rough approximation)
    const toPlayer = this.bot.entity.position.minus(entity.position);
    const distance = toPlayer.norm();
    if (distance < 0.1) return true;

    const lookDir = new Vec3(
      -Math.sin(entity.yaw) * Math.cos(entity.pitch),
      -Math.sin(entity.pitch),
      -Math.cos(entity.yaw) * Math.cos(entity.pitch)
    );

    const dot = toPlayer.normalize().dot(lookDir);
    return dot > 0.85 && distance < 16;
  }

  // ---- Projectile Tracking ----

  /**
   * Process a projectile entity
   */
  private processProjectile(entity: Entity): CachedProjectile {
    const position = entity.position.clone();
    const velocity = entity.velocity.clone();
    const playerPos = this.bot.entity.position;

    // Predict impact point
    const predictedImpact = this.predictProjectileImpact(position, velocity);

    // Check if targeting player
    const isTargetingPlayer = this.isProjectileTargetingPlayer(
      position, velocity, playerPos
    );

    return {
      entity,
      position,
      velocity,
      predictedImpact,
      distanceToPlayer: position.distanceTo(playerPos),
      isTargetingPlayer,
    };
  }

  /**
   * Predict where a projectile will land
   */
  private predictProjectileImpact(pos: Vec3, vel: Vec3): Vec3 | null {
    const GRAVITY = 0.05; // Approximate gravity per tick
    const MAX_TICKS = 100;

    let currentPos = pos.clone();
    let currentVel = vel.clone();

    for (let i = 0; i < MAX_TICKS; i++) {
      currentPos = currentPos.plus(currentVel);
      currentVel.y -= GRAVITY;

      // Check for ground collision
      const block = this.bot.blockAt(currentPos);
      if (block && block.boundingBox !== 'empty') {
        return currentPos;
      }
    }

    return null;
  }

  /**
   * Check if a projectile is heading toward the player
   */
  private isProjectileTargetingPlayer(
    pos: Vec3,
    vel: Vec3,
    playerPos: Vec3
  ): boolean {
    // Vector from projectile to player
    const toPlayer = playerPos.minus(pos);

    // Check if velocity is pointing toward player
    const velNorm = vel.norm();
    if (velNorm < 0.1) return false;

    const dot = toPlayer.normalize().dot(vel.normalize());
    if (dot < 0.5) return false; // Not heading toward player

    // Estimate closest approach
    const t = toPlayer.dot(vel) / (velNorm * velNorm);
    if (t < 0) return false; // Moving away

    const closestPoint = pos.plus(vel.scaled(t));
    const closestDistance = closestPoint.distanceTo(playerPos);

    return closestDistance < 4; // Within 4 blocks of player
  }

  // ---- Update Implementation ----

  protected updateState(): void {
    const playerPos = this.bot.entity.position;

    // Clear caches
    this.hostiles = [];
    this.passives = [];
    this.items = [];
    this.players = [];
    this.projectiles = [];
    this.closeEntities = [];

    // Process all entities
    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;

      const distance = entity.position.distanceTo(playerPos);

      // Track close entities
      if (distance <= this.closeRange) {
        this.closeEntities.push(entity);
      }

      // Categorize and cache
      const category = this.categorizeEntity(entity);

      switch (category) {
        case EntityCategory.HOSTILE:
          this.hostiles.push(entity);
          break;
        case EntityCategory.PASSIVE:
          this.passives.push(entity);
          break;
        case EntityCategory.ITEM:
          this.items.push(entity);
          break;
        case EntityCategory.PLAYER:
          this.players.push(entity);
          break;
        case EntityCategory.PROJECTILE:
          this.projectiles.push(this.processProjectile(entity));
          break;
      }
    }

    // Sort hostiles by distance
    this.hostiles.sort((a, b) =>
      a.position.distanceTo(playerPos) - b.position.distanceTo(playerPos)
    );

    // Sort items by distance
    this.items.sort((a, b) =>
      a.position.distanceTo(playerPos) - b.position.distanceTo(playerPos)
    );
  }

  reset(): void {
    this.hostiles = [];
    this.passives = [];
    this.items = [];
    this.players = [];
    this.projectiles = [];
    this.closeEntities = [];
  }

  // ---- Debug ----

  getDebugInfo(): string {
    this.ensureUpdated();
    return [
      `EntityTracker`,
      `  Hostiles: ${this.hostiles.length}`,
      `  Passives: ${this.passives.length}`,
      `  Items: ${this.items.length}`,
      `  Players: ${this.players.length}`,
      `  Projectiles: ${this.projectiles.length}`,
      `  Close: ${this.closeEntities.length}`,
    ].join('\n');
  }
}
