# AI Broadcast Extension

**Broadcast one message to all AI chat windows at once.** A Chrome/Edge extension for power users who juggle ChatGPT, Claude, Gemini, and more.

**一键将同一条消息同步广播到所有 AI 会话窗口。** 专为重度 AI 用户与效率极客设计的浏览器扩展。

![Hero Screenshot](assets/screenshot.png)

---

## 💡 Features / 特性

| English | 中文 |
|--------|------|
| **One input, sync everywhere** — Type once, send to all open AI tabs. | **多端同步输入** — 一次输入，自动分发给所有打开的 AI 助手。 |
| **Auto Send** — Submit to each AI without clicking Send in every tab. | **自动发送** — 无需在各标签页手动点击发送。 |
| **New Chat** — Optionally start a new conversation on each platform. | **新对话** — 可选在各平台开启新对话。 |
| **Minimal UI, keyboard-first** — Vercel-style design, `Ctrl+Enter` to send. | **极简拟物 UI** — 全键盘支持，Ctrl+Enter 发送。 |

## 🚀 Supported Platforms / 支持平台

- ChatGPT (OpenAI)
- Claude (Anthropic)
- Gemini (Google)
- Grok (xAI)
- DeepSeek

---

## 🛠 Installation / 安装

This extension is not on the Chrome Web Store yet. Load it manually in **Developer mode**:

本插件暂未上架 Chrome 网上应用店，请通过**开发者模式**手动加载：

1. **Get the code** / **获取代码**
   - Click **Code** → **Download ZIP**, then unzip.
   - 或 Git 克隆：`git clone https://github.com/GaryQood/ai-broadcast-extension.git`
2. **Open extensions** / **打开扩展页面**
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. Turn on **Developer mode** / 开启右上角 **开发者模式**。
4. Click **Load unpacked** / 点击 **加载已解压的扩展程序**。
5. Select the **project root folder** (the one containing `manifest.json`) / 选择解压后的**项目根目录**（包含 `manifest.json` 的文件夹）。

## 🎯 Usage / 使用说明

| Step | English | 中文 |
|------|--------|------|
| 1 | Open the AI sites you need (e.g. ChatGPT, Claude, Gemini) in separate tabs. | 在浏览器中打开需要使用的 AI 平台页面。 |
| 2 | Click the **AI Broadcast** icon in the toolbar. | 点击浏览器右上角的 AI Broadcast 图标。 |
| 3 | The extension scans and lists all detected AI tabs. | 插件会自动扫描并列出当前支持的 AI 窗口。 |
| 4 | Type your message in the input box. | 在输入框内输入内容。 |
| 5 | (Optional) Enable **Auto Send** and/or **New Chat**. | （可选）勾选「自动发送」「新对话」。 |
| 6 | Press **Ctrl+Enter** (or Cmd+Enter on Mac) or click Send to broadcast. | 按 **Ctrl+Enter** 或点击发送，完成广播。 |

---

## 📂 Development / 开发说明

**Which files affect what** / **哪些修改会生效**

- **Popup UI** (logo, styles, layout): edit `app/src/popup/Popup.jsx`, then run `npm run build` in `app/`, and reload the extension.
  **弹窗界面**：改 `app/src/popup/Popup.jsx` 等，在 `app/` 下执行 `npm run build` 后到扩展管理页「重新加载」。
- **Background, content script, manifest, icons**: edit `background.js`, `content.js`, `manifest.json`, `icons/` in the repo root; reload the extension to apply.
  **后台 / 注入脚本、manifest、图标**：改根目录对应文件，保存后重载扩展即生效。

See [app/docs/L3-EXTENSION-INTEGRATION.md](app/docs/L3-EXTENSION-INTEGRATION.md) for details. 详见该文档。

---

## 🔒 Privacy / 隐私安全

**English:** This extension runs entirely on your device. It uses a local broadcast flow only — **no collection, storage, or upload** of your chats, passwords, or any personal data. See [Privacy Policy](privacy.md).

**中文：** 本插件在本地运行，使用点对点广播机制。所有数据均在本地处理，**不收集、不存储、不上传**任何聊天记录、账号密码或隐私信息。详见 [隐私政策](privacy.md)。

---

## 📄 License / 许可证

[MIT License](LICENSE)
