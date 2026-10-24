import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSystemVoice } from '../src/renderer/src/lib/dex/system-voice';
const voices = [{voiceURI:'mandarin',name:'Tingting',lang:'zh-CN'}, {voiceURI:'grandma',name:'Grandma',lang:'zh-CN'}] as SpeechSynthesisVoice[];
test('an explicit voice resolves exactly and missing choices are not silently replaced', () => {
 assert.equal(resolveSystemVoice(voices, 'grandma')?.name, 'Grandma');
 assert.equal(resolveSystemVoice(voices, 'removed'), null);
});
test('default prefers Mandarin; empty lists report unavailable', () => {
 assert.equal(resolveSystemVoice(voices, null)?.voiceURI, 'mandarin');
 assert.equal(resolveSystemVoice([], null), null);
});
