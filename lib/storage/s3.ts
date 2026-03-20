import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────
// S3 Client Setup
// ─────────────────────────────────────────────────────────────

const s3Client = new S3Client({
  forcePathStyle: false,
  endpoint: process.env.SPACES_ENDPOINT!,
  region: process.env.SPACES_REGION!,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY!,
  },
});

export const bucket = process.env.SPACES_BUCKET!;
const spacesRegion = process.env.SPACES_REGION!;

function getPublicUrl(key: string): string {
  return `https://${bucket}.${spacesRegion}.digitaloceanspaces.com/${key}`;
}

// ─────────────────────────────────────────────────────────────
// Low-level S3 operations
// ─────────────────────────────────────────────────────────────

export async function saveFile(
  key: string,
  content: string | Buffer,
  contentType: string = "application/json"
): Promise<string> {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
      ACL: "public-read",
    },
  });
  await upload.done();
  return getPublicUrl(key);
}

export async function getFile(key: string): Promise<string | null> {
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(command);
    return (await response.Body?.transformToString()) ?? null;
  } catch (error: any) {
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
}

export async function listFiles(prefix: string) {
  const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix });
  const response = await s3Client.send(command);
  return response.Contents || [];
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Types for our NoSQL-like chat database
// ─────────────────────────────────────────────────────────────

export interface ChatMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  messageCount: number;
  hasImages: boolean;
}

export interface ChatImageRef {
  /** S3 key where the image is stored */
  key: string;
  /** Public URL to access the image */
  url: string;
  /** Original data URL or mime-type identifier */
  mediaType: string;
  /** SHA-256 hash for deduplication */
  hash: string;
}

export interface ChatMessagePart {
  type: "text" | "reasoning" | "file";
  text?: string;
  /** For file parts - the S3 URL (not the data URL) */
  url?: string;
  mediaType?: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: ChatMessagePart[];
  /** Which model generated this (for assistant messages) */
  model?: string;
  /** Timestamp of this individual message */
  timestamp: string;
}

export interface ChatDocument {
  id: string;
  metadata: ChatMetadata;
  messages: StoredMessage[];
}

// ─────────────────────────────────────────────────────────────
// Chat Index (master list of all chats, stored as index.json)
// ─────────────────────────────────────────────────────────────

const INDEX_KEY = "chats/index.json";

async function loadIndex(): Promise<ChatMetadata[]> {
  const raw = await getFile(INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveIndex(index: ChatMetadata[]): Promise<void> {
  await saveFile(INDEX_KEY, JSON.stringify(index, null, 2));
}

// ─────────────────────────────────────────────────────────────
// Image Storage — per-chat image folder
// ─────────────────────────────────────────────────────────────

/**
 * Extract and upload images from message parts.
 * Replaces data:image/* URLs with S3 URLs.
 * Returns the modified parts array and a list of image refs.
 */
export async function processAndUploadImages(
  chatId: string,
  parts: ChatMessagePart[]
): Promise<{ parts: ChatMessagePart[]; imageRefs: ChatImageRef[] }> {
  const imageRefs: ChatImageRef[] = [];
  const processedParts: ChatMessagePart[] = [];

  for (const part of parts) {
    if (part.type === "file" && part.url?.startsWith("data:")) {
      // Extract binary from data URL
      const match = part.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mediaType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, "base64");

        // Hash for deduplication
        const hash = crypto
          .createHash("sha256")
          .update(buffer)
          .digest("hex")
          .slice(0, 16);
        const ext = mediaType.split("/")[1] || "png";
        const imageKey = `chats/${chatId}/images/${Date.now()}-${hash}.${ext}`;

        // Upload to S3
        const url = await saveFile(imageKey, buffer, mediaType);

        imageRefs.push({ key: imageKey, url, mediaType, hash });
        processedParts.push({
          type: "file",
          url,
          mediaType,
        });
      } else {
        processedParts.push(part);
      }
    } else {
      processedParts.push(part);
    }
  }

  return { parts: processedParts, imageRefs };
}

// ─────────────────────────────────────────────────────────────
// Chat CRUD Operations
// ─────────────────────────────────────────────────────────────

