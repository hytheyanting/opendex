import { Agent, request } from 'node:https';
import { setTimeout as delay } from 'node:timers/promises';

export interface SenseVoiceOptions {
  baseUrl: string;
  ca: string | Buffer;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Upload one utterance to the private Ubuntu service, then await its result. */
export async function transcribeSenseVoice(wav: Buffer, options: SenseVoiceOptions): Promise<string> {
  options.signal?.throwIfAborted();
  if (!wav.length) throw new Error('音频为空，请重新录音。');
  const base = new URL(options.baseUrl);
  if (base.protocol !== 'https:') throw new Error('SenseVoice requires HTTPS.');
  const agent = new Agent({ ca: options.ca, keepAlive: true });
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new Error('Ubuntu 转写超时，请检查 NetBird 后重试。')), options.timeoutMs ?? 60000);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline.signal]) : deadline.signal;

  function json(path: string, body?: Buffer): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const req = request(new URL(path, base), {
        method: body ? 'POST' : 'GET', agent, signal,
        headers: body ? {
          'Content-Type': 'application/octet-stream', 'Content-Length': body.length,
          'X-Speech-Request': '1', 'X-File-Name': 'command.wav',
        } : {},
      }, res => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 1024 * 1024) { res.destroy(new Error('转写响应过大。')); return; }
          chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () => {
          try {
            const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('转写服务返回格式错误。');
            if (res.statusCode !== 200 && res.statusCode !== 202) throw new Error(typeof result.message === 'string' ? result.message : 'Ubuntu 转写服务暂时不可用。');
            resolve(result);
          } catch (error) { reject(error); }
        });
      });
      req.on('error', reject);
      req.end(body);
    });
  }

  try {
    const job = await json('/api/jobs', wav);
    if (typeof job.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(job.id)) throw new Error('转写服务未返回有效任务。');
    while (true) {
      signal.throwIfAborted();
      const result = await json(`/api/jobs/${job.id}`);
      if (result.status === 'done') {
        if (typeof result.text !== 'string') throw new Error('转写结果缺少文字。');
        return result.text.trim();
      }
      if (result.status === 'error') throw new Error(typeof result.message === 'string' ? result.message : 'Ubuntu 转写失败。');
      if (!['queued', 'converting', 'transcribing'].includes(String(result.status))) throw new Error('转写任务状态无效。');
      await delay(300, undefined, { signal });
    }
  } catch (error) {
    if (deadline.signal.aborted) throw deadline.signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    agent.destroy();
  }
}
