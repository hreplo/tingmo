# TingMo 听墨

**Desktop AI Voice Input for Windows** — press Right Alt, speak, release, and your speech becomes text at the cursor. Fully offline ASR with optional LLM refinement.

![version](https://img.shields.io/badge/version-0.2-orange)
![platform](https://img.shields.io/badge/platform-Windows%20x64-blue)
![license](https://img.shields.io/badge/license-MIT-green)

## Features

- **Local ASR** — Paraformer-large INT8 ONNX, 228MB, runs entirely offline
- **Smart Punctuation** — CT-Transformer model restores `，。？！、` from raw text
- **LLM Refinement** — Optional AI polish: removes filler words, auto-structures, preserves custom vocabulary
- **Translation Mode** — Right Alt + Right Shift to translate recognized speech
- **Dictionary** — Add custom terms for fuzzy correction and LLM preservation
- **5-Language UI** — 简体中文 / 繁體中文 / English / 日本語 / 한국어
- **Minimal UI** — Floating capsule (140×48px) appears only during recording

## Installation

Download `TingMo-Setup-0.2.exe` from [Releases](https://github.com/yangshaoxin12/tingmo/releases).

First launch downloads the ASR model (~230MB) automatically. Punctuation model (~280MB) is optional — download separately and place in `%APPDATA%/tingmo/models/funasr/`.

## How to Use

| Action | Keys |
|--------|------|
| Voice input | Press **Right Alt** → speak → press **Right Alt** again |
| Translate | Hold **Right Shift** + press **Right Alt** → speak → press **Right Alt** |
| Settings | Right-click tray icon → Settings |

## LLM Refinement (Optional)

1. Open Settings → AI Refine section
2. Enter your OpenAI-compatible API Key (supports GPT-4o-mini, Claude, DeepSeek, Qwen)
3. Enable "Refine"
4. Your speech will be polished: filler words removed, auto-structured, properly punctuated

Without LLM, ASR text is injected directly (with punctuation from the local CT-Transformer model).

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Electron 33 + React 18 + TypeScript |
| ASR | Paraformer-large INT8 ONNX (FunASR) |
| Punctuation | CT-Transformer ONNX (sherpa-onnx) |
| LLM | OpenAI-compatible API (GPT-4o-mini / Claude / DeepSeek / Qwen) |
| Audio | Web Audio API → 16kHz resample → WAV |
| Injection | Win32 `SendInput` + `KEYEVENTF_UNICODE` (koffi FFI) |
| State | Zustand |
| i18n | Custom React Context, 5 languages |

## Model Files

Placed in `%APPDATA%/tingmo/models/funasr/`:

| File | Size | Required |
|------|------|----------|
| `paraformer-large-int8.onnx` | 228 MB | Yes |
| `tokens.json` | 60 KB | Yes |
| `am.mvn` | 11 KB | Yes |
| `ct-transformer.onnx` | 281 MB | Optional (punctuation) |
| `punct-tokens.json` | 4 MB | Optional (punctuation) |

## Development

```bash
npm install
npm run dev            # Terminal 1: Vite dev server
npm run electron:dev   # Terminal 2: Build + launch Electron
```

## License

MIT
