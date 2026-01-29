/**
 * Utility functions for climbable blocks (ladders and vines)
 */

/**
 * Check if a block is climbable (ladder or vine)
 */
export function isClimbable(block: any): boolean {
    if (!block) return false;
    const name = block.name || '';
    return name === 'ladder' || name === 'vine' || name === 'twisting_vines' ||
        name === 'weeping_vines' || name === 'twisting_vines_plant' ||
        name === 'weeping_vines_plant' || name === 'cave_vines' ||
        name === 'cave_vines_plant';
}

/**
 * Check if block is a ladder specifically
 */
export function isLadder(block: any): boolean {
    if (!block) return false;
    return block.name === 'ladder';
}

/**
 * Check if block is a vine type
 */
export function isVine(block: any): boolean {
    if (!block) return false;
    const name = block.name || '';
    return name === 'vine' || name === 'twisting_vines' || name === 'weeping_vines' ||
        name === 'twisting_vines_plant' || name === 'weeping_vines_plant' ||
        name === 'cave_vines' || name === 'cave_vines_plant';
}
