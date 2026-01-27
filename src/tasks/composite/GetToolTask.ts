/**
 * GetToolTask - Composite Task for Obtaining Tools
 * Based on AltoClef's tool acquisition system
 *
 * Ensures the bot has a tool of the specified type,
 * crafting one if necessary.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { CraftTask } from '../concrete/CraftTask';
import { EquipTask, EquipmentSlot } from '../concrete/InventoryTask';
import { CollectWoodTask } from './CollectWoodTask';
import { ItemTarget } from '../../utils/ItemTarget';
import { getRecipe } from '../../crafting/CraftingRecipe';

/**
 * Tool tiers in order of preference (best first)
 */
const TOOL_TIERS = ['netherite', 'diamond', 'iron', 'stone', 'wooden', 'golden'];

/**
 * Tool type definitions
 */
export type ToolType = 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe';

/**
 * Get all tool variants for a type
 */
function getToolVariants(toolType: ToolType): string[] {
  return TOOL_TIERS.map(tier => `${tier}_${toolType}`);
}

/**
 * Get craftable tools (those we can make from scratch)
 */
function getCraftableTools(toolType: ToolType): string[] {
  return ['wooden', 'stone'].map(tier => `${tier}_${toolType}`);
}

/**
 * State for tool acquisition
 */
enum GetToolState {
  CHECKING_INVENTORY,
  GETTING_WOOD,
  CRAFTING_PLANKS,
  CRAFTING_STICKS,
  CRAFTING_TOOL,
  EQUIPPING,
  FINISHED,
  FAILED
}

/**
 * Task to ensure the bot has a tool
 */
export class GetToolTask extends Task {
  private toolType: ToolType;
  private minimumTier: string;
  private state: GetToolState = GetToolState.CHECKING_INVENTORY;
  private targetTool: string | null = null;

  constructor(bot: Bot, toolType: ToolType, minimumTier: string = 'wooden') {
    super(bot);
    this.toolType = toolType;
    this.minimumTier = minimumTier;
  }

  get displayName(): string {
    return `GetTool(${this.toolType})`;
  }

  onStart(): void {
    this.state = GetToolState.CHECKING_INVENTORY;
    this.targetTool = null;
  }

  onTick(): Task | null {
    switch (this.state) {
      case GetToolState.CHECKING_INVENTORY:
        return this.handleCheckingInventory();

      case GetToolState.GETTING_WOOD:
        return this.handleGettingWood();

      case GetToolState.CRAFTING_PLANKS:
        return this.handleCraftingPlanks();

      case GetToolState.CRAFTING_STICKS:
        return this.handleCraftingSticks();

      case GetToolState.CRAFTING_TOOL:
        return this.handleCraftingTool();

      case GetToolState.EQUIPPING:
        return this.handleEquipping();

      default:
        return null;
    }
  }

  private handleCheckingInventory(): Task | null {
    // Check if we already have an acceptable tool
    const existingTool = this.findExistingTool();
    if (existingTool) {
      this.targetTool = existingTool;
      this.state = GetToolState.EQUIPPING;
      return null;
    }

    // Determine what tool to craft
    this.targetTool = this.determineBestCraftableTool();
    if (!this.targetTool) {
      this.state = GetToolState.FAILED;
      return null;
    }

    // Check what materials we need
    if (this.needsWood()) {
      this.state = GetToolState.GETTING_WOOD;
    } else if (this.needsPlanks()) {
      this.state = GetToolState.CRAFTING_PLANKS;
    } else if (this.needsSticks()) {
      this.state = GetToolState.CRAFTING_STICKS;
    } else {
      this.state = GetToolState.CRAFTING_TOOL;
    }

    return null;
  }

  private handleGettingWood(): Task | null {
    const logCount = this.getItemCount('log');
    if (logCount >= 3) {
      this.state = GetToolState.CRAFTING_PLANKS;
      return null;
    }

    return new CollectWoodTask(this.bot, 3 - logCount);
  }

  private handleCraftingPlanks(): Task | null {
    const plankCount = this.getPlanksCount();
    if (plankCount >= 8) { // Enough for sticks + tool head
      this.state = GetToolState.CRAFTING_STICKS;
      return null;
    }

    // Find a log to craft into planks
    const logItem = this.findLogItem();
    if (!logItem) {
      this.state = GetToolState.GETTING_WOOD;
      return null;
    }

    // Craft planks from this log type
    const plankType = logItem.name.replace('_log', '_planks').replace('_stem', '_planks');
    return new CraftTask(this.bot, plankType, 4);
  }

