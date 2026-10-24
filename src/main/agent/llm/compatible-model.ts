import { createOpenAI } from "@ai-sdk/openai";

/** Use Chat Completions, as compatible gateways need not implement Responses. */
export function createCompatibleModel(options: {
  apiKey: string;
  baseURL: string;
  model: string;
  fetch?: typeof globalThis.fetch;
}) {
  const url = new URL(options.baseURL);
  if (url.protocol !== "https:") throw new Error("API 地址必须使用 HTTPS");
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("API 地址不能包含凭据、查询参数或片段");
  }
  if (!options.apiKey.trim() || !options.model.trim()) throw new Error("请填写 API 密钥和模型名称");
  return createOpenAI({
    apiKey: options.apiKey,
    baseURL: url.toString().replace(/\/$/, ""),
    fetch: options.fetch,
  }).chat(options.model.trim());
}
