/**
 * BeatMinecraftTask - Complete Speedrun Task
 * Based on BaritonePlus's BeatMinecraft2Task.java and MarvionBeatMinecraftTask.java
 *
 * WHY: This is the ultimate goal - beat Minecraft automatically:
 * - Collect resources (food, gear, building materials)
 * - Navigate to Nether for blaze rods and ender pearls
 * - Locate and enter the stronghold
 * - Kill the Ender Dragon
 *
 * The task orchestrates many subtasks in the correct order,
 * handling dimension changes and resource management.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { TimerGame } from '../../utils/timers/TimerGame';

// Import subtasks
import { GoToDimensionTask } from '../composite/PortalTask';
import { LocateStrongholdCoordinatesTask } from './LocateStrongholdCoordinatesTask';
import { GoToStrongholdPortalTask } from './GoToStrongholdPortalTask';
import { KillEnderDragonTask, WaitForDragonAndPearlTask } from './DragonFightTask';
import { CollectBlazeRodsTask } from './CollectBlazeRodsTask';
import { CollectFoodTask } from './CollectFoodTask';
import { TradeWithPiglinsTask } from './TradeTask';
import { EquipArmorTask } from './EquipArmorTask';
import { EquipSpecificArmorTask } from './EquipSpecificArmorTask';
import { PlaceBedAndSetSpawnTask } from './PlaceBedAndSetSpawnTask';
import { SleepInBedTask } from './SleepInBedTask';
import { DoToClosestBlockTask } from './BlockSearchTask';
import { DestroyBlockTask } from './ConstructionTask';
import { PickupItemTask } from './InventoryPickupItemTask';
import { KillAndLootTask } from './KillAndLootTask';
import { Dimension, itemTarget } from './ResourceTask';
import { InteractWithBlockTask, Direction } from './InteractWithBlockTask';
import { GetToBlockTask } from './GetToBlockTask';
import { GoToBlockTask } from './GoToBlockTask';
import { SearchChunkForBlockTask } from './SearchChunkForBlockTask';

/**
 * Configuration for BeatMinecraftTask
 */
