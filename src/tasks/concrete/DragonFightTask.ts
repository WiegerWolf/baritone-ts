/**
 * DragonFightTask - Ender Dragon Combat Tasks
 * Based on BaritonePlus's KillEnderDragonTask.java and WaitForDragonAndPearlTask.java
 *
 * WHY: Killing the Ender Dragon is the final boss of Minecraft speedruns:
 * - Must destroy End Crystals that heal the dragon
 * - Wait for dragon to perch on the exit portal
 * - Attack the dragon's head for maximum damage
 * - Avoid dragon breath and fireballs
 *
 * This implements two strategies:
 * 1. Traditional melee: Wait for perch, attack head directly
 * 2. Pearl strategy: Pillar up and pearl onto dragon when perching
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { DoToClosestEntityTask } from './EntityTask';
import { GetToYTask, TimeoutWanderTask } from './MovementUtilTask';
import { GoToBlockTask } from './GoToTask';
import { EquipTask, EquipmentSlot } from './InventoryTask';
import { MineAndCollectTask } from './MineAndCollectTask';
import { BlockPos } from '../../types';
import { itemTarget } from './ResourceTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Diamond armor items for equipment
 */
const DIAMOND_ARMOR = [
  'diamond_helmet',
  'diamond_chestplate',
  'diamond_leggings',
  'diamond_boots',
];

/**
 * Food items to pick up
 */
const FOOD_ITEMS = [
  'bread',
  'cooked_beef',
  'cooked_porkchop',
  'cooked_chicken',
  'cooked_mutton',
  'golden_apple',
];

/**
 * State for dragon fight
 */
enum DragonFightState {
  EQUIPPING,
  DESTROYING_CRYSTALS,
  WAITING_FOR_PERCH,
  ATTACKING_DRAGON,
  ENTERING_PORTAL,
  FINISHED,
}

/**
 * Interface for dragon perch waiting strategy
 */
export interface IDragonWaiter {
  setExitPortalTop(top: BlockPos): void;
  setPerchState(perching: boolean): void;
}

/**
 * Task to kill the Ender Dragon.
 *
 * WHY: This is the final challenge in beating Minecraft:
 * - End Crystals must be destroyed first (they heal the dragon)
 * - Dragon is most vulnerable when perching on the exit portal
 * - Need to avoid dragon breath and fireballs
 *
 * Based on BaritonePlus KillEnderDragonTask.java
 */
export class KillEnderDragonTask extends Task {
  private state: DragonFightState = DragonFightState.EQUIPPING;
  private exitPortalTop: BlockPos | null = null;
  private lookDownTimer: TimerGame;
  private attackCooldownTimer: TimerGame;

  constructor(bot: Bot) {
    super(bot);
    this.lookDownTimer = new TimerGame(bot, 0.5);
    this.attackCooldownTimer = new TimerGame(bot, 0.4);
  }

  get displayName(): string {
    return `KillEnderDragon(state: ${DragonFightState[this.state]})`;
  }

  onStart(): void {
    this.state = DragonFightState.EQUIPPING;
    this.exitPortalTop = null;
  }

