/**
 * PlayerInteractionFixChain - Inventory and Interaction Fixes
 * Based on AltoClef's PlayerInteractionFixChain.java
 *
 * This chain runs in the background to fix common interaction issues:
 * - Automatically equips the best tool when breaking blocks
 * - Fixes stuck items in cursor slot
 * - Handles screen closing when player is looking around
 * - Periodically refreshes inventory state
 * - Releases stuck shift key
 *
 * This chain always runs at the lowest priority as it performs
 * maintenance tasks rather than goal-oriented behavior.
 *
 * Key behaviors:
 * - Equips better tools from inventory when mining
 * - Clears cursor slot if item is held too long
 * - Closes inventory screens when player rotates view
 * - Releases held sneak key after timeout
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import type { Item } from 'prismarine-item';
import { Vec3 } from 'vec3';
import { TaskChain, ChainPriority } from '../tasks/TaskChain';
import { TimerGame } from '../utils/timers/TimerGame';

/**
 * Configuration for interaction fixes
 */
export interface PlayerInteractionFixConfig {
  /** Enable automatic tool switching (default: true) */
  autoEquipBestTool: boolean;
  /** Time before tool switch check in seconds (default: 0) */
  toolSwitchCooldown: number;
  /** Enable cursor slot fix (default: true) */
  fixCursorSlot: boolean;
  /** Time before cursor fix in seconds (default: 1) */
  cursorSlotTimeout: number;
  /** Enable screen closing on rotation (default: true) */
  closeScreenOnRotation: boolean;
  /** Rotation threshold for screen closing in degrees (default: 0.1) */
  rotationThreshold: number;
  /** Time screen must be open before checking rotation (default: 1) */
  screenOpenTimeout: number;
  /** Enable shift key fix (default: true) */
  fixStuckShift: boolean;
  /** Time before releasing stuck shift in seconds (default: 10) */
  shiftTimeout: number;
  /** Enable inventory refresh (default: true) */
  refreshInventory: boolean;
  /** Time between inventory refreshes in seconds (default: 30) */
  inventoryRefreshInterval: number;
}

const DEFAULT_CONFIG: PlayerInteractionFixConfig = {
  autoEquipBestTool: true,
  toolSwitchCooldown: 0,
  fixCursorSlot: true,
  cursorSlotTimeout: 1,
  closeScreenOnRotation: true,
  rotationThreshold: 0.1,
  screenOpenTimeout: 1,
  fixStuckShift: true,
  shiftTimeout: 10,
  refreshInventory: true,
  inventoryRefreshInterval: 30,
};

/**
 * Tool types and their effectiveness
 */
const TOOL_TYPES = ['pickaxe', 'axe', 'shovel', 'hoe', 'shears', 'sword'] as const;
type ToolType = typeof TOOL_TYPES[number];

/**
 * Tool materials in order of effectiveness
 */
const TOOL_MATERIALS = ['netherite', 'diamond', 'iron', 'golden', 'stone', 'wooden'] as const;

/**
 * Block material to best tool mapping
 */
const BLOCK_TOOL_MAP: Record<string, ToolType> = {
  // Stone-like blocks
  'stone': 'pickaxe',
  'cobblestone': 'pickaxe',
  'granite': 'pickaxe',
  'diorite': 'pickaxe',
  'andesite': 'pickaxe',
  'deepslate': 'pickaxe',
  'netherrack': 'pickaxe',
  'basalt': 'pickaxe',
  'obsidian': 'pickaxe',
  'iron_ore': 'pickaxe',
  'gold_ore': 'pickaxe',
  'diamond_ore': 'pickaxe',
  'coal_ore': 'pickaxe',
  'copper_ore': 'pickaxe',
  'emerald_ore': 'pickaxe',
  'lapis_ore': 'pickaxe',
  'redstone_ore': 'pickaxe',
  'nether_gold_ore': 'pickaxe',
  'nether_quartz_ore': 'pickaxe',
  'ancient_debris': 'pickaxe',

  // Wood blocks
  'oak_log': 'axe',
  'birch_log': 'axe',
  'spruce_log': 'axe',
  'jungle_log': 'axe',
  'dark_oak_log': 'axe',
  'acacia_log': 'axe',
  'mangrove_log': 'axe',
  'cherry_log': 'axe',
  'crimson_stem': 'axe',
  'warped_stem': 'axe',
  'oak_planks': 'axe',
  'birch_planks': 'axe',
  'spruce_planks': 'axe',
  'jungle_planks': 'axe',
  'dark_oak_planks': 'axe',
  'acacia_planks': 'axe',

  // Dirt-like blocks
  'dirt': 'shovel',
  'grass_block': 'shovel',
  'sand': 'shovel',
  'gravel': 'shovel',
  'clay': 'shovel',
  'soul_sand': 'shovel',
  'soul_soil': 'shovel',
  'snow': 'shovel',
  'snow_block': 'shovel',
  'podzol': 'shovel',
  'mycelium': 'shovel',
  'coarse_dirt': 'shovel',
  'rooted_dirt': 'shovel',
  'mud': 'shovel',
  'muddy_mangrove_roots': 'shovel',

  // Wool/leaves
  'white_wool': 'shears',
  'cobweb': 'shears',
  'oak_leaves': 'shears',
  'birch_leaves': 'shears',
  'spruce_leaves': 'shears',
  'jungle_leaves': 'shears',
  'dark_oak_leaves': 'shears',
  'acacia_leaves': 'shears',
  'vine': 'shears',
};

