#!/usr/bin/env node
/**
 * Auto-capture popup screenshots for landing hero and README.
 * Inputs: app/dist-extension/popup.html (must exist, run extension build first)
 * Outputs:
 *   Light:
 *    - assets/screenshot.png (legacy alias)
 *    - assets/screenshot-light.png
 *    - app/public/screenshot.png (legacy alias)
 *    - app/public/screenshot-light.png
 *   Dark:
 *    - assets/screenshot-dark.png
 *    - app/public/screenshot-dark.png
 */

import { chromium } from "playwright";
import { createServer } from "http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const distDir = join(root, "app", "dist-extension");

const outputTargets = {
  light: [
    join(root, "assets", "screenshot.png"),
    join(root, "assets", "screenshot-light.png"),
    join(root, "app", "public", "screenshot.png"),
    join(root, "app", "public", "screenshot-light.png"),
  ],
  dark: [
    join(root, "assets", "screenshot-dark.png"),
    join(root, "app", "public", "screenshot-dark.png"),
  ],
};

const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function serveStatic(req, res) {
  let pathname = new URL(req.url || "/", "http://localhost").pathname;
  if (pathname === "/") pathname = "/popup.html";
  const target = join(distDir, pathname.slice(1));
  if (!target.startsWith(distDir) || !existsSync(target)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const ext = extname(target).toLowerCase();
  res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
  res.end(readFileSync(target));
}

async function setupPage(page) {
  await page.addInitScript(() => {
    const tabs = [
      { id: 101, platformName: "ChatGPT", title: "需求拆解草稿", url: "https://chatgpt.com/" },
      { id: 102, platformName: "Claude", title: "实现方案 v2", url: "https://claude.ai/" },
      { id: 103, platformName: "Gemini", title: "回归测试清单", url: "https://gemini.google.com/" },
      { id: 104, platformName: "Doubao", title: "中文文案润色", url: "https://www.doubao.com/" },
      { id: 105, platformName: "Kimi", title: "多轮追问澄清", url: "https://kimi.com/" },
    ];

    window.chrome = {
      runtime: {
        id: "preview-extension-id",
        sendMessage: (msg) => {
          if (msg?.type === "GET_AI_TABS") return Promise.resolve({ tabs });
          if (msg?.type === "BROADCAST_MESSAGE") {
            return Promise.resolve({
              results: tabs.map((tab) => ({ tabId: tab.id, success: true })),
              summary: {
                requestId: "preview",
                totalMs: 260,
                p95TabMs: 95,
                successCount: tabs.length,
                failCount: 0,
              },
            });
          }
          return Promise.resolve({});
        },
        onMessage: {
          addListener: () => {},
          removeListener: () => {},
        },
      },
      storage: {
        local: {
          get: async () => ({ autoSend: true, newChat: false, popupDraft: "", aib_onboarding_completed: true }),
          set: async () => {},
          remove: async () => {},
        },
      },
    };
  });
}

async function captureVariant(browser, baseUrl, colorScheme) {
  const context = await browser.newContext({
    viewport: { width: 380, height: 520 },
    deviceScaleFactor: 2,
    colorScheme,
    locale: "zh-CN",
  });
  const page = await context.newPage();

  try {
    await setupPage(page);
    await page.goto(`${baseUrl}/popup.html`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=ChatGPT", { timeout: 10_000 });
    await page.waitForTimeout(150);

    await page.fill("textarea", "请把这个需求分为 3 个里程碑，并补充风险与验收标准。");
    await page.mouse.click(10, 10);
    await page.addStyleTag({
      content: [
        "*,*::before,*::after{animation:none !important;transition:none !important;}",
        "textarea{caret-color:transparent !important;}",
      ].join(""),
    });
    await page.waitForTimeout(60);

    const panel = page.locator("#root > div").first();
    return await panel.screenshot({ type: "png" });
  } finally {
    await context.close();
  }
}

function writeFiles(targets, buffer) {
  for (const target of targets) {
    const parent = dirname(target);
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
    writeFileSync(target, buffer);
  }
}

async function main() {
  if (!existsSync(join(distDir, "popup.html"))) {
    console.error("[capture:screenshot] Missing app/dist-extension/popup.html. Run npm run build:extension first.");
    process.exit(1);
  }

  const server = createServer(serveStatic);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ headless: true });

  try {
    const lightPng = await captureVariant(browser, baseUrl, "light");
    const darkPng = await captureVariant(browser, baseUrl, "dark");

    writeFiles(outputTargets.light, lightPng);
    writeFiles(outputTargets.dark, darkPng);

    console.log(
      `[capture:screenshot] updated ${outputTargets.light.length + outputTargets.dark.length} files (light + dark)`
    );
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error("[capture:screenshot] failed:", error);
  process.exit(1);
});
