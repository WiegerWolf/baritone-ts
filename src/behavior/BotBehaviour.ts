/**
 * BotBehaviour - Runtime Behavior Configuration
 * Based on BaritonePlus BotBehaviour.java
 *
 * A stack-based behavior state machine that allows tasks to:
 * - Push/pop behavior states
 * - Set runtime preferences (escape lava, follow distance, etc.)
 * - Protect items from use
 * - Configure pathfinding parameters
 *
 * Use this to change how the bot works for the duration of a task.
 * For example: "Build this bridge and avoid mining any blocks nearby"
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import type { Item } from 'prismarine-item';
import { Vec3 } from 'vec3';

/**
 * Predicate function type for entity checks
 */
export type EntityPredicate = (entity: Entity) => boolean;

/**
 * Predicate function type for position checks
 */
export type BlockPosPredicate = (pos: Vec3) => boolean;

/**
 * Predicate function type for tool forcing
 */
export type ForceToolPredicate = (blockName: string, itemName: string) => boolean;

/**
 * Heuristic modifier function
 */
export type HeuristicModifier = (baseCost: number, pos: Vec3) => number;

/**
 * Conversion slot definition
 */
export interface ConversionSlot {
  slot: number;
  itemBelongsHere: (itemName: string) => boolean;
}

/**
 * Behavior state snapshot
 */
export interface BehaviourState {
  // Core behavior flags
  escapeLava: boolean;
  disableDefence: boolean;
  exclusivelyMineLogs: boolean;
  forceFieldPlayers: boolean;

  // Movement parameters
  followOffsetDistance: number;
  swimThroughLava: boolean;
  allowDiagonalAscend: boolean;
  allowWalkThroughFlowingWater: boolean;

  // Pathfinding penalties
  blockPlacePenalty: number;
  blockBreakAdditionalPenalty: number;

  // Mining behavior
  mineScanDroppedItems: boolean;

  // Protected items (won't be used/thrown)
  protectedItems: Set<string>;

  // Block avoidance
  blocksToAvoidBreaking: Set<string>; // Stringified Vec3
  toAvoidBreaking: BlockPosPredicate[];
  toAvoidPlacing: BlockPosPredicate[];
  allowWalking: BlockPosPredicate[];
  avoidWalkingThrough: BlockPosPredicate[];

  // Tool forcing
  forceUseTools: ForceToolPredicate[];

  // Entity exclusions
  excludeFromForceField: EntityPredicate[];
  avoidDodgingProjectile: EntityPredicate[];

  // Conversion slots (for container tasks)
  conversionSlots: ConversionSlot[];

  // Custom heuristics
  globalHeuristics: HeuristicModifier[];
}

/**
 * Create a default behavior state
 */
function createDefaultState(): BehaviourState {
  return {
    escapeLava: true,
    disableDefence: false,
    exclusivelyMineLogs: false,
    forceFieldPlayers: false,

    followOffsetDistance: 2.0,
    swimThroughLava: false,
    allowDiagonalAscend: true,
    allowWalkThroughFlowingWater: false,

    blockPlacePenalty: 0,
    blockBreakAdditionalPenalty: 0,

    mineScanDroppedItems: true,

    protectedItems: new Set(),

    blocksToAvoidBreaking: new Set(),
    toAvoidBreaking: [],
    toAvoidPlacing: [],
    allowWalking: [],
    avoidWalkingThrough: [],

    forceUseTools: [],

    excludeFromForceField: [],
    avoidDodgingProjectile: [],

    conversionSlots: [],

    globalHeuristics: [],
  };
}

/**
 * Clone a behavior state
 */
function cloneState(state: BehaviourState): BehaviourState {
  return {
    escapeLava: state.escapeLava,
    disableDefence: state.disableDefence,
    exclusivelyMineLogs: state.exclusivelyMineLogs,
    forceFieldPlayers: state.forceFieldPlayers,

    followOffsetDistance: state.followOffsetDistance,
    swimThroughLava: state.swimThroughLava,
    allowDiagonalAscend: state.allowDiagonalAscend,
    allowWalkThroughFlowingWater: state.allowWalkThroughFlowingWater,

    blockPlacePenalty: state.blockPlacePenalty,
    blockBreakAdditionalPenalty: state.blockBreakAdditionalPenalty,

    mineScanDroppedItems: state.mineScanDroppedItems,

    protectedItems: new Set(state.protectedItems),

    blocksToAvoidBreaking: new Set(state.blocksToAvoidBreaking),
    toAvoidBreaking: [...state.toAvoidBreaking],
    toAvoidPlacing: [...state.toAvoidPlacing],
    allowWalking: [...state.allowWalking],
    avoidWalkingThrough: [...state.avoidWalkingThrough],

    forceUseTools: [...state.forceUseTools],

    excludeFromForceField: [...state.excludeFromForceField],
    avoidDodgingProjectile: [...state.avoidDodgingProjectile],

    conversionSlots: [...state.conversionSlots],

    globalHeuristics: [...state.globalHeuristics],
  };
}

