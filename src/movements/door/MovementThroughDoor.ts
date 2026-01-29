import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../../types';
import { WALK_ONE_BLOCK_COST } from '../../core/ActionCosts';
import { Movement } from '../Movement';
import { MovementState } from '../MovementState';
import { getMovementHelper } from '../MovementHelper';
import { Vec3 } from 'vec3';
import { DOOR_OPEN_COST, isOpenable, requiresRedstone } from './DoorUtils';

/**
 * MovementThroughDoor: Walk through a door (opening it if needed)
 */
export class MovementThroughDoor extends Movement {
    private doorOpened: boolean = false;
    private doorPos: BlockPos | null = null;

    constructor(src: BlockPos, dest: BlockPos, doorPos?: BlockPos) {
        super(src, dest);
        this.doorPos = doorPos || null;
    }

    calculateCost(ctx: CalculationContext): number {
        const { src, dest } = this;

        // Check destination floor
        const floor = ctx.getBlock(dest.x, dest.y - 1, dest.z);
        if (!ctx.canWalkOn(floor)) {
            return COST_INF;
        }

        // Find the door between src and dest
        const doorBlock = this.findDoorBetween(ctx, src, dest);
        if (!doorBlock) {
            // No door found, can't use this movement
            return COST_INF;
        }

        // Check if iron door (needs redstone)
        if (requiresRedstone(doorBlock.name)) {
            // Can't open iron doors without redstone
            return COST_INF;
        }

        // Store door position for later
        this.doorPos = new BlockPos(doorBlock.position.x, doorBlock.position.y, doorBlock.position.z);

        // Cost: walk + door open
        return WALK_ONE_BLOCK_COST + DOOR_OPEN_COST;
    }

    /**
     * Find a door between source and destination
     */
    private findDoorBetween(ctx: CalculationContext, src: BlockPos, dest: BlockPos): any | null {
        // Check at dest feet level
        const destBlock = ctx.getBlock(dest.x, dest.y, dest.z);
        if (destBlock && isOpenable(destBlock.name)) {
            return destBlock;
        }

        // Check at dest head level
        const destHead = ctx.getBlock(dest.x, dest.y + 1, dest.z);
        if (destHead && isOpenable(destHead.name)) {
            return destHead;
        }

        // Check at src feet level
        const srcBlock = ctx.getBlock(src.x, src.y, src.z);
        if (srcBlock && isOpenable(srcBlock.name)) {
            return srcBlock;
        }

        // Check at src head level
        const srcHead = ctx.getBlock(src.x, src.y + 1, src.z);
        if (srcHead && isOpenable(srcHead.name)) {
            return srcHead;
        }

        return null;
    }

    tick(ctx: CalculationContext, bot: any): MovementStatus {
        this.ticksOnCurrent++;
        if (!this.helper) this.initHelper(bot, ctx);

        switch (this.state) {
            case MovementState.NOT_STARTED:
                this.state = MovementState.BREAKING; // Reuse as "opening" state
                return MovementStatus.PREPPING;

            case MovementState.BREAKING: // Opening door
                if (this.doorPos && !this.doorOpened) {
                    const doorBlock = bot.blockAt(new Vec3(this.doorPos.x, this.doorPos.y, this.doorPos.z));

                    if (doorBlock && isOpenable(doorBlock.name)) {
                        // Check if already open
                        const isOpen = doorBlock.getProperties?.()?.open === 'true' ||
                            doorBlock.getProperties?.()?.open === true;

                        if (!isOpen) {
                            // Open the door
                            bot.activateBlock(doorBlock).then(() => {
                                this.doorOpened = true;
                                this.state = MovementState.MOVING;
                            }).catch(() => {
                                // Failed to open, try to move anyway
                                this.state = MovementState.MOVING;
                            });
                            return MovementStatus.RUNNING;
                        }
                    }
                    this.doorOpened = true;
                }
                this.state = MovementState.MOVING;
                return MovementStatus.RUNNING;

            case MovementState.MOVING:
                // Check if we've reached destination
                if (this.helper!.isAtPosition(this.dest)) {
                    this.state = MovementState.FINISHED;
                    return MovementStatus.SUCCESS;
                }

                // Move toward destination
                this.helper!.moveToward(this.dest, 0.25, false, false);
                return MovementStatus.RUNNING;

            case MovementState.FINISHED:
                return MovementStatus.SUCCESS;

            default:
                return MovementStatus.FAILED;
        }
    }

    reset(): void {
        super.reset();
        this.doorOpened = false;
    }
}