  onTick(): Task | null {
    // Find exit portal if we haven't yet
    if (this.exitPortalTop === null) {
      this.exitPortalTop = this.findExitPortalTop();
    }

    // Check for end portal (game is won!)
    const endPortal = this.findNearbyBlock('end_portal');
    if (endPortal) {
      this.state = DragonFightState.ENTERING_PORTAL;
      return new GoToBlockTask(this.bot, endPortal.x, endPortal.y + 1, endPortal.z);
    }

    // Equip diamond armor if we have it
    for (const armorName of DIAMOND_ARMOR) {
      if (this.hasItem(armorName) && !this.isArmorEquipped(armorName)) {
        this.state = DragonFightState.EQUIPPING;
        const slot = this.getArmorSlot(armorName);
        return new EquipTask(this.bot, armorName, slot);
      }
    }

    // Look down periodically to avoid angering endermen
    if (
      this.lookDownTimer.elapsed() &&
      !this.isAttackingDragon() &&
      this.bot.entity.onGround
    ) {
      this.lookDownTimer.reset();
      // Look down
      this.bot.look(this.bot.entity.yaw, Math.PI / 2, true);
    }

    // Destroy end crystals first
    const crystal = this.findNearestEndCrystal();
    if (crystal) {
      this.state = DragonFightState.DESTROYING_CRYSTALS;
      return new DoToClosestEntityTask(
        this.bot,
        (entity) => {
          // Attack if in range
          if (entity.position.distanceTo(this.bot.entity.position) < 7) {
            this.bot.attack(entity);
          }
          // Navigate to crystal
          return new GoToBlockTask(
            this.bot,
            Math.floor(entity.position.x) + 1,
            Math.floor(entity.position.y),
            Math.floor(entity.position.z)
          );
        },
        ['end_crystal'],
        () => true // Accept all end crystals
      );
    }

    // Fight the dragon
    const dragon = this.findEnderDragon();
    if (dragon) {
      const isPerching = this.isDragonPerching(dragon);

      if (isPerching) {
        this.state = DragonFightState.ATTACKING_DRAGON;
        return this.attackDragonTask(dragon);
      }

      this.state = DragonFightState.WAITING_FOR_PERCH;
      // Wander around the portal while waiting
      return this.getWanderTask();
    }

    // No dragon found - might have won or dragon is respawning
    return null;
  }

  /**
   * Find the top of the exit portal (bedrock structure)
   */
  private findExitPortalTop(): BlockPos | null {
    // The exit portal is always at x=0, z=0 in the End
    // Search for bedrock at the center
    for (let y = 70; y >= 50; y--) {
      const block = this.bot.blockAt(new Vec3(0, y, 0));
      if (block && block.name === 'bedrock') {
        return new BlockPos(0, y, 0);
      }
    }
    return null;
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
          if (block && block.name === blockName) {
            return pos;
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if player has item
   */
  private hasItem(itemName: string): boolean {
    return this.bot.inventory.items().some((item) => item.name === itemName);
  }

  /**
   * Check if armor is equipped
   */
  private isArmorEquipped(armorName: string): boolean {
    const slots = [5, 6, 7, 8]; // Armor slots in inventory
    for (const slot of slots) {
      const item = this.bot.inventory.slots[slot];
      if (item && item.name === armorName) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the equipment slot for armor piece
   */
  private getArmorSlot(armorName: string): EquipmentSlot {
    if (armorName.includes('helmet')) return EquipmentSlot.HEAD;
    if (armorName.includes('chestplate')) return EquipmentSlot.CHEST;
    if (armorName.includes('leggings')) return EquipmentSlot.LEGS;
    if (armorName.includes('boots')) return EquipmentSlot.FEET;
    return EquipmentSlot.HAND;
  }

  /**
   * Find nearest end crystal entity
   */
  private findNearestEndCrystal(): any | null {
    let nearest: any = null;
    let nearestDist = Infinity;
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'end_crystal' || entity.name === 'ender_crystal') {
        const dist = entity.position.distanceTo(playerPos);
        if (dist < nearestDist) {
          nearest = entity;
          nearestDist = dist;
        }
      }
    }

    return nearest;
  }

  /**
   * Find the ender dragon entity
   */
  private findEnderDragon(): any | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'ender_dragon') {
        return entity;
      }
    }
    return null;
  }

  /**
   * Check if dragon is perching (landing or sitting)
   */
  private isDragonPerching(dragon: any): boolean {
    // In mineflayer, we can check if dragon is near the center portal
    // and at a low altitude
    const dragonPos = dragon.position;
    const nearCenter = Math.abs(dragonPos.x) < 10 && Math.abs(dragonPos.z) < 10;
    const lowAltitude = dragonPos.y < 70;

    return nearCenter && lowAltitude;
  }

  /**
   * Check if currently attacking dragon
   */
  private isAttackingDragon(): boolean {
    return this.state === DragonFightState.ATTACKING_DRAGON;
  }

  /**
   * Create task to attack the dragon
   */
  private attackDragonTask(dragon: any): Task | null {
    const dragonPos = dragon.position;
    const playerPos = this.bot.entity.position;
    const dist = dragonPos.distanceTo(playerPos);

    // If close enough, attack
    if (dist < 7.5) {
      // Equip best weapon
      this.equipBestWeapon();

      // Look at dragon
      this.bot.lookAt(dragonPos.offset(0, 2, 0));

      // Attack if cooldown elapsed
      if (this.attackCooldownTimer.elapsed()) {
        this.bot.attack(dragon);
        this.attackCooldownTimer.reset();
      }

      return null;
    }

    // Move closer to dragon
    if (this.exitPortalTop) {
      // Navigate to a spot near the portal where dragon perches
      const targetPos = this.exitPortalTop.offset(0, -3, 0);
      return new GoToBlockTask(this.bot, targetPos.x, targetPos.y, targetPos.z);
    }

    return null;
  }

  /**
   * Equip the best available weapon
   */
  private equipBestWeapon(): void {
    const weapons = [
      'netherite_sword',
      'diamond_sword',
      'iron_sword',
      'stone_sword',
      'wooden_sword',
      'netherite_axe',
      'diamond_axe',
      'iron_axe',
    ];

    for (const weapon of weapons) {
      const item = this.bot.inventory.items().find((i) => i.name === weapon);
      if (item) {
        this.bot.equip(item, 'hand');
        return;
      }
    }
  }

  /**
   * Get a wander task to move around while waiting
   */
  private getWanderTask(): Task {
    // Wander in a circle around the exit portal
    return new TimeoutWanderTask(this.bot, 10);
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    // Finished when end portal appears and we enter it
    return this.state === DragonFightState.FINISHED;
  }

  /**
   * Get current state
   */
  getState(): DragonFightState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof KillEnderDragonTask;
  }
}

