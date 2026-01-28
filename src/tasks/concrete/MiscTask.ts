/**
 * MiscTask - Miscellaneous Tasks
 * Based on BaritonePlus's CarveThenCollectTask.java, HeroTask.java, and PlaceObsidianBucketTask.java
 *
 * WHY these tasks matter:
 * - CarveThenCollectTask: Carve blocks (like pumpkins) before collecting
 *   - Carved pumpkins needed for iron golems and jack-o-lanterns
 *   - Requires tool interaction, not just mining
 *
 * - HeroTask: Autonomous hostile mob clearing
 *   - Keeps area safe from hostile mobs
 *   - Collects XP orbs and mob drops
 *
 * - PlaceObsidianBucketTask: Create obsidian using bucket casting
 *   - Build cast frame, place lava, pour water to form obsidian
 *   - Alternative to mining obsidian with diamond pickaxe
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { ResourceTask, ItemTarget, itemTarget } from './ResourceTask';
import { DoToClosestBlockTask } from './BlockSearchTask';
import { DestroyBlockTask, PlaceBlockNearbyTask, ClearLiquidTask } from './ConstructionTask';
import { InteractWithBlockTask, Direction } from './InteractWithBlockTask';
import { TimeoutWanderTask } from './MovementUtilTask';
import { KillAndLootTask } from './KillAndLootTask';
import { PickupItemTask } from './InventoryTask';
import { GetToBlockTask } from './GoToTask';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';

/**
 * State for carve then collect task
 */
export enum CarveState {
  GETTING_TOOL,
  FINDING_CARVED_BLOCK,
  BREAKING_CARVED_BLOCK,
  FINDING_CARVE_BLOCK,
  CARVING_BLOCK,
  COLLECTING_BLOCKS,
  PLACING_BLOCKS,
}

/**
 * Task to carve blocks before collecting them.
 *
 * WHY: Some items require carving blocks first:
 * - Carved pumpkins from pumpkins (using shears)
 * - Used for iron golems and jack-o-lanterns
 *
 * Based on BaritonePlus CarveThenCollectTask.java
 */
export class CarveThenCollectTask extends ResourceTask {
  private targetBlocks: string[];
  private toCarveBlocks: string[];
  private carveWithItem: string;
  private toCarveItem: string;
  private state: CarveState = CarveState.GETTING_TOOL;

  /**
   * @param bot The bot instance
   * @param target The target item to collect (e.g., carved_pumpkin)
   * @param targetBlocks The blocks that drop the target (e.g., carved_pumpkin block)
   * @param toCarve The item form of the block to carve (e.g., pumpkin item)
   * @param toCarveBlocks The blocks to carve (e.g., pumpkin block)
   * @param carveWith The item to carve with (e.g., shears)
   */
  constructor(
    bot: Bot,
    target: ItemTarget,
    targetBlocks: string[],
    toCarve: ItemTarget,
    toCarveBlocks: string[],
    carveWith: string
  ) {
    super(bot, [target]);
    this.targetBlocks = targetBlocks;
    this.toCarveBlocks = toCarveBlocks;
    this.carveWithItem = carveWith;
    this.toCarveItem = toCarve.items[0];
  }

  get displayName(): string {
    return `CarveThenCollect(${this.itemTargets[0].items[0]})`;
  }

  protected onResourceStart(): void {
    this.state = CarveState.GETTING_TOOL;
  }

