/**
 * GroundedTask - A task that requires the player to be grounded
 */

import type { ITask } from '../interfaces';
import { Task } from './Task';

/**
 * A task that requires the player to be grounded
 */
export abstract class GroundedTask extends Task {
    shouldForce(interruptingCandidate: ITask | null): boolean {
        // Check if interrupter can override grounded
        if (interruptingCandidate && 'overridesGrounded' in interruptingCandidate) {
            return false;
        }

        // Force if not grounded
        const entity = this.bot.entity;
        if (!entity) return false;

        if (entity.onGround) return false;
        if ((entity as any).isInWater) return false;

        // Check if on ladder/vine
        const block = this.bot.blockAt(entity.position);
        if (block && (block.name === 'ladder' || block.name.includes('vine'))) {
            return false;
        }

        return true; // Not grounded, force continuation
    }
}
