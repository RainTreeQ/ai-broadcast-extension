#!/usr/bin/env node
/**
 * Intelligent Selector Discovery Script
 * Automatically discovers new selectors when platforms change their UI
 * 
 * Usage: node scripts/discover-selectors.mjs <platform-name>
 * Example: node scripts/discover-selectors.mjs chatgpt
 */

import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SELECTORS_DIR = join(ROOT, 'selectors');

const PLATFORMS = {
  chatgpt: { url: 'https://chatgpt.com/', name: 'ChatGPT' },
  claude: { url: 'https://claude.ai/', name: 'Claude' },
  gemini: { url: 'https://gemini.google.com/', name: 'Gemini' },
  grok: { url: 'https://grok.com/', name: 'Grok' },
  deepseek: { url: 'https://chat.deepseek.com/', name: 'DeepSeek' },
  doubao: { url: 'https://www.doubao.com/', name: 'Doubao' },
  qianwen: { url: 'https://www.qianwen.com/', name: 'Qianwen' },
  yuanbao: { url: 'https://yuanbao.tencent.com/', name: 'Yuanbao' },
  kimi: { url: 'https://www.kimi.com/', name: 'Kimi' },
  mistral: { url: 'https://chat.mistral.ai/', name: 'Mistral' },
};

async function isAuthGate(page) {
  return page.evaluate(() => {
    const hasPassword = document.querySelector('input[type="password"]') !== null;
    const hasEmail = document.querySelector('input[type="email"]') !== null;
    const hasPhone = document.querySelector('input[type="tel"]') !== null;
    const isLoginUrl = window.location.pathname.includes('sign_in')
      || window.location.pathname.includes('login')
      || window.location.pathname.includes('auth');
    const text = (document.body?.innerText || '').toLowerCase();
    const keywords = [
      'sign in',
      'log in',
      'login',
      'continue with',
      'register',
      '登录',
      '注册',
      '继续',
    ];
    return hasPassword || hasEmail || hasPhone || isLoginUrl || keywords.some((k) => text.includes(k));
  });
}

/**
 * Discover input field selectors using heuristic analysis
 */
async function discoverInputSelectors(page) {
  return await page.evaluate(() => {
    const candidates = [];
    
    // Collect all potential input elements
    const textareas = [...document.querySelectorAll('textarea')];
    const contentEditables = [...document.querySelectorAll('[contenteditable="true"]')];
    const textboxes = [...document.querySelectorAll('[role="textbox"]')];
    
    const allElements = [...new Set([...textareas, ...contentEditables, ...textboxes])];
    
    for (const el of allElements) {
      if (!el) continue;
      
      // Check visibility
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     rect.width > 100 && 
                     rect.height > 20 &&
                     rect.bottom > 0;
      
      if (!visible) continue;
      
      // Generate multiple selector strategies
      const selectors = [];
      
      // Strategy 1: ID
      if (el.id) {
        selectors.push({ selector: `#${el.id}`, specificity: 100 });
      }
      
      // Strategy 2: data-testid
      const testId = el.getAttribute('data-testid');
      if (testId) {
        selectors.push({ selector: `[data-testid="${testId}"]`, specificity: 95 });
      }
      
      // Strategy 3: Unique class
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.split(' ').filter(c => c && !c.match(/^(css-|_)/));
        if (classes.length > 0) {
          selectors.push({ selector: `.${classes[0]}`, specificity: 70 });
        }
      }
      
      // Strategy 4: Tag + attributes
      const tag = el.tagName.toLowerCase();
      if (tag === 'textarea') {
        const placeholder = el.getAttribute('placeholder');
        if (placeholder) {
          selectors.push({ 
            selector: `textarea[placeholder*="${placeholder.slice(0, 10)}"]`, 
            specificity: 80 
          });
        } else {
          selectors.push({ selector: 'textarea', specificity: 50 });
        }
      }
      
      // Strategy 5: contenteditable with attributes
      if (el.getAttribute('contenteditable') === 'true') {
        const role = el.getAttribute('role');
        const dataAttrs = [...el.attributes]
          .filter(attr => attr.name.startsWith('data-'))
          .slice(0, 2);
        
        if (role) {
          selectors.push({ 
            selector: `div[contenteditable="true"][role="${role}"]`, 
            specificity: 85 
          });
        }
        
        if (dataAttrs.length > 0) {
          const attrSelector = dataAttrs
            .map(attr => `[${attr.name}="${attr.value}"]`)
            .join('');
          selectors.push({ 
            selector: `div[contenteditable="true"]${attrSelector}`, 
            specificity: 90 
          });
        }
        
        // Check for specific editor frameworks
        if (el.classList.contains('ProseMirror')) {
          selectors.push({ 
            selector: 'div.ProseMirror[contenteditable="true"]', 
            specificity: 95 
          });
        }
        
        if (el.classList.contains('ql-editor')) {
          selectors.push({ 
            selector: '.ql-editor[contenteditable="true"]', 
            specificity: 95 
          });
        }
      }
      
      // Calculate score based on element characteristics
      let score = 0;
      
      // Position score (bottom of page = higher score)
      const viewportHeight = window.innerHeight;
      if (rect.bottom > viewportHeight * 0.5) score += 20;
      if (rect.bottom > viewportHeight * 0.7) score += 10;
      
      // Size score
      if (rect.width > 400) score += 10;
      if (rect.height > 40) score += 5;
      
      // Attribute score
      const placeholder = el.getAttribute('placeholder') || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const hint = (placeholder + ariaLabel).toLowerCase();
      
      if (hint.includes('message') || hint.includes('消息')) score += 15;
      if (hint.includes('chat') || hint.includes('对话')) score += 15;
      if (hint.includes('ask') || hint.includes('问')) score += 10;
      if (hint.includes('type') || hint.includes('输入')) score += 10;
      
      // Nearby send button score
      const parent = el.closest('form') || el.parentElement?.parentElement || document;
      const buttons = parent.querySelectorAll('button:not([disabled])');
      let hasSendButton = false;
      
      for (const btn of buttons) {
        const btnText = (btn.textContent || '').toLowerCase();
        const btnLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (btnText.includes('send') || btnText.includes('发送') || 
            btnLabel.includes('send') || btnLabel.includes('发送')) {
          hasSendButton = true;
          break;
        }
      }
      
      if (hasSendButton) score += 20;
      
      // Focus state score
      if (document.activeElement === el) score += 5;
      
      candidates.push({
        selectors,
        score,
        element: {
          tag: el.tagName.toLowerCase(),
          id: el.id,
          className: el.className,
          placeholder: el.getAttribute('placeholder'),
          ariaLabel: el.getAttribute('aria-label'),
          rect: { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom }
        }
      });
    }
    
    // Sort by score
    candidates.sort((a, b) => b.score - a.score);
    
    return candidates;
  });
}

