/**
 * SurviveTask - Automated Survival Gameplay
 * Based on AltoClef's survival automation
 *
 * High-level task that combines multiple survival behaviors
 * to keep the bot alive and progressing.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { CollectWoodTask } from './CollectWoodTask';
import { GetToolTask, type ToolType } from './GetToolTask';
import { GatherResourcesTask } from './GatherResourcesTask';
import { MineOresTask } from './MineOresTask';
import { FarmTask, FarmMode } from './FarmTask';
import { BuildShelterTask, ShelterType } from './BuildShelterTask';
import { CombatTask, CombatStyle } from './CombatTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Survival priorities
 */
export enum SurvivalPriority {
  CRITICAL,  // Immediate danger (combat, drowning)
  URGENT,    // Soon needed (food, shelter at night)
  NORMAL,    // Standard progression (tools, resources)
  LOW,       // Nice to have (better gear)
}

/**
 * State for survival task
 */
enum SurviveState {
  ASSESSING,
  HANDLING_DANGER,
  GETTING_FOOD,
  GETTING_SHELTER,
  GETTING_TOOLS,
  GATHERING_RESOURCES,
  MINING,
  IDLE
}

/**
 * Survival goals
 */
export interface SurvivalGoals {
  /** Minimum food level to maintain */
  minFoodLevel: number;
  /** Minimum health before seeking safety */
  minHealthLevel: number;
  /** Build shelter when dark */
  buildShelterAtNight: boolean;
  /** Fight hostile mobs */
  fightHostileMobs: boolean;
  /** Gather resources for progression */
  gatherResources: boolean;
  /** Mine for ores */
  mineOres: boolean;
  /** Target tool tier */
  targetToolTier: 'wooden' | 'stone' | 'iron' | 'diamond';
}

const DEFAULT_GOALS: SurvivalGoals = {
  minFoodLevel: 14,
  minHealthLevel: 10,
  buildShelterAtNight: true,
  fightHostileMobs: true,
  gatherResources: true,
  mineOres: true,
  targetToolTier: 'iron',
};

/**
 * Task for automated survival gameplay
 */
export class SurviveTask extends Task {
  private goals: SurvivalGoals;
  private state: SurviveState = SurviveState.ASSESSING;
  private assessTimer: TimerGame;
  private hasBasicTools: boolean = false;
  private hasShelter: boolean = false;
  private shelterPosition: Vec3 | null = null;

  constructor(bot: Bot, goals: Partial<SurvivalGoals> = {}) {
    super(bot);
    this.goals = { ...DEFAULT_GOALS, ...goals };
    this.assessTimer = new TimerGame(bot, 5); // Reassess every 5 seconds
  }

  get displayName(): string {
    return `Survive(${SurviveState[this.state]}, health: ${this.bot.health?.toFixed(1) ?? '?'})`;
  }

  onStart(): void {
    this.state = SurviveState.ASSESSING;
    this.hasBasicTools = false;
    this.hasShelter = false;
    this.shelterPosition = null;
  }

  onTick(): Task | null {
    // Periodically reassess priorities
    if (this.assessTimer.elapsed()) {
      this.assessTimer.reset();
      this.state = SurviveState.ASSESSING;
    }

    switch (this.state) {
      case SurviveState.ASSESSING:
        return this.handleAssessing();

      case SurviveState.HANDLING_DANGER:
        return this.handleDanger();

      case SurviveState.GETTING_FOOD:
        return this.handleGettingFood();

      case SurviveState.GETTING_SHELTER:
        return this.handleGettingShelter();

      case SurviveState.GETTING_TOOLS:
        return this.handleGettingTools();

      case SurviveState.GATHERING_RESOURCES:
        return this.handleGatheringResources();

      case SurviveState.MINING:
        return this.handleMining();

      case SurviveState.IDLE:
        return this.handleIdle();

      default:
        return null;
    }
  }

