# TingMo 听墨

> AI-powered voice input for Windows | 🎤 Vibe Coding Project

![version](https://img.shields.io/badge/version-V0.3.0-orange)
![platform](https://img.shields.io/badge/platform-Windows%20x64-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![vibe](https://img.shields.io/badge/vibe%20coding-yes-ff69b4)

*[中文版本](README.md) is also available.*

Press a hotkey, speak, release — your words appear at the cursor. Fully offline ASR with optional LLM refinement.

## Features

- **Local ASR** — SenseVoiceSmall ONNX, fully offline, 5 languages (zh/en/ja/ko/yue)
- **Built-in Punctuation** — ITN included in the model, no extra punctuation model needed
- **LLM Refinement** (optional) — Removes filler words, auto-structures, preserves custom terms
- **Translation** — ASR → translate to target language
- **Dictionary** — Add custom terms for fuzzy correction and LLM context preservation
- **5-Language UI** — 简体中文 / 繁體中文 / English / 日本語 / 한국어
- **Minimal UI** — Floating capsule appears only during recording

## Installation

Download `TingMo-Setup-0.3.exe` from [Releases](https://github.com/shaoxin12/tingmo/releases).

First launch downloads model files (~230MB) automatically.

## How to Use

| Action | How |
|--------|-----|
| Voice input | Press hotkey → speak → press again |
| Translate | Hold translate modifier + press hotkey |
| Settings | Right-click tray icon → Settings |

> Hotkeys are customizable in Settings. Default voice key is Right Alt.

## LLM Refinement (Optional)

1. Settings → Model → LLM
2. Enter your OpenAI-compatible API Key (GPT-4o-mini / Claude / DeepSeek / Qwen supported)
3. Enable "Refine"

Without LLM, SenseVoice result with built-in punctuation is injected directly — works offline.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Electron 33 + React 18 + TypeScript |
| ASR | SenseVoiceSmall ONNX (sherpa-onnx) |
| LLM | OpenAI-compatible API |
| Audio | Web Audio API → 16kHz resample → WAV |
| Injection | Win32 `SendInput` + `KEYEVENTF_UNICODE` (koffi FFI) |
| State | Zustand |
| i18n | React Context, 5 languages |

## Model Files

Placed in `%APPDATA%/TingMo/models/funasr/`:

| File | Size |
|------|------|
| `model.int8.onnx` | 229 MB |
| `tokens.txt` | 309 KB |
| `am.mvn` | 11 KB |

## Development

```bash
npm install
npm run dev            # Terminal 1: Vite
npm run electron:dev   # Terminal 2: Build + Electron
```

## About

This is a vibe coding project — built through rapid AI-assisted iteration. Issues and PRs welcome.

## License

MIT
