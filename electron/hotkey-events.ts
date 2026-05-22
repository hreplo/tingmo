export const VK_RMENU = 0xA5;

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
}

const KEY_DOWN_MESSAGES = new Set([WM_KEYDOWN, WM_SYSKEYDOWN]);
const KEY_UP_MESSAGES = new Set([WM_KEYUP, WM_SYSKEYUP]);

export function getHotkeyEventAction(input: HotkeyEventInput): HotkeyEventAction {
  if (input.nCode < 0 || input.vkCode !== input.targetVk) {
    return {
      consume: false,
      nextWasPressed: input.wasPressed,
      triggerPressed: false,
    };
  }

  if (KEY_DOWN_MESSAGES.has(input.message)) {
    return {
      consume: true,
      nextWasPressed: true,
      triggerPressed: !input.wasPressed,
    };
  }

  if (KEY_UP_MESSAGES.has(input.message)) {
    return {
      consume: true,
      nextWasPressed: false,
      triggerPressed: false,
    };
  }

  return {
    consume: false,
    nextWasPressed: input.wasPressed,
    triggerPressed: false,
  };
}