  private handleCraftingSticks(): Task | null {
    const stickCount = this.getItemCount('stick');
    if (stickCount >= 2) {
      this.state = GetToolState.CRAFTING_TOOL;
      return null;
    }

    // Need planks for sticks
    if (this.getPlanksCount() < 2) {
      this.state = GetToolState.CRAFTING_PLANKS;
      return null;
    }

    return new CraftTask(this.bot, 'stick', 4);
  }

  private handleCraftingTool(): Task | null {
    if (!this.targetTool) {
      this.state = GetToolState.FAILED;
      return null;
    }

    // Check if we have the tool now
    if (this.hasTool(this.targetTool)) {
      this.state = GetToolState.EQUIPPING;
      return null;
    }

    // Check materials
    const stickCount = this.getItemCount('stick');
    if (stickCount < 2) {
      this.state = GetToolState.CRAFTING_STICKS;
      return null;
    }

    // For wooden tools, need planks
    // For stone tools, need cobblestone
    if (this.targetTool.startsWith('wooden_')) {
      if (this.getPlanksCount() < 3) {
        this.state = GetToolState.CRAFTING_PLANKS;
        return null;
      }
    } else if (this.targetTool.startsWith('stone_')) {
      if (this.getItemCount('cobblestone') < 3) {
        // Need to mine cobblestone - this requires a pickaxe first
        // Fall back to wooden tool
        this.targetTool = `wooden_${this.toolType}`;
        if (this.getPlanksCount() < 3) {
          this.state = GetToolState.CRAFTING_PLANKS;
          return null;
        }
      }
    }

    return new CraftTask(this.bot, this.targetTool, 1);
  }

  private handleEquipping(): Task | null {
    if (!this.targetTool) {
      this.state = GetToolState.FINISHED;
      return null;
    }

    // Check if equipped
    const held = this.bot.heldItem;
    if (held && held.name === this.targetTool) {
      this.state = GetToolState.FINISHED;
      return null;
    }

    return new EquipTask(this.bot, this.targetTool, EquipmentSlot.HAND);
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.state === GetToolState.FINISHED || this.state === GetToolState.FAILED;
  }

  isFailed(): boolean {
    return this.state === GetToolState.FAILED;
  }

  /**
   * Find an existing acceptable tool in inventory
   */
  private findExistingTool(): string | null {
    const validTiers = this.getValidTiers();
    const variants = validTiers.map(tier => `${tier}_${this.toolType}`);

    for (const variant of variants) {
      if (this.hasTool(variant)) {
        return variant;
      }
    }

    return null;
  }

  /**
   * Get tiers at or above minimum
   */
  private getValidTiers(): string[] {
    const minIndex = TOOL_TIERS.indexOf(this.minimumTier);
    if (minIndex === -1) return TOOL_TIERS;
    return TOOL_TIERS.slice(0, minIndex + 1);
  }

  /**
   * Determine best tool we can craft
   */
  private determineBestCraftableTool(): string | null {
    // Check if we can make stone tool
    if (this.getItemCount('cobblestone') >= 3 && this.getItemCount('stick') >= 2) {
      return `stone_${this.toolType}`;
    }

    // Fall back to wooden
    return `wooden_${this.toolType}`;
  }

  /**
   * Check if we have a specific tool
   */
  private hasTool(toolName: string): boolean {
    return this.bot.inventory.items().some(item => item.name === toolName);
  }

  /**
   * Get count of items matching name
   */
  private getItemCount(namePart: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name.includes(namePart)) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Get total planks count
   */
  private getPlanksCount(): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name.includes('planks')) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Find a log item in inventory
   */
  private findLogItem(): any {
    return this.bot.inventory.items().find(item =>
      item.name.includes('log') || item.name.includes('stem')
    );
  }

  /**
   * Check if we need more wood
   */
  private needsWood(): boolean {
    const logs = this.getItemCount('log') + this.getItemCount('stem');
    const planks = this.getPlanksCount();
    // Need at least 3 logs or 12 planks equivalent
    return logs === 0 && planks < 12;
  }

  /**
   * Check if we need more planks
   */
  private needsPlanks(): boolean {
    const planks = this.getPlanksCount();
    const sticks = this.getItemCount('stick');
    // Need 3 for tool head + 2 for sticks (if we don't have sticks)
    const planksNeeded = 3 + (sticks < 2 ? 2 : 0);
    return planks < planksNeeded;
  }

  /**
   * Check if we need more sticks
   */
  private needsSticks(): boolean {
    return this.getItemCount('stick') < 2;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetToolTask)) return false;
    return this.toolType === other.toolType && this.minimumTier === other.minimumTier;
  }
}

/**
 * Convenience function to create a GetToolTask
 */
export function ensureTool(bot: Bot, toolType: ToolType, minimumTier: string = 'wooden'): GetToolTask {
  return new GetToolTask(bot, toolType, minimumTier);
}
