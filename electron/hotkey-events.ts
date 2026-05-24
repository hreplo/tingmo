export const VK_RMENU = 0xA5;
export const VK_ESCAPE = 0x1B;

export const WM_KEYDOWN = 0x0100;
export const WM_KEYUP = 0x0101;
export const WM_SYSKEYDOWN = 0x0104;
export const WM_SYSKEYUP = 0x0105;

export interface HotkeyEventInput {
  nCode: number;
  message: number;
  vkCode: number;
  targetVk: number;
  wasPressed: boolean;
}

export interface HotkeyEventAction {
  consume: boolean;
  nextWasPressed: boolean;
  triggerPressed: boolean;
  triggerReleased: boolean;
}

export const KEY_DOWN_MESSAGES = new Set([WM_KEYDOWN, WM_SYSKEYDOWN]);
export const KEY_UP_MESSAGES = new Set([WM_KEYUP, WM_SYSKEYUP]);

export function getHotkeyEventAction(input: HotkeyEventInput): HotkeyEventAction {
  if (input.nCode < 0 || input.vkCode !== input.targetVk) {
    return {
      consume: false,
      nextWasPressed: input.wasPressed,
      triggerPressed: false,
      triggerReleased: false,
    };
  }

  if (KEY_DOWN_MESSAGES.has(input.message)) {
    // Consume key-down to prevent Alt from stealing focus / activating menus
    // in the active app.  A synthetic key-up is injected immediately after
    // (see hotkey.ts) so Windows does not think Alt is stuck.
    return {
      consume: true,
      nextWasPressed: true,
      triggerPressed: !input.wasPressed,
      triggerReleased: false,
    };
  }

  if (KEY_UP_MESSAGES.has(input.message)) {
    // Real key-up: consume to match the consumed key-down (no orphan event).
    // Injected key-ups are detected in hotkey.ts and passed through.
    return {
      consume: true,
      nextWasPressed: false,
      triggerPressed: false,
      triggerReleased: input.wasPressed,
    };
  }

  return {
    consume: false,
    nextWasPressed: input.wasPressed,
    triggerPressed: false,
    triggerReleased: false,
  };
}