/**
 * PlayerInteractionFixChain - Handles background interaction fixes
 */
export class PlayerInteractionFixChain extends TaskChain {
  readonly displayName = 'PlayerInteractionFixChain';

  private config: PlayerInteractionFixConfig;

  // Timers
  private toolSwitchTimer: TimerGame;
  private cursorSlotTimer: TimerGame;
  private screenOpenTimer: TimerGame;
  private shiftTimer: TimerGame;
  private inventoryRefreshTimer: TimerGame;

  // State tracking
  private lastHandItem: Item | null = null;
  private lastYaw: number = 0;
  private lastPitch: number = 0;
  private isBreakingBlock: boolean = false;
  private breakingBlockPos: { x: number; y: number; z: number } | null = null;

  // Event listeners
  private boundOnDigStop: (block: Block) => void;

  constructor(bot: Bot, config: Partial<PlayerInteractionFixConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize timers
    this.toolSwitchTimer = new TimerGame(bot, this.config.toolSwitchCooldown);
    this.cursorSlotTimer = new TimerGame(bot, this.config.cursorSlotTimeout);
    this.screenOpenTimer = new TimerGame(bot, this.config.screenOpenTimeout);
    this.shiftTimer = new TimerGame(bot, this.config.shiftTimeout);
    this.inventoryRefreshTimer = new TimerGame(bot, this.config.inventoryRefreshInterval);

    // Force timers to elapsed state initially
    this.toolSwitchTimer.forceElapsed();
    this.inventoryRefreshTimer.forceElapsed();

    // Bind event handlers
    this.boundOnDigStop = this.onDigStop.bind(this);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.bot.on('diggingCompleted', this.boundOnDigStop);
    this.bot.on('diggingAborted', this.boundOnDigStop);
  }

  /**
   * Clean up event listeners
   */
  dispose(): void {
    this.bot.removeListener('diggingCompleted', this.boundOnDigStop);
    this.bot.removeListener('diggingAborted', this.boundOnDigStop);
  }

  private onDigStop(block: Block): void {
    this.isBreakingBlock = false;
    this.breakingBlockPos = null;
  }

  /**
   * Called externally when digging starts (mineflayer doesn't emit this event)
   */
  onDiggingStarted(block: Block): void {
    this.isBreakingBlock = true;
    this.breakingBlockPos = block.position;
  }

  getPriority(): number {
    // Always runs in background at lowest priority
    // This chain doesn't block other chains
    return ChainPriority.INACTIVE;
  }

  isActive(): boolean {
    // Always active but at lowest priority
    return true;
  }

  onTick(): void {
    // Auto-equip best tool when breaking blocks
    if (this.config.autoEquipBestTool) {
      this.handleToolSwitch();
    }

    // Fix cursor slot if item held too long
    if (this.config.fixCursorSlot) {
      this.handleCursorSlotFix();
    }

    // Release stuck shift key
    if (this.config.fixStuckShift) {
      this.handleStuckShift();
    }

    // Periodic inventory refresh
    if (this.config.refreshInventory) {
      this.handleInventoryRefresh();
    }

    // Store rotation for next tick (for screen closing check)
    this.lastYaw = this.bot.entity.yaw;
    this.lastPitch = this.bot.entity.pitch;
  }

