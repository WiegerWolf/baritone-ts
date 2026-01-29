/**
 * Standard priority levels for chains
 */

export const ChainPriority = {
    INACTIVE: 0,
    USER_TASK: 50,
    FOOD: 55,
    DANGER: 100,
    DEATH: 1000,
} as const;