  protected onResourceTick(): Task | null {
    const targetItem = this.itemTargets[0].items[0];
    const targetCount = this.itemTargets[0].targetCount;
    const currentCount = this.countItemByName(targetItem);
    const neededCount = targetCount - currentCount;

    if (neededCount <= 0) {
      return null; // Done
    }

    // If target block is found, break it
    const targetBlock = this.findNearbyBlock(this.targetBlocks);
    if (targetBlock) {
      this.state = CarveState.BREAKING_CARVED_BLOCK;
      return new DestroyBlockTask(this.bot, targetBlock.x, targetBlock.y, targetBlock.z);
    }

    // Make sure we have the carving tool
    if (!this.hasItemByName(this.carveWithItem)) {
      this.state = CarveState.GETTING_TOOL;
      // Would return task to get tool
      return null;
    }

    // If carve block is found, carve it
    const carveBlock = this.findNearbyBlock(this.toCarveBlocks);
    if (carveBlock) {
      this.state = CarveState.CARVING_BLOCK;
      return new InteractWithBlockTask(this.bot, {
        target: new BlockPos(carveBlock.x, carveBlock.y, carveBlock.z),
        itemToUse: this.carveWithItem,
      });
    }

    // Check if we have enough blocks to place and carve
    const currentCarveItems = this.countItemByName(this.toCarveItem);
    if (neededCount > currentCarveItems) {
      // Need to collect more blocks to carve
      this.state = CarveState.COLLECTING_BLOCKS;
      // Would return task to collect blocks
      return null;
    } else {
      // Place blocks to carve
      this.state = CarveState.PLACING_BLOCKS;
      return new PlaceBlockNearbyTask(this.bot, this.toCarveBlocks);
    }
  }

  protected onResourceStop(interruptTask: ITask | null): void {
    // Clean up
  }

  /**
   * Get current state
   */
  getState(): CarveState {
    return this.state;
  }

  /**
   * Get item count from inventory by name
   */
  private countItemByName(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name.includes(itemName)) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Check if player has item by name
   */
  private hasItemByName(itemName: string): boolean {
    return this.countItemByName(itemName) > 0;
  }

  /**
   * Find nearby block from list
   */
  private findNearbyBlock(blockNames: string[]): Vec3 | null {
    const playerPos = this.bot.entity.position;

    for (let x = -16; x <= 16; x++) {
      for (let z = -16; z <= 16; z++) {
        for (let y = -8; y <= 8; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);
          if (block && blockNames.some(name => block.name.includes(name))) {
            return pos;
          }
        }
      }
    }

    return null;
  }

  protected isEqualResource(other: ResourceTask): boolean {
    if (other instanceof CarveThenCollectTask) {
      return (
        this.itemTargets[0].items[0] === other.itemTargets[0].items[0] &&
        this.toCarveItem === other.toCarveItem
      );
    }
    return false;
  }
}

/**
 * Hostile mob types to hunt
 */
export const HOSTILE_MOBS = [
  'zombie',
  'skeleton',
  'spider',
  'creeper',
  'enderman',
  'witch',
  'slime',
  'phantom',
  'drowned',
  'husk',
  'stray',
  'zombie_villager',
];

/**
 * Drops from hostile mobs
 */
export const HOSTILE_MOB_DROPS = [
  'rotten_flesh',
  'bone',
  'arrow',
  'string',
  'spider_eye',
  'gunpowder',
  'ender_pearl',
  'slime_ball',
  'phantom_membrane',
];

/**
 * State for hero task
 */
export enum HeroState {
  EATING,
  COLLECTING_XP,
  KILLING_HOSTILE,
  COLLECTING_DROPS,
  SEARCHING,
}

/**
 * Task to autonomously clear hostile mobs.
 *
 * WHY: Keeping an area safe is important for:
 * - Protecting villagers and structures
 * - Collecting mob drops for resources
 * - Earning XP from combat
 *
 * Based on BaritonePlus HeroTask.java
 */
export class HeroTask extends Task {
  private state: HeroState = HeroState.SEARCHING;

  constructor(bot: Bot) {
    super(bot);
  }

  get displayName(): string {
    return `Hero(state: ${HeroState[this.state]})`;
  }

  onStart(): void {
    this.state = HeroState.SEARCHING;
  }

