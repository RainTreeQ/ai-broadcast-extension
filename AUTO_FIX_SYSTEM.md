# 🤖 Auto-Fix System Documentation

## 📋 Overview

The auto-fix system automatically detects and repairs broken platform selectors without requiring manual intervention or extension updates.

## 🏗️ Architecture

```
Daily E2E Tests (2x/day)
    ↓
Detect Failures
    ↓
Trigger Auto-Fix Workflow
    ↓
Discover New Selectors (AI-powered)
    ↓
Create PR in selectors repo
    ↓
[High Confidence] → Auto-merge
[Low Confidence] → Wait for your review
    ↓
Users auto-update within 12 hours
```

## 🔧 Components

### 1. Selector Discovery Engine
**File**: `scripts/discover-selectors.mjs`

**How it works**:
- Visits the broken platform with Playwright
- Collects all potential input elements (textarea, contenteditable, etc.)
- Scores each candidate based on:
  - Visibility and position
  - Size and attributes
  - Nearby send buttons
  - Placeholder/aria-label hints
- Generates multiple selector strategies (ID, data-testid, class, etc.)
- Returns top 5 selectors with confidence score

**Confidence scoring**:
- 95%+: Auto-merge enabled
- 80-94%: Requires manual review
- <80%: Flagged as low confidence

### 2. E2E Test Suite
**File**: `scripts/test-input-support.mjs`

**Enhancements**:
- Reads from `selectors/` directory (per-platform JSON files)
  - Each platform has its own file at `selectors/{platform}.json` with format `{ "mode": "override", "findInput": [...], "findSendBtn": [...] }`
  - There is also `selectors/index.json` with `{ "version": 3, "platforms": [...] }`
- Outputs `test-results.json` for GitHub Actions
- Distinguishes between "not logged in" (expected) vs "selector broken" (failure)
- Exits with code 1 only for real failures

### 3. GitHub Actions Workflows

#### a. E2E Monitor (`e2e-monitor.yml`)
- **Schedule**: 2x daily (08:00 & 20:00 Beijing time)
- **Triggers**: Auto-fix workflow on failure
- **Notifications**: Email (if configured)

#### b. Auto-Fix Selectors (`auto-fix-selectors.yml`)
- **Trigger**: Manual or from E2E monitor
- **Actions**:
  1. Run selector discovery for each failed platform
  2. Update `selectors/{platform}.json`
  3. Create PR in `sendol-selectors` repo
  4. Add labels based on confidence

#### c. Retry Failed (`retry-failed.yml`)
- **Schedule**: 24 hours after main monitor
- **Purpose**: Retry if initial failure was temporary
- **Logic**: Only triggers if no open auto-fix PR exists

#### d. Auto-Merge (in selectors repo)
- **Trigger**: PR opened with `high-confidence` label
- **Action**: Auto-approve and merge
- **Safety**: Only for PRs from `github-actions[bot]`

## 📊 Confidence Levels

| Level | Score | Action | Your Work |
|-------|-------|--------|-----------|
| **High** | 95%+ | Auto-merge | 0 seconds (just get notification) |
| **Medium** | 80-94% | Create PR | 30 seconds (review & click merge) |
| **Low** | <80% | Create PR + warning | 2 minutes (careful review) |
| **Failed** | N/A | Create issue | 5 minutes (manual fix) |

## 🔄 Typical Workflows

### Scenario 1: High Confidence Fix (95%+)
```
08:00 - E2E test detects ChatGPT broken
08:02 - Auto-fix discovers new selectors (98% confidence)
08:03 - PR created in selectors repo
08:03 - Auto-merged immediately
08:04 - You receive email: "✅ ChatGPT auto-fixed"
20:00 - Users' extensions auto-update
```
**Your time**: 0 seconds

### Scenario 2: Medium Confidence (80-94%)
```
08:00 - E2E test detects Claude broken
08:02 - Auto-fix discovers selectors (85% confidence)
08:03 - PR created, labeled "needs-review"
08:05 - You receive email with PR link
08:10 - You open GitHub app, review diff (looks good)
08:11 - Click "Merge pull request"
20:00 - Users' extensions auto-update
```
**Your time**: 30 seconds

### Scenario 3: Low Confidence (<80%)
```
08:00 - E2E test detects Gemini broken
08:02 - Auto-fix discovers selectors (65% confidence)
08:03 - PR created with ⚠️ warning
08:05 - You receive email
08:15 - You review PR, selectors look wrong
08:16 - Close PR
08:20 - Manually update selectors/{platform}.json
08:22 - Push to selectors repo
20:00 - Users' extensions auto-update
```
**Your time**: 2-5 minutes

