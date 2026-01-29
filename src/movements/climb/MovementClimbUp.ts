import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../../types';
import { LADDER_UP_ONE_COST } from '../../core/ActionCosts';
import { Movement, MovementState } from '../Movement';
import { getMovementHelper } from '../MovementHelper';
import { isClimbable, isVine } from './ClimbUtils';

/**
 * Vine climbing cost (slightly slower than ladder)
 * Vines require the player to be against a solid block
 */
const VINE_UP_ONE_COST = LADDER_UP_ONE_COST * 1.2; // 6.0 ticks

/**
 * MovementClimbUp - Climb up a ladder or vine
 */
export class MovementClimbUp extends Movement {
    private isVineClimb: boolean = false;

    constructor(src: BlockPos, dest: BlockPos) {
        super(src, dest);
    }

    calculateCost(ctx: CalculationContext): number {
        // Check if there's a climbable block at the source position
        const climbBlock = ctx.getBlock(this.src.x, this.src.y, this.src.z);
        if (!isClimbable(climbBlock)) return COST_INF;

        // Check if destination is clear
        const destBlock = ctx.getBlock(this.dest.x, this.dest.y, this.dest.z);
        if (!ctx.canWalkThrough(destBlock)) return COST_INF;

        // Check head space at destination
        const headSpace = ctx.getBlock(this.dest.x, this.dest.y + 1, this.dest.z);
        if (!ctx.canWalkThrough(headSpace)) return COST_INF;

        // Vines require a solid block behind them
        this.isVineClimb = isVine(climbBlock);
        if (this.isVineClimb) {
            // Check if vine has solid backing (simplified check)
            const hasSupport = this.checkVineSupport(ctx, this.src.x, this.src.y, this.src.z);
            if (!hasSupport) return COST_INF;
        }

        // Return appropriate cost
        return this.isVineClimb ? VINE_UP_ONE_COST : LADDER_UP_ONE_COST;
    }

    private checkVineSupport(ctx: CalculationContext, x: number, y: number, z: number): boolean {
        // Check all 4 horizontal directions for a solid block
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dz] of directions) {
            const block = ctx.getBlock(x + dx, y, z + dz);
            if (block && block.boundingBox === 'block') {
                return true;
            }
        }
        return false;
    }

    tick(ctx: CalculationContext, bot: any): MovementStatus {
        if (!this.helper) {
            this.initHelper(bot, ctx);
        }

        switch (this.state) {
            case MovementState.NOT_STARTED:
                // Look up
                bot.look(bot.entity.yaw, -Math.PI / 4);

                // Hold jump to climb
                bot.setControlState('jump', true);
                bot.setControlState('forward', false);

                this.state = MovementState.MOVING;
                break;

            case MovementState.MOVING:
                // Continue holding jump to climb
                bot.setControlState('jump', true);

                // Check if we've reached destination
                const pos = bot.entity.position;
                if (pos.y >= this.dest.y) {
                    this.state = MovementState.FINISHED;
                }

                this.ticksOnCurrent++;
                if (this.ticksOnCurrent > 100) {
                    return MovementStatus.UNREACHABLE;
                }
                break;

            case MovementState.FINISHED:
                bot.setControlState('jump', false);
                return MovementStatus.SUCCESS;
        }

        return MovementStatus.RUNNING;
    }
}
