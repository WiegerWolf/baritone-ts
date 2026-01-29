/**
 * CraftWithMatchingPlanksTask - Craft items requiring matching planks
 *
 * Handles recipes like fences, doors, signs, etc. that need
 * planks of the same wood type.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import { itemTarget } from './ResourceTask';
import { planksToLog } from '../../utils/ItemHelper';
import {
  CraftWithMatchingMaterialsTask,
  craftSlot,
  type CraftingRecipe,
} from './CraftWithMatchingMaterialsTask';

/**
 * All plank types
 */
const ALL_PLANKS = [
  'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks',
  'acacia_planks', 'dark_oak_planks', 'crimson_planks', 'warped_planks',
  'mangrove_planks', 'cherry_planks', 'bamboo_planks',
];

/**
 * CraftWithMatchingPlanksTask - Craft items requiring matching planks
 *
 * Handles recipes like fences, doors, signs, etc. that need
 * planks of the same wood type.
 */
export class CraftWithMatchingPlanksTask extends CraftWithMatchingMaterialsTask {
  private outputMapping: Map<string, string>;

  /**
   * @param bot The mineflayer bot
   * @param outputItems All valid output items (e.g., all fence types)
   * @param outputMapping Maps plank type to output item (e.g., oak_planks -> oak_fence)
   * @param recipe The crafting recipe
   * @param sameMask Which slots need matching materials
   * @param count Target count to craft
   */
  constructor(
    bot: Bot,
    outputItems: string[],
    outputMapping: Map<string, string>,
    recipe: CraftingRecipe,
    sameMask: boolean[],
    count: number
  ) {
    super(bot, itemTarget(outputItems, count), recipe, sameMask);
    this.outputMapping = outputMapping;
    this.sameResourceItems = ALL_PLANKS;
  }

  get displayName(): string {
    return `CraftWithPlanks(${this.targetItem.items[0]}, x${this.targetItem.targetCount})`;
  }

  protected getExpectedTotalCountOfSameItem(plankType: string): number {
    // Include logs that can be converted to planks
    const logType = planksToLog(plankType);
    const plankCount = this.countItem(plankType);
    const logCount = logType ? this.countItem(logType) * 4 : 0;
    return plankCount + logCount;
  }

  protected getCollectMaterialsTask(): Task | null {
    // TODO: Implement log collection task
    // For now, return null (task will re-check on next tick)
    return null;
  }

  protected getConvertRawMaterialsTask(): Task | null {
    // Find any logs we can convert
    for (const plankType of ALL_PLANKS) {
      const logType = planksToLog(plankType);
      if (logType && this.countItem(logType) >= 1) {
        // TODO: Return task to craft planks from logs
        return null;
      }
    }
    return null;
  }

  protected getOutputItemForMaterial(plankType: string): string {
    return this.outputMapping.get(plankType) ?? this.targetItem.items[0];
  }

  protected createCraftInTableTask(
    outputItem: string,
    count: number,
    recipe: CraftingRecipe
  ): Task | null {
    // TODO: Integrate with existing CraftInTableTask
    // For now, return null to indicate "keep trying"
    return null;
  }

  protected createCraftInInventoryTask(
    outputItem: string,
    count: number,
    recipe: CraftingRecipe
  ): Task | null {
    // TODO: Integrate with existing CraftInInventoryTask
    // For now, return null to indicate "keep trying"
    return null;
  }
}

/**
 * Create a fence crafting task
 */
export function craftFence(bot: Bot, count: number = 1): CraftWithMatchingPlanksTask {
  const outputItems = ALL_PLANKS.map(p => p.replace('_planks', '_fence'));

  const outputMapping = new Map<string, string>();
  for (const plank of ALL_PLANKS) {
    outputMapping.set(plank, plank.replace('_planks', '_fence'));
  }

  // Fence recipe: plank-stick-plank on two rows
  const recipe: CraftingRecipe = {
    slots: [
      craftSlot(ALL_PLANKS), craftSlot('stick'), craftSlot(ALL_PLANKS),
      craftSlot(ALL_PLANKS), craftSlot('stick'), craftSlot(ALL_PLANKS),
      null, null, null,
    ],
    outputCount: 3,
    isBig: true,
  };

  // Plank slots (0, 2, 3, 5) must match
  const sameMask = [true, false, true, true, false, true, false, false, false];

  return new CraftWithMatchingPlanksTask(bot, outputItems, outputMapping, recipe, sameMask, count);
}
