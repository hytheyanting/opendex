import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TtsPlayer } from '../src/renderer/src/lib/dex/tts-player';
const tick=()=>new Promise(r=>setTimeout(r,0));

test('local speech stays serial and stop discards late audio without disturbing a fresh request', async()=>{
 const originalWindow=globalThis.window, originalAudio=globalThis.Audio;
 const resolves:((bytes:ArrayBuffer)=>void)[]=[]; const audios:any[]=[];
 (globalThis as any).window={opendex:{synthesize:()=>new Promise(r=>resolves.push(r))}};
 (globalThis as any).Audio=class { src=''; onplay:any; onended:any; onerror:any; constructor(){audios.push(this)} play(){this.onplay?.();return Promise.resolve()} pause(){} };
 try {
  const p=new TtsPlayer({onStateChange:()=>{},onAudioBlocked:()=>{}},true);
  p.enqueue('旧的第一段');p.enqueue('旧的第二段');assert.equal(resolves.length,1);
  p.stop();p.enqueue('新指令');assert.equal(resolves.length,2);
  resolves[0](new Uint8Array([1]).buffer);await tick();assert.equal(audios.length,0);
  resolves[1](new Uint8Array([2]).buffer);await tick();assert.equal(audios.length,1);assert.equal(p.isSpeaking,true);
  p.enqueue('新指令第二段');assert.equal(resolves.length,2);
  audios[0].onended();await tick();assert.equal(resolves.length,3);
  p.stop();resolves[2](new Uint8Array([3]).buffer);await tick();assert.equal(audios.length,1);assert.equal(p.isSpeaking,false);
 } finally {(globalThis as any).window=originalWindow;(globalThis as any).Audio=originalAudio;}
});

test('unlock after stop cannot revive an autoplay-blocked old clip', async()=>{
 const originalWindow=globalThis.window, originalAudio=globalThis.Audio;
 const audios:any[]=[];let plays=0;
 (globalThis as any).window={opendex:{synthesize:async()=>new Uint8Array([1]).buffer}};
 (globalThis as any).Audio=class {src='';onplay:any;onended:any;onerror:any;constructor(){audios.push(this)}play(){plays++;if(plays===1)return Promise.reject(new DOMException('blocked','NotAllowedError'));return Promise.resolve()}pause(){}};
 try {
  const p=new TtsPlayer({onStateChange:()=>{},onAudioBlocked:()=>{}},true);
  p.enqueue('旧内容');await tick();assert.equal(plays,1);
  p.stop();p.unlock();await tick();assert.equal(plays,1);assert.equal(audios.length,1);assert.equal(p.isSpeaking,false);
 }finally{(globalThis as any).window=originalWindow;(globalThis as any).Audio=originalAudio;}
});