/**
 * Height for pearling strategy
 */
const PEARL_HEIGHT = 42;

/**
 * XZ radius from portal center
 */
const XZ_RADIUS = 30;
const XZ_RADIUS_TOO_FAR = 38;

/**
 * State for pearl strategy
 */
enum PearlStrategyState {
  COLLECTING_MATERIALS,
  MOVING_TO_POSITION,
  PILLARING_UP,
  WAITING_FOR_PERCH,
  THROWING_PEARL,
  FINISHED,
}

/**
 * Task to wait for dragon perch and pearl onto the portal.
 *
 * WHY: This is an advanced speedrun strategy:
 * - Pillar up to get a clear view of the portal
 * - Wait for dragon to perch
 * - Throw ender pearl onto the portal
 * - Quickly attack dragon while it's vulnerable
 *
 * Based on BaritonePlus WaitForDragonAndPearlTask.java
 */
export class WaitForDragonAndPearlTask extends Task implements IDragonWaiter {
  private state: PearlStrategyState = PearlStrategyState.COLLECTING_MATERIALS;
  private exitPortalTop: BlockPos | null = null;
  private dragonIsPerching: boolean = false;

  constructor(bot: Bot) {
    super(bot);
  }

  setExitPortalTop(top: BlockPos): void {
    this.exitPortalTop = top;
  }

  setPerchState(perching: boolean): void {
    this.dragonIsPerching = perching;
  }

  get displayName(): string {
    return `WaitForDragonAndPearl(state: ${PearlStrategyState[this.state]})`;
  }

  onStart(): void {
    this.state = PearlStrategyState.COLLECTING_MATERIALS;
    this.dragonIsPerching = false;
  }

