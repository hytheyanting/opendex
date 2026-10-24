import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import type { SystemVoiceOptions } from '../../lib/dex/speech-engine';
import { resolveSystemVoice, systemUtterance } from '../../lib/dex/system-voice';

export function SystemVoicePreview({ options }: { options: SystemVoiceOptions }) {
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('点击试听当前选择的声音，不调用云端模型。');
  const generation = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const stop = () => {
    generation.current++;
    if (utteranceRef.current) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setPlaying(false);
  };
  useEffect(() => {
    stop();
    setMessage('点击试听当前选择的声音，不调用云端模型。');
    return () => {
      generation.current++;
      if (utteranceRef.current) window.speechSynthesis.cancel();
      utteranceRef.current = null;
    };
  }, [options.voiceURI, options.rate, options.pitch]);

  const preview = () => {
    stop();
    const voice = resolveSystemVoice(window.speechSynthesis.getVoices(), options.voiceURI);
    if (!voice) {
      setMessage(options.voiceURI ? '所选声音在当前窗口不可用，请重新选择或下载该声音；此次没有回退播放默认声音。' : '声音列表尚未就绪，请稍后重试。');
      return;
    }
    const id = generation.current;
    const utterance = systemUtterance('你好，这是 OpenDex 的声音试听。你可以选择喜欢的声音，再开始对话。', voice, options);
    utteranceRef.current = utterance;
    setMessage(`试听使用：${voice.name}（${voice.lang}）`);
    setPlaying(true);
    const finish = (error?: string) => {
      if (generation.current !== id) return;
      utteranceRef.current = null;
      setPlaying(false);
      setMessage(error ? `试听失败：${error}` : `试听完成：${voice.name}（${voice.lang}）`);
    };
    utterance.onend = () => finish();
    utterance.onerror = event => finish(event.error);
    // A new audition replaces any previous preview in this settings window.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={preview}>试听声音</Button>
        <Button type="button" size="sm" variant="outline" disabled={!playing} onClick={() => { stop(); setMessage('试听已停止。'); }}>停止试听</Button>
      </div>
      <p role="status" className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