/**
 * Discover send button selectors
 */
async function discoverSendButtonSelectors(page) {
  return await page.evaluate(() => {
    const candidates = [];
    const buttons = document.querySelectorAll('button:not([disabled]), [role="button"]');
    
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect();
      const style = window.getComputedStyle(btn);
      const visible = style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     rect.width > 0 && 
                     rect.height > 0;
      
      if (!visible) continue;
      
      const text = (btn.textContent || '').trim().toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const testId = btn.getAttribute('data-testid') || '';
      
      const hint = text + ariaLabel + title;
      
      // Check if it's a send button
      const isSend = hint.includes('send') || hint.includes('发送') || 
                     hint.includes('submit') || hint.includes('提交');
      
      // Exclude non-send buttons
      const isExcluded = hint.includes('attach') || hint.includes('上传') ||
                        hint.includes('login') || hint.includes('登录') ||
                        hint.includes('cancel') || hint.includes('取消');
      
      if (!isSend || isExcluded) continue;
      
      // Generate selectors
      const selectors = [];
      
      if (testId) {
        selectors.push({ selector: `[data-testid="${testId}"]`, specificity: 95 });
      }
      
      if (ariaLabel) {
        selectors.push({ selector: `button[aria-label="${ariaLabel}"]`, specificity: 90 });
        if (ariaLabel.includes('send')) {
          selectors.push({ selector: 'button[aria-label*="Send"]', specificity: 85 });
        }
      }
      
      if (btn.type === 'submit') {
        selectors.push({ selector: 'button[type="submit"]', specificity: 80 });
      }
      
      let score = 0;
      if (hint.includes('send')) score += 30;
      if (hint.includes('发送')) score += 30;
      if (testId.includes('send')) score += 20;
      if (btn.type === 'submit') score += 15;
      
      candidates.push({ selectors, score });
    }
    
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  });
}

/**
 * Main discovery function
 */
