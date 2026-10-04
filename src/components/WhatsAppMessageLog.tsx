"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
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
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [campaignId]);

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'image': return <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'video': return <Video className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'audio': return <Music className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'document': return <FileCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <Card className="border border-[#E6E2D8] dark:border-[#262930] bg-[#FBF9F4] dark:bg-[#181A1F] text-gray-900 dark:text-white rounded-2xl shadow-sm">
      <CardHeader className="pb-3 border-b border-[#E6E2D8] dark:border-[#262930] flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-700 dark:text-emerald-400" />
            Live Message Delivery Log
          </CardTitle>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="text-xs sm:text-sm font-bold h-9 px-3 rounded-xl border-[#E6E2D8] dark:border-[#262930] bg-[#FAF8F5] dark:bg-[#121418] text-gray-800 dark:text-gray-200 hover:bg-[#EDE8DE] dark:hover:bg-[#20242C]"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="pt-4 p-0">
        {loading && logs.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-gray-500 animate-pulse">
            Loading message logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-gray-500">
            No message activity logged yet. When customers trigger your ad quick replies, logs will appear here.
          </div>
        ) : (
          <div className="divide-y divide-[#E6E2D8] dark:divide-[#262930] max-h-[520px] overflow-y-auto">
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
                <div key={log.id} className="p-3.5 px-4 flex items-center justify-between hover:bg-[#EDE8DE]/60 dark:hover:bg-[#20242C]/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#EDE8DE] dark:bg-[#121418] border border-[#E6E2D8] dark:border-[#262930] flex items-center justify-center shrink-0">
                      {renderTypeIcon(log.messageType)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-gray-500" />
                          +{cleanPhone}
                        </span>
                        {log.contactName && (
                          <span className="text-gray-700 dark:text-gray-300 font-bold text-xs sm:text-sm">({log.contactName})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 flex-wrap">
                        <span className="capitalize font-black text-gray-900 dark:text-white">{log.messageType}</span>
                        {log.fileUrl && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="truncate max-w-[200px] sm:max-w-md font-semibold text-gray-800 dark:text-gray-200">{log.fileUrl.split('/').pop()}</span>
                          </>
                        )}
                        {log.errorMessage && (
                          <span className="text-red-600 dark:text-red-400 font-bold truncate max-w-[220px] sm:max-w-md">
                            Error: {log.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400 font-mono">
                      {formattedDate} {formattedTime}
                    </span>

                    {log.status === 'sent' ? (
                      <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5 font-bold px-2.5 py-1 shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Sent
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700 flex items-center gap-1.5 font-bold px-2.5 py-1 shadow-xs">
                        <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
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