  private handleAssessing(): Task | null {
    // Check priorities in order

    // 1. CRITICAL: Health danger
    const health = this.bot.health ?? 20;
    if (health < this.goals.minHealthLevel) {
      this.state = SurviveState.HANDLING_DANGER;
      return null;
    }

    // 2. CRITICAL: Hostile mobs nearby
    if (this.goals.fightHostileMobs && this.hasHostileMobNearby()) {
      this.state = SurviveState.HANDLING_DANGER;
      return null;
    }

    // 3. URGENT: Food level
    const food = this.bot.food ?? 20;
    if (food < this.goals.minFoodLevel) {
      this.state = SurviveState.GETTING_FOOD;
      return null;
    }

    // 4. URGENT: Night time shelter
    if (this.goals.buildShelterAtNight && this.isNightTime() && !this.hasShelter) {
      this.state = SurviveState.GETTING_SHELTER;
      return null;
    }

    // 5. NORMAL: Basic tools
    if (!this.hasBasicTools && !this.hasRequiredTools()) {
      this.state = SurviveState.GETTING_TOOLS;
      return null;
    }

    // 6. NORMAL: Resource gathering
    if (this.goals.gatherResources && this.needsResources()) {
      this.state = SurviveState.GATHERING_RESOURCES;
      return null;
    }

    // 7. LOW: Mining for ores
    if (this.goals.mineOres) {
      this.state = SurviveState.MINING;
      return null;
    }

    // Nothing urgent
    this.state = SurviveState.IDLE;
    return null;
  }

  private handleDanger(): Task | null {
    // Check health first
    const health = this.bot.health ?? 20;
    if (health < this.goals.minHealthLevel) {
      // Low health - try to eat or flee
      if (this.hasFood()) {
        // Eating is handled by FoodChain
        this.state = SurviveState.ASSESSING;
        return null;
      }
      // Flee from danger
      this.state = SurviveState.GETTING_SHELTER;
      return null;
    }

    // Fight nearby hostile mobs
    if (this.hasHostileMobNearby()) {
      return new CombatTask(this.bot, { style: CombatStyle.HIT_AND_RUN });
    }

    this.state = SurviveState.ASSESSING;
    return null;
  }

