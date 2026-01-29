/**
 * Slot - Abstract base class for inventory/window slot mapping
 */

/**
 * Slot abstraction for inventory/window mapping
 */
export abstract class Slot {
    abstract getInventorySlot(): number;
    abstract getWindowSlot(): number;
    abstract toString(): string;
}