  onTick(): Task | null {
    // Check if we need to eat first
    if (this.needsToEat()) {
      this.state = HeroState.EATING;
      return null; // Let food chain handle eating
    }

    // Look for experience orbs
    const xpOrb = this.findNearbyEntity('experience_orb');
    if (xpOrb) {
      this.state = HeroState.COLLECTING_XP;
      return new GetToBlockTask(
        this.bot,
        Math.floor(xpOrb.position.x),
        Math.floor(xpOrb.position.y),
        Math.floor(xpOrb.position.z)
      );
    }

    // Look for hostile mobs
    const hostile = this.findNearbyHostile();
    if (hostile) {
      this.state = HeroState.KILLING_HOSTILE;
      return new KillAndLootTask(
        this.bot,
        HOSTILE_MOB_DROPS.map(drop => itemTarget(drop, 64)),
        [hostile.name || 'zombie'],
        {}
      );
    }

    // Look for mob drops
    const droppedItem = this.findDroppedHostileDrop();
    if (droppedItem) {
      this.state = HeroState.COLLECTING_DROPS;
      return new PickupItemTask(this.bot, droppedItem, 64);
    }

    // Wander to find more mobs
    this.state = HeroState.SEARCHING;
    return new TimeoutWanderTask(this.bot);
  }

  onStop(interruptTask: ITask | null): void {
    // Clean up
  }

  /**
   * Check if player needs to eat
   */
  private needsToEat(): boolean {
    const food = (this.bot as any).food || 20;
    return food < 14;
  }

  /**
   * Find nearby entity by name
   */
  private findNearbyEntity(entityName: string): any | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === entityName) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Find nearby hostile mob
   */
  private findNearbyHostile(): any | null {
    let closest: any = null;
    let closestDist = Infinity;
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name && HOSTILE_MOBS.includes(entity.name)) {
        const dist = entity.position.distanceTo(playerPos);
        if (dist < closestDist) {
          closest = entity;
          closestDist = dist;
        }
      }
    }

    return closest;
  }

  /**
   * Find dropped hostile mob item
   */
  private findDroppedHostileDrop(): string | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'item') {
        // Would need to check item stack for hostile drops
        // Simplified: return first item found
        return 'rotten_flesh';
      }
    }
    return null;
  }

  /**
   * Get current state
   */
  getState(): HeroState {
    return this.state;
  }

  isFinished(): boolean {
    // Hero task never finishes - it runs continuously
    return false;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof HeroTask;
  }
}

/**
 * Cast frame offsets for obsidian bucket placement
 * Relative to lava position
 */
export const OBSIDIAN_CAST_FRAME = [
  new Vec3(0, -1, 0),  // Below lava
  new Vec3(0, 0, -1),  // North
  new Vec3(0, 0, 1),   // South
  new Vec3(-1, 0, 0),  // West
  new Vec3(1, 0, 0),   // East
  new Vec3(1, 1, 0),   // East-up (for water placement)
];

/**
 * State for obsidian bucket task
 */
export enum ObsidianBucketState {
  GETTING_WATER_BUCKET,
  GETTING_LAVA_BUCKET,
  BUILDING_CAST,
  CLEARING_SPACE,
  POSITIONING,
  PLACING_LAVA,
  PLACING_WATER,
  CLEARING_WATER,
  FINISHED,
}

/**
 * Task to place obsidian using bucket casting method.
 *
 * WHY: Creating obsidian without a diamond pickaxe:
 * - Build a cast frame around target position
 * - Place lava in the cast
 * - Pour water on the lava to create obsidian
 * - Useful for nether portal construction
 *
 * Based on BaritonePlus PlaceObsidianBucketTask.java
 */
export class PlaceObsidianBucketTask extends Task {
  private pos: BlockPos;
  private state: ObsidianBucketState = ObsidianBucketState.GETTING_WATER_BUCKET;
  private progressChecker: MovementProgressChecker;
  private currentCastTarget: BlockPos | null = null;
  private currentDestroyTarget: BlockPos | null = null;

  constructor(bot: Bot, pos: BlockPos) {
    super(bot);
    this.pos = pos;
    this.progressChecker = new MovementProgressChecker(bot);
  }

  get displayName(): string {
    return `PlaceObsidianBucket(${this.pos.x}, ${this.pos.y}, ${this.pos.z})`;
  }

