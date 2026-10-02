import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

export interface UploadResult {
  url: string;
  filename: string;
  parsedContent?: string;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vqnoaodavbiyenbqqbib.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_secret_tme1q7VZR_zQeytlaCCZug_Zjjo9cZ1';

let browserClient: SupabaseClient | null = null;

function getClientSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') {
    return getSupabase();
  }
  if (!browserClient) {
    if (SUPABASE_URL && SUPABASE_KEY) {
      browserClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } else {
      browserClient = getSupabase();
    }
  }
  return browserClient;
}

/**
 * Universal client-side file uploader.
 * Uploads directly to Supabase Storage 'media' bucket to bypass Vercel's 4.5MB limit.
 * Supports files up to 50MB (Telegram's maximum file size).
 */
export async function uploadFile(
  file: File,
  type: 'image' | 'audio' | 'video' | 'document'
): Promise<UploadResult> {
  // Max size limit: 50MB (Telegram's maximum file send limit)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('ফাইলের সাইজ সর্বোচ্চ ৫০ MB হতে পারবে। দয়া করে ৫০ MB-র চেয়ে ছোট ফাইল নির্বাচন করুন।');
  }

  const isLargeFile = file.size > 4 * 1024 * 1024;

  // 1. Direct Supabase Storage Upload (Bypasses Vercel 4.5MB limit)
  const supabase = getClientSupabase();
  if (supabase) {
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const safeFilename = `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const { data, error } = await supabase.storage
        .from('media')
        .upload(safeFilename, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        });

      if (!error && data) {
        const { data: pubUrlData } = supabase.storage
          .from('media')
          .getPublicUrl(safeFilename);

        if (pubUrlData?.publicUrl) {
          let parsedContent = '';
          // If document, extract text using server parser
          if (type === 'document') {
            try {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('type', 'document');
              const parseRes = await fetch('/api/upload', { method: 'POST', body: formData });
              const parseData = await parseRes.json();
              parsedContent = parseData.parsedContent || '';
            } catch (pErr) {
              console.warn('Doc parsing fallback:', pErr);
            }
          }

          return {
            url: pubUrlData.publicUrl,
            filename: safeFilename,
            parsedContent,
          };
        }
      } else if (error) {
        console.error('Supabase storage upload error:', error.message);
        if (isLargeFile) {
          throw new Error(`ক্লাউড স্টোরেজে ভিডিও আপলোড ব্যর্থ হয়েছে: ${error.message}।`);
        }
      }
    } catch (sbErr: any) {
      if (isLargeFile) {
        throw new Error(sbErr.message || 'ভিডিও আপলোড ব্যর্থ হয়েছে। দয়া করে আবার চেষ্টা করুন।');
      }
      console.warn('Supabase direct upload exception:', sbErr);
    }
  }

  // 2. Fallback to /api/upload for smaller files (< 4.5MB)
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!res.ok) {
    if (res.status === 413) {
      throw new Error('ফাইলটি Vercel সার্ভারলেস সীমার (৪.৫ MB) চেয়ে বড়। দয়া করে ৪.৫ MB-র কম সাইজের ফাইল আপলোড করুন অথবা সরাসরি ভিডিও লিঙ্ক ব্যবহার করুন।');
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `ফাইল আপলোড ব্যর্থ হয়েছে (Status: ${res.status})`);
  }

  const data = await res.json();
  if (!data.url) {
    throw new Error('আপলোড সম্পন্ন হয়নি');
  }

  return {
    url: data.url,
    filename: data.filename || file.name,
    parsedContent: data.parsedContent,
  };
}
