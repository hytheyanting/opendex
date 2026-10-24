import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);
// Fixed code; user/model input is passed only through argv. NSWorkspace looks
// up running apps without launching them. terminate requests a normal quit;
// an app can refuse or present its own save dialog. Never forceTerminate.
const QUIT_SCRIPT = `
ObjC.import('AppKit');
function run(argv) {
  const wanted = argv[0].toLowerCase().replace(/\\.app$/, '');
  const apps = $.NSWorkspace.sharedWorkspace.runningApplications;
  const matches = [];
  for (let i = 0; i < apps.count; i++) {
    const a = apps.objectAtIndex(i);
    const name = ObjC.unwrap(a.localizedName) || '';
    const id = ObjC.unwrap(a.bundleIdentifier) || '';
    if (name.toLowerCase() === wanted || id.toLowerCase() === wanted) matches.push(a);
  }
  if (!matches.length) return JSON.stringify({status:'not_running'});
  if (matches.length !== 1) return JSON.stringify({status:'ambiguous'});
  const app = matches[0];
  const id = ObjC.unwrap(app.bundleIdentifier) || '';
  if (['io.opendex.app','com.apple.finder','com.apple.dock','com.apple.loginwindow','com.apple.systemuiserver'].includes(id.toLowerCase())) {
    return JSON.stringify({status:'protected'});
  }
  const pid = app.processIdentifier;
  app.terminate;
  for (let n = 0; n < 20; n++) {
    $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.1));
    const current = $.NSWorkspace.sharedWorkspace.runningApplications;
    let running = false;
    for (let i = 0; i < current.count; i++) {
      if (current.objectAtIndex(i).processIdentifier === pid) running = true;
    }
    if (!running) return JSON.stringify({status:'exited'});
  }
  return JSON.stringify({status:'still_running'});
}`;

type Run = (file: string, args: string[]) => Promise<{ stdout: string }>;
export async function quitApp(name: string, options: { platform?: string; run?: Run } = {}) {
  const application = name.trim();
  if (!application || application.length > 256 || /[\x00-\x1f]/.test(application)) {
    return { error: '请填写有效的应用名称或 bundle ID。' };
  }
  if ((options.platform ?? process.platform) !== 'darwin') return { error: '直接退出应用目前仅支持 macOS。' };
  const run: Run = options.run ?? ((file, args) => execute(file, args, { timeout: 10_000, maxBuffer: 64 * 1024 }));
  try {
    const { stdout } = await run('/usr/bin/osascript', ['-l', 'JavaScript', '-e', QUIT_SCRIPT, '--', application]);
    const { status } = JSON.parse(stdout);
    if (status === 'exited' || status === 'not_running') return { ok: true, status, application };
    if (status === 'still_running') return { error: '已请求正常退出，但应用仍在运行；可能正在等待保存确认，请用户检查。不会强制结束进程。' };
    if (status === 'ambiguous') return { error: '找到多个同名应用，请提供确切的 bundle ID。' };
    if (status === 'protected') return { error: '不能通过此工具退出 OpenDex 或系统桌面组件。' };
    return { error: '无法确认应用退出状态。' };
  } catch {
    return { error: '退出请求失败或超时，请检查 macOS 提示与目标应用状态。' };
  }
}