export interface BeatMinecraftConfig {
  /** Target eyes of ender to collect */
  targetEyes: number;
  /** Minimum eyes needed before stronghold search */
  minimumEyes: number;
  /** Place bed spawn near end portal */
  placeSpawnNearEndPortal: boolean;
  /** Barter for pearls instead of hunting endermen */
  barterPearlsInsteadOfEndermanHunt: boolean;
  /** Sleep through night when possible */
  sleepThroughNight: boolean;
  /** Search ruined portals for loot */
  searchRuinedPortals: boolean;
  /** Search desert temples for loot */
  searchDesertTemples: boolean;
  /** Minimum food units to maintain */
  minFoodUnits: number;
  /** Target food units to collect */
  foodUnits: number;
  /** Number of beds for dragon fight */
  requiredBeds: number;
  /** Minimum building materials */
  minBuildMaterialCount: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BeatMinecraftConfig = {
  targetEyes: 14,
  minimumEyes: 12,
  placeSpawnNearEndPortal: true,
  barterPearlsInsteadOfEndermanHunt: false,
  sleepThroughNight: true,
  searchRuinedPortals: true,
  searchDesertTemples: true,
  minFoodUnits: 180,
  foodUnits: 220,
  requiredBeds: 10,
  minBuildMaterialCount: 5,
};

/**
 * Armor sets for different phases
 */
export const DIAMOND_ARMOR = [
  'diamond_helmet',
  'diamond_chestplate',
  'diamond_leggings',
  'diamond_boots',
];

export const IRON_ARMOR = [
  'iron_helmet',
  'iron_chestplate',
  'iron_leggings',
  'iron_boots',
];

/**
 * Main state machine for BeatMinecraftTask
 */
export enum BeatMinecraftState {
  /** Initial setup and resource gathering */
  GETTING_FOOD,
  GETTING_GEAR,
  GETTING_BEDS,
  /** Nether phase */
  GOING_TO_NETHER,
  GETTING_BLAZE_RODS,
  GETTING_ENDER_PEARLS,
  /** Stronghold phase */
  LEAVING_NETHER,
  LOCATING_STRONGHOLD,
  OPENING_PORTAL,
  SETTING_SPAWN,
  /** End phase */
  ENTERING_END,
  FIGHTING_DRAGON,
  /** Completion */
  FINISHED,
}

/**
 * Items needed to make eyes of ender
 */
const BLAZE_ROD_TARGET = 7; // Enough for 14 eyes
const ENDER_PEARL_TARGET = 14;

/**
 * End portal frame offsets from center
 */
const END_PORTAL_FRAME_OFFSETS = [
  new Vec3(2, 0, 1),
  new Vec3(2, 0, 0),
  new Vec3(2, 0, -1),
  new Vec3(-2, 0, 1),
  new Vec3(-2, 0, 0),
  new Vec3(-2, 0, -1),
  new Vec3(1, 0, 2),
  new Vec3(0, 0, 2),
  new Vec3(-1, 0, 2),
  new Vec3(1, 0, -2),
  new Vec3(0, 0, -2),
  new Vec3(-1, 0, -2),
];

/**
 * Main task to beat Minecraft.
 *
 * WHY: This orchestrates the entire speedrun:
 * 1. Gather initial resources (food, wood, stone tools)
 * 2. Get iron/diamond gear
 * 3. Enter Nether, get blaze rods
 * 4. Get ender pearls (hunting or bartering)
 * 5. Craft eyes of ender
 * 6. Locate and enter stronghold
 * 7. Set spawn near portal
 * 8. Enter End, kill dragon
 *
 * Based on BaritonePlus BeatMinecraft2Task.java
 */
export class BeatMinecraftTask extends Task {
  private config: BeatMinecraftConfig;
  private state: BeatMinecraftState = BeatMinecraftState.GETTING_FOOD;
  private endPortalCenter: BlockPos | null = null;
  private bedSpawnLocation: BlockPos | null = null;
  private locateStrongholdTask: GoToStrongholdPortalTask;
  private dragonKillTask: KillEnderDragonTask;
  private ranStrongholdLocator: boolean = false;

  constructor(bot: Bot, config: Partial<BeatMinecraftConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.locateStrongholdTask = new GoToStrongholdPortalTask(bot, this.config.targetEyes);
    this.dragonKillTask = new KillEnderDragonTask(bot);
  }

  get displayName(): string {
    return `BeatMinecraft(state: ${BeatMinecraftState[this.state]})`;
  }

  onStart(): void {
    this.state = BeatMinecraftState.GETTING_FOOD;
    this.endPortalCenter = null;
    this.bedSpawnLocation = null;
    this.ranStrongholdLocator = false;
  }

  onTick(): Task | null {
    const dimension = this.getCurrentDimension();

    // Handle End dimension
    if (dimension === 'the_end') {
      return this.handleEndDimension();
    }

    // Check for end portal
    if (dimension === 'overworld') {
      this.checkForEndPortal();
    }

    // Calculate eye requirements
    const eyeCount = this.getItemCount('ender_eye');
    const blazePowderCount = this.getItemCount('blaze_powder');
    const blazeRodCount = this.getItemCount('blaze_rod');
    const enderPearlCount = this.getItemCount('ender_pearl');

    const filledFrames = this.getFilledPortalFrames();
    const eyesNeeded = this.config.targetEyes - filledFrames;
    const hasEnoughEyes = eyeCount >= eyesNeeded;

    // Main state machine
    switch (dimension) {
      case 'overworld':
        return this.handleOverworld(hasEnoughEyes, eyesNeeded, blazeRodCount, enderPearlCount);
      case 'nether':
        return this.handleNether(blazeRodCount, enderPearlCount, eyesNeeded);
      default:
        return null;
    }
  }

