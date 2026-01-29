/**
 * StrafeAndDodgeTask - Strafe Around Target While Avoiding Projectiles
 *
 * WHY: When fighting ranged enemies, strafing makes it harder
 * for them to hit us while we can still attack.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Task } from '../Task';
import type { ITask } from '../interfaces';

/**
 * Task to strafe around a target while avoiding projectiles.
 *
 * WHY: When fighting ranged enemies, strafing makes it harder
 * for them to hit us while we can still attack.
 */
export class StrafeAndDodgeTask extends Task {
  private targetEntity: Entity | null = null;
  private strafeDirection: number = 1; // 1 = right, -1 = left
  private strafeTimer: number = 0;

  constructor(bot: Bot, targetEntityId?: number) {
    super(bot);
    if (targetEntityId !== undefined) {
      this.targetEntity = bot.entities[targetEntityId] ?? null;
    }
  }

  get displayName(): string {
    return 'StrafeAndDodge';
  }

  onStart(): void {
    this.strafeDirection = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = 0;
  }

  onTick(): Task | null {
    // Update target if needed
    if (!this.targetEntity || !this.targetEntity.isValid) {
      this.targetEntity = this.findNearestEnemy();
    }

    if (!this.targetEntity) {
      return null;
    }

    // Strafe around target
    this.strafeTimer++;

    // Change strafe direction periodically
    if (this.strafeTimer > 40) { // About 2 seconds
      this.strafeDirection *= -1;
      this.strafeTimer = 0;
    }

    // Execute strafe
    this.bot.clearControlStates();
    if (this.strafeDirection > 0) {
      this.bot.setControlState('right', true);
    } else {
      this.bot.setControlState('left', true);
    }

    // Look at target
    this.bot.lookAt(this.targetEntity.position.offset(0, 1.6, 0));

    return null;
  }

  private findNearestEnemy(): Entity | null {
    const playerPos = this.bot.entity.position;
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    const hostileTypes = ['skeleton', 'stray', 'pillager', 'blaze', 'ghast', 'drowned'];

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;

      const name = entity.name ?? '';
      if (!hostileTypes.some(type => name.includes(type))) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return false; // Continuous task
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return other instanceof StrafeAndDodgeTask;
  }
}

/**
 * Helper to strafe and dodge
 */
export function strafeAndDodge(bot: Bot, targetId?: number): StrafeAndDodgeTask {
  return new StrafeAndDodgeTask(bot, targetId);
}
