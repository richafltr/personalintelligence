"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import cn from "classnames";
import { PlusIcon, MessageSquareIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface ChatMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  messageCount: number;
  hasImages: boolean;
}

export function Sidebar() {
  const pathname = usePathname();
  const [chats, setChats] = useState<ChatMetadata[]>([]);

  useEffect(() => {
    // We will fetch from S3 indirectly via an API route later
    const fetchHistory = async () => {
      try {
        const response = await fetch("/api/history");
        if (response.ok) {
          const data = await response.json();
          setChats(data.chats || []);
        }
      } catch (error) {
        console.error("Failed to fetch history:", error);
      }
    };
    fetchHistory();
    window.addEventListener("history-updated", fetchHistory);
    return () => window.removeEventListener("history-updated", fetchHistory);
  }, []);

  return (
    <div className="w-64 h-full border-r dark:border-zinc-800 border-zinc-200 flex flex-col dark:bg-zinc-900 bg-zinc-50 overflow-hidden shrink-0">
      <div className="p-4 flex flex-col gap-4 flex-1 overflow-hidden">
        <Link
          href="/"
          className="flex items-center justify-between p-2 rounded-lg border dark:border-zinc-700 border-zinc-300 dark:hover:bg-zinc-800 hover:bg-zinc-200 transition-colors"
        >
          <div className="flex items-center gap-2 font-medium text-sm">
            <PlusIcon size={16} />
            <span>New Chat</span>
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-2 py-2">
            History
          </div>
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/chat/${chat.id}`}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg text-sm transition-colors",
                {
                  "dark:bg-zinc-800 bg-zinc-200": pathname === `/chat/${chat.id}`,
                  "dark:hover:bg-zinc-800 hover:bg-zinc-200": pathname !== `/chat/${chat.id}`,
                }
              )}
            >
              {chat.hasImages ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 shrink-0">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              ) : (
                <MessageSquareIcon size={14} className="text-zinc-500 shrink-0" />
              )}
              <span className="truncate flex-1">{chat.title}</span>
            </Link>
          ))}
          {chats.length === 0 && (
            <div className="text-xs text-zinc-400 px-2 py-4 text-center italic">
              No recent chats
            </div>
          )}
        </div>
      </div>
      <div className="p-4 border-t dark:border-zinc-800 border-zinc-200">
        <div className="flex flex-col gap-2">
           <div className="text-xs font-semibold text-zinc-500">
             Richa&apos;s Personal Intelligence
           </div>
        </div>
      </div>
    </div>
  );
}
