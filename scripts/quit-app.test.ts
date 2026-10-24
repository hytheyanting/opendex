import assert from 'node:assert/strict';
import { test } from 'node:test';
import { quitApp } from '../src/skills/open/quit-app';

test('quit passes an application name as a literal argument, never executable code', async () => {
  let args: string[] = [];
  const name = 'Odd " App; $(touch /tmp/should-not-exist)';
  const result = await quitApp(name, { platform: 'darwin', run: async (_file, input) => {
    args = input;
    return { stdout: '{"status":"exited"}' };
  }});
  assert.equal(args.at(-1), name);
  assert.equal(args.at(-2), '--');
  assert.equal(args[args.indexOf('-e') + 1].includes(name), false);
  assert.deepEqual(result, { ok: true, status: 'exited', application: name });
});

test('quit reports an app still running rather than claiming it closed', async () => {
  const result = await quitApp('Calculator', { platform: 'darwin', run: async () => ({ stdout: '{"status":"still_running"}' }) });
  assert.equal('error' in result, true);
});

test('quit never launches an absent app and reports not-running separately', async () => {
  const result = await quitApp('Calculator', { platform: 'darwin', run: async () => ({ stdout: '{"status":"not_running"}' }) });
  assert.deepEqual(result, { ok: true, status: 'not_running', application: 'Calculator' });
});

test('quit rejects empty names and unsupported platforms before running a process', async () => {
  const run = async () => { throw new Error('must not run'); };
  assert.equal('error' in await quitApp('', { platform: 'darwin', run }), true);
  assert.equal('error' in await quitApp('Calculator', { platform: 'linux', run }), true);
});

test('macOS interpreter treats option-looking names as data', { skip: process.platform !== 'darwin' }, async () => {
  const name = '-econsole.log("must-not-execute")';
  assert.deepEqual(await quitApp(name), { ok: true, status: 'not_running', application: name });
});
