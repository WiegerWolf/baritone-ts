/**
 * SmeltTarget - Smelting Recipe Target
 * Based on BaritonePlus SmeltTarget.java
 *
 * Wraps a smelting target with input materials and output item.
 * Used by smelting tasks to specify what to smelt and how many.
 */

import { ItemTarget } from './ItemTarget';

/**
 * SmeltTarget - Represents a smelting target
 */
export class SmeltTarget {
  /** The output item target */
  private readonly item: ItemTarget;

  /** The primary material to smelt */
  private readonly material: ItemTarget;

  /** Alternative materials that can also produce the output */
  private readonly optionalMaterials: string[];

  /**
   * Create a smelting target
   * @param item The output item target (what we want)
   * @param material The input material target (what we smelt)
   * @param optionalMaterials Alternative input materials
   */
  constructor(item: ItemTarget, material: ItemTarget, ...optionalMaterials: string[]) {
    this.item = item;
    // Material count should match item target count (1:1 smelting ratio)
    this.material = new ItemTarget(material.getItemNames().slice(), item.getTargetCount());
    this.optionalMaterials = optionalMaterials;
  }

  /**
   * Get the output item target
   */
  getItem(): ItemTarget {
    return this.item;
  }

  /**
   * Get the input material target
   */
  getMaterial(): ItemTarget {
    return this.material;
  }

  /**
   * Get optional alternative materials
   */
  getOptionalMaterials(): readonly string[] {
    return this.optionalMaterials;
  }

  /**
   * Get all valid input materials (primary + optional)
   */
  getAllMaterials(): string[] {
    return [...this.material.getItemNames(), ...this.optionalMaterials];
  }

  /**
   * Get the target count (number of items to smelt)
   */
  getTargetCount(): number {
    return this.item.getTargetCount();
  }

  /**
   * Check if an item can be used as input material
   */
  isValidMaterial(itemName: string): boolean {
    return this.material.matches(itemName) || this.optionalMaterials.includes(itemName);
  }

  /**
   * Create a string representation
   */
  toString(): string {
    const output = this.item.getItemNames().join(' or ');
    const input = this.material.getItemNames().join(' or ');
    const optional = this.optionalMaterials.length > 0
      ? ` (or ${this.optionalMaterials.join(', ')})`
      : '';
    return `SmeltTarget(${input}${optional} -> ${output} x${this.getTargetCount()})`;
  }

  /**
   * Check equality with another SmeltTarget
   */
  equals(other: SmeltTarget): boolean {
    return (
      this.itemTargetEquals(this.item, other.item) &&
      this.itemTargetEquals(this.material, other.material)
    );
  }

  /**
   * Check if two ItemTargets are equal
   */
  private itemTargetEquals(a: ItemTarget, b: ItemTarget): boolean {
    if (a.getTargetCount() !== b.getTargetCount()) return false;
    const aItems = [...a.getItemNames()].sort();
    const bItems = [...b.getItemNames()].sort();
    if (aItems.length !== bItems.length) return false;
    for (let i = 0; i < aItems.length; i++) {
      if (aItems[i] !== bItems[i]) return false;
    }
    return true;
  }
}

// ============================================================================
// Common Smelting Targets
// ============================================================================

/**
 * Create a SmeltTarget for iron ingots
 */
export function smeltIronIngots(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('iron_ingot', count),
    new ItemTarget(['raw_iron', 'iron_ore', 'deepslate_iron_ore'], count)
  );
}

/**
 * Create a SmeltTarget for gold ingots
 */
export function smeltGoldIngots(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('gold_ingot', count),
    new ItemTarget(['raw_gold', 'gold_ore', 'deepslate_gold_ore'], count),
    'nether_gold_ore'
  );
}

/**
 * Create a SmeltTarget for copper ingots
 */
export function smeltCopperIngots(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('copper_ingot', count),
    new ItemTarget(['raw_copper', 'copper_ore', 'deepslate_copper_ore'], count)
  );
}

