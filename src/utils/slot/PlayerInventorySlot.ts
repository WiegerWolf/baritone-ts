/**
 * PlayerInventorySlot - Player inventory slot mapping
 */

import { Slot } from './Slot';

/**
 * Player inventory slot (0-35 + armor + offhand)
 */
export class PlayerInventorySlot extends Slot {
    constructor(private index: number) {
        super();
    }

    getInventorySlot(): number {
        return this.index;
    }

    getWindowSlot(): number {
        // Map inventory 0-8 (hotbar) → window 36-44
        // Map inventory 9-35 (main) → window 9-35
        if (this.index < 9) return this.index + 36;
        return this.index;
    }

    toString(): string {
        return `PlayerSlot(${this.index} → window ${this.getWindowSlot()})`;
    }
}
