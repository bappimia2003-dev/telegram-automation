"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  FileCheck, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Phone,
  Search
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { WaMessageLog } from '@/lib/whatsappTypes';

interface WhatsAppMessageLogProps {
  campaignId?: string;
}

export function WhatsAppMessageLog({ campaignId }: WhatsAppMessageLogProps) {
  const [logs, setLogs] = useState<WaMessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');

  const fetchLogs = async () => {
    try {
      const url = campaignId 
        ? `/api/whatsapp/logs?campaignId=${campaignId}&limit=100` 
        : `/api/whatsapp/logs?limit=100`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const text = await res.text();
      if (!text || text.trim().startsWith('<')) return;
      const data = JSON.parse(text);
      if (data?.ok) {
        setLogs(data.logs || []);
      }
    } catch {
      // Transient fetch/reload errors are safely ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [campaignId]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'sent' && log.status !== 'sent') return false;
        if (statusFilter === 'failed' && log.status === 'sent') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPhone = log.phoneNumber.includes(q);
        const matchesName = log.contactName?.toLowerCase().includes(q);
        const matchesFile = log.fileUrl?.toLowerCase().includes(q);
        if (!matchesPhone && !matchesName && !matchesFile) return false;
      }
      return true;
    });
  }, [logs, statusFilter, searchQuery]);

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'image': return <ImageIcon className="w-3.5 h-3.5 text-[#075E54] dark:text-[#00A884]" />;
      case 'video': return <Video className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
      case 'audio': return <Music className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      case 'document': return <FileCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      default: return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Table Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#075E54] dark:text-[#00A884]" />
          <h3 className="text-sm font-bold text-foreground">
            Live Message Delivery Activity
          </h3>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary text-foreground">
            {filteredLogs.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative w-44 sm:w-52">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter recipient phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#075E54] dark:focus:ring-[#00A884]"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center p-0.5 bg-secondary rounded-lg">
            {(['all', 'sent', 'failed'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={cn(
                  "px-2 py-1 text-xs font-semibold rounded-md transition-all capitalize",
                  statusFilter === tab 
                    ? "bg-card text-foreground shadow-xs font-bold" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === 'sent' ? 'Delivered' : tab}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="text-xs font-semibold h-8 px-2.5 rounded-lg border-border bg-card text-foreground hover:bg-secondary"
          >
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Log Table Container */}
      <div className="rounded-lg border border-border overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="py-10 text-center text-xs font-medium text-muted-foreground animate-pulse">
            Loading recent message dispatches...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            {searchQuery ? 'No delivery logs match your search.' : 'No message activity recorded yet. Inbound triggers will appear here in real-time.'}
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[460px] overflow-y-auto">
            {filteredLogs.map((log) => {
              const formattedTime = new Date(log.sentAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });
              const formattedDate = new Date(log.sentAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              });
              const cleanPhone = log.phoneNumber.replace('@s.whatsapp.net', '');

              return (
                <div 
                  key={log.id} 
                  className="px-3.5 py-2.5 flex items-center justify-between hover:bg-secondary/40 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      {renderTypeIcon(log.messageType)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-foreground">
                          +{cleanPhone}
                        </span>
                        {log.contactName && (
                          <span className="text-muted-foreground">
                            · {log.contactName}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground capitalize">
                          · {log.messageType}
                        </span>
                      </div>

                      {log.fileUrl && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-xs sm:max-w-md font-mono mt-0.5">
                          {log.fileUrl.split('/').pop()}
                        </p>
                      )}

                      {log.errorMessage && (
                        <p className="text-[11px] text-red-500 font-semibold truncate max-w-sm mt-0.5">
                          {log.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                      {formattedDate} {formattedTime}
                    </span>

                    <span className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded",
                      log.status === 'sent'
                        ? "bg-[#25D366]/15 text-[#128C7E] dark:text-[#00A884]"
                        : "bg-red-500/15 text-red-600 dark:text-red-400"
                    )}>
                      {log.status === 'sent' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-[#25D366]" />
                          <span>Delivered</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-red-500" />
                          <span>Failed</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