/**
 * Create a SmeltTarget for cooked beef
 */
export function smeltCookedBeef(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('cooked_beef', count),
    new ItemTarget('beef', count)
  );
}

/**
 * Create a SmeltTarget for cooked porkchop
 */
export function smeltCookedPorkchop(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('cooked_porkchop', count),
    new ItemTarget('porkchop', count)
  );
}

/**
 * Create a SmeltTarget for cooked chicken
 */
export function smeltCookedChicken(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('cooked_chicken', count),
    new ItemTarget('chicken', count)
  );
}

/**
 * Create a SmeltTarget for cooked mutton
 */
export function smeltCookedMutton(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('cooked_mutton', count),
    new ItemTarget('mutton', count)
  );
}

/**
 * Create a SmeltTarget for cooked rabbit
 */
export function smeltCookedRabbit(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('cooked_rabbit', count),
    new ItemTarget('rabbit', count)
  );
}

/**
 * Create a SmeltTarget for cooked cod
 */
export function smeltCookedCod(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('cooked_cod', count),
    new ItemTarget('cod', count)
  );
}

/**
 * Create a SmeltTarget for cooked salmon
 */
export function smeltCookedSalmon(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('cooked_salmon', count),
    new ItemTarget('salmon', count)
  );
}

/**
 * Create a SmeltTarget for baked potato
 */
export function smeltBakedPotato(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('baked_potato', count),
    new ItemTarget('potato', count)
  );
}

/**
 * Create a SmeltTarget for glass
 */
export function smeltGlass(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('glass', count),
    new ItemTarget('sand', count),
    'red_sand'
  );
}

/**
 * Create a SmeltTarget for charcoal
 */
export function smeltCharcoal(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('charcoal', count),
    new ItemTarget([
      'oak_log', 'birch_log', 'spruce_log', 'jungle_log',
      'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log',
      'oak_wood', 'birch_wood', 'spruce_wood', 'jungle_wood',
      'acacia_wood', 'dark_oak_wood', 'mangrove_wood', 'cherry_wood',
    ], count)
  );
}

/**
 * Create a SmeltTarget for smooth stone
 */
export function smeltSmoothStone(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('smooth_stone', count),
    new ItemTarget('stone', count)
  );
}

/**
 * Create a SmeltTarget for stone (from cobblestone)
 */
export function smeltStone(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('stone', count),
    new ItemTarget(['cobblestone', 'cobbled_deepslate'], count)
  );
}

/**
 * Create a SmeltTarget for bricks
 */
export function smeltBrick(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('brick', count),
    new ItemTarget('clay_ball', count)
  );
}

/**
 * Create a SmeltTarget for nether bricks
 */
export function smeltNetherBrick(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('nether_brick', count),
    new ItemTarget('netherrack', count)
  );
}

/**
 * Create a SmeltTarget for dried kelp
 */
export function smeltDriedKelp(count: number): SmeltTarget {
  return new SmeltTarget(
    new ItemTarget('dried_kelp', count),
    new ItemTarget('kelp', count)
  );
}

/**
 * Smelting recipes registry for common items
 */
export const SmeltTargets = {
  // Ores
  ironIngot: smeltIronIngots,
  goldIngot: smeltGoldIngots,
  copperIngot: smeltCopperIngots,

  // Food
  cookedBeef: smeltCookedBeef,
  cookedPorkchop: smeltCookedPorkchop,
  cookedChicken: smeltCookedChicken,
  cookedMutton: smeltCookedMutton,
  cookedRabbit: smeltCookedRabbit,
  cookedCod: smeltCookedCod,
  cookedSalmon: smeltCookedSalmon,
  bakedPotato: smeltBakedPotato,
  driedKelp: smeltDriedKelp,

  // Materials
  glass: smeltGlass,
  charcoal: smeltCharcoal,
  smoothStone: smeltSmoothStone,
  stone: smeltStone,
  brick: smeltBrick,
  netherBrick: smeltNetherBrick,
};

export default SmeltTarget;