  onStart(): void {
    this.state = ObsidianBucketState.GETTING_WATER_BUCKET;
    this.currentCastTarget = null;
    this.currentDestroyTarget = null;
    this.progressChecker.reset();
  }

  onTick(): Task | null {
    // Check for completion
    if (this.isObsidianPlaced() && !this.hasWaterAbove()) {
      this.state = ObsidianBucketState.FINISHED;
      return null;
    }

    // Clear leftover water
    if (this.isObsidianPlaced() && this.hasWaterAbove()) {
      this.state = ObsidianBucketState.CLEARING_WATER;
      const waterPos = new BlockPos(this.pos.x, this.pos.y + 1, this.pos.z);
      return new ClearLiquidTask(this.bot, waterPos.x, waterPos.y, waterPos.z);
    }

    // Make sure we have water bucket
    if (!this.hasItem('water_bucket')) {
      this.state = ObsidianBucketState.GETTING_WATER_BUCKET;
      // Would return task to get water bucket
      return null;
    }

    // Make sure we have lava bucket (unless lava already placed)
    if (!this.hasItem('lava_bucket') && !this.isLavaAtPosition()) {
      this.state = ObsidianBucketState.GETTING_LAVA_BUCKET;
      // Would return task to get lava bucket
      return null;
    }

    // Check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      this.progressChecker.reset();
      return new TimeoutWanderTask(this.bot, 5);
    }

    // Handle current destroy target
    if (this.currentDestroyTarget) {
      if (!this.isSolid(this.currentDestroyTarget)) {
        this.currentDestroyTarget = null;
      } else {
        return new DestroyBlockTask(
          this.bot,
          this.currentDestroyTarget.x,
          this.currentDestroyTarget.y,
          this.currentDestroyTarget.z
        );
      }
    }

    // Handle current cast target
    if (this.currentCastTarget) {
      if (this.isSolid(this.currentCastTarget)) {
        this.currentCastTarget = null;
      } else {
        // Would use PlaceStructureBlockTask, but we'll use PlaceBlockNearbyTask
        this.state = ObsidianBucketState.BUILDING_CAST;
        return new PlaceBlockNearbyTask(this.bot, ['cobblestone', 'stone', 'dirt']);
      }
    }

    // Build cast frame
    for (const offset of OBSIDIAN_CAST_FRAME) {
      const castPos = new BlockPos(
        this.pos.x + offset.x,
        this.pos.y + offset.y,
        this.pos.z + offset.z
      );
      if (!this.isSolid(castPos)) {
        this.currentCastTarget = castPos;
        this.state = ObsidianBucketState.BUILDING_CAST;
        return null;
      }
    }

    // Cast frame built - place lava
    if (!this.isLavaAtPosition()) {
      // Position player safely before placing lava
      const safePos = new BlockPos(this.pos.x - 1, this.pos.y + 1, this.pos.z);
      const playerPos = this.bot.entity.position;
      const atSafePos = Math.abs(playerPos.x - safePos.x) < 1 &&
                        Math.abs(playerPos.z - safePos.z) < 1;

      if (!atSafePos && this.hasItem('lava_bucket')) {
        this.state = ObsidianBucketState.POSITIONING;
        return new GetToBlockTask(this.bot, safePos.x, safePos.y, safePos.z);
      }

      // Clear space if needed
      if (this.isSolid(this.pos)) {
        this.currentDestroyTarget = this.pos;
        this.state = ObsidianBucketState.CLEARING_SPACE;
        return null;
      }

      // Clear above
      const abovePos = new BlockPos(this.pos.x, this.pos.y + 1, this.pos.z);
      if (this.isSolid(abovePos)) {
        this.currentDestroyTarget = abovePos;
        this.state = ObsidianBucketState.CLEARING_SPACE;
        return null;
      }

      // Place lava
      this.state = ObsidianBucketState.PLACING_LAVA;
      const placeTarget = new BlockPos(this.pos.x + 1, this.pos.y, this.pos.z);
      return new InteractWithBlockTask(this.bot, {
        target: placeTarget,
        direction: Direction.WEST,
        itemToUse: 'lava_bucket',
      });
    }

