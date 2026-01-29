import { describe, it, expect } from 'bun:test';
import {
  HOSTILE_MOBS,
  HOSTILE_MOB_DROPS,
  OBSIDIAN_CAST_FRAME,
} from './MiscTask';

describe('Constants', () => {
  describe('HOSTILE_MOBS', () => {
    it('WHY: Includes common overworld hostile mobs', () => {
      expect(HOSTILE_MOBS).toContain('zombie');
      expect(HOSTILE_MOBS).toContain('skeleton');
      expect(HOSTILE_MOBS).toContain('spider');
      expect(HOSTILE_MOBS).toContain('creeper');
    });

    it('WHY: Includes enderman for pearl collection', () => {
      expect(HOSTILE_MOBS).toContain('enderman');
    });

    it('WHY: Includes slime for slime ball collection', () => {
      expect(HOSTILE_MOBS).toContain('slime');
    });

    it('WHY: Includes mob variants', () => {
      expect(HOSTILE_MOBS).toContain('husk');
      expect(HOSTILE_MOBS).toContain('stray');
      expect(HOSTILE_MOBS).toContain('drowned');
    });
  });

  describe('HOSTILE_MOB_DROPS', () => {
    it('WHY: Includes common mob drops', () => {
      expect(HOSTILE_MOB_DROPS).toContain('rotten_flesh');
      expect(HOSTILE_MOB_DROPS).toContain('bone');
      expect(HOSTILE_MOB_DROPS).toContain('arrow');
      expect(HOSTILE_MOB_DROPS).toContain('string');
      expect(HOSTILE_MOB_DROPS).toContain('gunpowder');
    });

    it('WHY: Includes valuable drops', () => {
      expect(HOSTILE_MOB_DROPS).toContain('ender_pearl');
      expect(HOSTILE_MOB_DROPS).toContain('spider_eye');
    });
  });

  describe('OBSIDIAN_CAST_FRAME', () => {
    it('WHY: Has 6 frame positions for bucket casting', () => {
      expect(OBSIDIAN_CAST_FRAME.length).toBe(6);
    });

    it('WHY: Includes below position (floor)', () => {
      const below = OBSIDIAN_CAST_FRAME.find(v => v.y === -1);
      expect(below).toBeDefined();
    });

    it('WHY: Includes side positions (walls)', () => {
      const sides = OBSIDIAN_CAST_FRAME.filter(v => v.y === 0);
      expect(sides.length).toBeGreaterThanOrEqual(4);
    });

    it('WHY: Includes elevated position for water placement', () => {
      const elevated = OBSIDIAN_CAST_FRAME.find(v => v.y === 1);
      expect(elevated).toBeDefined();
    });
  });
});
