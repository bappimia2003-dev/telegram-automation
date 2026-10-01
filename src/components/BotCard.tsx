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
    <Card className="flex flex-col transition-all hover:bg-card/80 hover:shadow-md glass-hover">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">{bot.name}</h3>
            <div className="mt-2 flex gap-2">
              <Badge variant={isActive ? "success" : "destructive"}>
                {isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline">{model}</Badge>
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
      
      <CardFooter className="flex justify-end gap-2 border-t border-border/50 pt-4">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/bots/${bot.id}`}>
            <Edit2 className="h-4 w-4 mr-2" />
            Manage
          </Link>
        </Button>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
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