  onTick(): Task | null {
    if (!this.exitPortalTop) {
      // Find exit portal
      this.exitPortalTop = this.findExitPortalTop();
      if (!this.exitPortalTop) {
        return new TimeoutWanderTask(this.bot, 5);
      }
    }

    // Check if we have ender pearl
    if (!this.hasItem('ender_pearl')) {
      this.state = PearlStrategyState.COLLECTING_MATERIALS;
      // Would return task to get ender pearl
      return null;
    }

    // Check if we have building materials
    const buildingMaterialCount = this.getBuildingMaterialCount();
    if (buildingMaterialCount < PEARL_HEIGHT + 10) {
      this.state = PearlStrategyState.COLLECTING_MATERIALS;
      return new MineAndCollectTask(
        this.bot,
        [itemTarget('end_stone', PEARL_HEIGHT + 10)],
        ['end_stone'],
        {}
      );
    }

    const playerPos = this.bot.entity.position;
    const minHeight = this.exitPortalTop.y + PEARL_HEIGHT - 3;

    // If dragon is perching and we have line of sight, throw pearl!
    if (this.dragonIsPerching && playerPos.y >= minHeight) {
      this.state = PearlStrategyState.THROWING_PEARL;
      return this.throwPearlTask();
    }

    // Need to pillar up
    if (playerPos.y < minHeight) {
      this.state = PearlStrategyState.PILLARING_UP;
      return new GetToYTask(this.bot, minHeight);
    }

    // At correct height, wait for perch
    this.state = PearlStrategyState.WAITING_FOR_PERCH;

    // Update perch state by checking dragon
    const dragon = this.findEnderDragon();
    if (dragon) {
      this.dragonIsPerching = this.isDragonPerching(dragon);
    }

    // Look at dragon while waiting
    if (dragon) {
      this.bot.lookAt(dragon.position);
    }

    return null;
  }

  /**
   * Find the exit portal top
   */
  private findExitPortalTop(): BlockPos | null {
    for (let y = 70; y >= 50; y--) {
      const block = this.bot.blockAt(new Vec3(0, y, 0));
      if (block && block.name === 'bedrock') {
        return new BlockPos(0, y, 0);
      }
    }
    return null;
  }

  /**
   * Check if player has item
   */
  private hasItem(itemName: string): boolean {
    return this.bot.inventory.items().some((item) => item.name.includes(itemName));
  }

  /**
   * Get count of building materials
   */
  private getBuildingMaterialCount(): number {
    const materials = ['dirt', 'cobblestone', 'netherrack', 'end_stone'];
    let count = 0;

    for (const item of this.bot.inventory.items()) {
      if (materials.includes(item.name)) {
        count += item.count;
      }
    }

    return count;
  }

  /**
   * Find ender dragon
   */
  private findEnderDragon(): any | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'ender_dragon') {
        return entity;
      }
    }
    return null;
  }

  /**
   * Check if dragon is perching
   */
  private isDragonPerching(dragon: any): boolean {
    const dragonPos = dragon.position;
    const nearCenter = Math.abs(dragonPos.x) < 10 && Math.abs(dragonPos.z) < 10;
    const lowAltitude = dragonPos.y < 70;

    return nearCenter && lowAltitude;
  }

  /**
   * Create task to throw ender pearl at portal
   */
  private throwPearlTask(): Task | null {
    // Equip ender pearl and throw at portal
    const pearl = this.bot.inventory.items().find((item) => item.name.includes('ender_pearl'));
    if (pearl && this.exitPortalTop) {
      const targetPos = new Vec3(
        this.exitPortalTop.x,
        this.exitPortalTop.y - 1,
        this.exitPortalTop.z
      );

      // Look at target and throw
      this.bot.equip(pearl, 'hand');
      this.bot.lookAt(targetPos);
      this.bot.activateItem();
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    if (!this.exitPortalTop) return false;

    // Finished when we're close to portal center after pearling
    const playerPos = this.bot.entity.position;
    const distXZ = Math.sqrt(
      Math.pow(playerPos.x - this.exitPortalTop.x, 2) +
        Math.pow(playerPos.z - this.exitPortalTop.z, 2)
    );

    return this.dragonIsPerching && distXZ < 15;
  }

  /**
   * Get current state
   */
  getState(): PearlStrategyState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof WaitForDragonAndPearlTask;
  }
}

/**
 * Convenience function to kill ender dragon
 */
export function killEnderDragon(bot: Bot): KillEnderDragonTask {
  return new KillEnderDragonTask(bot);
}

/**
 * Convenience function for pearl strategy
 */
export function waitForDragonAndPearl(bot: Bot): WaitForDragonAndPearlTask {
  return new WaitForDragonAndPearlTask(bot);
}

/**
 * State for bed-based dragon killing
 */
enum BedDragonState {
  FINDING_PORTAL,
  WAITING_FOR_DRAGON,
  POSITIONING,
  PLACING_BED,
  WAITING_FOR_HEAD,
  EXPLODING_BED,
  FINISHED,
}

