import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasCommandWords } from '../src/renderer/src/lib/dex/command-text';
import { transcribeSenseVoice } from '../src/main/stt/sensevoice';

test('Chinese and multilingual spoken commands are accepted', () => {
  for (const command of ['打开浏览器', '把这段文字输入记事本', '開啟網頁', '検索して', 'open Safari', '123']) {
    assert.equal(hasCommandWords(command), true, command);
  }
  for (const noise of ['', '  ', '.', '♪', '…', '🎵']) assert.equal(hasCommandWords(noise), false);
});

test('voice transport requires HTTPS', async () => {
  await assert.rejects(transcribeSenseVoice(Buffer.from('audio'), {baseUrl:'http://127.0.0.1', ca:'test'}), /HTTPS/);
});

test('cancelled transport never uploads audio', async () => {
  const ac = new AbortController(); ac.abort();
  await assert.rejects(transcribeSenseVoice(Buffer.from('audio'), {baseUrl:'https://127.0.0.1', ca:'test', signal:ac.signal}), /abort/i);
});

test('empty audio is rejected before network access', async () => {
  await assert.rejects(transcribeSenseVoice(Buffer.alloc(0), {baseUrl:'https://127.0.0.1', ca:'test'}), /音频|audio/i);
});