  /**
   * Handle automatic tool switching
   */
  private handleToolSwitch(): void {
    if (!this.isBreakingBlock || !this.breakingBlockPos) return;
    if (!this.toolSwitchTimer.elapsed()) return;

    this.toolSwitchTimer.reset();

    // Get the block being broken
    const block = this.bot.blockAt(new Vec3(this.breakingBlockPos.x, this.breakingBlockPos.y, this.breakingBlockPos.z));
    if (!block) return;

    // Find best tool for this block
    const bestTool = this.findBestToolForBlock(block);
    if (!bestTool) return;

    // Check if we already have the best tool equipped
    const currentItem = this.bot.heldItem;
    if (currentItem && this.isSameTool(currentItem, bestTool)) return;

    // Equip the better tool
    this.equipTool(bestTool);
  }

  /**
   * Find the best tool in inventory for a block
   */
  private findBestToolForBlock(block: Block): Item | null {
    const toolType = this.getToolTypeForBlock(block);
    if (!toolType) return null;

    let bestTool: Item | null = null;
    let bestMaterialIndex: number = TOOL_MATERIALS.length;

    for (const item of this.bot.inventory.items()) {
      if (!this.isToolType(item, toolType)) continue;

      const materialIndex = this.getToolMaterialIndex(item);
      if (materialIndex < bestMaterialIndex) {
        bestMaterialIndex = materialIndex;
        bestTool = item;
      }
    }

    return bestTool;
  }

  /**
   * Get the tool type needed for a block
   */
  private getToolTypeForBlock(block: Block): ToolType | null {
    // Check direct mapping
    if (BLOCK_TOOL_MAP[block.name]) {
      return BLOCK_TOOL_MAP[block.name];
    }

    // Check patterns
    if (block.name.includes('ore') || block.name.includes('stone')) {
      return 'pickaxe';
    }
    if (block.name.includes('log') || block.name.includes('plank') || block.name.includes('wood')) {
      return 'axe';
    }
    if (block.name.includes('dirt') || block.name.includes('sand') || block.name.includes('gravel')) {
      return 'shovel';
    }
    if (block.name.includes('wool') || block.name.includes('leaves')) {
      return 'shears';
    }

    return null;
  }

  /**
   * Check if an item is a specific tool type
   */
  private isToolType(item: Item, toolType: ToolType): boolean {
    return item.name.includes(toolType);
  }

  /**
   * Get the material index for a tool (lower = better)
   */
  private getToolMaterialIndex(item: Item): number {
    for (let i = 0; i < TOOL_MATERIALS.length; i++) {
      if (item.name.includes(TOOL_MATERIALS[i])) {
        return i;
      }
    }
    return TOOL_MATERIALS.length;
  }

  /**
   * Check if two items are the same tool
   */
  private isSameTool(a: Item, b: Item): boolean {
    return a.name === b.name;
  }

  /**
   * Equip a tool
   */
  private async equipTool(item: Item): Promise<void> {
    try {
      await this.bot.equip(item, 'hand');
    } catch (err) {
      // Failed to equip, will try again next tick
    }
  }

  /**
   * Handle fixing items stuck in cursor slot
   */
  private handleCursorSlotFix(): void {
    // In mineflayer, we check if there's an item in the cursor slot
    const cursor = (this.bot.inventory as any).cursor;
    if (!cursor) {
      this.cursorSlotTimer.reset();
      this.lastHandItem = null;
      return;
    }

    // Check if same item as before
    if (this.lastHandItem && cursor.name === this.lastHandItem.name) {
      // Same item held for a while
      if (this.cursorSlotTimer.elapsed()) {
        // Try to put it somewhere
        this.clearCursorSlot(cursor);
        this.cursorSlotTimer.reset();
      }
    } else {
      // New item, reset timer
      this.cursorSlotTimer.reset();
      this.lastHandItem = cursor;
    }
  }

