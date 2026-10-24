import type { SttProvider } from "../config/schema";
import { transcribeOpenAI } from "./openai";
import { app } from "electron";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { transcribeSenseVoice } from "./sensevoice";

// Provider switch for cloud transcription. Web Speech is handled entirely in
// the renderer and never reaches here. New cloud providers (Deepgram, etc.)
// slot in alongside OpenAI.
export async function transcribe(
  provider: SttProvider,
  wav: Buffer,
): Promise<string> {
  switch (provider) {
    case "sensevoice":
      return transcribeSenseVoice(wav, {
        baseUrl: "https://100.125.232.11:8787",
        ca: readFileSync(join(app.getAppPath(), "resources", "sensevoice-ca.crt")),
      });
    case "openai":
      return transcribeOpenAI(wav);
    default:
      throw new Error(`Provider "${provider}" is not a cloud STT provider.`);
  }
}
