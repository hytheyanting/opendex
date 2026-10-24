import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { SelectField } from '../ui/fields';

type Voice = { id: string; name: string };
export function LocalStudioVoices({ voiceId, onChange }: { voiceId: string; onChange: (id: string) => void }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('连接本机声音工作台，读取已保存音色。');
  const generation = useRef(0);
  const refreshGeneration = useRef(0);
  const clip = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const cleanupAudio = () => {
    if (clip.current) {
      clip.current.audio.pause();
      clip.current.audio.onended = null;
      clip.current.audio.onerror = null;
      clip.current.audio.src = '';
      URL.revokeObjectURL(clip.current.url);
      clip.current = null;
    }
  };
  const stop = () => { generation.current++; cleanupAudio(); setBusy(false); };
  const refresh = async () => {
    const id = ++refreshGeneration.current;
    setLoading(true);
    try {
      const items = await window.opendex.localVoices();
      if (id !== refreshGeneration.current) return;
      setVoices(items);
      setMessage(items.length ? `已读取 ${items.length} 个音色；克隆并保存新音色后，点击刷新即可使用。` : '音色库为空，请先在工作台克隆并保存。');
    } catch (error) { if (id === refreshGeneration.current) setMessage(String((error as Error).message)); }
    finally { if (id === refreshGeneration.current) setLoading(false); }
  };
  useEffect(() => { void refresh(); return () => { refreshGeneration.current++; }; }, []);
  useEffect(() => {
    stop();
    return () => { generation.current++; cleanupAudio(); };
  }, [voiceId]);
  const preview = async () => {
    stop();
    const id = generation.current;
    setBusy(true);
    setMessage('正在本机生成试听，首次加载模型可能较慢…');
    const started = Date.now();
    try {
      const bytes = await window.opendex.synthesizeLocal('你好，这是我的本机克隆音色。很高兴为你服务。', voiceId);
      if (id !== generation.current) return;
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      const audio = new Audio(url);
      clip.current = { audio, url };
      const name = voices.find(v => v.id === voiceId)?.name ?? voiceId;
      const finish = (error?: string) => {
        if (id !== generation.current) return;
        cleanupAudio(); setBusy(false);
        setMessage(error ?? `试听完成：${name}`);
      };
      audio.onended = () => finish();
      audio.onerror = () => finish('音频播放失败，请重试。');
      await audio.play();
      if (id === generation.current) setMessage(`正在试听：${name}（生成耗时 ${((Date.now() - started) / 1000).toFixed(1)} 秒）`);
    } catch (error) {
      if (id === generation.current) { cleanupAudio(); setBusy(false); setMessage(String((error as Error).message)); }
    }
  };
  const available = voices.some(v => v.id === voiceId);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">本机声音工作台 · http://127.0.0.1:8766/ · 语音在 Mac 本地生成。</p>
      <SelectField label="克隆音色" value={voiceId} options={[
        { value: '', label: '请选择音色' },
        ...(!available && voiceId ? [{ value: voiceId, label: '所选音色暂不可用，请刷新' }] : []),
        ...voices.map(v => ({ value: v.id, label: v.name })),
      ]} onChange={onChange} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void refresh()}>{loading ? '读取中…' : '刷新音色'}</Button>
        <Button type="button" size="sm" disabled={!available || busy} onClick={() => void preview()}>试听克隆音色</Button>
        <Button type="button" size="sm" variant="outline" disabled={!busy} onClick={() => { stop(); setMessage('试听已停止；已开始的本机生成可能仍会继续完成。'); }}>停止试听</Button>
      </div>
      <p role="status" className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