/**
 * Save a complete chat (messages + metadata) to S3.
 * - Images are extracted from data URLs and uploaded separately
 * - Metadata is saved to both the chat folder and the master index
 */
export async function saveChat(
  chatId: string,
  rawMessages: any[],
  currentModel: string = "kimi-k2.5"
): Promise<ChatDocument> {
  // Process each message — upload images and convert parts
  const storedMessages: StoredMessage[] = [];
  let hasImages = false;

  for (const msg of rawMessages) {
    const parts: ChatMessagePart[] = (msg.parts || []).map((p: any) => ({
      type: p.type,
      text: p.text,
      url: p.url,
      mediaType: p.mediaType || p.mimeType,
    }));

    // If message has no parts, construct from content
    if (parts.length === 0 && typeof msg.content === "string") {
      parts.push({ type: "text", text: msg.content });
    }

    // Upload any data-URL images to S3
    const { parts: processedParts, imageRefs } =
      await processAndUploadImages(chatId, parts);

    if (imageRefs.length > 0) hasImages = true;

    storedMessages.push({
      id: msg.id || crypto.randomUUID(),
      role: msg.role,
      parts: processedParts,
      model: msg.role === "assistant" ? currentModel : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  // Derive a title from the first user message
  const firstUserMsg = storedMessages.find((m) => m.role === "user");
  const titleText =
    firstUserMsg?.parts.find((p) => p.type === "text")?.text || "New Chat";
  const title =
    titleText.length > 60 ? titleText.slice(0, 60) + "..." : titleText;

  const now = new Date().toISOString();
  const metadata: ChatMetadata = {
    id: chatId,
    title,
    createdAt: now,
    updatedAt: now,
    model: currentModel,
    messageCount: storedMessages.length,
    hasImages,
  };

  // Check if this chat already exists (preserve createdAt)
  const existing = await getFile(`chats/${chatId}/metadata.json`);
  if (existing) {
    try {
      const existingMeta = JSON.parse(existing);
      metadata.createdAt = existingMeta.createdAt || now;
    } catch {}
  }

  // Save metadata.json for this chat
  await saveFile(
    `chats/${chatId}/metadata.json`,
    JSON.stringify(metadata, null, 2)
  );

  // Save messages.json for this chat
  await saveFile(
    `chats/${chatId}/messages.json`,
    JSON.stringify(storedMessages, null, 2)
  );

  // Update the master index
  const index = await loadIndex();
  const existingIdx = index.findIndex((c) => c.id === chatId);
  if (existingIdx >= 0) {
    index[existingIdx] = metadata;
  } else {
    index.unshift(metadata); // newest first
  }
  await saveIndex(index);

  return { id: chatId, metadata, messages: storedMessages };
}

/**
 * Load a chat's messages from S3.
 */
export async function loadChat(
  chatId: string
): Promise<ChatDocument | null> {
  const [metaRaw, msgsRaw] = await Promise.all([
    getFile(`chats/${chatId}/metadata.json`),
    getFile(`chats/${chatId}/messages.json`),
  ]);

  if (!msgsRaw) {
    // Try legacy format (single chats/{id}.json)
    const legacyRaw = await getFile(`chats/${chatId}.json`);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      return {
        id: chatId,
        metadata: {
          id: chatId,
          title: `Chat ${chatId.slice(0, 8)}`,
          createdAt: legacy.updatedAt || new Date().toISOString(),
          updatedAt: legacy.updatedAt || new Date().toISOString(),
          model: "unknown",
          messageCount: legacy.messages?.length || 0,
          hasImages: false,
        },
        messages: legacy.messages || [],
      };
    }
    return null;
  }

  const metadata: ChatMetadata = metaRaw
    ? JSON.parse(metaRaw)
    : {
        id: chatId,
        title: `Chat ${chatId.slice(0, 8)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        model: "unknown",
        messageCount: 0,
        hasImages: false,
      };

  return {
    id: chatId,
    metadata,
    messages: JSON.parse(msgsRaw),
  };
}

/**
 * List all chats from the master index
 */
export async function listChats(): Promise<ChatMetadata[]> {
  const index = await loadIndex();
  // Sort newest first
  index.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return index;
}
