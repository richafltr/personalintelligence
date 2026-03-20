import { createOpenAI } from "@ai-sdk/openai";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";

const do_inference = createOpenAI({
  apiKey: process.env.MODEL_ACCESS_KEY,
  baseURL: "https://inference.do-ai.run/v1",
});

// IMPORTANT: Use .chat() to force the chat completions API (/v1/chat/completions)
// The default do_inference("model") uses the Responses API (/v1/responses)
// which DigitalOcean Inference does NOT support.
export const myProvider = customProvider({
  languageModels: {
    "kimi-k2.5": wrapLanguageModel({
      middleware: extractReasoningMiddleware({
        tagName: "think",
      }),
      model: do_inference.chat("kimi-k2.5"),
    }),
    "nvidia-nemotron": wrapLanguageModel({
      middleware: extractReasoningMiddleware({
        tagName: "think",
      }),
      model: do_inference.chat("nvidia-nemotron-3-super-120b"),
    }),
    "glm-5": wrapLanguageModel({
      middleware: extractReasoningMiddleware({
        tagName: "think",
      }),
      model: do_inference.chat("glm-5"),
    }),
    "gpt-oss-120b": wrapLanguageModel({
      middleware: extractReasoningMiddleware({
        tagName: "think",
      }),
      model: do_inference.chat("openai-gpt-oss-120b"),
    }),
  },
});

export type modelID = Parameters<(typeof myProvider)["languageModel"]>["0"];

export const models: Record<modelID, string> = {
  "kimi-k2.5": "Kimi-k2.5",
  "nvidia-nemotron": "Nvidia Nemotron",
  "glm-5": "GLM-5",
  "gpt-oss-120b": "GPT-OSS 120B",
};

export const modelCapabilities: Record<modelID, { supportsImages: boolean }> = {
  // DO Inference currently does not support image URLs or base64 in any request
  // Images are saved to S3 for storage but cannot be passed to the model
  "kimi-k2.5": { supportsImages: false },
  "nvidia-nemotron": { supportsImages: false },
  "glm-5": { supportsImages: false },
  "gpt-oss-120b": { supportsImages: false },
};
