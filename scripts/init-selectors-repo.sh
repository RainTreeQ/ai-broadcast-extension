#!/bin/bash
# Script to initialize a separate GitHub repository for selectors

set -e

REPO_NAME="sendol-selectors"
REPO_DIR="../${REPO_NAME}"

echo "🚀 Initializing selectors repository..."

# Create directory
mkdir -p "$REPO_DIR"
cd "$REPO_DIR"

# Initialize git
git init

# Copy selectors directory
mkdir -p selectors
cp -r ../ai-broadcast-extension/selectors/*.json selectors/

# Create README
cat > README.md << 'MDEOF'
# Sendol AI Extension - Dynamic Selectors

This repository hosts the dynamic DOM selectors configuration for the Sendol AI Broadcast Extension.

## Quick Update Guide

When an AI platform changes its UI:

1. Open the platform in your browser
2. Open DevTools (F12) and find the new input field selector
3. Update `selectors/{platform}.json` with the new selector
4. Commit and push

Example:
```bash
# Test the selector in DevTools console first
document.querySelector('YOUR_NEW_SELECTOR')

# If it works, update the platform file
vim selectors/chatgpt.json
git add selectors/
git commit -m "fix: update ChatGPT input selector"
git push
```

Users will automatically receive the update within 12 hours.

## File Structure

```
selectors/
  index.json          # Version and platform list
  chatgpt.json        # ChatGPT selectors
  claude.json         # Claude selectors
  gemini.json         # Gemini selectors
  ...
```

Each platform file:
```json
{
  "findInput": ["selector1", "selector2"],
  "findSendBtn": ["selector1", "selector2"]
}
```

Selectors are tried in order. First match wins.
MDEOF

# Create .gitignore
cat > .gitignore << 'GITEOF'
.DS_Store
node_modules/
*.log
GITEOF

# Initial commit
git add .
git commit -m "Initial commit: Dynamic selectors for Sendol AI Extension"

echo "✅ Repository initialized at $REPO_DIR"
echo ""
echo "Next steps:"
echo "1. Create a new GitHub repository named '$REPO_NAME'"
echo "2. Run: cd $REPO_DIR"
echo "3. Run: git remote add origin https://github.com/YOUR_USERNAME/$REPO_NAME.git"
echo "4. Run: git push -u origin main"
echo "5. The extension fetches from:"
echo "   https://raw.githubusercontent.com/YOUR_USERNAME/$REPO_NAME/main/selectors/{platform}.json"