/**
 * Bed types for the explosion strategy
 */
const BED_ITEMS = [
  'white_bed', 'orange_bed', 'magenta_bed', 'light_blue_bed',
  'yellow_bed', 'lime_bed', 'pink_bed', 'gray_bed',
  'light_gray_bed', 'cyan_bed', 'purple_bed', 'blue_bed',
  'brown_bed', 'green_bed', 'red_bed', 'black_bed',
];

/**
 * Task to kill the Ender Dragon using bed explosions.
 *
 * WHY: Beds explode in the End dimension (can't set spawn there).
 * This explosion deals massive damage - one of the fastest speedrun strats.
 * The bed must be placed at the right moment when dragon's head is close.
 *
 * Strategy:
 * 1. Position near the exit portal
 * 2. Wait for dragon to perch
 * 3. Place bed on top of portal bedrock
 * 4. Wait for dragon's head to be close enough
 * 5. Right-click bed to explode it
 *
 * Based on BaritonePlus KillEnderDragonWithBedsTask.java
 */
export class KillEnderDragonWithBedsTask extends Task {
  private state: BedDragonState = BedDragonState.FINDING_PORTAL;
  private exitPortalTop: BlockPos | null = null;
  private whenNotPerchingTask: Task & IDragonWaiter;
  private bedClickDistance: number;

  constructor(bot: Bot, notPerchingTask: Task & IDragonWaiter, bedClickDistance: number = 4.0) {
    super(bot);
    this.whenNotPerchingTask = notPerchingTask;
    this.bedClickDistance = bedClickDistance;
  }

  get displayName(): string {
    return `KillDragonWithBeds(${BedDragonState[this.state]})`;
  }

  onStart(): void {
    this.state = BedDragonState.FINDING_PORTAL;
    this.exitPortalTop = null;
  }

  onTick(): Task | null {
    // Find the exit portal if we haven't yet
    if (!this.exitPortalTop) {
      this.exitPortalTop = this.findExitPortalTop();
      if (this.exitPortalTop) {
        this.whenNotPerchingTask.setExitPortalTop(this.exitPortalTop);
      } else {
        this.state = BedDragonState.FINDING_PORTAL;
        // Navigate to 0,0 to find the portal
        return new GoToBlockTask(this.bot, 0, 70, 0);
      }
    }

    // Check if dragon exists
    const dragon = this.findEnderDragon();
    if (!dragon) {
      // Dragon is dead or not found
      this.state = BedDragonState.FINISHED;
      return null;
    }

    // Check if dragon is perching
    const isPerching = this.isDragonPerching(dragon);
    this.whenNotPerchingTask.setPerchState(isPerching);

    // When dragon is not perching, run the alternative task
    if (!isPerching) {
      if (!this.whenNotPerchingTask.isFinished()) {
        return this.whenNotPerchingTask;
      }
    }

    if (isPerching) {
      return this.handlePerching(dragon);
    }

    // Run the not-perching task as fallback
    return this.whenNotPerchingTask;
  }

