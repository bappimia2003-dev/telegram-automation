'use client';

import React from 'react';
import { WhatsAppStatus } from '@/components/WhatsAppStatus';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Server, 
  ShieldAlert, 
  HelpCircle, 
  CheckCircle,
  ExternalLink
} from 'lucide-react';

export default function WhatsAppSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl pb-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-1">
          WhatsApp Settings & Engine Configuration
        </h1>
        <p className="text-sm text-gray-500">
          Manage your WhatsApp session, Railway engine connection, and delivery security rules.
        </p>
      </div>

      {/* Connection & QR Status */}
      <WhatsAppStatus />

      {/* Architecture Guide */}
      <Card className="border border-gray-200 bg-white rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-green-700" />
            Deployment & Engine Information
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            How the WhatsApp Baileys Engine works with Vercel and Railway.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs text-gray-600">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Local Testing (Now Active)
            </h4>
            <p>
              আপনি এখন লোকালহোস্টে টেস্ট করতে পারবেন। লোকালহোস্টে ইঞ্জিন চালু করতে নিচের কমান্ডটি দিন:
            </p>
            <pre className="p-2.5 rounded-lg bg-gray-900 text-emerald-400 font-mono text-[11px] overflow-x-auto">
              cd "wa-engine" &amp;&amp; npm run dev
            </pre>
            <p>
              ইঞ্জিন পোর্ট <code>3005</code> এ চালু হয়ে আপনার WhatsApp এর সাথে কানেক্ট হবে এবং মেসেজ আসার সাথে সাথে ক্যাম্পেইনের ফাইল সেন্ড করবে।
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-blue-600" />
              Railway Production Deployment (Later)
            </h4>
            <p>
              যখন আপনি প্রোডাকশনে পুশ করতে বলবেন, তখন <code>wa-engine</code> ফোল্ডারটি Railway-তে ডেপ্লয় করে Railway এর URL টি Vercel Environment Variable <code>WA_ENGINE_URL</code> এ বসিয়ে দিলেই ২৪/৭ কাজ করবে।
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5">
            <h4 className="font-bold text-amber-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Safety & Anti-Ban Best Practices
            </h4>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li>সর্বদা একটি আলাদা নিবেদিত (Dedicated) SIM কার্ড ব্যবহার করুন।</li>
              <li>ফাইল সেন্ডের মাঝে অন্তত ২-৪ সেকেন্ডের ডিলে (Delay) রাখুন।</li>
              <li>সিস্টেমে One-Time গ্যারান্টি সক্রিয় আছে, একই কাস্টমারকে ফাইল বার বার সেন্ড করা হবে না।</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
