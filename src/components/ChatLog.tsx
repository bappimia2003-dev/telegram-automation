"use client"

import * as React from "react"
import { Search, Bot, User, ArrowDown } from "lucide-react"
import { Input } from "./ui/input"
import { Badge } from "./ui/badge"
import { cn } from "@/lib/utils"

export interface ChatMessage {
  id: string;
  senderName?: string;
  text: string;
  timestamp: string;
  isIncoming?: boolean;
  direction?: 'incoming' | 'outgoing';
  modelUsed?: string;
  aiModel?: string;
}

interface ChatLogProps {
  messages: ChatMessage[];
  botName: string;
}

export function ChatLog({ messages, botName }: ChatLogProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const bottomRef = React.useRef<HTMLDivElement>(null)

  const filteredMessages = (messages || []).filter(m => 
    (m.text || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.senderName || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Header with Search */}
      <div className="p-3.5 sm:p-4 border-b border-border/60 bg-card/90 backdrop-blur flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-primary shrink-0" />
          <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
            {botName} Conversations
          </h3>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border/40">
            {messages.length} msgs
          </span>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-9 h-9 text-xs sm:text-sm bg-secondary/50 border-border/60" 
            placeholder="Search in chat..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 min-h-[300px]">
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-16">
            <Bot size={36} className="mb-2 opacity-30 text-primary" />
            <p className="text-sm font-medium">No messages found</p>
            <p className="text-xs text-muted-foreground mt-0.5">Send a message to your bot on Telegram to see it here live.</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isIncoming = msg.isIncoming !== undefined 
              ? Boolean(msg.isIncoming) 
              : (msg.direction === 'incoming');
            const modelUsed = msg.modelUsed || msg.aiModel;
            const sender = isIncoming ? (msg.senderName || 'Telegram User') : botName;
            const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

            return (
              <div 
                key={msg.id} 
                className={cn(
                  "flex flex-col max-w-[88%] sm:max-w-[80%]",
                  isIncoming ? "items-start" : "items-end self-end ml-auto"
                )}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  {isIncoming ? (
                    <User size={12} className="text-muted-foreground" />
                  ) : (
                    <Bot size={12} className="text-primary" />
                  )}
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {sender}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {timeStr}
                  </span>
                </div>

                <div 
                  className={cn(
                    "px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm",
                    isIncoming 
                      ? "bg-secondary text-secondary-foreground rounded-tl-sm border border-border/40" 
                      : "bg-primary text-primary-foreground rounded-tr-sm"
                  )}
                >
                  {msg.text}
                </div>

                {!isIncoming && modelUsed && (
                  <div className="mt-1 px-1">
                    <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/80 text-muted-foreground border border-border/40">
                      {modelUsed}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
