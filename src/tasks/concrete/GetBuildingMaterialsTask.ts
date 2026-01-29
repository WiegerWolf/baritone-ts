/**
 * GetBuildingMaterialsTask - Building Material Collection Task
 * Based on BaritonePlus's building material collection system
 *
 * WHY: Many tasks require "throwaway" blocks for scaffolding, bridging,
 * or clearing liquids. This task collects common building materials like
 * cobblestone, dirt, or netherrack - whatever is easiest to find.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { MineAndCollectTask } from './MineAndCollectTask';
import { itemTarget } from './ResourceTask';

/**
 * Throwaway/building materials that can be easily collected
 */
export const BUILDING_MATERIALS: string[] = [
  'cobblestone',
  'dirt',
  'netherrack',
  'cobbled_deepslate',
  'end_stone',
  'sand',
  'gravel',
  'andesite',
  'diorite',
  'granite',
  'tuff',
  'stone',
  'deepslate',
];

/**
 * Blocks that can be mined to get building materials
 */
const MATERIAL_BLOCKS: string[] = [
  'stone',      // -> cobblestone
  'dirt',       // -> dirt
  'netherrack', // -> netherrack
  'deepslate',  // -> cobbled_deepslate
  'end_stone',  // -> end_stone
  'sand',       // -> sand
  'gravel',     // -> gravel
  'andesite',   // -> andesite
  'diorite',    // -> diorite
  'granite',    // -> granite
  'tuff',       // -> tuff
];

/**
 * State for building materials task
 */
enum BuildingMaterialsState {
  CHECKING,
  COLLECTING,
  FINISHED
}

/**
 * Task to collect building/throwaway materials.
 *
 * WHY: Many tasks require "throwaway" blocks for scaffolding, bridging,
 * or clearing liquids. This task collects common building materials like
 * cobblestone, dirt, or netherrack - whatever is easiest to find.
 *
 * Based on BaritonePlus GetBuildingMaterialsTask.java
 */
export class GetBuildingMaterialsTask extends Task {
  private targetCount: number;
  private state: BuildingMaterialsState = BuildingMaterialsState.CHECKING;

  constructor(bot: Bot, count: number) {
    super(bot);
    this.targetCount = count;
  }

  get displayName(): string {
    const current = this.getBuildingMaterialCount();
    return `GetBuildingMaterials(${current}/${this.targetCount})`;
  }

  onStart(): void {
    this.state = BuildingMaterialsState.CHECKING;
  }

  onTick(): Task | null {
    const currentCount = this.getBuildingMaterialCount();

    if (currentCount >= this.targetCount) {
      this.state = BuildingMaterialsState.FINISHED;
      return null;
    }

    this.state = BuildingMaterialsState.COLLECTING;

    // Create item targets for all building materials
    const needed = this.targetCount - currentCount;
    const targets = BUILDING_MATERIALS.map(mat => itemTarget(mat, needed));

    return new MineAndCollectTask(
      this.bot,
      targets,
      MATERIAL_BLOCKS,
      {
        searchRadius: 32,
        preferDrops: false,
      }
    );
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.state === BuildingMaterialsState.FINISHED ||
           this.getBuildingMaterialCount() >= this.targetCount;
  }

  // ---- Helper methods ----

  /**
   * Count all building materials in inventory
   */
  getBuildingMaterialCount(): number {
    const inventory = this.bot.inventory.items();
    let total = 0;

    for (const item of inventory) {
      if (BUILDING_MATERIALS.includes(item.name)) {
        total += item.count;
      }
    }

    return total;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetBuildingMaterialsTask)) return false;
    return this.targetCount === other.targetCount;
  }
}

/**
 * Helper function to get building materials
 */
export function getBuildingMaterials(
  bot: Bot,
  count: number
): GetBuildingMaterialsTask {
  return new GetBuildingMaterialsTask(bot, count);
}
