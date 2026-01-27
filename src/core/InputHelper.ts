import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { getRotationHelper, RotationHelper, RotationConfig } from './RotationHelper';

/**
 * InputHelper provides an abstraction layer for controlling bot movement
 * Based on Baritone's InputOverrideHandler
 *
 * Key features:
 * - Clean interface for movement controls
 * - Integration with rotation smoothing
 * - Sprint management with stamina awareness
 * - Input state tracking
 * - Override system for temporary control takeover
 */

/**
 * Control states that can be managed
 */
export type ControlState = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak' | 'sprint';

/**
 * Input state snapshot
 */
export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sneak: boolean;
  sprint: boolean;
}

/**
 * Input override with priority
 */
interface InputOverride {
  state: Partial<InputState>;
  priority: number;
  source: string;
}

export class InputHelper {
  private bot: Bot;
  private rotationHelper: RotationHelper;

  // Current input state
  private state: InputState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    sneak: false,
    sprint: false
  };

  // Input overrides (higher priority wins)
  private overrides: Map<string, InputOverride> = new Map();

  // Sprint management
  private sprintEnabled: boolean = true;
  private sprintCooldown: number = 0;
  private sprintTicksSinceStart: number = 0;

  // Movement state
  private movingToward: Vec3 | null = null;
  private movementTolerance: number = 0.2;

  constructor(bot: Bot, rotationConfig?: Partial<RotationConfig>) {
    this.bot = bot;
    this.rotationHelper = getRotationHelper(bot, rotationConfig);
  }

  /**
   * Set a control state
   */
  setControl(control: ControlState, value: boolean): void {
    this.state[control] = value;
  }

  /**
   * Get current control state
   */
  getControl(control: ControlState): boolean {
    // Check for overrides first
    for (const override of this.overrides.values()) {
      if (override.state[control] !== undefined) {
        return override.state[control]!;
      }
    }
    return this.state[control];
  }

  /**
   * Set multiple controls at once
   */
  setControls(controls: Partial<InputState>): void {
    Object.assign(this.state, controls);
  }

  /**
   * Clear all control states
   */
  clearControls(): void {
    this.state = {
      forward: false,
      back: false,
      left: false,
      right: false,
      jump: false,
      sneak: false,
      sprint: false
    };
    this.movingToward = null;
  }

  /**
   * Add an input override
   */
  addOverride(source: string, state: Partial<InputState>, priority: number = 0): void {
    this.overrides.set(source, { state, priority, source });
  }

  /**
   * Remove an input override
   */
  removeOverride(source: string): void {
    this.overrides.delete(source);
  }

  /**
   * Check if an override is active
   */
  hasOverride(source: string): boolean {
    return this.overrides.has(source);
  }

  /**
   * Clear all overrides
   */
  clearOverrides(): void {
    this.overrides.clear();
  }

  /**
   * Move toward a position
   */
  moveToward(position: Vec3, tolerance: number = 0.2, sprint: boolean = false, jump: boolean = false): boolean {
    this.movingToward = position;
    this.movementTolerance = tolerance;

    const botPos = this.bot.entity.position;
    const dx = position.x - botPos.x;
    const dz = position.z - botPos.z;
    const distSq = dx * dx + dz * dz;

    // Check if arrived
    if (distSq < tolerance * tolerance) {
      this.clearControls();
      this.movingToward = null;
      return true;
    }

    // Look toward destination
    this.rotationHelper.lookAt(position.offset(0, this.bot.entity.height * 0.5, 0));

    // Set movement controls
    this.state.forward = true;
    this.state.back = false;
    this.state.jump = jump;

    // Handle sprint
    if (sprint && this.canSprint()) {
      this.state.sprint = true;
    } else {
      this.state.sprint = false;
    }

    return false;
  }

  /**
   * Strafe left/right while facing forward
   */
  strafe(direction: 'left' | 'right', amount: number = 1): void {
    this.state.left = direction === 'left';
    this.state.right = direction === 'right';
  }

  /**
   * Jump
   */
  jump(): void {
    if (this.bot.entity.onGround) {
      this.state.jump = true;
    }
  }

  /**
   * Sneak
   */
  sneak(enabled: boolean = true): void {
    this.state.sneak = enabled;
  }

  /**
   * Sprint (if allowed)
   */
  sprint(enabled: boolean = true): void {
    if (enabled && this.canSprint()) {
      this.state.sprint = true;
    } else {
      this.state.sprint = false;
    }
  }

  /**
   * Check if sprinting is possible
   */
  canSprint(): boolean {
    if (!this.sprintEnabled) return false;
    if (this.sprintCooldown > 0) return false;
    if (this.bot.food < 6) return false; // Need food to sprint
    if (this.state.sneak) return false; // Can't sprint while sneaking
    if ((this.bot.entity as any).isInWater) return false; // Can't sprint in water (without dolphin's grace)
    return true;
  }

  /**
   * Enable/disable sprinting globally
   */
  setSprintEnabled(enabled: boolean): void {
    this.sprintEnabled = enabled;
    if (!enabled) {
      this.state.sprint = false;
    }
  }

  /**
   * Look at a position (delegates to rotation helper)
   */
  lookAt(position: Vec3, priority: number = 0, instant: boolean = false): void {
    this.rotationHelper.lookAt(position, priority, instant);
  }

  /**
   * Look at a block (delegates to rotation helper)
   */
  lookAtBlock(x: number, y: number, z: number, face?: Vec3, priority: number = 0): void {
    this.rotationHelper.lookAtBlock(x, y, z, face, priority);
  }

  /**
   * Check if looking at a position
   */
  isLookingAt(position: Vec3, threshold: number = 5): boolean {
    return this.rotationHelper.isLookingAt(position, threshold);
  }

  /**
   * Get rotation helper for direct access
   */
  getRotationHelper(): RotationHelper {
    return this.rotationHelper;
  }

  /**
   * Tick the input helper - call every physics tick
   */
  tick(): void {
    // Update rotation
    this.rotationHelper.tick();

    // Update sprint cooldown
    if (this.sprintCooldown > 0) {
      this.sprintCooldown--;
    }

    // Track sprint duration
    if (this.state.sprint) {
      this.sprintTicksSinceStart++;
    } else {
      this.sprintTicksSinceStart = 0;
    }

    // Apply controls to bot
    this.applyControls();
  }

  /**
   * Apply current control state to bot
   */
  private applyControls(): void {
    // Build effective state (considering overrides)
    const effective = this.getEffectiveState();

    // Apply to bot
    this.bot.setControlState('forward', effective.forward);
    this.bot.setControlState('back', effective.back);
    this.bot.setControlState('left', effective.left);
    this.bot.setControlState('right', effective.right);
    this.bot.setControlState('jump', effective.jump);
    this.bot.setControlState('sneak', effective.sneak);
    this.bot.setControlState('sprint', effective.sprint);
  }

  /**
   * Get effective state after applying overrides
   */
  private getEffectiveState(): InputState {
    const effective = { ...this.state };

    // Sort overrides by priority (higher first)
    const sortedOverrides = Array.from(this.overrides.values())
      .sort((a, b) => b.priority - a.priority);

    // Apply overrides
    for (const override of sortedOverrides) {
      Object.assign(effective, override.state);
    }

    return effective;
  }

  /**
   * Get current input state
   */
  getState(): InputState {
    return { ...this.state };
  }

  /**
   * Get effective state (with overrides applied)
   */
  getEffectiveInputState(): InputState {
    return this.getEffectiveState();
  }

  /**
   * Check if any movement control is active
   */
  isMoving(): boolean {
    const state = this.getEffectiveState();
    return state.forward || state.back || state.left || state.right;
  }

  /**
   * Stop all movement
   */
  stop(): void {
    this.clearControls();
    this.clearOverrides();
    this.rotationHelper.cancel();
    this.applyControls();
  }
}

/**
 * Shared instance cache (one per bot)
 */
const helpers = new WeakMap<any, InputHelper>();

/**
 * Get or create InputHelper for a bot
 */
export function getInputHelper(bot: Bot, rotationConfig?: Partial<RotationConfig>): InputHelper {
  let helper = helpers.get(bot);
  if (!helper) {
    helper = new InputHelper(bot, rotationConfig);
    helpers.set(bot, helper);
  }
  return helper;
}
