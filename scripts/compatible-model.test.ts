import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { createCompatibleModel } from '../src/main/agent/llm/compatible-model';

test('compatible provider uses Chat Completions and preserves images/tools', async () => {
  let target = '', body: any;
  const model = createCompatibleModel({
    apiKey: 'synthetic-test-key', baseURL:'https://example.invalid/v1/', model:'Kimi-K2.5',
    fetch: async (input, init) => {
      target = String(input); body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({id:'test', object:'chat.completion', created:1, model:'Kimi-K2.5',
        choices:[{index:0, message:{role:'assistant', content:null, tool_calls:[{id:'call_test', type:'function', function:{name:'echo', arguments:'{"text":"好的"}'}}]}, finish_reason:'tool_calls'}],
        usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}), {headers:{'Content-Type':'application/json'}});
    },
  });
  const result = await generateText({model, messages:[{role:'user', content:[
    {type:'text', text:'看图后调用 echo'},
    {type:'image', image:new Uint8Array([137,80,78,71,13,10,26,10]), mediaType:'image/png'},
  ]}], tools:{echo:tool({description:'echo', inputSchema:z.object({text:z.string()})})}});
  assert.equal(target, 'https://example.invalid/v1/chat/completions');
  assert.equal(body.model, 'Kimi-K2.5');
  assert.equal(body.messages[0].content[1].type, 'image_url');
  assert.equal(body.tools[0].function.name, 'echo');
  assert.equal(result.toolCalls[0].toolName, 'echo');
});

test('compatible endpoint rejects plaintext and URL credentials', () => {
  for (const baseURL of ['http://example.invalid/v1', 'https://user:pass@example.invalid/v1', 'https://example.invalid/v1?key=test']) {
    assert.throws(() => createCompatibleModel({apiKey:'test',baseURL,model:'test'}), /HTTPS|凭据|地址/);
  }
});