### Scenario 4: Discovery Failed
```
08:00 - E2E test detects Qianwen broken
08:02 - Auto-fix runs but can't find selectors
08:03 - Issue created in main repo
08:05 - You receive email
09:00 - You manually inspect Qianwen
09:05 - Update selectors/{platform}.json
09:07 - Push to selectors repo
21:00 - Users' extensions auto-update
```
**Your time**: 5-10 minutes

## 🎯 Expected Maintenance Time

### Monthly Average
- **High confidence fixes**: 2-3 times × 0 sec = 0 min
- **Medium confidence**: 1 time × 30 sec = 0.5 min
- **Low confidence**: 0-1 time × 5 min = 5 min
- **Manual fixes**: 0-1 time × 10 min = 10 min

**Total**: ~15 minutes/month (down from 2-4 hours/month)

## 🧪 Testing the System

### Test Selector Discovery
```bash
# Test on a specific platform
node scripts/discover-selectors.mjs chatgpt

# Should output:
# - Confidence score
# - Top 5 input selectors
# - Top 5 button selectors
```

### Test E2E Suite
```bash
# Run full test
npm run test:input

# Check output
cat test-results.json
```

### Simulate Failure
```bash
# Temporarily break a selector in selectors/{platform}.json
vim selectors/chatgpt.json (example)
# Change chatgpt.findInput[0] to "#nonexistent"

# Run test (should fail)
npm run test:input

# Restore
git checkout selectors/
```

### Test Auto-Fix Workflow (Manual Trigger)
```bash
# Go to GitHub Actions
# Select "Auto-Fix Selectors"
# Click "Run workflow"
# Input: chatgpt
# Watch it create a PR
```

## 🔐 Required Secrets

### Main Repo (`ai-broadcast-extension`)
Optional (for email notifications):
- `MAIL_USERNAME`: your-email@gmail.com
- `MAIL_PASSWORD`: Gmail app password
- `NOTIFY_EMAIL`: where-to-send-alerts@example.com

### Selectors Repo (`sendol-selectors`)
None required (uses `GITHUB_TOKEN` automatically)

## 📈 Monitoring

### Check System Health
1. Go to GitHub Actions in main repo
2. Look for "E2E Monitor" runs
3. Green = all platforms working
4. Red = auto-fix triggered

### Check Auto-Fix Status
1. Go to `sendol-selectors` repo
2. Check Pull Requests tab
3. Open PRs = waiting for your review
4. Merged PRs = auto-fixed successfully

### Check User Update Status
Users update every 12 hours via `background.js`:
- Fetches from: `https://raw.githubusercontent.com/RainTreeQ/sendol-selectors/main/selectors/{platform}.json`
- Cached in: `chrome.storage.local.aib_dynamic_selectors`
- Next update: Check `timestamp` field

## 🐛 Troubleshooting

### Auto-fix not triggering
- Check GitHub Actions logs
- Verify `test-results.json` was created
- Check if workflow dispatch permissions are enabled

### PR not auto-merging (high confidence)
- Check if `high-confidence` label was added
- Verify auto-merge workflow is enabled in selectors repo
- Check workflow permissions (needs `contents: write`)

### Discovery returns low confidence
- Platform may have complex/dynamic structure
- Manual review recommended
- Consider adding platform-specific logic to discovery script

### Email notifications not working
- Verify secrets are set correctly
- Check Gmail app password (not regular password)
- Test with workflow dispatch

## 🚀 Future Improvements

Potential enhancements (not implemented yet):
1. **Machine learning**: Train on historical selector patterns
2. **Multi-strategy testing**: Test discovered selectors before creating PR
3. **Slack/Discord integration**: Real-time notifications
4. **Automatic rollback**: If users report issues, auto-revert
5. **A/B testing**: Gradually roll out selector changes

## 📞 Support

If the auto-fix system fails:
1. Check GitHub Actions logs
2. Review `test-results.json`
3. Run `npm run diagnose <platform>` locally
4. Manually update `selectors/{platform}.json` in selectors repo
5. Users will get the fix within 12 hours

---

**Remember**: The system is designed to handle 90%+ of cases automatically. You only need to intervene when confidence is low or discovery fails completely.
