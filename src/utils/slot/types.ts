/**
 * Types and enums for slot handling
 */

/**
 * Click types for inventory interactions
 */
export enum ClickType {
    LEFT_CLICK = 'left',
    RIGHT_CLICK = 'right',
    SHIFT_CLICK = 'shift',
    DROP = 'drop',
    DROP_STACK = 'drop_stack',
    SWAP_HOTBAR = 'swap',
}

/**
 * Click mode mapping for mineflayer
 */
export interface ClickParams {
    button: 0 | 1;
    mode: 0 | 1 | 4 | 2;
}

/**
 * Pending click action in the queue
 */
export interface PendingClick {
    slot: number;
    type: ClickType;
    hotbarSlot?: number;
    resolve: (success: boolean) => void;
    reject: (error: Error) => void;
}

/**
 * SlotHandler configuration
 */
export interface SlotHandlerConfig {
    /** Minimum time between clicks (ms) */
    clickCooldown: number;
    /** Maximum retries for failed clicks */
    maxRetries: number;
    /** Timeout for click operations (ms) */
    clickTimeout: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: SlotHandlerConfig = {
    clickCooldown: 100, // 100ms = safe for most servers
    maxRetries: 3,
    clickTimeout: 1000,
};

/**
 * Click parameter mappings
 */
export const CLICK_PARAMS: Record<ClickType, ClickParams> = {
    [ClickType.LEFT_CLICK]: { button: 0, mode: 0 },
    [ClickType.RIGHT_CLICK]: { button: 1, mode: 0 },
    [ClickType.SHIFT_CLICK]: { button: 0, mode: 1 },
    [ClickType.DROP]: { button: 0, mode: 4 },
    [ClickType.DROP_STACK]: { button: 1, mode: 4 },
    [ClickType.SWAP_HOTBAR]: { button: 0, mode: 2 },
};
