/**
 * Tests for ResourceTask ItemTarget helper
 *
 * These tests verify that the itemTarget helper function works correctly:
 * - WHY: Resource collection is fundamental to Minecraft progression.
 * - INTENT: Validate item target creation with single and multiple items.
 */

import { itemTarget } from './ResourceTask';

describe('ItemTarget helper', () => {
  it('should create item target with single item', () => {
    const target = itemTarget('diamond', 10);
    expect(target.items).toEqual(['diamond']);
    expect(target.targetCount).toBe(10);
  });

  it('should create item target with multiple items', () => {
    const target = itemTarget(['coal', 'charcoal'], 5);
    expect(target.items).toEqual(['coal', 'charcoal']);
    expect(target.targetCount).toBe(5);
  });
});
