/**
 * ContainerItemTarget - Shared types for container operations
 */

/**
 * Item target for container operations
 */
export interface ContainerItemTarget {
  /** Item name(s) to match */
  items: string | string[];
  /** Target count to have */
  targetCount: number;
}

/**
 * Create item target
 */
export function containerItemTarget(items: string | string[], count: number): ContainerItemTarget {
  return { items, targetCount: count };
}

/**
 * Check if an item matches a target
 */
export function itemMatchesTarget(itemName: string, target: ContainerItemTarget): boolean {
  const items = Array.isArray(target.items) ? target.items : [target.items];
  return items.some(name => itemName === name || itemName.includes(name));
}