  /**
   * Handle overworld logic
   */
  private handleOverworld(
    hasEnoughEyes: boolean,
    eyesNeeded: number,
    blazeRodCount: number,
    enderPearlCount: number
  ): Task | null {
    // If we have eyes and found portal, handle portal interactions
    if (hasEnoughEyes && this.endPortalCenter !== null) {
      // Check if portal is already open
      if (this.isEndPortalOpen()) {
        // Set spawn if configured
        if (this.config.placeSpawnNearEndPortal && !this.bedSpawnLocation) {
          this.state = BeatMinecraftState.SETTING_SPAWN;
          return new PlaceBedAndSetSpawnTask(this.bot);
        }

        // Enter the portal
        this.state = BeatMinecraftState.ENTERING_END;
        return new GetToBlockTask(this.bot, this.endPortalCenter.x, this.endPortalCenter.y + 1, this.endPortalCenter.z);
      }

      // Open the portal
      this.state = BeatMinecraftState.OPENING_PORTAL;
      return this.openEndPortalTask();
    }

    // If we have eyes, locate stronghold
    if (hasEnoughEyes) {
      this.state = BeatMinecraftState.LOCATING_STRONGHOLD;
      this.ranStrongholdLocator = true;
      return this.locateStrongholdTask;
    }

    // Get beds before entering nether
    if (this.needsBeds()) {
      this.state = BeatMinecraftState.GETTING_BEDS;
      return this.getBedTask();
    }

    // Get food if needed
    if (this.getFoodUnits() < this.config.minFoodUnits) {
      this.state = BeatMinecraftState.GETTING_FOOD;
      return new CollectFoodTask(this.bot, { unitsNeeded: this.config.foodUnits });
    }

    // Get basic gear
    if (!this.hasBasicGear()) {
      this.state = BeatMinecraftState.GETTING_GEAR;
      // Would return task to get gear
      return null;
    }

    // Sleep through night if configured
    if (this.config.sleepThroughNight && this.canSleep()) {
      return new SleepInBedTask(this.bot);
    }

    // Need to go to nether for blaze rods/pearls
    this.state = BeatMinecraftState.GOING_TO_NETHER;
    return new GoToDimensionTask(this.bot, Dimension.NETHER);
  }

  /**
   * Handle nether logic
   */
  private handleNether(
    blazeRodCount: number,
    enderPearlCount: number,
    eyesNeeded: number
  ): Task | null {
    const blazeRodTarget = Math.ceil((eyesNeeded - this.getItemCount('blaze_powder')) / 2);
    const needsBlazeRods = blazeRodCount < blazeRodTarget;
    const needsEnderPearls = enderPearlCount < eyesNeeded;

    // Get blaze rods first
    if (needsBlazeRods) {
      this.state = BeatMinecraftState.GETTING_BLAZE_RODS;
      return new CollectBlazeRodsTask(this.bot, { count: blazeRodTarget });
    }

    // Get ender pearls
    if (needsEnderPearls) {
      this.state = BeatMinecraftState.GETTING_ENDER_PEARLS;
      return this.getEnderPearlTask(eyesNeeded);
    }

    // Leave nether
    this.state = BeatMinecraftState.LEAVING_NETHER;
    return new GoToDimensionTask(this.bot, Dimension.OVERWORLD);
  }

  /**
   * Handle End dimension logic
   */
  private handleEndDimension(): Task | null {
    // Check for victory (end portal to overworld)
    const endPortal = this.findNearbyBlock('end_gateway');
    if (endPortal) {
      this.state = BeatMinecraftState.FINISHED;
      return null;
    }

    // Pickup dropped items (after death respawn)
    const droppedBed = this.findDroppedItem('_bed');
    if (droppedBed && this.getItemCount('_bed') < this.config.requiredBeds) {
      return new PickupItemTask(this.bot, '_bed', this.config.requiredBeds);
    }

    // Fight dragon
    this.state = BeatMinecraftState.FIGHTING_DRAGON;

    // Use bed strats if we have beds
    if (this.hasItem('_bed')) {
      return this.dragonKillTask;
    }

    // Regular fight without beds
    return this.dragonKillTask;
  }

