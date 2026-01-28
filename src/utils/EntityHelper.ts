/**
 * EntityHelper - Entity State Interpretation Utilities
 * Based on AltoClef/BaritonePlus EntityHelper.java
 *
 * Provides utilities for:
 * - Determining entity hostility
 * - Calculating damage
 * - Entity state checks (grounded, trading, etc.)
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';

/**
 * Entity gravity constant (blocks per second^2)
 */
export const ENTITY_GRAVITY = 0.08;

/**
 * Hostile mob types that are always hostile
 */
const ALWAYS_HOSTILE_MOBS = new Set([
  'zombie',
  'husk',
  'drowned',
  'skeleton',
  'stray',
  'wither_skeleton',
  'creeper',
  'witch',
  'slime',
  'magma_cube',
  'blaze',
  'ghast',
  'phantom',
  'guardian',
  'elder_guardian',
  'shulker',
  'vex',
  'vindicator',
  'evoker',
  'ravager',
  'pillager',
  'warden',
  'wither',
  'ender_dragon',
]);

/**
 * Neutral mobs that only attack when provoked
 */
const NEUTRAL_MOBS = new Set([
  'enderman',
  'piglin',
  'spider', // hostile in dark only
  'cave_spider',
  'zombified_piglin',
  'polar_bear',
  'wolf',
  'iron_golem',
  'bee',
  'dolphin',
  'llama',
  'trader_llama',
  'panda',
  'goat',
]);

/**
 * Passive mobs that never attack
 */
const PASSIVE_MOBS = new Set([
  'pig',
  'cow',
  'sheep',
  'chicken',
  'rabbit',
  'mooshroom',
  'villager',
  'wandering_trader',
  'squid',
  'glow_squid',
  'turtle',
  'cod',
  'salmon',
  'tropical_fish',
  'pufferfish',
  'axolotl',
  'bat',
  'cat',
  'ocelot',
  'parrot',
  'horse',
  'donkey',
  'mule',
  'skeleton_horse',
  'zombie_horse',
  'strider',
  'fox',
  'frog',
  'tadpole',
  'allay',
  'camel',
  'sniffer',
]);

/**
 * Check if an entity is angry at the player
 * @param bot The mineflayer bot
 * @param entity The entity to check
 */
export function isAngryAtPlayer(bot: Bot, entity: Entity): boolean {
  const hostile = isGenerallyHostileToPlayer(bot, entity);

  // TODO: Check if entity can see player (line of sight)
  // For now, just return hostility status
  return hostile;
}

/**
 * Check if an entity is generally hostile to the player
 * @param bot The mineflayer bot
 * @param entity The entity to check
 */
export function isGenerallyHostileToPlayer(bot: Bot, entity: Entity): boolean {
  if (!entity.name) return false;

  const mobType = entity.name.toLowerCase();

  // Check if it's an always-hostile mob
  if (ALWAYS_HOSTILE_MOBS.has(mobType)) {
    return true;
  }

  // Check neutral mobs - they may be hostile based on state
  if (NEUTRAL_MOBS.has(mobType)) {
    // Check if the entity is targeting the player
    if ((entity as any).target === bot.entity?.id) {
      return true;
    }

    // Spider is hostile in low light levels
    if (mobType === 'spider' || mobType === 'cave_spider') {
      // Check if it's dark (light level < 7)
      const block = bot.blockAt(entity.position);
      if (block && (block as any).light < 7) {
        return true;
      }
    }

    // Piglin - check if not trading
    if (mobType === 'piglin') {
      return !isTradingPiglin(entity);
    }

    return false;
  }

  // Passive mobs are never hostile
  if (PASSIVE_MOBS.has(mobType)) {
    return false;
  }

  // Unknown entity - check if it has a target
  return (entity as any).target === bot.entity?.id;
}

/**
 * Check if a piglin is currently trading (holding gold)
 * @param entity The entity to check
 */