async function discoverSelectors(platformId, options = {}) {
  const { authStatePath = '' } = options;
  const platform = PLATFORMS[platformId];
  if (!platform) {
    throw new Error(`Unknown platform: ${platformId}`);
  }
  
  console.log(`🔍 Discovering selectors for ${platform.name}...`);
  
  const browser = await chromium.launch({ headless: true });
  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
  };

  if (authStatePath) {
    if (!existsSync(authStatePath)) {
      await browser.close();
      throw new Error(`Auth state file not found: ${authStatePath}`);
    }
    contextOptions.storageState = authStatePath;
  }

  const context = await browser.newContext(contextOptions);
  
  const page = await context.newPage();
  
  try {
    await page.goto(platform.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(5000); // Wait for dynamic content

    const authGate = await isAuthGate(page);
    if (authGate && !authStatePath) {
      throw new Error(
        `${platform.name} requires authentication. Re-run with --auth <storage-state.json>.`
      );
    }
    
    // Discover input selectors
    const inputCandidates = await discoverInputSelectors(page);
    console.log(`  Found ${inputCandidates.length} input candidates`);
    
    // Discover send button selectors
    const buttonCandidates = await discoverSendButtonSelectors(page);
    console.log(`  Found ${buttonCandidates.length} send button candidates`);
    
    // Extract top selectors
    const topInputSelectors = inputCandidates
      .slice(0, 3)
      .flatMap(c => c.selectors)
      .sort((a, b) => b.specificity - a.specificity)
      .slice(0, 5)
      .map(s => s.selector);
    
    const topButtonSelectors = buttonCandidates
      .slice(0, 3)
      .flatMap(c => c.selectors)
      .sort((a, b) => b.specificity - a.specificity)
      .slice(0, 5)
      .map(s => s.selector);
    
    // Calculate confidence score
    const confidence = Math.min(95, 
      (inputCandidates[0]?.score || 0) + 
      (buttonCandidates[0]?.score || 0)
    );
    
    await browser.close();
    
    return {
      platformId,
      platformName: platform.name,
      findInput: [...new Set(topInputSelectors)],
      findSendBtn: [...new Set(topButtonSelectors)],
      confidence,
      topCandidate: inputCandidates[0],
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

/**
 * Update selectors/{platform}.json with discovered selectors
 */
function updateSelectorsFile(platformId, discovered) {
  const platformPath = join(SELECTORS_DIR, `${platformId}.json`);
  let oldSelectors = {};

  if (existsSync(platformPath)) {
    oldSelectors = JSON.parse(readFileSync(platformPath, 'utf8'));
  }

  const nextSelectors = {
    mode: oldSelectors.mode || 'override',
    findInput: discovered.findInput,
    findSendBtn: discovered.findSendBtn,
  };

  mkdirSync(SELECTORS_DIR, { recursive: true });
  writeFileSync(platformPath, JSON.stringify(nextSelectors, null, 2) + '\n');

  return { old: oldSelectors, new: nextSelectors, path: platformPath };
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const platformId = args[0];
  let authStatePath = process.env.PLAYWRIGHT_AUTH_STATE_PATH || '';

  for (let i = 1; i < args.length; i += 1) {
    if (args[i] === '--auth' && args[i + 1]) {
      authStatePath = args[i + 1];
      i += 1;
    }
  }
  
  if (!platformId) {
    console.error('Usage: node scripts/discover-selectors.mjs <platform>');
    console.error('Available platforms:', Object.keys(PLATFORMS).join(', '));
    process.exit(1);
  }
  
  try {
    const discovered = await discoverSelectors(platformId, { authStatePath });
    const updated = updateSelectorsFile(platformId, discovered);
    
    console.log('\n📊 Discovery Results:');
    console.log(`  Platform: ${discovered.platformName}`);
    console.log(`  Confidence: ${discovered.confidence}%`);
    console.log(`  Input selectors: ${discovered.findInput.length}`);
    console.log(`  Button selectors: ${discovered.findSendBtn.length}`);
    console.log(`  Previous input selectors: ${(updated.old?.findInput || []).length}`);
    console.log(`  Updated file: ${updated.path}`);
    
    if (discovered.confidence < 70) {
      console.warn('\n⚠️  Low confidence score. Manual review recommended.');
    }
    
    console.log('\n🔧 Suggested selectors:');
    console.log('  Input:');
    discovered.findInput.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
    console.log('  Send button:');
    discovered.findSendBtn.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
    
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `confidence=${discovered.confidence}\n`);
      appendFileSync(process.env.GITHUB_OUTPUT, `platform=${discovered.platformName}\n`);
      appendFileSync(process.env.GITHUB_OUTPUT, `input_selectors=${JSON.stringify(discovered.findInput)}\n`);
      appendFileSync(process.env.GITHUB_OUTPUT, `button_selectors=${JSON.stringify(discovered.findSendBtn)}\n`);
    }
    
  } catch (error) {
    console.error('❌ Discovery failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { discoverSelectors, updateSelectorsFile };
