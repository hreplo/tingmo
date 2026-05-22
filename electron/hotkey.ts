const koffi = require('koffi');

import {
  VK_RMENU,
  getHotkeyEventAction,
} from './hotkey-events';

const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');

const WH_KEYBOARD_LL = 13;
const HC_ACTION = 0;

const KBDLLHOOKSTRUCT = koffi.struct('KBDLLHOOKSTRUCT', {
  vkCode: 'uint32',
  scanCode: 'uint32',
  flags: 'uint32',
  time: 'uint32',
  dwExtraInfo: 'uintptr',
});

const LowLevelKeyboardProc = koffi.proto(
  'intptr __stdcall LowLevelKeyboardProc(int nCode, uintptr wParam, void *lParam)',
);

const SetWindowsHookExW = user32.func(
  'SetWindowsHookExW',
  'void *',
  ['int', 'LowLevelKeyboardProc *', 'void *', 'uint32'],
);
const CallNextHookEx = user32.func(
  'CallNextHookEx',
  'intptr',
  ['void *', 'int', 'uintptr', 'void *'],
);
const UnhookWindowsHookEx = user32.func('UnhookWindowsHookEx', 'bool', ['void *']);
const GetAsyncKeyState = user32.func('GetAsyncKeyState', 'int16', ['int32']);
const GetModuleHandleW = kernel32.func('GetModuleHandleW', 'void *', ['str16']);

let callback: ((pressed: boolean) => void) | null = null;
let hookHandle: unknown = null;
let hookProc: unknown = null;
let wasPressed = false;
let currentVk = VK_RMENU;

export function setHotkeyCallback(cb: (pressed: boolean) => void): void {
  callback = cb;
}

export function startHotkey(vkCode?: number): void {
  if (vkCode !== undefined) currentVk = vkCode;
  if (hookHandle) {
    stopHotkey();
  }

  hookProc = koffi.register((nCode: number, wParam: number, lParam: unknown) => {
    try {
      const event = nCode === HC_ACTION
        ? koffi.decode(lParam, KBDLLHOOKSTRUCT)
        : null;

      const action = getHotkeyEventAction({
        nCode,
        message: Number(wParam),
        vkCode: event?.vkCode ?? 0,
        targetVk: currentVk,
        wasPressed,
      });

      wasPressed = action.nextWasPressed;
      if (action.triggerPressed) {
        callback?.(true);
      }

      if (action.consume) {
        return 1;
      }
    } catch (err) {
      console.error('[Hotkey] Keyboard hook error:', err);
    }

    return CallNextHookEx(hookHandle, nCode, wParam, lParam);
  }, koffi.pointer(LowLevelKeyboardProc));

  const moduleHandle = GetModuleHandleW(null);
  hookHandle = SetWindowsHookExW(WH_KEYBOARD_LL, hookProc, moduleHandle, 0);

  if (!hookHandle) {
    koffi.unregister(hookProc);
    hookProc = null;
    throw new Error('Failed to install right Alt keyboard hook');
  }
}

export function stopHotkey(): void {
  if (hookHandle) {
    UnhookWindowsHookEx(hookHandle);
    hookHandle = null;
  }

  if (hookProc) {
    koffi.unregister(hookProc);
    hookProc = null;
  }

  wasPressed = false;
}

export async function waitForHotkeyRelease(timeoutMs = 1200): Promise<void> {
  const startedAt = Date.now();

  while ((GetAsyncKeyState(currentVk) & 0x8000) !== 0) {
    if (Date.now() - startedAt >= timeoutMs) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
