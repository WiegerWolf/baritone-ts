/**
 * InputControls - Input State Management
 * Based on AltoClef/BaritonePlus InputControls.java
 *
 * Manages keyboard/mouse input state for bot control.
 * Handles one-frame presses, holds, and releases.
 *
 * Mineflayer equivalent of Minecraft's KeyBinding system.
 */

import type { Bot } from 'mineflayer';

/**
 * Input types that can be controlled
 * Mapped to Mineflayer control states
 */
export enum Input {
  MOVE_FORWARD = 'forward',
  MOVE_BACK = 'back',
  MOVE_LEFT = 'left',
  MOVE_RIGHT = 'right',
  JUMP = 'jump',
  SNEAK = 'sneak',
  SPRINT = 'sprint',
  // Attack and use are handled differently in mineflayer
  CLICK_LEFT = 'attack',
  CLICK_RIGHT = 'use',
}

/**
 * Mineflayer control state keys
 */
type ControlState = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak' | 'sprint';

/**
 * Check if input maps to a control state
 */
function isControlState(input: Input): input is Input.MOVE_FORWARD | Input.MOVE_BACK |
    Input.MOVE_LEFT | Input.MOVE_RIGHT | Input.JUMP | Input.SNEAK | Input.SPRINT {
  return input !== Input.CLICK_LEFT && input !== Input.CLICK_RIGHT;
}

/**
 * InputControls manages bot input state
 */
export class InputControls {
  private bot: Bot;

  /**
   * Inputs queued for release on next tick
   */
  private toUnpress: Set<Input> = new Set();

  /**
   * Inputs waiting for release before they can be pressed again
   */
  private waitForRelease: Set<Input> = new Set();

  /**
   * Currently held inputs
   */
  private held: Set<Input> = new Set();

  constructor(bot: Bot) {
    this.bot = bot;
  }

  /**
   * Try to press an input for one frame.
   * If input is already waiting for release, does nothing.
   * Will auto-release on next tick.
   */
  tryPress(input: Input): void {
    // Already pressed and waiting for release
    if (this.waitForRelease.has(input)) {
      return;
    }

    this.setInputState(input, true);
    this.toUnpress.add(input);
    this.waitForRelease.add(input);
  }

  /**
   * Hold an input continuously.
   * Must call release() to stop.
   */
  hold(input: Input): void {
    this.setInputState(input, true);
    this.held.add(input);
  }

  /**
   * Release a held input.
   */
  release(input: Input): void {
    this.setInputState(input, false);
    this.held.delete(input);
  }

  /**
   * Release all held inputs.
   */
  releaseAll(): void {
    for (const input of this.held) {
      this.setInputState(input, false);
    }
    this.held.clear();
    this.toUnpress.clear();
    this.waitForRelease.clear();
  }

  /**
   * Check if an input is currently held.
   */
  isHeldDown(input: Input): boolean {
    if (isControlState(input)) {
      return this.bot.controlState[input as ControlState];
    }
    return this.held.has(input);
  }

  /**
   * Force look at a specific yaw/pitch.
   */
  forceLook(yaw: number, pitch: number): void {
    if (this.bot.entity) {
      this.bot.entity.yaw = yaw;
      this.bot.entity.pitch = pitch;
      // Also force look with mineflayer
      this.bot.look(yaw, pitch, true);
    }
  }

  /**
   * Force look at a position.
   */
  forceLookAt(x: number, y: number, z: number): void {
    this.bot.lookAt({ x, y, z } as any, true);
  }

  /**
   * Called before user input commands each tick.
   * Releases any single-frame presses from previous tick.
   */
  onTickPre(): void {
    // Release all single-frame presses
    for (const input of this.toUnpress) {
      if (!this.held.has(input)) {
        this.setInputState(input, false);
      }
    }
    this.toUnpress.clear();
  }

  /**
   * Called after user input commands each tick.
   * Clears the wait-for-release set.
   */
  onTickPost(): void {
    this.waitForRelease.clear();
  }

  /**
   * Set the input state.
   */
  private setInputState(input: Input, pressed: boolean): void {
    if (isControlState(input)) {
      this.bot.setControlState(input as ControlState, pressed);
    } else if (input === Input.CLICK_LEFT || input === Input.CLICK_RIGHT) {
      // Attack/Use handling differs - these are typically one-shot actions
      // Store state for action handlers to check
      if (pressed) {
        this.held.add(input);
      } else {
        this.held.delete(input);
      }
    }
  }

  /**
   * Perform an attack action (left click).
   */
  attack(): void {
    // In mineflayer, attacks are explicit method calls, not control states
    // This is handled by PlayerExtraController.attack()
    this.tryPress(Input.CLICK_LEFT);
  }

  /**
   * Perform a use action (right click).
   */
  use(): void {
    // In mineflayer, use is context-dependent
    this.tryPress(Input.CLICK_RIGHT);
  }

  /**
   * Check if attack is being held.
   */
  isAttacking(): boolean {
    return this.held.has(Input.CLICK_LEFT);
  }

  /**
   * Check if use is being held.
   */
  isUsing(): boolean {
    return this.held.has(Input.CLICK_RIGHT);
  }
}

/**
 * Create an InputControls instance for a bot.
 */
export function createInputControls(bot: Bot): InputControls {
  return new InputControls(bot);
}

export default InputControls;
