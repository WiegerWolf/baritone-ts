/**
 * ArmorRequirement - Armor Tier Requirements
 * Based on BaritonePlus ArmorRequirement.java
 *
 * Defines armor tiers and their corresponding item sets.
 * Used by tasks that require specific armor protection levels.
 */

/**
 * Armor requirement tiers
 */
export enum ArmorRequirement {
  NONE = 'none',
  LEATHER = 'leather',
  CHAINMAIL = 'chainmail',
  IRON = 'iron',
  GOLD = 'gold',
  DIAMOND = 'diamond',
  NETHERITE = 'netherite',
}

/**
 * Armor set - helmet, chestplate, leggings, boots
 */
export interface ArmorSet {
  helmet: string;
  chestplate: string;
  leggings: string;
  boots: string;
}

/**
 * Armor sets for each tier
 */
export const ARMOR_SETS: Record<ArmorRequirement, ArmorSet | null> = {
  [ArmorRequirement.NONE]: null,
  [ArmorRequirement.LEATHER]: {
    helmet: 'leather_helmet',
    chestplate: 'leather_chestplate',
    leggings: 'leather_leggings',
    boots: 'leather_boots',
  },
  [ArmorRequirement.CHAINMAIL]: {
    helmet: 'chainmail_helmet',
    chestplate: 'chainmail_chestplate',
    leggings: 'chainmail_leggings',
    boots: 'chainmail_boots',
  },
  [ArmorRequirement.IRON]: {
    helmet: 'iron_helmet',
    chestplate: 'iron_chestplate',
    leggings: 'iron_leggings',
    boots: 'iron_boots',
  },
  [ArmorRequirement.GOLD]: {
    helmet: 'golden_helmet',
    chestplate: 'golden_chestplate',
    leggings: 'golden_leggings',
    boots: 'golden_boots',
  },
  [ArmorRequirement.DIAMOND]: {
    helmet: 'diamond_helmet',
    chestplate: 'diamond_chestplate',
    leggings: 'diamond_leggings',
    boots: 'diamond_boots',
  },
  [ArmorRequirement.NETHERITE]: {
    helmet: 'netherite_helmet',
    chestplate: 'netherite_chestplate',
    leggings: 'netherite_leggings',
    boots: 'netherite_boots',
  },
};

/**
 * Armor tier order (for comparison)
 */
const ARMOR_TIER_ORDER: ArmorRequirement[] = [
  ArmorRequirement.NONE,
  ArmorRequirement.LEATHER,
  ArmorRequirement.GOLD,
  ArmorRequirement.CHAINMAIL,
  ArmorRequirement.IRON,
  ArmorRequirement.DIAMOND,
  ArmorRequirement.NETHERITE,
];

/**
 * Get armor protection values for each tier
 */
export const ARMOR_PROTECTION: Record<ArmorRequirement, number> = {
  [ArmorRequirement.NONE]: 0,
  [ArmorRequirement.LEATHER]: 7,      // 1+3+2+1
  [ArmorRequirement.GOLD]: 11,        // 2+5+3+1
  [ArmorRequirement.CHAINMAIL]: 12,   // 2+5+4+1
  [ArmorRequirement.IRON]: 15,        // 2+6+5+2
  [ArmorRequirement.DIAMOND]: 20,     // 3+8+6+3
  [ArmorRequirement.NETHERITE]: 20,   // 3+8+6+3 (same as diamond but with toughness)
};

/**
 * Get armor toughness for each tier
 */
export const ARMOR_TOUGHNESS: Record<ArmorRequirement, number> = {
  [ArmorRequirement.NONE]: 0,
  [ArmorRequirement.LEATHER]: 0,
  [ArmorRequirement.GOLD]: 0,
  [ArmorRequirement.CHAINMAIL]: 0,
  [ArmorRequirement.IRON]: 0,
  [ArmorRequirement.DIAMOND]: 8,      // 2+2+2+2
  [ArmorRequirement.NETHERITE]: 12,   // 3+3+3+3
};

/**
 * Get armor items for a tier
 */
export function getArmorItems(tier: ArmorRequirement): string[] {
  const set = ARMOR_SETS[tier];
  if (!set) return [];
  return [set.helmet, set.chestplate, set.leggings, set.boots];
}

/**
 * Get armor set for a tier
 */
export function getArmorSet(tier: ArmorRequirement): ArmorSet | null {
  return ARMOR_SETS[tier];
}

/**
 * Get the tier index for comparison
 */
export function getArmorTierIndex(tier: ArmorRequirement): number {
  return ARMOR_TIER_ORDER.indexOf(tier);
}

/**
 * Compare two armor tiers
 * Returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareArmorTiers(a: ArmorRequirement, b: ArmorRequirement): number {
  return getArmorTierIndex(a) - getArmorTierIndex(b);
}

/**
 * Check if armor tier a meets or exceeds requirement b
 */
export function armorMeetsRequirement(
  current: ArmorRequirement,
  required: ArmorRequirement
): boolean {
  return getArmorTierIndex(current) >= getArmorTierIndex(required);
}

/**
 * Get the armor tier from an item name
 */
export function getArmorTierFromItem(itemName: string): ArmorRequirement | null {
  if (itemName.startsWith('leather_')) return ArmorRequirement.LEATHER;
  if (itemName.startsWith('chainmail_')) return ArmorRequirement.CHAINMAIL;
  if (itemName.startsWith('iron_')) return ArmorRequirement.IRON;
  if (itemName.startsWith('golden_')) return ArmorRequirement.GOLD;
  if (itemName.startsWith('diamond_')) return ArmorRequirement.DIAMOND;
  if (itemName.startsWith('netherite_')) return ArmorRequirement.NETHERITE;
  if (itemName === 'turtle_helmet') return ArmorRequirement.IRON; // Turtle helmet ~ iron tier
  return null;
}

/**
 * Check if an item is an armor piece
 */
export function isArmorItem(itemName: string): boolean {
  return (
    itemName.endsWith('_helmet') ||
    itemName.endsWith('_chestplate') ||
    itemName.endsWith('_leggings') ||
    itemName.endsWith('_boots') ||
    itemName === 'turtle_helmet'
  );
}

/**
 * Get the armor slot type from an item name
 */
export function getArmorSlotFromItem(
  itemName: string
): 'helmet' | 'chestplate' | 'leggings' | 'boots' | null {
  if (itemName.endsWith('_helmet') || itemName === 'turtle_helmet') return 'helmet';
  if (itemName.endsWith('_chestplate')) return 'chestplate';
  if (itemName.endsWith('_leggings')) return 'leggings';
  if (itemName.endsWith('_boots')) return 'boots';
  return null;
}

/**
 * Get the next tier up from the current tier
 */
export function getNextArmorTier(current: ArmorRequirement): ArmorRequirement | null {
  const index = getArmorTierIndex(current);
  if (index >= ARMOR_TIER_ORDER.length - 1) return null;
  return ARMOR_TIER_ORDER[index + 1];
}

/**
 * Get minimum armor tier needed for total protection value
 */
export function getMinimumTierForProtection(protection: number): ArmorRequirement {
  for (const tier of ARMOR_TIER_ORDER) {
    if (ARMOR_PROTECTION[tier] >= protection) {
      return tier;
    }
  }
  return ArmorRequirement.NETHERITE;
}

export default ArmorRequirement;
