#!/usr/bin/env node
/**
 * 主流大模型输入框支持情况测试
 * 访问各平台页面，检测 content.js 中定义的选择器是否能找到输入框
 * 运行: npm run test:input  或  npx playwright install chromium && node scripts/test-input-support.mjs
 */

import { chromium } from 'playwright';

const PLATFORMS = [
  {
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    selectors: [
      '#prompt-textarea',
      'div[contenteditable="true"][data-lexical-editor]',
      'div[contenteditable="true"][role="textbox"]',
    ],
  },
  {
    name: 'Claude',
    url: 'https://claude.ai/',
    selectors: [
      'div.ProseMirror[contenteditable="true"]',
      '[data-testid="chat-input"] div[contenteditable]',
      'fieldset div[contenteditable="true"]',
      'div[contenteditable="true"]',
    ],
  },
  {
    name: 'Gemini',
    url: 'https://gemini.google.com/',
    selectors: [
      '.ql-editor[contenteditable="true"]',
      'rich-textarea .ql-editor',
      'div[contenteditable="true"][role="textbox"]',
      'p[data-placeholder]',
    ],
  },
  {
    name: 'Grok',
    url: 'https://grok.com/',
    selectors: [
      'textarea[placeholder*="mind"]',
      'textarea[placeholder*="Ask"]',
      'textarea',
      'div[contenteditable="true"]',
    ],
  },
  {
    name: 'DeepSeek',
    url: 'https://www.deepseek.com/',
    selectors: [
      'textarea#chat-input',
      'textarea[placeholder*="Ask"]',
      'textarea',
    ],
  },
  {
    name: 'Kimi',
    url: 'https://www.kimi.com/',
    selectors: [
      'textarea[placeholder]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea',
    ],
  },
];

async function checkSelectors(page, selectors) {
  return page.evaluate((sels) => {
    for (const sel of sels) {
      let el = null;
      try {
        if (sel === 'p[data-placeholder]') {
          const p = document.querySelector(sel);
          el = p?.closest('[contenteditable="true"]') || p;
        } else {
          el = document.querySelector(sel);
        }
        if (el) {
          const tag = el.tagName?.toLowerCase();
          const visible = el.offsetParent !== null && (el.offsetWidth > 0 || el.offsetHeight > 0);
          return { found: true, selector: sel, tag, visible };
        }
      } catch (e) {}
    }
    return { found: false, selector: null, tag: null, visible: false };
  }, selectors);
}

async function testPlatform(browser, platform, results) {
  const { name, url, selectors } = platform;
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(4000);

    const r = await checkSelectors(page, selectors);
    results.push({
      name,
      url,
      ...r,
      note: !r.found ? '可能未登录或页面结构已变更' : r.visible ? '' : '元素存在但可能不可见',
    });
  } catch (err) {
    results.push({
      name,
      url,
      found: false,
      selector: null,
      tag: null,
      visible: false,
      note: `加载失败: ${err.message?.slice(0, 60)}`,
    });
  } finally {
    await ctx.close();
  }
}

async function main() {
  console.log('正在测试主流大模型输入框支持情况...\n');
  const results = [];
  const browser = await chromium.launch({ headless: true });

  for (const platform of PLATFORMS) {
    process.stderr.write(`  ${platform.name} ... `);
    await testPlatform(browser, platform, results);
    const r = results[results.length - 1];
    process.stderr.write(r.found ? (r.visible ? '✓ 找到\n' : '? 找到但不可见\n') : '✗ 未找到\n');
  }

  await browser.close();

  console.log('\n========== 输入框支持情况汇总 ==========\n');
  const table = results.map((r) => ({
    平台: r.name,
    输入框: r.found ? (r.visible ? '✓ 支持' : '? 存在') : '✗ 未检测到',
    命中选择器: r.selector || '-',
    标签: r.tag || '-',
    备注: r.note || '',
  }));

  console.table(table);
  console.log('\n说明: 部分站点需登录后才显示输入框，未登录时显示「未检测到」属正常。');
  console.log('选择器与 content.js 中一致，若某站长期未检测到请检查该站是否改版。\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
