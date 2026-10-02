"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
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
  Phone
} from 'lucide-react';
import { WaMessageLog } from '@/lib/whatsappTypes';

interface WhatsAppMessageLogProps {
  campaignId?: string;
}

export function WhatsAppMessageLog({ campaignId }: WhatsAppMessageLogProps) {
  const [logs, setLogs] = useState<WaMessageLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const url = campaignId 
        ? `/api/whatsapp/logs?campaignId=${campaignId}&limit=100` 
        : `/api/whatsapp/logs?limit=100`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [campaignId]);

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileText className="w-3.5 h-3.5 text-blue-400" />;
      case 'image': return <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />;
      case 'video': return <Video className="w-3.5 h-3.5 text-rose-400" />;
      case 'audio': return <Music className="w-3.5 h-3.5 text-purple-400" />;
      case 'document': return <FileCheck className="w-3.5 h-3.5 text-amber-400" />;
      default: return <FileText className="w-3.5 h-3.5" />;
    }
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-lg">
      <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            Live Message Delivery Log
          </CardTitle>
          <CardDescription className="text-xs">
            Recent auto-dispatched files and delivery status to customers.
          </CardDescription>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="text-xs h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="pt-4 p-0">
        {loading && logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
            Loading message logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No message activity logged yet. When customers trigger your ad quick replies, logs will appear here.
          </div>
        ) : (
          <div className="divide-y divide-border/30 max-h-[480px] overflow-y-auto">
            {logs.map((log) => {
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
                <div key={log.id} className="p-3.5 px-4 flex items-center justify-between hover:bg-secondary/20 transition-colors text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary/80 flex items-center justify-center shrink-0">
                      {renderTypeIcon(log.messageType)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-white flex items-center gap-1">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          +{cleanPhone}
                        </span>
                        {log.contactName && (
                          <span className="text-muted-foreground text-[11px]">({log.contactName})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        <span className="capitalize">{log.messageType}</span>
                        {log.fileUrl && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">{log.fileUrl.split('/').pop()}</span>
                          </>
                        )}
                        {log.errorMessage && (
                          <span className="text-destructive font-normal truncate max-w-[220px]">
                            Error: {log.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {formattedDate} {formattedTime}
                    </span>

                    {log.status === 'sent' ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Sent
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-destructive" />
                        Failed
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