/**
 * Stringify a Vec3 position for use as a Set key
 */
function posKey(pos: Vec3): string {
  return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
}

/**
 * BotBehaviour - Stack-based behavior configuration
 */
export class BotBehaviour {
  private bot: Bot;
  private states: BehaviourState[] = [];

  constructor(bot: Bot) {
    this.bot = bot;
    // Start with one default state
    this.push();
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Should the bot escape lava (part of WorldSurvivalChain)
   */
  shouldEscapeLava(): boolean {
    return this.current().escapeLava;
  }

  /**
   * Is defense/MLG disabled
   */
  isDefenseDisabled(): boolean {
    return this.current().disableDefence;
  }

  /**
   * Should exclusively mine logs (no other blocks)
   */
  exclusivelyMineLogs(): boolean {
    return this.current().exclusivelyMineLogs;
  }

  /**
   * Should force field affect players
   */
  shouldForceFieldPlayers(): boolean {
    return this.current().forceFieldPlayers;
  }

  /**
   * Get follow offset distance
   */
  getFollowDistance(): number {
    return this.current().followOffsetDistance;
  }

  /**
   * Get conversion slots for container tasks
   */
  getConversionSlots(): ConversionSlot[] {
    return this.current().conversionSlots;
  }

  // ============================================================================
  // Setters
  // ============================================================================

  /**
   * Set whether bot should escape lava
   */
  setEscapeLava(allow: boolean): void {
    this.current().escapeLava = allow;
  }

  /**
   * Set follow distance
   */
  setFollowDistance(distance: number): void {
    this.current().followOffsetDistance = distance;
  }

  /**
   * Set whether to scan for dropped items while mining
   */
  setMineScanDroppedItems(value: boolean): void {
    this.current().mineScanDroppedItems = value;
  }

  /**
   * Set whether to exclusively mine logs
   */
  setExclusivelyMineLogs(value: boolean): void {
    this.current().exclusivelyMineLogs = value;
  }

  /**
   * Disable defense/MLG systems
   */
  disableDefence(value: boolean): void {
    this.current().disableDefence = value;
  }

  /**
   * Set force field player targeting
   */
  setForceFieldPlayers(value: boolean): void {
    this.current().forceFieldPlayers = value;
  }

  /**
   * Allow swimming through lava
   */
  allowSwimThroughLava(allow: boolean): void {
    this.current().swimThroughLava = allow;
  }

  /**
   * Allow diagonal ascend movements
   */
  setAllowDiagonalAscend(allow: boolean): void {
    this.current().allowDiagonalAscend = allow;
  }

  /**
   * Allow walking through flowing water
   */
  setAllowWalkThroughFlowingWater(value: boolean): void {
    this.current().allowWalkThroughFlowingWater = value;
  }

  /**
   * Set block placement penalty
   */
  setBlockPlacePenalty(penalty: number): void {
    this.current().blockPlacePenalty = penalty;
  }

  /**
   * Set block break additional penalty
   */
  setBlockBreakAdditionalPenalty(penalty: number): void {
    this.current().blockBreakAdditionalPenalty = penalty;
  }

  // ============================================================================
  // Protected Items
  // ============================================================================

  /**
   * Add items to protected list (won't be used/thrown)
   */
  addProtectedItems(...items: string[]): void {
    for (const item of items) {
      this.current().protectedItems.add(item);
    }
  }

  /**
   * Remove items from protected list
   */
  removeProtectedItems(...items: string[]): void {
    for (const item of items) {
      this.current().protectedItems.delete(item);
    }
  }

  /**
   * Check if an item is protected
   */
  isProtected(item: string | Item): boolean {
    const name = typeof item === 'string' ? item : item.name;
    return this.current().protectedItems.has(name);
  }

  // ============================================================================
  // Block Avoidance
  // ============================================================================

  /**
   * Avoid breaking a specific block position
   */
  avoidBlockBreaking(pos: Vec3): void {
    this.current().blocksToAvoidBreaking.add(posKey(pos));
  }

  /**
   * Avoid breaking blocks matching a predicate
   */
  avoidBlockBreakingPredicate(pred: BlockPosPredicate): void {
    this.current().toAvoidBreaking.push(pred);
  }

  /**
   * Avoid placing blocks matching a predicate
   */
  avoidBlockPlacing(pred: BlockPosPredicate): void {
    this.current().toAvoidPlacing.push(pred);
  }

  /**
   * Allow walking on blocks matching a predicate
   */
  allowWalkingOn(pred: BlockPosPredicate): void {
    this.current().allowWalking.push(pred);
  }

  /**
   * Avoid walking through blocks matching a predicate
   */
  avoidWalkingThrough(pred: BlockPosPredicate): void {
    this.current().avoidWalkingThrough.push(pred);
  }

  /**
   * Check if a block should be avoided for breaking
   */
  shouldAvoidBreaking(pos: Vec3): boolean {
    if (this.current().blocksToAvoidBreaking.has(posKey(pos))) {
      return true;
    }
    for (const pred of this.current().toAvoidBreaking) {
      if (pred(pos)) return true;
    }
    return false;
  }

  /**
   * Check if a position should be avoided for placing
   */
  shouldAvoidPlacing(pos: Vec3): boolean {
    for (const pred of this.current().toAvoidPlacing) {
      if (pred(pos)) return true;
    }
    return false;
  }

  // ============================================================================
  // Tool Forcing
  // ============================================================================

  /**
   * Force use of specific tools for blocks
   */
  forceUseTool(pred: ForceToolPredicate): void {
    this.current().forceUseTools.push(pred);
  }

  /**
   * Check if a tool should be forced for a block
   */
  shouldForceUseTool(blockName: string, itemName: string): boolean {
    for (const pred of this.current().forceUseTools) {
      if (pred(blockName, itemName)) return true;
    }
    return false;
  }

  // ============================================================================
  // Entity Exclusions
  // ============================================================================

  /**
   * Add entity exclusion from force field
   */
  addForceFieldExclusion(pred: EntityPredicate): void {
    this.current().excludeFromForceField.push(pred);
  }

  /**
   * Check if entity should be excluded from force field
   */
  shouldExcludeFromForcefield(entity: Entity): boolean {
    for (const pred of this.current().excludeFromForceField) {
      if (pred(entity)) return true;
    }
    return false;
  }

  /**
   * Add projectile dodging exclusion
   */
  avoidDodgingProjectile(pred: EntityPredicate): void {
    this.current().avoidDodgingProjectile.push(pred);
  }

  /**
   * Check if projectile dodging should be avoided for entity
   */
  shouldAvoidDodgingProjectile(entity: Entity): boolean {
    for (const pred of this.current().avoidDodgingProjectile) {
      if (pred(entity)) return true;
    }
    return false;
  }

  // ============================================================================
  // Conversion Slots
  // ============================================================================

  /**
   * Mark a slot as a conversion slot (for container tasks)
   */
  markSlotAsConversionSlot(slot: number, itemBelongsHere: (itemName: string) => boolean): void {
    this.current().conversionSlots.push({ slot, itemBelongsHere });
  }

  // ============================================================================
  // Global Heuristics
  // ============================================================================

  /**
   * Add a global heuristic modifier for pathfinding
   */
  addGlobalHeuristic(heuristic: HeuristicModifier): void {
    this.current().globalHeuristics.push(heuristic);
  }

  /**
   * Apply global heuristics to a cost
   */
  applyGlobalHeuristics(baseCost: number, pos: Vec3): number {
    let cost = baseCost;
    for (const heuristic of this.current().globalHeuristics) {
      cost = heuristic(cost, pos);
    }
    return cost;
  }

  // ============================================================================
  // Stack Management
  // ============================================================================

  /**
   * Push a new behavior state onto the stack (copies current state)
   */
  push(): void {
    if (this.states.length === 0) {
      this.states.push(createDefaultState());
    } else {
      this.states.push(cloneState(this.current()));
    }
  }

  /**
   * Push a custom state onto the stack
   */
  pushState(customState: BehaviourState): void {
    this.states.push(customState);
  }

  /**
   * Pop the current behavior state and restore the previous one
   */
  pop(): BehaviourState | null {
    if (this.states.length === 0) {
      console.error('BotBehaviour: State stack is empty. This should not happen.');
      return null;
    }

    const popped = this.states.pop()!;

    if (this.states.length === 0) {
      console.error('BotBehaviour: State stack is empty after pop. Restoring default.');
      this.push();
    }

    return popped;
  }

  /**
   * Get the current behavior state
   */
  private current(): BehaviourState {
    if (this.states.length === 0) {
      console.error('BotBehaviour: State stack empty, creating default.');
      this.push();
    }
    return this.states[this.states.length - 1];
  }

  /**
   * Get the current state (for inspection)
   */
  getCurrentState(): Readonly<BehaviourState> {
    return this.current();
  }

  /**
   * Get the stack depth
   */
  getStackDepth(): number {
    return this.states.length;
  }
}

/**
 * Create a BotBehaviour instance
 */
export function createBotBehaviour(bot: Bot): BotBehaviour {
  return new BotBehaviour(bot);
}

export default BotBehaviour;
