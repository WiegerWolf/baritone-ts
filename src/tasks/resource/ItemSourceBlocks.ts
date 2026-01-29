/**
 * Common source block mappings for resource tasks
 */

/**
 * Common source block mappings
 */
export const ITEM_SOURCE_BLOCKS: Record<string, string[]> = {
    // Ores
    coal: ['coal_ore', 'deepslate_coal_ore'],
    raw_iron: ['iron_ore', 'deepslate_iron_ore'],
    raw_gold: ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
    raw_copper: ['copper_ore', 'deepslate_copper_ore'],
    diamond: ['diamond_ore', 'deepslate_diamond_ore'],
    emerald: ['emerald_ore', 'deepslate_emerald_ore'],
    lapis_lazuli: ['lapis_ore', 'deepslate_lapis_ore'],
    redstone: ['redstone_ore', 'deepslate_redstone_ore'],
    ancient_debris: ['ancient_debris'],

    // Wood
    oak_log: ['oak_log'],
    birch_log: ['birch_log'],
    spruce_log: ['spruce_log'],
    jungle_log: ['jungle_log'],
    acacia_log: ['acacia_log'],
    dark_oak_log: ['dark_oak_log'],

    // Stone
    cobblestone: ['stone', 'cobblestone'],
    cobbled_deepslate: ['deepslate'],

    // Sand/Gravel
    sand: ['sand'],
    gravel: ['gravel'],
    flint: ['gravel'],

    // Plants
    wheat: ['wheat'],
    carrot: ['carrots'],
    potato: ['potatoes'],
    beetroot: ['beetroots'],

    // Misc
    clay_ball: ['clay'],
    glowstone_dust: ['glowstone'],
    string: ['cobweb'],
};

/**
 * Create a source block map from the common mappings
 */
export function createSourceBlockMap(itemNames: string[]): Map<string, string[]> {
    const map = new Map<string, string[]>();

    for (const name of itemNames) {
        const sources = ITEM_SOURCE_BLOCKS[name];
        if (sources) {
            map.set(name, sources);
        }
    }

    return map;
}
