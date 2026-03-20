import {
  S3Client,
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
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.name === "NoSuchKey" || (error as any).$metadata?.httpStatusCode === 404)
    ) {
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
// Image Storage — per-chat image folder
// ─────────────────────────────────────────────────────────────

/**
 * Extract and upload images from message parts.
 * Uses pure content hashing for true deduplication.
 */
export async function processAndUploadImages(
  chatId: string,
  parts: ChatMessagePart[]
): Promise<{ parts: ChatMessagePart[]; imageRefs: ChatImageRef[] }> {
  const imageRefs: ChatImageRef[] = [];
  const processedParts: ChatMessagePart[] = [];

  for (const part of parts) {
    if (part.type === "file" && part.url?.startsWith("data:")) {
      const match = part.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mediaType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, "base64");

        const hash = crypto
          .createHash("sha256")
          .update(buffer)
          .digest("hex")
          .slice(0, 16);
        const ext = mediaType.split("/")[1] || "png";
        const imageKey = `chats/${chatId}/images/${hash}.${ext}`;

        let url: string;
        if (await fileExists(imageKey)) {
          url = getPublicUrl(imageKey);
        } else {
          url = await saveFile(imageKey, buffer, mediaType);
        }

        imageRefs.push({ key: imageKey, url, mediaType, hash });
        processedParts.push({
          type: "file",
          url,
          mediaType,
        });
        continue;
      }
    }
    processedParts.push(part);
  }

  return { parts: processedParts, imageRefs };
}

// ─────────────────────────────────────────────────────────────
// Chat CRUD Operations
// ─────────────────────────────────────────────────────────────

/**
 * Save a complete chat (messages + metadata) to S3.
 * Uses atomic per-message files to prevent data loss.
 */
export async function saveChat(
  chatId: string,
  rawMessages: Array<{ id?: string; parts?: any[]; content?: string; role: any; createdAt?: string }>,
  currentModel: string = "kimi-k2.5"
): Promise<ChatDocument> {
  let hasImages = false;
  const now = new Date().toISOString();

  const storedMessages: StoredMessage[] = [];

  for (const [index, msg] of rawMessages.entries()) {
    const messageId = msg.id || `msg-${Date.now()}-${index}`;
    const parts: ChatMessagePart[] = (msg.parts || []).map((p: any) => ({
      type: p.type,
      text: p.text,
      url: p.url,
      mediaType: p.mediaType || p.mimeType,
    }));

    if (parts.length === 0 && typeof msg.content === "string") {
      parts.push({ type: "text", text: msg.content });
    }

    const { parts: processedParts, imageRefs } =
      await processAndUploadImages(chatId, parts);

    if (imageRefs.length > 0) hasImages = true;

    const storedMsg: StoredMessage = {
      id: messageId,
      role: msg.role,
      parts: processedParts,
      model: msg.role === "assistant" ? currentModel : undefined,
      timestamp: msg.createdAt ? new Date(msg.createdAt).toISOString() : now,
    };

    storedMessages.push(storedMsg);

    const paddedIndex = String(index).padStart(4, '0');
    await saveFile(
      `chats/${chatId}/messages/${paddedIndex}-${messageId}.json`,
      JSON.stringify(storedMsg, null, 2)
    );
  }

  const firstUserMsg = storedMessages.find((m) => m.role === "user");
  const titleText =
    firstUserMsg?.parts.find((p) => p.type === "text")?.text || "New Chat";
  const title = titleText.length > 60 ? titleText.slice(0, 60) + "..." : titleText;

  const metadata: ChatMetadata = {
    id: chatId,
    title,
    createdAt: now,
    updatedAt: now,
    model: currentModel,
    messageCount: storedMessages.length,
    hasImages,
  };

  const existingMetaRaw = await getFile(`chats/${chatId}/metadata.json`);
  if (existingMetaRaw) {
    try {
      const existingMeta = JSON.parse(existingMetaRaw);
      metadata.createdAt = existingMeta.createdAt || now;
    } catch {}
  }

  await saveFile(
    `chats/${chatId}/metadata.json`,
    JSON.stringify(metadata, null, 2)
  );

  return { id: chatId, metadata, messages: storedMessages };
}

/**
 * Load a chat's messages from S3.
 * Assembles history from individual message files.
 */
export async function loadChat(
  chatId: string
): Promise<ChatDocument | null> {
  const metaRaw = await getFile(`chats/${chatId}/metadata.json`);
  if (!metaRaw) {
    const legacyRaw = await getFile(`chats/${chatId}/messages.json`) || await getFile(`chats/${chatId}.json`);
    if (legacyRaw) {
      const legacyMsgs = JSON.parse(legacyRaw);
      const messages = Array.isArray(legacyMsgs) ? legacyMsgs : legacyMsgs.messages || [];
      return {
        id: chatId,
        metadata: {
          id: chatId,
          title: `Legacy Chat ${chatId.slice(0, 8)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          model: "unknown",
          messageCount: messages.length,
          hasImages: false,
        },
        messages,
      };
    }
    return null;
  }

  const metadata: ChatMetadata = JSON.parse(metaRaw);
  const messageFiles = await listFiles(`chats/${chatId}/messages/`);
  
  if (messageFiles.length === 0) {
    const fallbackMsgs = await getFile(`chats/${chatId}/messages.json`);
    return {
      id: chatId,
      metadata,
      messages: fallbackMsgs ? JSON.parse(fallbackMsgs) : [],
    };
  }

  const messageObjects = await Promise.all(
    messageFiles
      .filter((f) => f.Key?.endsWith('.json'))
      .sort((a, b) => (a.Key! > b.Key! ? 1 : -1))
      .map(async (f) => {
        const raw = await getFile(f.Key!);
        return raw ? (JSON.parse(raw) as StoredMessage) : null;
      })
  );

  const messages = messageObjects.filter((m): m is StoredMessage => m !== null);

  return {
    id: chatId,
    metadata,
    messages,
  };
}

/**
 * List all chats by dynamically scanning the Space.
 */
export async function listChats(): Promise<ChatMetadata[]> {
  const files = await listFiles("chats/");
  const metaKeys = files
    .filter((f) => f.Key?.endsWith("/metadata.json"))
    .map((f) => f.Key!);

  const metadataObjects = await Promise.all(
    metaKeys.map(async (key) => {
      const raw = await getFile(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as ChatMetadata;
      } catch {
        return null;
      }
    })
  );

  const chats = metadataObjects.filter((m): m is ChatMetadata => m !== null);
  chats.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  
  return chats;
}

/**
 * Delete a chat and all its associated files (messages and images)
 */
export async function deleteChat(chatId: string): Promise<void> {
  const prefix = `chats/${chatId}/`;
  const files = await listFiles(prefix);
  
  if (files.length === 0) return;

  await Promise.all(
    files.map((file) => 
      s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: file.Key! }))
    )
  );
}