    // Lava placed - place water
    const waterCheckPos = new BlockPos(this.pos.x, this.pos.y + 1, this.pos.z);
    if (!this.isWaterAtPosition(waterCheckPos)) {
      // Position player safely
      const safePos = new BlockPos(this.pos.x - 1, this.pos.y + 1, this.pos.z);
      const playerPos = this.bot.entity.position;
      const atSafePos = Math.abs(playerPos.x - safePos.x) < 1 &&
                        Math.abs(playerPos.z - safePos.z) < 1;

      if (!atSafePos && this.hasItem('water_bucket')) {
        this.state = ObsidianBucketState.POSITIONING;
        return new GetToBlockTask(this.bot, safePos.x, safePos.y, safePos.z);
      }

      // Clear space if needed
      if (this.isSolid(waterCheckPos)) {
        this.currentDestroyTarget = waterCheckPos;
        this.state = ObsidianBucketState.CLEARING_SPACE;
        return null;
      }

      // Place water
      this.state = ObsidianBucketState.PLACING_WATER;
      const placeTarget = new BlockPos(this.pos.x + 1, this.pos.y + 1, this.pos.z);
      return new InteractWithBlockTask(this.bot, {
        target: placeTarget,
        direction: Direction.WEST,
        itemToUse: 'water_bucket',
      });
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Clean up
  }

  /**
   * Check if obsidian is at position
   */
  private isObsidianPlaced(): boolean {
    const block = this.bot.blockAt(new Vec3(this.pos.x, this.pos.y, this.pos.z));
    return block !== null && block.name === 'obsidian';
  }

  /**
   * Check if water is above position
   */
  private hasWaterAbove(): boolean {
    const block = this.bot.blockAt(new Vec3(this.pos.x, this.pos.y + 1, this.pos.z));
    return block !== null && block.name === 'water';
  }

  /**
   * Check if lava is at position
   */
  private isLavaAtPosition(): boolean {
    const block = this.bot.blockAt(new Vec3(this.pos.x, this.pos.y, this.pos.z));
    return block !== null && block.name === 'lava';
  }

  /**
   * Check if water is at position
   */
  private isWaterAtPosition(pos: BlockPos): boolean {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    return block !== null && block.name === 'water';
  }

  /**
   * Check if block is solid
   */
  private isSolid(pos: BlockPos): boolean {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    if (!block) return false;
    return block.name !== 'air' && block.name !== 'water' && block.name !== 'lava';
  }

  /**
   * Check if player has item
   */
  private hasItem(itemName: string): boolean {
    return this.bot.inventory.items().some(item => item.name.includes(itemName));
  }

  /**
   * Get current state
   */
  getState(): ObsidianBucketState {
    return this.state;
  }

  /**
   * Get target position
   */
  getPosition(): BlockPos {
    return this.pos;
  }

  isFinished(): boolean {
    return this.isObsidianPlaced() && !this.hasWaterAbove();
  }

  isEqual(other: ITask | null): boolean {
    if (other instanceof PlaceObsidianBucketTask) {
      return this.pos.x === other.pos.x &&
             this.pos.y === other.pos.y &&
             this.pos.z === other.pos.z;
    }
    return false;
  }
}

/**
 * Convenience function to create CarveThenCollectTask for carved pumpkins
 */
export function collectCarvedPumpkins(bot: Bot, count: number): CarveThenCollectTask {
  return new CarveThenCollectTask(
    bot,
    itemTarget('carved_pumpkin', count),
    ['carved_pumpkin'],
    itemTarget('pumpkin', count),
    ['pumpkin'],
    'shears'
  );
}

/**
 * Convenience function to create HeroTask
 */
export function beHero(bot: Bot): HeroTask {
  return new HeroTask(bot);
}

/**
 * Convenience function to create PlaceObsidianBucketTask
 */
export function placeObsidianWithBucket(bot: Bot, pos: BlockPos): PlaceObsidianBucketTask {
  return new PlaceObsidianBucketTask(bot, pos);
}
