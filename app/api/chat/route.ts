import { modelID, myProvider, modelCapabilities } from "@/lib/models";
import { convertToModelMessages, smoothStream, streamText, UIMessage } from "ai";
import { NextRequest } from "next/server";
import { saveFile, fileExists, bucket } from "@/lib/storage/s3";
import crypto from "crypto";

const spacesRegion = process.env.SPACES_REGION!;

/**
 * Upload a base64 data URL to S3 and return the public URL.
 * This is required because DO Inference only supports external image URLs,
 * not inline base64 data URLs.
 */
async function uploadImageForInference(dataUrl: string, chatId?: string): Promise<string | null> {
  try {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const mediaType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, "base64");
    const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    const ext = mediaType.split("/")[1] || "png";
    const key = chatId
      ? `chats/${chatId}/images/${hash}.${ext}`
      : `inference-images/${hash}.${ext}`;
    
    const exists = await fileExists(key);
    if (!exists) {
      await saveFile(key, buffer, mediaType);
    }
    return `https://${bucket}.${spacesRegion}.digitaloceanspaces.com/${key}`;
  } catch (err) {
    console.error("[chat] Failed to upload image for inference:", err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const {
    messages,
    selectedModelId,
  }: {
    messages: Array<UIMessage>;
    selectedModelId: modelID;
  } = await request.json();

  const capabilities = modelCapabilities[selectedModelId] ?? { supportsImages: false };

  // Strip reasoning parts + handle images per model capability
  const cleanedMessages = await Promise.all(
    messages.map(async (msg) => {
      const filteredParts = await Promise.all(
        (msg.parts || []).map(async (part: any) => {
          // Always remove reasoning parts
          if (part.type === "reasoning") return null;

          // Handle file/image parts
          if (part.type === "file" && part.mediaType?.startsWith("image/")) {
            if (!capabilities.supportsImages) {
              // Text-only model — drop the image entirely
              return null;
            }
            // Vision model — convert base64 to public URL so DO Inference can load it
            if (part.url?.startsWith("data:")) {
              const chatId = messages[0]?.id;
              const publicUrl = await uploadImageForInference(part.url, chatId);
              if (!publicUrl) return null;
              return { ...part, url: publicUrl };
            }
          }
          return part;
        })
      );

      return {
        ...msg,
        parts: filteredParts.filter(Boolean),
      };
    })
  );

  const stream = streamText({
    system:
      "You are Richa's Personal Intelligence, a highly capable reasoning AI. You prioritize accuracy, depth, and helpfulness.",
    model: myProvider.languageModel(selectedModelId),
    experimental_transform: [
      smoothStream({
        chunking: "word",
      }),
    ],
    messages: await convertToModelMessages(cleanedMessages as UIMessage[]),
  });

  return stream.toUIMessageStreamResponse({
    sendReasoning: true,
    onError: (error) => {
      console.error("[chat] Error:", error);
      return `An error occurred, please try again!`;
    },
  });
}
