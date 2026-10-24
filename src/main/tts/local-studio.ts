/** Existing Mac-only voice studio. Never send text or reference audio to a cloud. */
const BASE = 'http://127.0.0.1:8766';
export interface LocalVoice { id: string; name: string }
export async function listLocalVoices(fetcher: typeof fetch = fetch): Promise<LocalVoice[]> {
  let response: Response;
  try { response = await fetcher(`${BASE}/v1/audio/voices`, { signal: AbortSignal.timeout(10_000), redirect: 'error' }); }
  catch { throw new Error('无法连接本机声音工作台，请先打开 http://127.0.0.1:8766/。'); }
  if (!response.ok) throw new Error(`读取本机音色失败（${response.status}）。`);
  const body = await response.text();
  if (body.length > 128_000) throw new Error('音色列表过大。');
  const data = JSON.parse(body);
  if (!Array.isArray(data.voices)) throw new Error('音色列表格式无效。');
  return data.voices.filter((v: any) => typeof v.voice_id === 'string' && typeof v.name === 'string').map((v: any) => ({ id: v.voice_id, name: v.name }));
}
export async function synthesizeLocal(text: string, voiceId: string, fetcher: typeof fetch = fetch): Promise<Buffer> {
  if (!voiceId?.trim()) throw new Error('请先选择本机克隆音色。');
  if (typeof text !== 'string' || !text.trim() || text.length > 4096) throw new Error('朗读文字需为 1–4096 字符。');
  let response: Response;
  try {
    response = await fetcher(`${BASE}/v1/audio/speech`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(240_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen3-tts', input: text.trim(), voice: voiceId }),
    });
  } catch { throw new Error('本机声音合成连接失败或超时，请检查声音工作台。'); }
  if (!response.ok) throw new Error(response.status === 400 ? '所选音色不可用，请刷新音色列表后重新选择。' : `本机声音合成失败（${response.status}）。`);
  if (!response.headers.get('content-type')?.includes('audio/')) throw new Error('声音工作台未返回音频。');
  if (Number(response.headers.get('content-length')) > 32 * 1024 * 1024) throw new Error('合成音频过大。');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 32 * 1024 * 1024) throw new Error('合成音频为空或过大。');
  return bytes;
}
