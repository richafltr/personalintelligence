import { NextRequest, NextResponse } from "next/server";
import { loadChat } from "@/lib/storage/s3";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = (await params).id;
    const doc = await loadChat(id);

    if (!doc) {
      return NextResponse.json({ messages: [], metadata: null });
    }

    return NextResponse.json({
      messages: doc.messages,
      metadata: doc.metadata,
    });
  } catch (error) {
    console.error("Failed to load chat:", error);
    return NextResponse.json({ messages: [] });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = (await params).id;
    const { deleteChat } = await import("@/lib/storage/s3");
    await deleteChat(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete chat:", error);
    return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
  }
}
