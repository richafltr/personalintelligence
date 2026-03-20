import { NextRequest, NextResponse } from "next/server";
import { saveChat } from "@/lib/storage/s3";

// Extend Vercel function timeout to 60s for S3 operations
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { messages, model } = await request.json();
    const id = (await params).id;

    // Use the new structured storage system
    const doc = await saveChat(id, messages, model || "kimi-k2.5");

    return NextResponse.json({
      success: true,
      chatId: doc.id,
      messageCount: doc.metadata.messageCount,
      hasImages: doc.metadata.hasImages,
    });
  } catch (error) {
    console.error("Failed to save chat:", error);
    return NextResponse.json(
      { error: "Failed to save chat" },
      { status: 500 }
    );
  }
}
