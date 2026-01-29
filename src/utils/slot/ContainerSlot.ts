/**
 * ContainerSlot - Container slot mapping (chest, furnace, etc.)
 */

import { Slot } from './Slot';

/**
 * Container slot (chest, furnace, etc.)
 */
export class ContainerSlot extends Slot {
    constructor(private windowSlot: number) {
        super();
    }

    getInventorySlot(): number {
        // Container slots are window-relative
        return this.windowSlot;
    }

    getWindowSlot(): number {
        return this.windowSlot;
    }

    toString(): string {
        return `ContainerSlot(${this.windowSlot})`;
    }
}