  /**
   * Clear an item from cursor slot
   */
  private async clearCursorSlot(item: Item): Promise<void> {
    try {
      // Try to find a slot to put it in
      const emptySlot = this.bot.inventory.firstEmptyInventorySlot();
      if (emptySlot !== null) {
        await this.bot.clickWindow(emptySlot, 0, 0);
        return;
      }

      // Check if it's throwable garbage
      if (this.isGarbage(item)) {
        await this.bot.tossStack(item);
        return;
      }

      // Find something we can throw away
      for (const invItem of this.bot.inventory.items()) {
        if (this.isGarbage(invItem)) {
          await this.bot.tossStack(invItem);
          return;
        }
      }
    } catch (err) {
      // Failed to clear, will try again
    }
  }

  /**
   * Check if an item is garbage that can be thrown
   */
  private isGarbage(item: Item): boolean {
    const garbageItems = [
      'dirt', 'cobblestone', 'gravel', 'sand', 'rotten_flesh',
      'spider_eye', 'bone', 'string', 'gunpowder', 'redstone',
      'feather', 'wheat_seeds', 'beetroot_seeds',
    ];
    return garbageItems.some(g => item.name.includes(g));
  }

  /**
   * Handle releasing stuck shift key
   */
  private handleStuckShift(): void {
    const isSneaking = this.bot.getControlState('sneak');

    if (isSneaking) {
      if (this.shiftTimer.elapsed()) {
        this.bot.setControlState('sneak', false);
        this.shiftTimer.reset();
      }
    } else {
      this.shiftTimer.reset();
    }
  }

  /**
   * Handle periodic inventory refresh
   */
  private handleInventoryRefresh(): void {
    if (!this.inventoryRefreshTimer.elapsed()) return;
    if (this.isBreakingBlock) return; // Don't refresh while mining

    // In mineflayer, inventory is automatically synced
    // But we can emit an event for higher-level handlers
    this.bot.emit('inventory_refreshed' as any);
    this.inventoryRefreshTimer.reset();
  }

  /**
   * Check rotation change for screen closing
   * Returns true if player has rotated enough to close screen
   */
  checkRotationChange(): boolean {
    if (!this.config.closeScreenOnRotation) return false;
    if (!this.screenOpenTimer.elapsed()) return false;

    const deltaYaw = Math.abs(this.bot.entity.yaw - this.lastYaw);
    const deltaPitch = Math.abs(this.bot.entity.pitch - this.lastPitch);

    return deltaYaw > this.config.rotationThreshold ||
           deltaPitch > this.config.rotationThreshold;
  }

  // ---- Public API ----

  /**
   * Check if currently breaking a block
   */
  isBreaking(): boolean {
    return this.isBreakingBlock;
  }

  /**
   * Get position of block being broken
   */
  getBreakingPosition(): { x: number; y: number; z: number } | null {
    return this.breakingBlockPos;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<PlayerInteractionFixConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.toolSwitchCooldown !== undefined) {
      this.toolSwitchTimer.setInterval(config.toolSwitchCooldown);
    }
    if (config.cursorSlotTimeout !== undefined) {
      this.cursorSlotTimer.setInterval(config.cursorSlotTimeout);
    }
    if (config.screenOpenTimeout !== undefined) {
      this.screenOpenTimer.setInterval(config.screenOpenTimeout);
    }
    if (config.shiftTimeout !== undefined) {
      this.shiftTimer.setInterval(config.shiftTimeout);
    }
    if (config.inventoryRefreshInterval !== undefined) {
      this.inventoryRefreshTimer.setInterval(config.inventoryRefreshInterval);
    }
  }

  /**
   * Force equip best tool for current block
   */
  forceEquipBestTool(): void {
    if (!this.isBreakingBlock || !this.breakingBlockPos) return;

    const block = this.bot.blockAt(new Vec3(this.breakingBlockPos.x, this.breakingBlockPos.y, this.breakingBlockPos.z));
    if (!block) return;

    const bestTool = this.findBestToolForBlock(block);
    if (bestTool) {
      this.equipTool(bestTool);
    }
  }

  /**
   * Get debug info
   */
  getDebugInfo(): string {
    return [
      `PlayerInteractionFixChain`,
      `  Breaking: ${this.isBreakingBlock}`,
      `  Cursor item: ${this.lastHandItem?.name ?? 'none'}`,
      `  Sneaking: ${this.bot.getControlState('sneak')}`,
      `  Held item: ${this.bot.heldItem?.name ?? 'none'}`,
    ].join('\n');
  }
}
