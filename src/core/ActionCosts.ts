/**
 * Tick-based movement costs matching Baritone's precise calculations
 *
 * Minecraft runs at 20 ticks per second. By measuring costs in ticks,
 * we can accurately predict travel time and choose optimal paths.
 */

// Walking speed: 4.317 blocks/second = 0.21585 blocks/tick
export const WALK_ONE_BLOCK_COST = 20 / 4.317; // 4.633 ticks

// Sprinting speed: 5.612 blocks/second (30% faster than walking)
export const SPRINT_ONE_BLOCK_COST = 20 / 5.612; // 3.564 ticks

// Sprint multiplier (sprint cost / walk cost)
export const SPRINT_MULTIPLIER = SPRINT_ONE_BLOCK_COST / WALK_ONE_BLOCK_COST; // ~0.769

// Sneaking speed: 1.3 blocks/second
export const SNEAK_ONE_BLOCK_COST = 20 / 1.3; // 15.385 ticks

// Swimming/water walking speed: 2.2 blocks/second
export const WALK_ONE_IN_WATER_COST = 20 / 2.2; // 9.091 ticks

// Soul sand: 40% slower than normal walking
export const WALK_ONE_OVER_SOUL_SAND_COST = WALK_ONE_BLOCK_COST * 1.4; // 6.486 ticks

// Ladder climbing: ~3 blocks/second up
export const LADDER_UP_ONE_COST = 20 / 3.0; // 6.667 ticks

// Ladder descending: ~5 blocks/second down
export const LADDER_DOWN_ONE_COST = 20 / 5.0; // 4.0 ticks

// Diagonal movement: sqrt(2) multiplier
export const SQRT_2 = Math.sqrt(2); // 1.414

/**
 * Fall physics costs based on Minecraft physics
 * Fall time increases non-linearly with distance
 */
export const FALL_1_25_BLOCKS_COST = 4.0; // ticks
export const FALL_0_25_BLOCKS_COST = 2.0; // ticks

// Jump cost: falling 1.25 blocks minus 0.25 blocks
export const JUMP_ONE_BLOCK_COST = FALL_1_25_BLOCKS_COST - FALL_0_25_BLOCKS_COST; // 2.0 ticks

// Walk off block cost (time to step off edge)
export const WALK_OFF_BLOCK_COST = WALK_ONE_BLOCK_COST * 0.4; // ~1.85 ticks

// Cost to center after landing from a fall
export const CENTER_AFTER_FALL_COST = WALK_ONE_BLOCK_COST * 0.3; // ~1.39 ticks

/**
 * Pre-calculated fall costs for N blocks
 * Includes time to fall + centering cost
 */
export const FALL_N_BLOCKS_COST: number[] = [];

// Calculate fall costs for heights 0-256
function initFallCosts(): void {
  // Fall time formula: t = sqrt(2 * distance / gravity)
  // Minecraft gravity: 0.08 blocks/tick^2 (with drag)
  // Simplified: each block takes longer the further you fall

  for (let n = 0; n <= 256; n++) {
    if (n === 0) {
      FALL_N_BLOCKS_COST[n] = 0;
      continue;
    }

    // Approximate fall time based on Minecraft physics
    // v(t) = v0 - g*t where g = 0.08 blocks/tick^2
    // With drag: v(t) = (v0 - g/drag) * e^(-drag*t) + g/drag
    // Simplified approximation:
    let ticks = 0;
    let distance = 0;
    let velocity = 0;
    const gravity = 0.08;
    const drag = 0.02;

    while (distance < n) {
      velocity = (velocity + gravity) * (1 - drag);
      distance += velocity;
      ticks++;
    }

    FALL_N_BLOCKS_COST[n] = ticks;
  }
}

initFallCosts();

/**
 * Get fall cost for N blocks including damage penalty
 * @param n Number of blocks to fall
 * @param safeWater Whether landing in water (no damage)
 */
export function getFallCost(n: number, safeWater: boolean = false): number {
  if (n < 0) return COST_INF;
  if (n >= FALL_N_BLOCKS_COST.length) return COST_INF;

  let cost = FALL_N_BLOCKS_COST[n] + CENTER_AFTER_FALL_COST;

  // Add damage penalty if falling more than 3 blocks onto solid ground
  if (!safeWater && n > 3) {
    // Damage = (fall_distance - 3) * 0.5 hearts
    // Penalty is proportional to damage taken
    const damage = (n - 3);
    cost += damage * 10; // Significant penalty for taking damage
  }

  return cost;
}

/**
 * Cost infinity value
 * Using 1,000,000 instead of MAX_VALUE to avoid overflow when adding costs
 * 1,000,000 ticks = ~14 hours, effectively infinity
 */
export const COST_INF = 1000000;

/**
 * Block breaking cost calculation
 * @param hardness Block hardness value
 * @param toolMultiplier Tool efficiency multiplier (1.0 = hand)
 * @param efficiencyLevel Efficiency enchantment level
 */
export function getBreakCost(
  hardness: number,
  toolMultiplier: number = 1.0,
  efficiencyLevel: number = 0
): number {
  if (hardness < 0) return COST_INF; // Unbreakable

  // Base break time: hardness * 30 ticks / tool_speed
  let efficiency = toolMultiplier;

  // Efficiency enchantment: adds level^2 + 1 to speed
  if (efficiencyLevel > 0 && efficiency > 1.0) {
    efficiency += efficiencyLevel * efficiencyLevel + 1;
  }

  return (hardness * 30) / efficiency;
}

/**
 * Block placement cost
 * Includes look time, equip time, place animation
 */
export const PLACE_ONE_BLOCK_COST = 4.0; // ~4 ticks

/**
 * Additional penalty for backplacing (placing behind while moving backward)
 */
export const BACKPLACE_ADDITIONAL_PENALTY = 2.0;

/**
 * Cost for opening/closing a door or fence gate
 */
export const DOOR_OPEN_COST = 4.0;

/**
 * Calculate cost of moving one block with terrain modifiers
 * @param baseCost Base movement cost
 * @param blockBelow Block type being walked on
 */
export function getTerrainCost(baseCost: number, blockType: string): number {
  switch (blockType) {
    case 'soul_sand':
    case 'soul_soil':
      return baseCost * 1.4; // 40% slower

    case 'honey_block':
      return baseCost * 2.0; // 50% slower

    case 'slime_block':
      return baseCost * 0.8; // Slight bounce help

    case 'ice':
    case 'packed_ice':
    case 'blue_ice':
    case 'frosted_ice':
      return baseCost * 0.8; // Slippery but fast

    case 'magma_block':
      // Must sneak to avoid damage
      return SNEAK_ONE_BLOCK_COST;

    default:
      return baseCost;
  }
}
