import { modelID, myProvider } from "@/lib/models";
import { convertToModelMessages, smoothStream, streamText, UIMessage } from "ai";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const {
    messages,
    selectedModelId,
  }: {
    messages: Array<UIMessage>;
    selectedModelId: modelID;
  } = await request.json();

  // Strip reasoning parts from messages before converting to prevent
  // any issues when switching models mid-conversation
  const cleanedMessages = messages.map((msg) => ({
    ...msg,
    parts: (msg.parts || []).filter((part) => part.type !== "reasoning"),
  }));

  const stream = streamText({
    system:
      "You are Richa's Personal Intelligence, a highly capable reasoning AI. You prioritize accuracy, depth, and helpfulness.",
    model: myProvider.languageModel(selectedModelId),
    experimental_transform: [
      smoothStream({
        chunking: "word",
      }),
    ],
    messages: await convertToModelMessages(cleanedMessages),
  });

  return stream.toUIMessageStreamResponse({
    sendReasoning: true,
    onError: (error) => {
      console.error("[chat] Error:", error);
      return `An error occurred, please try again!`;
    },
  });
}
