"use client";

import cn from "classnames";
import { toast } from "sonner";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Messages } from "./messages";
import { modelID, models } from "@/lib/models";
import { Footnote } from "./footnote";
import {
  ArrowUpIcon,
  CheckedSquare,
  ChevronDownIcon,
  StopIcon,
  UncheckedSquare,
} from "./icons";

export function Chat({ id: initialId }: { id?: string }) {
  const router = useRouter();
  const [id, setId] = useState<string | undefined>(initialId);
  const idRef = useRef<string | undefined>(initialId);
  const [input, setInput] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<modelID>("kimi-k2.5");
  const selectedModelRef = useRef<modelID>("kimi-k2.5");
  const [isReasoningEnabled, setIsReasoningEnabled] = useState<boolean>(true);
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    idRef.current = id;
  }, [id]);

  useEffect(() => {
    selectedModelRef.current = selectedModelId;
  }, [selectedModelId]);

  // Use transport with dynamic body that reads current model/reasoning from refs
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          selectedModelId: selectedModelRef.current,
          isReasoningEnabled: true,
        }),
      }),
    [],
  );

  const { messages, setMessages, sendMessage, status, stop } = useChat({
    id: "primary",
    transport,
    onFinish: async ({ messages: allMessages }) => {
      const currentId = idRef.current;
      if (currentId && allMessages.length > 0) {
        try {
          await fetch(`/api/chat/${currentId}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: allMessages,
              model: selectedModelRef.current,
            }),
          });
        } catch (err) {
          console.error("Failed to save chat:", err);
        }
        window.dispatchEvent(new CustomEvent("history-updated"));
      }
    },
    onError: () => {
      toast.error("An error occurred, please try again!");
    },
  });

  useEffect(() => {
    setId(initialId);
    if (!initialId) {
      setMessages([]);
    }
  }, [initialId, setMessages]);

  useEffect(() => {
    if (id && id === initialId) {
      fetch(`/api/chat/${id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages) setMessages(data.messages);
        })
        .catch(() => {});
    }
  }, [id, initialId, setMessages]);

  const isGeneratingResponse = ["streaming", "submitted"].includes(status);

  const doSubmit = useCallback(() => {
    if (input.trim() === "" && images.length === 0) return;
    if (isGeneratingResponse) {
      toast.error("Please wait for the model to finish its response!");
      return;
    }

    if (!id) {
      const newId = crypto.randomUUID();
      setId(newId);
      router.push(`/chat/${newId}`, { scroll: false });
    }

    // Build files array from images
    const files = images.map((dataUrl) => ({
      type: "file" as const,
      url: dataUrl,
      mediaType: "image/png" as const,
    }));

    sendMessage({
      text: input,
      files: files.length > 0 ? files : undefined,
    });

    setInput("");
    setImages([]);
  }, [input, images, id, isGeneratingResponse, sendMessage, router]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setImages((prev) => [...prev, dataUrl]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          setImages((prev) => [...prev, dataUrl]);
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setImages((prev) => [...prev, dataUrl]);
          };
          reader.readAsDataURL(file);
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [],
  );

  return (
    <div
      className={cn(
        "px-4 md:px-0 pb-4 pt-8 flex flex-col h-dvh items-center w-full max-w-3xl",
        {
          "justify-between": messages.length > 0,
          "justify-center gap-4": messages.length === 0,
        },
      )}
    >
      {messages.length > 0 ? (
        <Messages messages={messages} status={status} />
      ) : (
        <div className="flex flex-col gap-0.5 sm:text-2xl text-xl w-full">
          <div className="flex flex-row gap-2 items-center">
            <div>Richa&apos;s Personal Intelligence</div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 w-full">
        <div
          className="flex relative flex-col gap-1 p-3 w-full rounded-2xl dark:bg-zinc-800 bg-zinc-100"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onPaste={handlePaste}
        >
          {/* Image previews */}
          {images.length > 0 && (
            <div className="flex flex-row gap-2 mb-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img
                    src={img}
                    alt={`Upload ${i + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border dark:border-zinc-600 border-zinc-300"
                  />
                  <button
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() =>
                      setImages((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            className="mb-12 w-full bg-transparent outline-none resize-none min-h-12 placeholder:text-zinc-400"
            placeholder="Send a message (paste or drop images here)"
            value={input}
            autoFocus
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                doSubmit();
              }
            }}
          />

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="absolute bottom-2.5 left-2.5 flex flex-row gap-2">
            <button
              className={cn(
                "relative w-fit text-sm p-1.5 rounded-lg flex flex-row items-center gap-2 dark:hover:bg-zinc-600 hover:bg-zinc-200 cursor-pointer",
                {
                  "dark:bg-zinc-600 bg-zinc-200": isReasoningEnabled,
                },
              )}
              onClick={() => setIsReasoningEnabled(!isReasoningEnabled)}
            >
              {isReasoningEnabled ? <CheckedSquare /> : <UncheckedSquare />}
              <div>Reasoning</div>
            </button>

            {/* Image upload button */}
            <button
              className="text-sm p-1.5 rounded-lg flex flex-row items-center gap-1 dark:hover:bg-zinc-600 hover:bg-zinc-200 cursor-pointer text-zinc-500"
              onClick={() => fileInputRef.current?.click()}
              title="Attach image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <span>Image</span>
            </button>
          </div>

          <div className="absolute bottom-2.5 right-2.5 flex flex-row gap-2">
            <div className="relative w-fit text-sm p-1.5 rounded-lg flex flex-row items-center gap-0.5 dark:hover:bg-zinc-700 hover:bg-zinc-200 cursor-pointer">
              <div className="flex justify-center items-center px-1 text-zinc-500 dark:text-zinc-400">
                <span className="pr-1">{models[selectedModelId]}</span>
                <ChevronDownIcon />
              </div>

              <select
                className="absolute left-0 p-1 w-full opacity-0 cursor-pointer"
                value={selectedModelId}
                onChange={(event) => {
                  setSelectedModelId(event.target.value as modelID);
                }}
              >
                {Object.entries(models).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className={cn(
                "size-8 flex flex-row justify-center items-center dark:bg-zinc-100 bg-zinc-900 dark:text-zinc-900 text-zinc-100 p-1.5 rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-300 hover:scale-105 active:scale-95 transition-all",
                {
                  "dark:bg-zinc-200 dark:text-zinc-500":
                    isGeneratingResponse ||
                    (input.trim() === "" && images.length === 0),
                },
              )}
              onClick={() => {
                if (isGeneratingResponse) {
                  stop();
                } else {
                  doSubmit();
                }
              }}
            >
              {isGeneratingResponse ? <StopIcon /> : <ArrowUpIcon />}
            </button>
          </div>
        </div>

        <Footnote />
      </div>
    </div>
  );
}
