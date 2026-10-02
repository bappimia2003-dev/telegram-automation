"use client"

import * as React from "react"
import Link from "next/link"
import { MessageSquare, Edit2, Trash2 } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"

interface BotCardProps {
  bot: any;
  onDelete: (id: string) => void;
}

export function BotCard({ bot, onDelete }: BotCardProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  const isActive = bot.isActive !== undefined ? Boolean(bot.isActive) : (bot.status === "Active" || bot.status === "active");
  const model = bot.currentModel || bot.model || 'gemini-2.0-flash';
  const messageCount = bot.messageCount ?? bot.messagesProcessed ?? 0;
  const personality = bot.aiPersonality || bot.systemPrompt || 'Helpful Assistant';

  const handleDelete = () => {
    setIsDeleting(true)
    onDelete(bot.id)
    setIsDeleting(false)
  }

  return (
    <Card className="flex flex-col transition-all hover:bg-card/80 hover:shadow-md glass-hover overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">{bot.name}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <Badge variant={isActive ? "success" : "destructive"}>
                {isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline">{model}</Badge>
              {bot.enableWelcomeMedia && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Media /start
                </span>
              )}
              {(bot.workInfo || bot.productFileUrl) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Shop Brain
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 pb-4">
        <div className="flex items-center text-sm text-muted-foreground mb-4">
          <MessageSquare className="mr-2 h-4 w-4 text-blue-500" />
          {messageCount} messages
        </div>
        <div className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md border border-border/50">
          {personality.length > 80 
            ? `${personality.substring(0, 80)}...` 
            : personality}
        </div>
      </CardContent>
      
      <CardFooter className="grid grid-cols-3 gap-2 border-t border-border/50 p-3 bg-secondary/15">
        <Button variant="outline" size="sm" asChild className="h-8 px-1.5 text-xs w-full">
          <Link href={`/bots/${bot.id}/settings`}>
            Settings
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="h-8 px-1.5 text-xs w-full">
          <Link href={`/bots/${bot.id}`}>
            <Edit2 className="h-3.5 w-3.5 mr-1 shrink-0" />
            Manage
          </Link>
        </Button>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" className="h-8 px-1.5 text-xs w-full">
              <Trash2 className="h-3.5 w-3.5 mr-1 shrink-0" />
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Bot</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {bot.name}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  )
}
