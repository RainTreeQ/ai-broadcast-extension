#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const esbuildBin = join(ROOT, 'app', 'node_modules', '.bin', 'esbuild')

if (!existsSync(esbuildBin)) {
  throw new Error('Missing app/node_modules/.bin/esbuild. Run npm install in app/')
}

const PLATFORMS = [
  'chatgpt', 'claude', 'gemini', 'grok', 'deepseek',
  'mistral', 'doubao', 'qianwen', 'yuanbao', 'kimi'
]

const builds = [
  {
    source: join(ROOT, 'src', 'content', 'core-entry.js'),
    output: join(ROOT, 'content-core.js'),
    label: 'content-core.js'
  },
  ...PLATFORMS.map(platform => ({
    source: join(ROOT, 'src', 'content', 'entries', `${platform}.js`),
    output: join(ROOT, `content-${platform}.js`),
    label: `content-${platform}.js`
  }))
]

for (const { source, output, label } of builds) {
  if (!existsSync(source)) {
    throw new Error(`Missing entry file: ${source}`)
  }
  execFileSync(esbuildBin, [source, '--bundle', '--format=iife', `--outfile=${output}`], {
    stdio: 'inherit',
  })
  console.log(`[build:content] Built ${label}`)
}

console.log(`[build:content] Done — ${builds.length} files (1 core + ${PLATFORMS.length} platform)`)
