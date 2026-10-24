import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listLocalVoices, synthesizeLocal } from '../src/main/tts/local-studio';
test('voice list is fetched afresh and newly saved voices appear', async()=>{
 let calls=0; const fetcher=async()=>Response.json({voices:++calls===1?[{voice_id:'a',name:'A'}]:[{voice_id:'a',name:'A'},{voice_id:'new',name:'新声音'}]});
 assert.equal((await listLocalVoices(fetcher)).length,1);
 assert.equal((await listLocalVoices(fetcher)).at(-1)?.id,'new');
});
test('synthesis passes saved voice id and returns MP3 bytes', async()=>{
 let body:any; const result=await synthesizeLocal('你好','voice-new',async(url,init)=>{
 assert.equal(String(url),'http://127.0.0.1:8766/v1/audio/speech');body=JSON.parse(String(init?.body));return new Response(new Uint8Array([73,68,51,1]),{headers:{'Content-Type':'audio/mpeg'}});
 });assert.deepEqual(body,{model:'qwen3-tts',input:'你好',voice:'voice-new'});assert.equal(result.length,4);
});
test('missing voice, service error, and non-audio results fail explicitly',async()=>{
 await assert.rejects(synthesizeLocal('你好',''),/音色/);
 await assert.rejects(synthesizeLocal('你好','deleted',async()=>new Response('',{status:400})),/音色/);
 await assert.rejects(synthesizeLocal('你好','x',async()=>Response.json({error:'bad'})),/音频/);
});
