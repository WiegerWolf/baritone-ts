/**
 * KillEnderDragonTask - Traditional melee Ender Dragon combat
 * Based on BaritonePlus's KillEnderDragonTask.java
 *
 * WHY: Killing the Ender Dragon is the final boss of Minecraft speedruns:
 * - Must destroy End Crystals that heal the dragon
 * - Wait for dragon to perch on the exit portal
 * - Attack the dragon's head for maximum damage
 * - Avoid dragon breath and fireballs
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { DoToClosestEntityTask } from './EntityTask';
import { GetToYTask } from './GetToYTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { GoToBlockTask } from './GoToBlockTask';
import { EquipTask, EquipmentSlot } from './EquipTask';
import { BlockPos } from '../../types';
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
  DODGING_BREATH,
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
  private breathDodgeTimer: TimerGame;

  constructor(bot: Bot) {
    super(bot);
    this.lookDownTimer = new TimerGame(bot, 0.5);
    this.attackCooldownTimer = new TimerGame(bot, 0.4);
    this.breathDodgeTimer = new TimerGame(bot, 0.5);
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

    // Check if we're in breath cloud and need to dodge
    if (this.isInBreathCloud()) {
      this.state = DragonFightState.DODGING_BREATH;
      this.breathDodgeTimer.reset();
      return this.handleDodgingBreath();
    }

    // Handle active breath dodging
    if (this.state === DragonFightState.DODGING_BREATH) {
      return this.handleDodgingBreath();
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

  /**
   * Check if player is inside dragon breath cloud
   */
  private isInBreathCloud(): boolean {
    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity.name !== 'area_effect_cloud') continue;
      const dist = this.bot.entity.position.distanceTo(entity.position);
      if (dist < 4) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get direction to escape from center (away from portal)
   */
  private getEscapeDirection(): Vec3 {
    const pos = this.bot.entity.position;
    // Exit portal center is at 0, 0
    const dx = pos.x - 0;
    const dz = pos.z - 0;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len === 0) return new Vec3(1, 0, 0);
    return new Vec3((dx / len) * 10, 0, (dz / len) * 10);
  }

  /**
   * Handle dodging dragon breath by running away from center
   */
  private handleDodgingBreath(): Task | null {
    // Check if still in breath
    if (!this.isInBreathCloud()) {
      this.state = DragonFightState.WAITING_FOR_PERCH;
      this.bot.clearControlStates();
      return null;
    }

    // Keep running away
    if (this.breathDodgeTimer.elapsed()) {
      const escapeDir = this.getEscapeDirection();
      try {
        const escapePos = this.bot.entity.position.plus(escapeDir);
        this.bot.lookAt(escapePos);
      } catch {
        // May fail
      }
      this.breathDodgeTimer.reset();
    }

    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
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
 * Convenience function to kill ender dragon
 */
export function killEnderDragon(bot: Bot): KillEnderDragonTask {
  return new KillEnderDragonTask(bot);
}

export {
  DragonFightState,
  DIAMOND_ARMOR,
  FOOD_ITEMS,
};