  private handleGettingFood(): Task | null {
    const food = this.bot.food ?? 20;
    if (food >= this.goals.minFoodLevel) {
      this.state = SurviveState.ASSESSING;
      return null;
    }

    // Check if we have food
    if (this.hasFood()) {
      // Eating is automatic via FoodChain
      this.state = SurviveState.ASSESSING;
      return null;
    }

    // Need to get food
    // Check for nearby farms
    // For now, gather raw food items
    const foodItems = ['apple', 'bread', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton', 'carrot', 'potato', 'beetroot'];

    return new GatherResourcesTask(this.bot, foodItems, foodItems.map(() => 8));
  }

  private handleGettingShelter(): Task | null {
    // Check if night is over
    if (!this.isNightTime()) {
      this.hasShelter = true; // Survived the night
      this.state = SurviveState.ASSESSING;
      return null;
    }

    // Build emergency shelter
    return new BuildShelterTask(this.bot, {
      type: ShelterType.DIRT_HUT,
      interiorSize: 2,
      wallHeight: 2,
    });
  }

  private handleGettingTools(): Task | null {
    // Check what tools we need
    if (!this.hasPickaxe()) {
      return new GetToolTask(this.bot, 'pickaxe');
    }

    if (!this.hasAxe()) {
      return new GetToolTask(this.bot, 'axe');
    }

    if (!this.hasSword()) {
      return new GetToolTask(this.bot, 'sword');
    }

    // All basic tools acquired
    this.hasBasicTools = true;
    this.state = SurviveState.ASSESSING;
    return null;
  }

  private handleGatheringResources(): Task | null {
    // Gather basic survival resources
    const resources = [];
    const counts = [];

    // Check wood
    if (this.countItem('log') < 16) {
      return new CollectWoodTask(this.bot, 16 - this.countItem('log'));
    }

    // Check cobblestone
    if (this.countItem('cobblestone') < 32) {
      resources.push('cobblestone');
      counts.push(32 - this.countItem('cobblestone'));
    }

    // Check coal/charcoal for torches
    if (this.countItem('coal') + this.countItem('charcoal') < 16) {
      resources.push('coal');
      counts.push(16);
    }

    if (resources.length > 0) {
      return new GatherResourcesTask(this.bot, resources, counts);
    }

    this.state = SurviveState.ASSESSING;
    return null;
  }

  private handleMining(): Task | null {
    // Mine for ores based on target tier
    switch (this.goals.targetToolTier) {
      case 'iron':
        return new MineOresTask(this.bot, {
          targetOres: ['iron', 'coal'],
          targetCount: 16,
        });
      case 'diamond':
        return new MineOresTask(this.bot, {
          targetOres: ['diamond', 'iron', 'coal'],
          targetCount: 8,
        });
      default:
        return new MineOresTask(this.bot, {
          targetOres: ['coal', 'iron'],
          targetCount: 8,
        });
    }
  }

  private handleIdle(): Task | null {
    // Nothing urgent to do - explore or wait
    this.state = SurviveState.ASSESSING;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    // Survive task never really finishes
    return false;
  }

  // ---- Helper Methods ----

  private hasHostileMobNearby(): boolean {
    const hostileMobs = [
      'zombie', 'skeleton', 'spider', 'creeper', 'enderman',
      'witch', 'drowned', 'husk', 'stray', 'phantom',
    ];

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;

      if (hostileMobs.includes(entity.name ?? '')) {
        const dist = this.bot.entity.position.distanceTo(entity.position);
        if (dist <= 16) return true;
      }
    }

    return false;
  }

  private isNightTime(): boolean {
    // Minecraft day: 0-12000 ticks, night: 12000-24000
    const time = this.bot.time?.timeOfDay ?? 0;
    return time >= 12500 && time <= 23500;
  }

  private hasFood(): boolean {
    const foodItems = [
      'apple', 'bread', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken',
      'cooked_mutton', 'cooked_salmon', 'cooked_cod', 'baked_potato',
      'carrot', 'golden_carrot', 'golden_apple', 'melon_slice',
    ];

    for (const item of this.bot.inventory.items()) {
      if (foodItems.includes(item.name)) return true;
    }

    return false;
  }

  private hasRequiredTools(): boolean {
    return this.hasPickaxe() && this.hasAxe() && this.hasSword();
  }

  private hasPickaxe(): boolean {
    return this.bot.inventory.items().some(i => i.name.includes('pickaxe'));
  }

  private hasAxe(): boolean {
    return this.bot.inventory.items().some(i => i.name.includes('_axe'));
  }

  private hasSword(): boolean {
    return this.bot.inventory.items().some(i => i.name.includes('sword'));
  }

  private needsResources(): boolean {
    return this.countItem('log') < 16 ||
           this.countItem('cobblestone') < 32 ||
           (this.countItem('coal') + this.countItem('charcoal')) < 8;
  }

  private countItem(namePart: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name.includes(namePart)) {
        count += item.count;
      }
    }
    return count;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof SurviveTask)) return false;

    return JSON.stringify(this.goals) === JSON.stringify(other.goals);
  }
}

/**
 * Convenience functions
 */
export function survive(bot: Bot): SurviveTask {
  return new SurviveTask(bot);
}

export function survivePassive(bot: Bot): SurviveTask {
  return new SurviveTask(bot, {
    fightHostileMobs: false,
    mineOres: false,
  });
}

export function surviveAndProgress(bot: Bot): SurviveTask {
  return new SurviveTask(bot, {
    targetToolTier: 'diamond',
  });
}
