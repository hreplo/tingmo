# 听墨 TingMo

> AI 赋能的 Windows 桌面语音输入法 | 🎤 Vibe Coding 项目

*[English version](README_EN.md)*

![version](https://img.shields.io/badge/version-V0.3.0-orange)
![platform](https://img.shields.io/badge/platform-Windows%20x64-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![vibe](https://img.shields.io/badge/vibe%20coding-yes-ff69b4)

按下快捷键开始说话，松开后语音自动转文字注入光标位置。支持纯离线运行，也可接入 LLM 进行口语润色。

## 特性

- **本地 ASR** — SenseVoiceSmall ONNX，230MB，完全离线，中英日韩粤 5 语言
- **内置标点** — SenseVoice 自带 ITN 标点恢复，无需额外模型
- **LLM 润色**（可选）— 去口语填充词 + 自动结构化 + 保留专属词汇
- **翻译模式** — 识别后自动翻译为目标语言
- **个性词典** — 添加专属词汇，模糊纠错 + LLM 上下文保留
- **5 语言界面** — 简体中文 / 繁體中文 / English / 日本語 / 한국어
- **极简交互** — 浮窗胶囊仅在录音时出现，无按钮

## 安装

从 [Releases](https://github.com/shaoxin12/tingmo/releases) 下载 `TingMo-Setup-0.3.exe`。

首次启动自动下载模型文件（~230MB）。

## 使用

| 操作 | 方式 |
|------|------|
| 语音输入 | 按下快捷键 → 说话 → 再次按下 |
| 翻译 | 按住翻译修饰键 + 按下快捷键 |
| 设置 | 右键系统托盘图标 → 设置 |

> 快捷键可在设置中自定义，默认语音键为右 Alt。

## LLM 润色（可选）

1. 设置 → 模型 → LLM 大模型
2. 填入 OpenAI 兼容 API Key（支持 GPT-4o-mini / Claude / DeepSeek / 通义千问）
3. 开启"启用润色"

无需 LLM 时，SenseVoice 自带标点结果直接注入，离线可用。

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Electron 33 + React 18 + TypeScript |
| ASR | SenseVoiceSmall ONNX (sherpa-onnx) |
| LLM | OpenAI 兼容 API |
| 音频 | Web Audio API → 16kHz 重采样 → WAV |
| 注入 | Win32 `SendInput` + `KEYEVENTF_UNICODE` (koffi FFI) |
| 状态 | Zustand |
| i18n | React Context，5 语言 |

## 模型文件

存放于 `%APPDATA%/TingMo/models/funasr/`：

| 文件 | 大小 | 必需 |
|------|------|------|
| `model.int8.onnx` | 229 MB | ✅ |
| `tokens.txt` | 309 KB | ✅ |
| `am.mvn` | 11 KB | ✅ |

## 开发

```bash
npm install
npm run dev            # 终端 1: Vite
npm run electron:dev   # 终端 2: 构建 + Electron
```

## 关于

本项目为 Vibe Coding 作品——在 AI 辅助下快速迭代开发。欢迎提 Issue 和 PR。

## License

MIT
