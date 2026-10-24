import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { transcribeSenseVoice } from '../src/main/stt/sensevoice';
import { hasCommandWords } from '../src/renderer/src/lib/dex/command-text';

async function main() {
const options = {baseUrl:'https://100.125.232.11:8787', ca:readFileSync('resources/sensevoice-ca.crt')};
const wav = readFileSync(process.argv[2] ?? '../speech-web/tests/sample.wav');
const started = performance.now();
const text = await transcribeSenseVoice(wav, options);
assert.match(text, /早上9点至下午5点/);
assert.ok(hasCommandWords(text));
console.log(JSON.stringify({success:true, text, elapsed_ms:Math.round(performance.now()-started)}, null, 2));
await assert.rejects(transcribeSenseVoice(Buffer.from('not valid audio'), options), /无法读取/);
console.log('PASS: invalid audio returns a usable error');
await assert.rejects(transcribeSenseVoice(wav, {...options, timeoutMs:1}), /超时/);
console.log('PASS: stalled transport has a bounded deadline');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
