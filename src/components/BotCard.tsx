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
    <Card className="flex flex-col rounded-2xl overflow-hidden transition-all shadow-sm bg-[#FBF9F4] dark:bg-[#181A1F] border-[#E6E2D8] dark:border-[#262930] hover:shadow-md">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{bot.name}</h3>
            
            {/* Badges Pill Row */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                isActive 
                  ? "bg-[#16A34A] text-white" 
                  : "bg-red-600 text-white"
              }`}>
                {isActive ? "Active" : "Inactive"}
              </span>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#EDE8DE] dark:bg-[#242830] text-gray-900 dark:text-gray-200 border border-[#DDD7CB] dark:border-[#323742]">
                {model}
              </span>

              {bot.enableWelcomeMedia && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#EDE9FE] dark:bg-[#2E284A] text-[#6D28D9] dark:text-[#C4B5FD] border border-[#DDD6FE] dark:border-[#433878]">
                  Media Alert
                </span>
              )}

              {(bot.workInfo || bot.productFileUrl) && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#DCFCE7] dark:bg-[#143825] text-[#15803D] dark:text-[#86EFAC] border border-[#BBF7D0] dark:border-[#1D5438]">
                  Shop Brain
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-5 pt-1 pb-4">
        <div className="flex items-center text-sm font-bold text-gray-800 dark:text-gray-200 mb-3">
          <MessageSquare className="mr-2 h-4 w-4 text-[#164E43] dark:text-emerald-400" />
          <span>{messageCount} messages</span>
        </div>
        
        {/* Inset Personality Box */}
        <div className="text-xs sm:text-sm font-bold p-3.5 rounded-xl border leading-relaxed bg-[#EDE8DE] dark:bg-[#121418] border-[#DDD7CB] dark:border-[#262930] text-gray-900 dark:text-white">
          {personality.length > 80 
            ? `${personality.substring(0, 80)}...` 
            : personality}
        </div>
      </CardContent>
      
      {/* Footer with Sleek Action Buttons matching app tokens */}
      <CardFooter className="grid grid-cols-3 gap-2 border-t border-[#E4DFD2] dark:border-[#262930] p-3 bg-transparent">
        {/* Settings button */}
        <Link 
          href={`/bots/${bot.id}/settings`}
          className="h-9 px-2 text-xs font-bold rounded-xl flex items-center justify-center transition-all border border-[#E4DFD2] dark:border-[#262930] bg-[#FAF8F5] dark:bg-[#1A1D24] text-gray-800 dark:text-gray-200 hover:bg-[#EDE8DE] dark:hover:bg-[#22262E] active:scale-95"
        >
          Settings
        </Link>

        {/* Manage button */}
        <Link 
          href={`/bots/${bot.id}`}
          className="h-9 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs bg-[#164E43] hover:bg-[#124238] text-white active:scale-95"
        >
          <Edit2 className="h-3.5 w-3.5" />
          <span>Manage</span>
        </Link>
        
        {/* Delete Dialog Button */}
        <Dialog>
          <DialogTrigger asChild>
            <button className="h-9 px-2 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20">
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
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
