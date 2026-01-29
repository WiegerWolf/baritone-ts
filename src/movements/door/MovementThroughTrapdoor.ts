import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../../types';
import { Movement } from '../Movement';
import { MovementState } from '../MovementState';
import { getMovementHelper } from '../MovementHelper';
import { Vec3 } from 'vec3';
import { DOOR_OPEN_COST, isTrapdoor, requiresRedstone } from './DoorUtils';

/**
 * MovementThroughTrapdoor: Move through a trapdoor (vertical movement)
 */
export class MovementThroughTrapdoor extends Movement {
    private trapdoorOpened: boolean = false;
    private direction: 'up' | 'down';

    constructor(src: BlockPos, dest: BlockPos) {
        super(src, dest);
        this.direction = dest.y > src.y ? 'up' : 'down';
    }

    calculateCost(ctx: CalculationContext): number {
        const { src, dest } = this;

        // Find trapdoor position
        const trapdoorY = this.direction === 'up' ? src.y + 1 : src.y;
        const trapdoorBlock = ctx.getBlock(src.x, trapdoorY, src.z);

        if (!trapdoorBlock || !isTrapdoor(trapdoorBlock.name)) {
            return COST_INF;
        }

        // Check if iron trapdoor
        if (requiresRedstone(trapdoorBlock.name)) {
            return COST_INF;
        }

        // Check destination is valid
        if (this.direction === 'up') {
            const destHead = ctx.getBlock(dest.x, dest.y + 1, dest.z);
            if (!ctx.canWalkThrough(destHead)) {
                return COST_INF;
            }
        } else {
            const destFloor = ctx.getBlock(dest.x, dest.y - 1, dest.z);
            if (!ctx.canWalkOn(destFloor)) {
                return COST_INF;
            }
        }

        // Cost: movement + trapdoor interaction
        return (this.direction === 'up' ? 8.0 : 4.0) + DOOR_OPEN_COST;
    }

    tick(ctx: CalculationContext, bot: any): MovementStatus {
        this.ticksOnCurrent++;
        if (!this.helper) this.initHelper(bot, ctx);

        switch (this.state) {
            case MovementState.NOT_STARTED:
                this.state = MovementState.BREAKING;
                return MovementStatus.PREPPING;

            case MovementState.BREAKING:
                if (!this.trapdoorOpened) {
                    const trapdoorY = this.direction === 'up' ? this.src.y + 1 : this.src.y;
                    const trapdoorBlock = bot.blockAt(new Vec3(this.src.x, trapdoorY, this.src.z));

                    if (trapdoorBlock && isTrapdoor(trapdoorBlock.name)) {
                        const isOpen = trapdoorBlock.getProperties?.()?.open === 'true' ||
                            trapdoorBlock.getProperties?.()?.open === true;

                        if (!isOpen) {
                            bot.activateBlock(trapdoorBlock).then(() => {
                                this.trapdoorOpened = true;
                                this.state = MovementState.MOVING;
                            }).catch(() => {
                                this.state = MovementState.MOVING;
                            });
                            return MovementStatus.RUNNING;
                        }
                    }
                    this.trapdoorOpened = true;
                }
                this.state = MovementState.MOVING;
                return MovementStatus.RUNNING;

            case MovementState.MOVING:
                if (this.helper!.isAtPosition(this.dest, 0.4)) {
                    return MovementStatus.SUCCESS;
                }

                if (this.direction === 'up') {
                    bot.setControlState('jump', true);
                }

                this.helper!.moveToward(this.dest, 0.3, false, false);
                return MovementStatus.RUNNING;

            default:
                return MovementStatus.FAILED;
        }
    }

    reset(): void {
        super.reset();
        this.trapdoorOpened = false;
    }
}
