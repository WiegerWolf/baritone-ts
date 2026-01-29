/**
 * ArmorSlot - Armor slot mapping
 */

import { Slot } from './Slot';

/**
 * Armor slot mapping
 */
export class ArmorSlot extends Slot {
    static HELMET = new ArmorSlot(5);
    static CHESTPLATE = new ArmorSlot(6);
    static LEGGINGS = new ArmorSlot(7);
    static BOOTS = new ArmorSlot(8);

    private constructor(private windowSlot: number) {
        super();
    }

    getInventorySlot(): number {
        return this.windowSlot;
    }

    getWindowSlot(): number {
        return this.windowSlot;
    }

    toString(): string {
        const names: Record<number, string> = {
            5: 'Helmet',
            6: 'Chestplate',
            7: 'Leggings',
            8: 'Boots',
        };
        return `ArmorSlot(${names[this.windowSlot]})`;
    }
}
