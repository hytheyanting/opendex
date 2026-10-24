import type { SystemVoiceOptions } from './speech-engine';

/** Explicit choices must match; callers can distinguish a missing installed voice. */
export function resolveSystemVoice(voices: SpeechSynthesisVoice[], voiceURI: string | null): SpeechSynthesisVoice | null {
  if (voiceURI) return voices.find(v => v.voiceURI === voiceURI) ?? null;
  return voices.find(v => /^zh[-_](CN|Hans)/i.test(v.lang))
    ?? voices.find(v => v.lang?.startsWith('zh')) ?? voices[0] ?? null;
}

export function systemUtterance(text: string, voice: SpeechSynthesisVoice | null, options: SystemVoiceOptions) {
  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
  utterance.rate = options.rate;
  utterance.pitch = options.pitch;
  return utterance;
}
