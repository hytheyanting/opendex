// FIFO TTS playback queue. Each enqueued sentence is synthesized in the main
// process (via window.opendex.synthesize) in parallel, then audio elements are
// played strictly in order so the speech is gapless even if later requests
// resolve before earlier ones.
//
// If the browser blocks playback (autoplay policy — no user gesture yet), the
// player parks the queue and notifies the orchestrator via `onAudioBlocked`.
// Calling `unlock()` after a user gesture resumes the queue.

interface QueuedClip {
  text: string;
  blobPromise?: Promise<Blob>;
  signal: AbortSignal;
}

export interface TtsPlayerCallbacks {
  onStateChange: (speaking: boolean) => void;
  onAudioBlocked: () => void;
  onError?: (message: string) => void;
  /** Fires when a queued clip actually starts playing (for spoken-progress UI). */
  onChunkStart?: (text: string) => void;
}

export class TtsPlayer {
  private queue: QueuedClip[] = [];
  private playing = false;
  private currentAudio: HTMLAudioElement | null = null;
  private abortController: AbortController | null = null;
  private audioBlocked = false;
  private unlockResolver: (() => void) | null = null;

  private generation = 0;
  private cancelPlayback: (() => void) | null = null;

  constructor(private readonly cb: TtsPlayerCallbacks, private readonly sequential = false) {}

  enqueue(text: string) {
    if (!text.trim()) return;
    if (!this.abortController) this.abortController = new AbortController();
    const signal = this.abortController.signal;
    // Synthesis happens in the main process (keys never reach the renderer).
    // We get raw MP3 bytes back and wrap them in a Blob for playback.
    const blobPromise = this.sequential ? undefined : this.synthesize(text, signal);
    void blobPromise?.catch(() => {});
    this.queue.push({ text, blobPromise, signal });
    void this.pump();
  }

  private synthesize(text: string, signal: AbortSignal): Promise<Blob> {
    return window.opendex.synthesize(text).then(bytes => {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      return new Blob([bytes], { type: "audio/mpeg" });
    });
  }

  private async pump() {
    if (this.playing) return;
    const next = this.queue.shift();
    if (!next) return;
    const generation = this.generation;
    this.playing = true;
    this.cb.onStateChange(true);
    try {
      const blob = await (next.blobPromise ?? this.synthesize(next.text, next.signal));
      if (next.signal.aborted || generation !== this.generation) return;
      await this.playBlob(blob, next.text);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[opendex tts] playback error", err);
        if (generation === this.generation) this.cb.onError?.((err as Error).message);
      }
    } finally {
      if (generation !== this.generation) return;
      this.playing = false;
      if (this.queue.length > 0) {
        void this.pump();
      } else {
        this.cb.onStateChange(false);
      }
    }
  }

  private playBlob(blob: Blob, text: string): Promise<void> {
    const generation = this.generation;
    return new Promise<void>((resolve, reject) => {
      const tryPlay = async () => {
        if (generation !== this.generation) return resolve();
        if (this.audioBlocked) await this.waitForUnlock();
        if (generation !== this.generation) return resolve();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        this.currentAudio = audio;
        // Report spoken progress when the clip actually begins playing.
        audio.onplay = () => this.cb.onChunkStart?.(text);
        this.cancelPlayback = () => {
          audio.pause();
          audio.onended = null;
          audio.onerror = null;
          audio.src = "";
          URL.revokeObjectURL(url);
          this.cancelPlayback = null;
          resolve();
        };
        audio.onended = () => {
          this.cancelPlayback = null;
          URL.revokeObjectURL(url);
          if (this.currentAudio === audio) this.currentAudio = null;
          resolve();
        };
        audio.onerror = () => {
          this.cancelPlayback = null;
          URL.revokeObjectURL(url);
          if (this.currentAudio === audio) this.currentAudio = null;
          reject(new Error("Audio playback failed."));
        };
        try {
          await audio.play();
        } catch (err) {
          URL.revokeObjectURL(url);
          if (this.currentAudio === audio) this.currentAudio = null;
          this.cancelPlayback = null;
          if (generation !== this.generation) return resolve();
          if ((err as Error).name === "NotAllowedError") {
            // Park the queue and ask for an unlock gesture.
            this.audioBlocked = true;
            this.cb.onAudioBlocked();
            void tryPlay();
            return;
          }
          reject(err);
        }
      };
      void tryPlay();
    });
  }

  private waitForUnlock(): Promise<void> {
    return new Promise((resolve) => {
      this.unlockResolver = resolve;
    });
  }

  unlock() {
    this.audioBlocked = false;
    const r = this.unlockResolver;
    this.unlockResolver = null;
    r?.();
  }

  stop() {
    this.generation++;
    const unlock = this.unlockResolver;
    this.unlockResolver = null;
    this.audioBlocked = false;
    unlock?.();
    this.cancelPlayback?.();
    this.queue = [];
    this.abortController?.abort();
    this.abortController = null;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = "";
      this.currentAudio = null;
    }
    if (this.playing) {
      this.playing = false;
      this.cb.onStateChange(false);
    }
  }

  get isSpeaking() {
    return this.playing || this.queue.length > 0;
  }

  get isBlocked() {
    return this.audioBlocked;
  }
}
