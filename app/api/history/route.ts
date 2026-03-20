import { NextResponse } from "next/server";
import { listChats } from "@/lib/storage/s3";

export async function GET() {
  try {
    const chats = await listChats();
    return NextResponse.json({ chats });
  } catch (error) {
    console.error("Failed to fetch history:", error);
    return NextResponse.json({ chats: [] });
  }
}
