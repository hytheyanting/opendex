// Run with the packaged Electron executable and ELECTRON_RUN_AS_NODE=1.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { join, resolve } = require('node:path');
const { readFileSync } = require('node:fs');
const root = join(resolve(process.argv[2]), 'Contents/Resources/app.asar');
const packagedRequire = createRequire(join(root, 'out/main/index.js'));
for (const name of ['ai', '@ai-sdk/anthropic', '@ai-sdk/openai', '@ai-sdk/xai', '@ai-sdk/gateway', '@nut-tree-fork/nut-js', 'dotenv', 'zod', '@elevenlabs/elevenlabs-js']) {
  packagedRequire(name);
  console.log('PASS packaged dependency:', name);
}
assert.match(readFileSync(join(root, 'resources/sensevoice-ca.crt'), 'utf8'), /BEGIN CERTIFICATE/);
console.log('PASS bundled public CA');
