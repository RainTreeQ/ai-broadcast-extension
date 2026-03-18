#!/usr/bin/env node
/**
 * 主流大模型输入框支持情况测试
 * 访问各平台页面，检测 selectors/ 目录中定义的选择器是否能找到输入框
 * 运行: npm run test:input
 *
 * 输出:
 *   - 控制台汇总表格
 *   - test-results.json (供 GitHub Actions 读取)
 *   - 失败时以非零退出码退出
 */

import { chromium } from 'playwright';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SELECTORS_DIR = join(ROOT, 'selectors');
const RESULTS_PATH = join(ROOT, 'test-results.json');
const AUTH_STATE_PATH = process.env.PLAYWRIGHT_AUTH_STATE_PATH || '';

// Load selectors from selectors/ directory (single source of truth)
const SELECTOR_CONFIG = {};
for (const file of readdirSync(SELECTORS_DIR)) {
  if (file === 'index.json' || !file.endsWith('.json')) continue;
  const platformId = file.replace('.json', '');
  SELECTOR_CONFIG[platformId] = JSON.parse(readFileSync(join(SELECTORS_DIR, file), 'utf8'));
}

const PLATFORMS = [
  { id: 'chatgpt',  name: 'ChatGPT',  url: 'https://chatgpt.com/' },
  { id: 'claude',   name: 'Claude',   url: 'https://claude.ai/' },
  { id: 'gemini',   name: 'Gemini',   url: 'https://gemini.google.com/' },
  { id: 'grok',     name: 'Grok',     url: 'https://grok.com/' },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com/' },
  { id: 'doubao',   name: 'Doubao',   url: 'https://www.doubao.com/' },
  { id: 'qianwen',  name: 'Qianwen',  url: 'https://www.qianwen.com/' },
  { id: 'yuanbao',  name: 'Yuanbao',  url: 'https://yuanbao.tencent.com/' },
  { id: 'kimi',     name: 'Kimi',     url: 'https://www.kimi.com/' },
  { id: 'mistral',  name: 'Mistral',  url: 'https://chat.mistral.ai/' },
];

const AUTH_KEYWORDS = [
  'sign in',
  'log in',
  'login',
  'continue with',
  'register',
  'join now',
  '登录',
  '注册',
  '继续',
  '继续使用',
  '立即登录',
  '手机号登录',
];

async function checkSelectors(page, selectors) {
  return page.evaluate((sels) => {
    for (const sel of sels) {
      try {
        let el = null;
        if (sel === 'p[data-placeholder]') {
          const p = document.querySelector(sel);
          el = p?.closest('[contenteditable="true"]') || p;
        } else {
          el = document.querySelector(sel);
        }
        if (el) {
          const tag = el.tagName?.toLowerCase();
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const visible = style.display !== 'none' &&
                         style.visibility !== 'hidden' &&
                         rect.width > 0 && rect.height > 0;
          return { found: true, selector: sel, tag, visible };
        }
      } catch (e) {}
    }
    return { found: false, selector: null, tag: null, visible: false };
  }, selectors);
}

async function detectAuthRequired(page) {
  return page.evaluate((keywords) => {
    const text = (document.body?.innerText || '').toLowerCase();
    const hasKeyword = keywords.some((k) => text.includes(k));
    const hasPasswordInput = document.querySelector('input[type="password"]') !== null;
    const hasEmailInput = document.querySelector('input[type="email"]') !== null;
    const hasPhoneInput = document.querySelector('input[type="tel"]') !== null;
    const isLoginUrl = window.location.pathname.includes('sign_in')
      || window.location.pathname.includes('login')
      || window.location.pathname.includes('auth');
    return hasPasswordInput || hasEmailInput || hasPhoneInput || isLoginUrl || (hasKeyword && hasKeyword);
  }, AUTH_KEYWORDS);
}

async function testPlatform(browser, platform) {
  const selectors = SELECTOR_CONFIG[platform.id]?.findInput || [];
  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  };

  if (AUTH_STATE_PATH) {
    contextOptions.storageState = AUTH_STATE_PATH;
  }

  const ctx = await browser.newContext(contextOptions);
  const page = await ctx.newPage();

  try {
    await page.goto(platform.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(4000);

    const r = await checkSelectors(page, selectors);
    const authRequired = !r.found ? await detectAuthRequired(page) : false;
    await ctx.close();

    return {
      id: platform.id,
      name: platform.name,
      url: platform.url,
      ...r,
      status: r.found ? 'pass' : authRequired ? 'auth_required' : 'hard_fail',
      note: r.found
        ? r.visible ? '' : '元素存在但可能不可见'
        : authRequired ? '需要登录后才能检测输入框（正常）' : '页面可访问但未找到输入框，疑似结构已变更',
    };
  } catch (err) {
    await ctx.close();
    return {
      id: platform.id,
      name: platform.name,
      url: platform.url,
      found: false,
      selector: null,
      tag: null,
      visible: false,
      status: 'load_failed',
      note: `加载失败: ${err.message?.slice(0, 80)}`,
    };
  }
}

async function main() {
  console.log('正在测试主流大模型输入框支持情况...\n');

  const results = [];
  const browser = await chromium.launch({ headless: true });

  for (const platform of PLATFORMS) {
    process.stderr.write(`  ${platform.name.padEnd(12)} ... `);
    const r = await testPlatform(browser, platform);
    results.push(r);
    process.stderr.write(
      r.found ? (r.visible ? '✓ 找到\n' : '? 找到但不可见\n') : '✗ 未找到\n'
    );
  }

  await browser.close();

  // ── Console summary ──────────────────────────────────────────────────────
  console.log('\n========== 输入框支持情况汇总 ==========\n');
  const table = results.map((r) => ({
    平台: r.name,
    输入框: r.found ? (r.visible ? '✓ 支持' : '? 存在') : '✗ 未检测到',
    命中选择器: r.selector || '-',
    标签: r.tag || '-',
    备注: r.note || '',
  }));
  console.table(table);

  // ── Identify failures ────────────────────────────────────────────────────
  const hardFailed = results.filter((r) => r.status === 'hard_fail');
  const authRequired = results.filter((r) => r.status === 'auth_required');
  const loadFailed = results.filter((r) => r.status === 'load_failed');

  if (loadFailed.length > 0) {
    console.log('\n⚠️  以下平台加载失败（可能是网络问题，不计入失败）:');
    loadFailed.forEach((r) => console.log(`   - ${r.name}: ${r.note}`));
  }

  if (authRequired.length > 0) {
    console.log('\nℹ️  以下平台需要登录后检测（不计入失败）:');
    authRequired.forEach((r) => console.log(`   - ${r.name}`));
  }

  // ── Write test-results.json for GitHub Actions ───────────────────────────
  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    authRequired: authRequired.length,
    failed: hardFailed.length,
    loadErrors: loadFailed.length,
    failedPlatforms: hardFailed.map((r) => r.id),
    results,
  };

  writeFileSync(RESULTS_PATH, JSON.stringify(summary, null, 2) + '\n');
  console.log(`\n📄 详细结果已写入: test-results.json`);

  // ── Exit code ────────────────────────────────────────────────────────────
  if (hardFailed.length > 0) {
    console.error(`\n❌ ${hardFailed.length} 个平台选择器失效: ${hardFailed.map((r) => r.name).join(', ')}`);
    console.error('   → 将触发自动修复流程');
    process.exit(1);
  }

  console.log('\n✅ 所有平台测试通过（或仅需登录后检测）');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