  private handlePerching(dragon: any): Task | null {
    const playerPos = this.bot.entity.position;

    // Target stand position: one block below and offset from portal
    const targetStandPos = new Vec3(
      this.exitPortalTop!.x - 1,
      this.exitPortalTop!.y - 1,
      this.exitPortalTop!.z
    );

    // Check if we're in position
    const inRangeXZ = Math.abs(playerPos.x - targetStandPos.x) < 1 &&
                      Math.abs(playerPos.z - targetStandPos.z) < 1;
    const atCorrectY = playerPos.y >= targetStandPos.y;

    if (!inRangeXZ || !atCorrectY) {
      this.state = BedDragonState.POSITIONING;
      return new GoToBlockTask(
        this.bot,
        Math.floor(targetStandPos.x),
        Math.floor(targetStandPos.y),
        Math.floor(targetStandPos.z)
      );
    }

    // We're positioned. Check for bed placement
    const bedTargetPos = new Vec3(
      this.exitPortalTop!.x,
      this.exitPortalTop!.y + 1,
      this.exitPortalTop!.z
    );

    // Check if bed is already placed
    const bedBlock = this.bot.blockAt(bedTargetPos);
    const bedPlaced = bedBlock && BED_ITEMS.some(bed => bedBlock.name.includes(bed.replace('_bed', '')));

    if (!bedPlaced) {
      this.state = BedDragonState.PLACING_BED;

      // Check if we can place (camera above bed position)
      const canPlace = this.bot.entity.position.y + 1.6 > bedTargetPos.y;

      if (canPlace) {
        // Find and equip a bed
        const bed = this.bot.inventory.items().find(item =>
          BED_ITEMS.includes(item.name)
        );

        if (bed) {
          this.bot.equip(bed, 'hand');
          // Look at the position below the bed (place on portal bedrock)
          const placePos = new Vec3(
            bedTargetPos.x,
            bedTargetPos.y - 1,
            bedTargetPos.z
          );
          this.bot.lookAt(placePos);
          // Place the bed
          this.bot.activateItem();
        }
      } else {
        // Need to jump to place bed
        if (this.bot.entity.onGround) {
          this.bot.setControlState('jump', true);
        } else {
          this.bot.setControlState('jump', false);
        }
      }

      return null;
    }

    // Bed is placed! Wait for dragon's head to be close enough
    this.state = BedDragonState.WAITING_FOR_HEAD;

    // Make sure we're on the ground to not blow ourselves up
    if (!this.bot.entity.onGround) {
      return null; // Wait to fall
    }

    // Calculate distance to dragon's head
    const dragonHeadPos = new Vec3(
      dragon.position.x,
      dragon.position.y + 2, // Approximate head position
      dragon.position.z
    );

    const distToBedHead = dragonHeadPos.distanceTo(bedTargetPos);

    if (distToBedHead < this.bedClickDistance) {
      // Dragon's head is close enough - EXPLODE THE BED!
      this.state = BedDragonState.EXPLODING_BED;

      // Look at bed and interact
      this.bot.lookAt(bedTargetPos);

      // Activate block to trigger bed explosion
      const bedBlockRef = this.bot.blockAt(bedTargetPos);
      if (bedBlockRef) {
        this.bot.activateBlock(bedBlockRef);
      }
    }

    return null;
  }

  private findExitPortalTop(): BlockPos | null {
    // The exit portal is at 0,0 in the end
    for (let y = 70; y >= 50; y--) {
      const block = this.bot.blockAt(new Vec3(0, y, 0));
      if (block && block.name === 'bedrock') {
        return new BlockPos(0, y, 0);
      }
    }
    return null;
  }

  private findEnderDragon(): any | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'ender_dragon') {
        return entity;
      }
    }
    return null;
  }

  private isDragonPerching(dragon: any): boolean {
    // Dragon perches when near 0,0 and low altitude
    const dragonPos = dragon.position;
    const nearCenter = Math.abs(dragonPos.x) < 15 && Math.abs(dragonPos.z) < 15;
    const lowAltitude = dragonPos.y < 75;

    // Also check if dragon is below exit portal height
    if (this.exitPortalTop && dragonPos.y < this.exitPortalTop.y + 2) {
      return false; // Already perched/too low
    }

    return nearCenter && lowAltitude;
  }

  /**
   * Count beds in inventory
   */
  getBedCount(): number {
    return this.bot.inventory.items()
      .filter(item => BED_ITEMS.includes(item.name))
      .reduce((sum, item) => sum + item.count, 0);
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.setControlState('jump', false);
  }

  isFinished(): boolean {
    return this.state === BedDragonState.FINISHED ||
           this.findEnderDragon() === null;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof KillEnderDragonWithBedsTask;
  }
}

/**
 * Convenience function for bed-based dragon killing
 */
export function killDragonWithBeds(
  bot: Bot,
  notPerchingTask: Task & IDragonWaiter
): KillEnderDragonWithBedsTask {
  return new KillEnderDragonWithBedsTask(bot, notPerchingTask);
}

export {
  DragonFightState,
  PearlStrategyState,
  BedDragonState,
  DIAMOND_ARMOR,
  FOOD_ITEMS,
  BED_ITEMS,
};
