# Maintenance Guide - Sendol AI Broadcast Extension

## 🎯 Overview

This extension has been architected for **minimal maintenance**. Most platform UI changes can be fixed without releasing a new version.

## 🔄 Quick Fix Workflow (No Extension Update Needed)

When a platform breaks (e.g., ChatGPT changes their input field):

### 1. Identify the New Selector
```bash
# Open the broken platform in your browser
# Press F12 to open DevTools
# Find the input field element
# Right-click → Copy → Copy selector

# Test it in console:
document.querySelector('YOUR_NEW_SELECTOR')
```

### 2. Update selectors/
```bash
# Edit selectors/
vim selectors/chatgpt.json

# Or if using separate repo:
cd ../sendol-selectors
vim selectors/chatgpt.json
```

### 3. Validate & Deploy
```bash
# Validate the JSON structure
npm run validate:selectors

# Commit and push (if using separate repo)
git add selectors/
git commit -m "fix: update ChatGPT input selector"
git push

# Users will auto-update within 12 hours
```

## 🏗️ Architecture

### Dynamic Selectors System
- **Location**: selectors/ (can be hosted separately on GitHub)
- **Update Frequency**: Every 12 hours via `background.js`
- **Fallback**: Heuristic engine if selectors fail

### File Structure
```
src/content/
  ├── index.js          # Main content script (bundled by esbuild)
  ├── selectors.js      # Selector fetching logic
  └── heuristics.js     # Fallback detection engine

background.js           # Fetches selectors from cloud
selectors/          # Platform DOM selectors (cloud-hosted)
```

### Build Process
```bash
# Development
npm run build:extension

# Production (minified)
npm run package:extension:min

# The build uses esbuild to bundle src/content/index.js → content.js
```

## 🚨 Monitoring

### GitHub Actions E2E Tests
- **Schedule**: Daily at 00:00 UTC
- **What it does**: Tests all platforms for input/send functionality
- **On failure**: Sends email alert

### Setup Email Notifications
```bash
# Add these secrets to your GitHub repository:
# Settings → Secrets → Actions

MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
NOTIFY_EMAIL=where-to-send-alerts@example.com
```

### Manual Test
```bash
npm run test:input
```

## 🔧 Common Maintenance Tasks

### Adding a New Platform

1. **Update platform registry**:
```javascript
// shared/platform-registry.js
{
  id: 'newplatform',
  name: 'NewPlatform',
  domains: ['newplatform.com'],
  newChatUrl: 'https://newplatform.com/chat'
}
```

2. **Add selectors**:
```json
// selectors/{platform}.json
{
  "newplatform": {
    "findInput": ["textarea#input", "div[contenteditable='true']"],
    "findSendBtn": ["button[type='submit']"]
  }
}
```

3. **Add adapter** (if special logic needed):
```javascript
// src/content/index.js - platformAdapters
newplatform: {
  name: 'NewPlatform',
  findInput: async () => await findInputBySelectors('newplatform') || waitFor(...),
  inject: (el, text) => setReactValue(el, text),
  send: async (el) => { /* custom send logic */ }
}
```

### Updating Heuristics

If many platforms break at once, improve the fallback:

```javascript
// src/content/index.js - findInputHeuristically()
// Add more scoring criteria or selector patterns
```

### Debugging

```javascript
// Enable debug mode in popup
// Check console for [AIB] logs

// Test selector in DevTools:
document.querySelector('YOUR_SELECTOR')

// Test heuristic engine:
findInputHeuristically()
```

## 📊 Metrics

Current stats:
- **Platforms**: 9 (ChatGPT, Claude, Gemini, Grok, DeepSeek, Doubao, Qianwen, Yuanbao, Kimi)
- **Total Selectors**: 69
- **Package Size**: ~463KB (under 550KB budget)
- **Update Frequency**: 12 hours (automatic)

## 🎓 Best Practices

1. **Always test selectors** in browser DevTools before committing
2. **Use specific selectors first**, generic ones last (order matters)
3. **Validate JSON** with `npm run validate:selectors` before pushing
4. **Monitor GitHub Actions** for daily test results
5. **Keep selectors/ in a separate repo** for faster updates

## 🆘 Emergency Procedures

### All Platforms Broken
1. Check if selectors/ fetch is failing (network issue)
2. Verify GitHub raw URL is accessible
3. Heuristic engine should still work as fallback

### Specific Platform Broken
1. Update selectors/ immediately
2. Users get fix within 12 hours
3. No extension store review needed

### Extension Store Rejection
1. Most fixes don't need store updates
2. Only update extension for:
   - New features
   - Security fixes
   - Major refactoring

## 📝 Version History

- **v2.5.0**: Dynamic selectors + heuristic fallback system
- Previous: Hardcoded selectors (required extension updates)
