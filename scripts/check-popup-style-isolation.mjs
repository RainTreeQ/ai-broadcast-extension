#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';

const POPUP_ENTRY_PATH = path.resolve(process.cwd(), 'app/src/popup/main.jsx');
const FORBIDDEN_INDEX_CSS_IMPORT_PATTERN = /import\s+['"][^'"]*\.\.\/[^'"]*index\.css['"]\s*;?/m;
const REQUIRED_POPUP_CSS_IMPORT_PATTERN = /import\s+['"]\.\/popup\.css['"]\s*;?/m;

function fail(message) {
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

if (!fs.existsSync(POPUP_ENTRY_PATH)) {
  fail(`Missing popup entry: ${POPUP_ENTRY_PATH}`);
  process.exit(1);
}

const source = fs.readFileSync(POPUP_ENTRY_PATH, 'utf8');
let hasFailure = false;

if (FORBIDDEN_INDEX_CSS_IMPORT_PATTERN.test(source)) {
  fail('app/src/popup/main.jsx imports index.css through a parent path.');
  hasFailure = true;
} else {
  pass('No parent-path index.css import found in app/src/popup/main.jsx.');
}

if (REQUIRED_POPUP_CSS_IMPORT_PATTERN.test(source)) {
  pass('Required ./popup.css import found in app/src/popup/main.jsx.');
} else {
  fail('Missing required ./popup.css import in app/src/popup/main.jsx.');
  hasFailure = true;
}

if (hasFailure) {
  process.exit(1);
}

pass('Popup style isolation guard passed.');
