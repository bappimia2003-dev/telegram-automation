"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Input } from "./ui/input"
import { Badge } from "./ui/badge"
import { cn } from "@/lib/utils"

export interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: string;
  isIncoming: boolean;
  modelUsed?: string;
}

interface ChatLogProps {
  messages: ChatMessage[];
  botName: string;
}

export function ChatLog({ messages, botName }: ChatLogProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const bottomRef = React.useRef<HTMLDivElement>(null)

  const filteredMessages = messages.filter(m => 
    m.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.senderName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border bg-card/80 backdrop-blur flex justify-between items-center">
        <h3 className="font-semibold">{botName} Chat Log</h3>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-9 h-9" 
            placeholder="Search messages..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No messages yet. Waiting for conversations...
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div 
              key={msg.id} 
              className={cn(
                "flex flex-col max-w-[80%]",
                msg.isIncoming ? "items-start" : "items-end self-end ml-auto"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {msg.isIncoming ? msg.senderName : botName}
                </span>
                <span className="text-xs text-muted-foreground opacity-70">
                  {msg.timestamp}
                </span>
              </div>
              <div 
                className={cn(
                  "px-4 py-2 rounded-2xl text-sm",
                  msg.isIncoming 
                    ? "bg-secondary text-secondary-foreground rounded-tl-sm" 
                    : "bg-primary text-primary-foreground rounded-tr-sm"
                )}
              >
                {msg.text}
              </div>
              {!msg.isIncoming && msg.modelUsed && (
                <div className="mt-1">
                  <Badge variant="outline" className="text-[10px] h-4 px-1 border-border/50">
                    {msg.modelUsed}
                  </Badge>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