  /**
   * Get task to open end portal
   */
  private openEndPortalTask(): Task | null {
    if (!this.endPortalCenter) return null;

    // Find unfilled frame
    for (const offset of END_PORTAL_FRAME_OFFSETS) {
      const framePos = new BlockPos(
        this.endPortalCenter.x + offset.x,
        this.endPortalCenter.y + offset.y,
        this.endPortalCenter.z + offset.z
      );

      const block = this.bot.blockAt(new Vec3(framePos.x, framePos.y, framePos.z));
      if (block && block.name === 'end_portal_frame') {
        // Check if filled (would need to check block state)
        // For now, interact with all frames
        return new InteractWithBlockTask(this.bot, {
          target: framePos,
          direction: Direction.UP,
          itemToUse: 'ender_eye',
        });
      }
    }

    return null;
  }

  /**
   * Get task to collect ender pearls
   */
  private getEnderPearlTask(count: number): Task | null {
    if (this.config.barterPearlsInsteadOfEndermanHunt) {
      // Equip golden boots first
      if (!this.isWearing('golden_boots')) {
        return new EquipSpecificArmorTask(this.bot, 'golden_boots');
      }
      return new TradeWithPiglinsTask(this.bot, [itemTarget('ender_pearl', count)]);
    }

    // Hunt endermen in warped forest
    const hasEnderman = this.findNearbyEntity('enderman');
    const droppedPearl = this.findDroppedItem('ender_pearl');

    if (hasEnderman || droppedPearl) {
      return new KillAndLootTask(
        this.bot,
        [itemTarget('ender_pearl', count)],
        ['enderman'],
        {}
      );
    }

    // Search for warped forest
    return new SearchChunkForBlockTask(this.bot, ['warped_nylium'], 1, {});
  }

  /**
   * Get task to collect beds
   */
  private getBedTask(): Task | null {
    // Check for nearby beds
    const bedBlock = this.findNearbyBlock('_bed');
    if (bedBlock) {
      return new DestroyBlockTask(this.bot, bedBlock.x, bedBlock.y, bedBlock.z);
    }

    // Would need to craft beds
    return null;
  }

  /**
   * Check for end portal in nearby chunks
   */
  private checkForEndPortal(): void {
    // Search for end portal or end portal frames
    const portalBlock = this.findNearbyBlock('end_portal');
    if (portalBlock) {
      this.endPortalCenter = new BlockPos(portalBlock.x, portalBlock.y, portalBlock.z);
      return;
    }

    // Try to calculate center from frames
    const frames: Vec3[] = [];
    const playerPos = this.bot.entity.position;

    for (let x = -64; x <= 64; x++) {
      for (let z = -64; z <= 64; z++) {
        for (let y = -32; y <= 32; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);
          if (block && block.name === 'end_portal_frame') {
            frames.push(pos);
          }
        }
      }
    }

    if (frames.length >= 12) {
      // Calculate center
      let sumX = 0, sumY = 0, sumZ = 0;
      for (const frame of frames) {
        sumX += frame.x;
        sumY += frame.y;
        sumZ += frame.z;
      }
      this.endPortalCenter = new BlockPos(
        Math.floor(sumX / frames.length),
        Math.floor(sumY / frames.length),
        Math.floor(sumZ / frames.length)
      );
    }
  }

  /**
   * Check if end portal is open
   */
  private isEndPortalOpen(): boolean {
    if (!this.endPortalCenter) return false;
    const block = this.bot.blockAt(new Vec3(this.endPortalCenter.x, this.endPortalCenter.y, this.endPortalCenter.z));
    return block !== null && block.name === 'end_portal';
  }

