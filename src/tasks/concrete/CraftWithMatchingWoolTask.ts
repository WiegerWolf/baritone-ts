/**
 * CraftWithMatchingWoolTask - Craft items requiring matching wool
 *
 * Handles recipes like beds that need wool of the same color.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import { itemTarget } from './ResourceTask';
import {
  CraftWithMatchingMaterialsTask,
  craftSlot,
  type CraftingRecipe,
} from './CraftWithMatchingMaterialsTask';

/**
 * All wool colors
 */
const ALL_WOOL = [
  'white_wool', 'orange_wool', 'magenta_wool', 'light_blue_wool',
  'yellow_wool', 'lime_wool', 'pink_wool', 'gray_wool',
  'light_gray_wool', 'cyan_wool', 'purple_wool', 'blue_wool',
  'brown_wool', 'green_wool', 'red_wool', 'black_wool',
];

/**
 * All plank types (needed for bed recipe)
 */
const ALL_PLANKS = [
  'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks',
  'acacia_planks', 'dark_oak_planks', 'crimson_planks', 'warped_planks',
  'mangrove_planks', 'cherry_planks', 'bamboo_planks',
];

/**
 * CraftWithMatchingWoolTask - Craft items requiring matching wool
 *
 * Handles recipes like beds that need wool of the same color.
 */
export class CraftWithMatchingWoolTask extends CraftWithMatchingMaterialsTask {
  private outputMapping: Map<string, string>;

  /**
   * @param bot The mineflayer bot
   * @param outputItems All valid output items (e.g., all bed colors)
   * @param outputMapping Maps wool type to output item (e.g., white_wool -> white_bed)
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
    this.sameResourceItems = ALL_WOOL;
  }

  get displayName(): string {
    return `CraftWithWool(${this.targetItem.items[0]}, x${this.targetItem.targetCount})`;
  }

  protected getCollectMaterialsTask(): Task | null {
    // TODO: Implement wool collection (shear sheep, etc.)
    return null;
  }

  protected getConvertRawMaterialsTask(): Task | null {
    // Wool doesn't have raw material conversion like logs->planks
    return null;
  }

  protected getOutputItemForMaterial(woolType: string): string {
    return this.outputMapping.get(woolType) ?? this.targetItem.items[0];
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
 * Create a bed crafting task (requires 3x3 table)
 */
export function craftBed(bot: Bot, count: number = 1): CraftWithMatchingWoolTask {
  const outputItems = ALL_WOOL.map(w => w.replace('_wool', '_bed'));

  const outputMapping = new Map<string, string>();
  for (const wool of ALL_WOOL) {
    outputMapping.set(wool, wool.replace('_wool', '_bed'));
  }

  // Bed recipe: 3 wool on top, 3 planks on bottom
  const recipe: CraftingRecipe = {
    slots: [
      craftSlot(ALL_WOOL), craftSlot(ALL_WOOL), craftSlot(ALL_WOOL),
      craftSlot(ALL_PLANKS), craftSlot(ALL_PLANKS), craftSlot(ALL_PLANKS),
      null, null, null,
    ],
    outputCount: 1,
    isBig: true,
  };

  // Wool slots (0, 1, 2) must match
  const sameMask = [true, true, true, false, false, false, false, false, false];

  return new CraftWithMatchingWoolTask(bot, outputItems, outputMapping, recipe, sameMask, count);
}
