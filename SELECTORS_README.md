# Sendol AI Broadcast Extension - Selectors Repository

This repository hosts the dynamic DOM selectors configuration for the Sendol AI Broadcast Extension.

## What is this?

The selectors/ directory contains CSS selectors for finding input fields and send buttons across different AI platforms (ChatGPT, Claude, Gemini, etc.). The browser extension automatically fetches this file every 12 hours to stay up-to-date with platform UI changes.

## Why does this exist?

AI platforms frequently update their UI, which can break browser extensions. By hosting selectors in a separate repository:

1. **No extension updates needed** - When a platform changes its UI, we just update this JSON file
2. **Instant fixes** - All users get the fix within 12 hours without reinstalling
3. **No app store review delays** - Bypass the slow Chrome Web Store review process

## File Structure

```json
{
  "chatgpt": {
    "findInput": ["#prompt-textarea", "div[contenteditable='true']"],
    "findSendBtn": ["[data-testid='send-button']", "button[aria-label*='Send']"]
  },
  "claude": {
    "findInput": ["div.ProseMirror[contenteditable='true']"],
    "findSendBtn": ["button[aria-label='Send Message']"]
  }
}
```

## How to update

1. When a platform breaks, test the new selectors in browser DevTools
2. Update selectors/ in this repository
3. Commit and push - users will auto-update within 12 hours

## Supported Platforms

- ChatGPT (chatgpt.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- Grok (grok.com)
- DeepSeek (deepseek.com)
- Doubao (doubao.com)
- Qianwen (qianwen.com)
- Yuanbao (yuanbao.tencent.com)
- Kimi (kimi.ai)

## Fallback Mechanism

If selectors fail, the extension uses a heuristic engine that:
- Searches for contenteditable divs and textareas
- Looks for buttons with "Send", "发送", "Submit" text
- Scores candidates by visibility, position, and context
