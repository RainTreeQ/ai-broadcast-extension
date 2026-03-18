#!/usr/bin/env node

/**
 * Validate selectors directory structure and test selectors against live platforms
 * Usage: node scripts/validate-selectors.mjs
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SELECTORS_DIR = join(ROOT, 'selectors');

const REQUIRED_PLATFORMS = [
  'chatgpt', 'claude', 'gemini', 'grok', 'deepseek',
  'doubao', 'qianwen', 'yuanbao', 'kimi', 'mistral'
];

function validateStructure() {
  console.log('📋 Validating selectors/ directory structure...\n');

  if (!fs.existsSync(SELECTORS_DIR)) {
    console.error('❌ selectors/ directory not found!');
    process.exit(1);
  }

  const indexPath = join(SELECTORS_DIR, 'index.json');
  if (!fs.existsSync(indexPath)) {
    console.error('❌ selectors/index.json not found!');
    process.exit(1);
  }

  let hasErrors = false;
  let totalSelectors = 0;

  let indexConfig;
  try {
    indexConfig = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch (err) {
    console.error('❌ Invalid selectors/index.json:', err.message);
    process.exit(1);
  }

  if (typeof indexConfig.version === 'undefined') {
    console.error('❌ selectors/index.json missing version');
    hasErrors = true;
  }

  if (!Array.isArray(indexConfig.platforms)) {
    console.error('❌ selectors/index.json platforms must be an array');
    hasErrors = true;
  }

  // Check all required platforms exist
  for (const platform of REQUIRED_PLATFORMS) {
    const platformPath = join(SELECTORS_DIR, `${platform}.json`);
    if (!fs.existsSync(platformPath)) {
      console.error(`❌ Missing platform file: selectors/${platform}.json`);
      hasErrors = true;
      continue;
    }

    let config;
    try {
      config = JSON.parse(fs.readFileSync(platformPath, 'utf8'));
    } catch (err) {
      console.error(`❌ Invalid JSON in selectors/${platform}.json: ${err.message}`);
      hasErrors = true;
      continue;
    }

    if (!Array.isArray(config.findInput)) {
      console.error(`❌ ${platform}.findInput must be an array`);
      hasErrors = true;
    }

    if (!Array.isArray(config.findSendBtn)) {
      console.error(`❌ ${platform}.findSendBtn must be an array`);
      hasErrors = true;
    }

    if (config.findInput && !config.findInput.every((s) => typeof s === 'string')) {
      console.error(`❌ ${platform}.findInput contains non-string values`);
      hasErrors = true;
    }

    if (config.findSendBtn && !config.findSendBtn.every((s) => typeof s === 'string')) {
      console.error(`❌ ${platform}.findSendBtn contains non-string values`);
      hasErrors = true;
    }

    const allSelectors = [...(config.findInput || []), ...(config.findSendBtn || [])];
    for (const selector of allSelectors) {
      if (selector.includes('  ')) {
        console.warn(`⚠️  ${platform}: Selector has double spaces: "${selector}"`);
      }
      if (selector.startsWith(' ') || selector.endsWith(' ')) {
        console.warn(`⚠️  ${platform}: Selector has leading/trailing spaces: "${selector}"`);
      }
    }

    totalSelectors += (config.findInput || []).length + (config.findSendBtn || []).length;
    console.log(`✅ ${platform}: ${config.findInput.length} input selectors, ${config.findSendBtn.length} button selectors`);
  }

  if (hasErrors) {
    console.error('\n❌ Validation failed!');
    process.exit(1);
  }

  console.log('\n✅ All validations passed!');
  console.log('\n📊 Summary:');
  console.log(`   Selector directory: ${SELECTORS_DIR}`);
  console.log(`   Platforms: ${REQUIRED_PLATFORMS.length}`);
  console.log(`   Total selectors: ${totalSelectors}`);
}

validateStructure();
