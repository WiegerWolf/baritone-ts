/**
 * Utility functions for block interactions
 */

import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';

/**
 * Calculate the face vector from reference block to target
 */
export function calculateFaceVector(reference: BlockPos, target: BlockPos): Vec3 {
    return new Vec3(
        Math.sign(target.x - reference.x),
        Math.sign(target.y - reference.y),
        Math.sign(target.z - reference.z)
    );
}

/**
 * Find a suitable reference block for placing at target position
 * Returns null if no valid reference found
 */
export function findReferenceBlock(
    bot: any,
    target: BlockPos,
    canUseBlock: (block: any) => boolean
): { reference: BlockPos; faceVector: Vec3 } | null {
    // Check all 6 adjacent positions
    const offsets = [
        { dx: 0, dy: -1, dz: 0 },  // Below
        { dx: 0, dy: 1, dz: 0 },   // Above
        { dx: -1, dy: 0, dz: 0 },  // West
        { dx: 1, dy: 0, dz: 0 },   // East
        { dx: 0, dy: 0, dz: -1 },  // North
        { dx: 0, dy: 0, dz: 1 }    // South
    ];

    for (const offset of offsets) {
        const refX = target.x + offset.dx;
        const refY = target.y + offset.dy;
        const refZ = target.z + offset.dz;

        const block = bot.blockAt(new Vec3(refX, refY, refZ));
        if (block && canUseBlock(block)) {
            return {
                reference: new BlockPos(refX, refY, refZ),
                faceVector: new Vec3(-offset.dx, -offset.dy, -offset.dz)
            };
        }
    }

    return null;
}

/**
 * Check if player can reach a block for interaction
 */
export function canReachBlock(bot: any, pos: BlockPos, maxReach: number = 4.5): boolean {
    const playerPos = bot.entity.position;
    const blockCenter = new Vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
    const distance = playerPos.distanceTo(blockCenter);
    return distance <= maxReach;
}

/**
 * Calculate rotation needed to look at a block
 */
export function calculateLookRotation(
    playerPos: Vec3,
    targetPos: Vec3
): { yaw: number; pitch: number } {
    const dx = targetPos.x - playerPos.x;
    const dy = targetPos.y - (playerPos.y + 1.62); // Eye height
    const dz = targetPos.z - playerPos.z;

    const yaw = Math.atan2(-dx, -dz);
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    const pitch = Math.atan2(-dy, horizontalDist);

    return { yaw, pitch };
}