export function isTradingPiglin(entity: Entity): boolean {
  if (!entity.name || entity.name.toLowerCase() !== 'piglin') {
    return false;
  }

  // Check if holding gold ingot
  const heldItem = (entity as any).heldItem;
  if (heldItem && heldItem.name === 'gold_ingot') {
    return true;
  }

  // Also check equipment
  const equipment = (entity as any).equipment;
  if (equipment) {
    for (const slot of [0, 1]) { // Main hand and off hand
      const item = equipment[slot];
      if (item && item.name === 'gold_ingot') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if an entity is grounded (on ground or in water)
 * @param entity The entity to check
 */
export function isGrounded(entity: Entity): boolean {
  const onGround = entity.onGround ?? false;
  const inWater = (entity as any).isInWater ?? false;
  const swimming = (entity as any).isSwimming ?? false;

  return onGround || inWater || swimming;
}

/**
 * Check if the bot player is grounded
 * @param bot The mineflayer bot
 */
export function isPlayerGrounded(bot: Bot): boolean {
  if (!bot.entity) return false;
  return isGrounded(bot.entity);
}

/**
 * Damage source type
 */
export enum DamageSource {
  GENERIC = 'generic',
  PLAYER_ATTACK = 'player_attack',
  MOB_ATTACK = 'mob_attack',
  PROJECTILE = 'projectile',
  FALL = 'fall',
  FIRE = 'fire',
  LAVA = 'lava',
  DROWNING = 'drowning',
  EXPLOSION = 'explosion',
  VOID = 'out_of_world',
  MAGIC = 'magic',
  WITHER = 'wither',
  STARVING = 'starving',
  LIGHTNING = 'lightning',
  FREEZE = 'freeze',
}

/**
 * Check if a damage source bypasses armor
 */
export function damageBypassesArmor(source: DamageSource): boolean {
  const bypassArmor = new Set([
    DamageSource.VOID,
    DamageSource.STARVING,
    DamageSource.MAGIC,
    DamageSource.DROWNING,
    DamageSource.FIRE, // Fire ticks bypass armor
  ]);
  return bypassArmor.has(source);
}

/**
 * Calculate damage after armor reduction
 * @param damage Raw damage amount
 * @param armor Armor points (0-20)
 * @param toughness Armor toughness (0-20)
 */
export function calculateArmorReduction(
  damage: number,
  armor: number,
  toughness: number = 0
): number {
  // Minecraft armor formula
  // damage_after = damage * (1 - min(20, max(armor/5, armor - damage/(2 + toughness/4))) / 25)
  const armorEffect = Math.min(
    20,
    Math.max(armor / 5, armor - damage / (2 + toughness / 4))
  );
  return damage * (1 - armorEffect / 25);
}

/**
 * Calculate damage after protection enchantment
 * @param damage Damage after armor
 * @param protectionLevel Combined protection level (0-20 effective)
 */
export function calculateProtectionReduction(
  damage: number,
  protectionLevel: number
): number {
  // Each protection level reduces damage by 4%, max 80% reduction
  const reduction = Math.min(protectionLevel * 0.04, 0.8);
  return damage * (1 - reduction);
}

/**
 * Calculate resulting damage to player
 * Simplified version of Minecraft's damage calculation
 *
 * @param bot The mineflayer bot
 * @param source Damage source type
 * @param rawDamage Raw incoming damage
 */
export function calculateResultingPlayerDamage(
  bot: Bot,
  source: DamageSource,
  rawDamage: number
): number {
  let damage = rawDamage;

  // Get player's armor value
  const armor = getPlayerArmor(bot);
  const toughness = getPlayerArmorToughness(bot);

  // Apply armor if applicable
  if (!damageBypassesArmor(source)) {
    damage = calculateArmorReduction(damage, armor, toughness);
  }

  // Apply protection enchantment (simplified - assumes total protection level)
  const protectionLevel = getPlayerProtectionLevel(bot);
  if (protectionLevel > 0) {
    damage = calculateProtectionReduction(damage, protectionLevel);
  }

  // Apply absorption
  const absorption = getPlayerAbsorption(bot);
  damage = Math.max(0, damage - absorption);

  return damage;
}

/**
 * Get player's total armor points
 */
export function getPlayerArmor(bot: Bot): number {
  // Try to get from bot entity if available
  if (bot.entity && (bot.entity as any).attributes) {
    const armorAttr = (bot.entity as any).attributes['generic.armor'];
    if (armorAttr) return armorAttr.value ?? 0;
  }

  // Calculate from equipped armor
  let total = 0;
  const armorValues: Record<string, number> = {
    leather_helmet: 1, leather_chestplate: 3, leather_leggings: 2, leather_boots: 1,
    golden_helmet: 2, golden_chestplate: 5, golden_leggings: 3, golden_boots: 1,
    chainmail_helmet: 2, chainmail_chestplate: 5, chainmail_leggings: 4, chainmail_boots: 1,
    iron_helmet: 2, iron_chestplate: 6, iron_leggings: 5, iron_boots: 2,
    diamond_helmet: 3, diamond_chestplate: 8, diamond_leggings: 6, diamond_boots: 3,
    netherite_helmet: 3, netherite_chestplate: 8, netherite_leggings: 6, netherite_boots: 3,
    turtle_helmet: 2,
  };

  // Check armor slots (5-8 in player inventory)
  for (let slot = 5; slot <= 8; slot++) {
    const item = bot.inventory.slots[slot];
    if (item && armorValues[item.name]) {
      total += armorValues[item.name];
    }
  }

  return total;
}

/**
 * Get player's armor toughness
 */
export function getPlayerArmorToughness(bot: Bot): number {
  // Only diamond and netherite have toughness
  let total = 0;
  const toughnessValues: Record<string, number> = {
    diamond_helmet: 2, diamond_chestplate: 2, diamond_leggings: 2, diamond_boots: 2,
    netherite_helmet: 3, netherite_chestplate: 3, netherite_leggings: 3, netherite_boots: 3,
  };

  for (let slot = 5; slot <= 8; slot++) {
    const item = bot.inventory.slots[slot];
    if (item && toughnessValues[item.name]) {
      total += toughnessValues[item.name];
    }
  }

  return total;
}

/**
 * Get player's total protection enchantment level (simplified)
 */
export function getPlayerProtectionLevel(bot: Bot): number {
  // Check armor enchantments
  // This is simplified - actual calculation is more complex
  let total = 0;

  for (let slot = 5; slot <= 8; slot++) {
    const item = bot.inventory.slots[slot];
    if (item && item.nbt) {
      // Try to read protection enchantment
      // Note: NBT structure varies - this is a simplified check
      const enchants = (item as any).enchants ?? [];
      for (const ench of enchants) {
        if (ench.name === 'protection') {
          total += ench.lvl;
        }
      }
    }
  }

  // Cap at 20 effective (80% reduction)
  return Math.min(total, 20);
}

/**
 * Get player's absorption amount
 */
export function getPlayerAbsorption(bot: Bot): number {
  // Check for absorption effect
  const effect = bot.entity?.effects?.[22]; // Absorption effect ID
  if (effect) {
    return (effect.amplifier + 1) * 4; // 4 hearts per level
  }
  return 0;
}

/**
 * Get distance between two entities
 */
export function getEntityDistance(e1: Entity, e2: Entity): number {
  return e1.position.distanceTo(e2.position);
}

/**
 * Get horizontal distance between two entities (ignoring Y)
 */
export function getEntityHorizontalDistance(e1: Entity, e2: Entity): number {
  const dx = e1.position.x - e2.position.x;
  const dz = e1.position.z - e2.position.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Check if an entity is a player
 */
export function isPlayer(entity: Entity): boolean {
  return entity.type === 'player';
}

/**
 * Check if an entity is a hostile mob
 */
export function isHostileMob(entity: Entity): boolean {
  if (!entity.name) return false;
  return ALWAYS_HOSTILE_MOBS.has(entity.name.toLowerCase());
}

/**
 * Check if an entity is a passive mob
 */
export function isPassiveMob(entity: Entity): boolean {
  if (!entity.name) return false;
  return PASSIVE_MOBS.has(entity.name.toLowerCase());
}

/**
 * Check if an entity is a neutral mob
 */
export function isNeutralMob(entity: Entity): boolean {
  if (!entity.name) return false;
  return NEUTRAL_MOBS.has(entity.name.toLowerCase());
}

/**
 * Get the nearest entity of a specific type
 */
export function getNearestEntity(
  bot: Bot,
  filter: (entity: Entity) => boolean
): Entity | null {
  let nearest: Entity | null = null;
  let nearestDist = Infinity;

  for (const id in bot.entities) {
    const entity = bot.entities[id];
    if (entity === bot.entity) continue;
    if (!filter(entity)) continue;

    const dist = bot.entity?.position.distanceTo(entity.position) ?? Infinity;
    if (dist < nearestDist) {
      nearest = entity;
      nearestDist = dist;
    }
  }

  return nearest;
}

/**
 * Get all entities matching a filter within range
 */
export function getEntitiesInRange(
  bot: Bot,
  range: number,
  filter?: (entity: Entity) => boolean
): Entity[] {
  const entities: Entity[] = [];
  const rangeSq = range * range;

  for (const id in bot.entities) {
    const entity = bot.entities[id];
    if (entity === bot.entity) continue;

    const distSq = bot.entity?.position.distanceSquared(entity.position) ?? Infinity;
    if (distSq > rangeSq) continue;

    if (!filter || filter(entity)) {
      entities.push(entity);
    }
  }

  return entities;
}

/**
 * Create an EntityHelper bound to a specific bot
 */
export class EntityHelperInstance {
  constructor(private bot: Bot) {}

  isAngryAtPlayer = (entity: Entity) => isAngryAtPlayer(this.bot, entity);
  isGenerallyHostileToPlayer = (entity: Entity) => isGenerallyHostileToPlayer(this.bot, entity);
  isPlayerGrounded = () => isPlayerGrounded(this.bot);
  calculateResultingPlayerDamage = (source: DamageSource, damage: number) =>
    calculateResultingPlayerDamage(this.bot, source, damage);
  getPlayerArmor = () => getPlayerArmor(this.bot);
  getNearestEntity = (filter: (e: Entity) => boolean) => getNearestEntity(this.bot, filter);
  getEntitiesInRange = (range: number, filter?: (e: Entity) => boolean) =>
    getEntitiesInRange(this.bot, range, filter);
}

/**
 * Create an EntityHelper instance for a bot
 */
export function createEntityHelper(bot: Bot): EntityHelperInstance {
  return new EntityHelperInstance(bot);
}

export default {
  ENTITY_GRAVITY,
  isAngryAtPlayer,
  isGenerallyHostileToPlayer,
  isTradingPiglin,
  isGrounded,
  isPlayerGrounded,
  DamageSource,
  damageBypassesArmor,
  calculateArmorReduction,
  calculateProtectionReduction,
  calculateResultingPlayerDamage,
  getPlayerArmor,
  getPlayerArmorToughness,
  getPlayerProtectionLevel,
  getPlayerAbsorption,
  getEntityDistance,
  getEntityHorizontalDistance,
  isPlayer,
  isHostileMob,
  isPassiveMob,
  isNeutralMob,
  getNearestEntity,
  getEntitiesInRange,
  createEntityHelper,
};
