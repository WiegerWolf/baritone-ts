/**
 * OffhandSlot - Offhand slot mapping
 */

import { Slot } from './Slot';

/**
 * Offhand slot
 */
export class OffhandSlot extends Slot {
    static INSTANCE = new OffhandSlot();

    private constructor() {
        super();
    }

    getInventorySlot(): number {
        return 45;
    }

    getWindowSlot(): number {
        return 45;
    }

    toString(): string {
        return 'OffhandSlot';
    }
}