  /**
   * Count filled portal frames
   */
  private getFilledPortalFrames(): number {
    if (!this.endPortalCenter) return 0;

    let filled = 0;
    for (const offset of END_PORTAL_FRAME_OFFSETS) {
      const pos = new Vec3(
        this.endPortalCenter.x + offset.x,
        this.endPortalCenter.y + offset.y,
        this.endPortalCenter.z + offset.z
      );
      const block = this.bot.blockAt(pos);
      // Would need to check block state for eye property
      if (block && block.name === 'end_portal_frame') {
        // Simplified: assume unfilled
      }
    }

    return filled;
  }

  /**
   * Get current dimension
   */
  private getCurrentDimension(): string {
    const dimName = (this.bot as any).game?.dimension || 'overworld';
    if (dimName.includes('nether')) return 'nether';
    if (dimName.includes('end')) return 'the_end';
    return 'overworld';
  }

  /**
   * Check if player needs beds
   */
  private needsBeds(): boolean {
    return this.getItemCount('_bed') < this.config.requiredBeds;
  }

  /**
   * Get food units from inventory
   */
  private getFoodUnits(): number {
    // Simplified food calculation
    let units = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name.includes('cooked') || item.name.includes('bread') || item.name.includes('apple')) {
        units += item.count * 4; // Rough approximation
      }
    }
    return units;
  }

  /**
   * Check if player has basic gear
   */
  private hasBasicGear(): boolean {
    return this.hasItem('iron_pickaxe') || this.hasItem('diamond_pickaxe');
  }

  /**
   * Check if player can sleep
   */
  private canSleep(): boolean {
    const time = (this.bot as any).time?.timeOfDay || 0;
    return time >= 12541 && time <= 23458;
  }

  /**
   * Check if wearing armor piece
   */
  private isWearing(armorName: string): boolean {
    // Simplified check
    return false;
  }

  /**
   * Get count of item in inventory
   */
  private getItemCount(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name.includes(itemName)) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Check if player has item
   */
  private hasItem(itemName: string): boolean {
    return this.getItemCount(itemName) > 0;
  }

  /**
   * Find nearby block by name
   */
  private findNearbyBlock(blockName: string): Vec3 | null {
    const playerPos = this.bot.entity.position;

    for (let x = -32; x <= 32; x++) {
      for (let z = -32; z <= 32; z++) {
        for (let y = -16; y <= 16; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);
          if (block && block.name.includes(blockName)) {
            return pos;
          }
        }
      }
    }

    return null;
  }

  /**
   * Find nearby entity
   */
  private findNearbyEntity(entityName: string): boolean {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name?.includes(entityName)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find dropped item entity
   */
  private findDroppedItem(itemName: string): boolean {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'item') {
        // Would need to check item stack
        return false;
      }
    }
    return false;
  }

  onStop(interruptTask: ITask | null): void {
    // Clean up
  }

  isFinished(): boolean {
    // Finished when credits screen shows (dragon dead and entered portal)
    // In practice, check if we're back in overworld after being in End
    return this.state === BeatMinecraftState.FINISHED;
  }

  /**
   * Get current state
   */
  getState(): BeatMinecraftState {
    return this.state;
  }

  /**
   * Get the config
   */
  getConfig(): BeatMinecraftConfig {
    return this.config;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof BeatMinecraftTask;
  }
}

/**
 * Convenience function to create BeatMinecraftTask
 */
export function beatMinecraft(bot: Bot, config?: Partial<BeatMinecraftConfig>): BeatMinecraftTask {
  return new BeatMinecraftTask(bot, config);
}

/**
 * Convenience function with default speedrun settings
 */
export function speedrunMinecraft(bot: Bot): BeatMinecraftTask {
  return new BeatMinecraftTask(bot, {
    barterPearlsInsteadOfEndermanHunt: true,
    sleepThroughNight: false, // Speedruns don't sleep
    requiredBeds: 7, // Fewer beds for faster run
  });
}

export { DEFAULT_CONFIG as BEAT_MINECRAFT_DEFAULT_CONFIG };
