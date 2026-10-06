import { deleteFromR2, isR2Configured } from './r2';
import { getSupabase } from './supabase';
import fs from 'fs';
import path from 'path';
import { WaCampaign } from './whatsappTypes';

/**
 * Universal media deletion helper.
 * Completely purges a media file from:
 * 1. Cloudflare R2 (Object storage)
 * 2. Supabase Storage ('media' bucket)
 * 3. Supabase Database ('wa_connection' base64 backups)
 * 4. Local disk (public/uploads)
 */
export async function deleteMediaUrl(url: string): Promise<boolean> {
  if (!url || typeof url !== 'string' || !url.trim()) return false;
  const target = url.trim();

  // Ignore data URIs or empty
  if (target.startsWith('data:') || target.length < 5) return false;

  const filename = target.split('/').pop()?.split('?')[0] || '';
  let deletedSomething = false;

  // 1. Cloudflare R2 Deletion
  if (isR2Configured() && (target.includes('r2.dev') || target.includes('r2.cloudflarestorage.com') || target.startsWith('whatsapp/'))) {
    try {
      const r2Deleted = await deleteFromR2(target);
      if (r2Deleted) deletedSomething = true;
    } catch (e: any) {
      console.warn('[MediaCleaner] R2 delete error:', e.message);
    }
  }

  // 2. Supabase Storage Deletion
  const supabase = getSupabase();
  if (supabase) {
    try {
      if (target.includes('supabase.co')) {
        // Find storage path after /media/
        const match = target.match(/\/media\/(.+)$/);
        const storagePath = match ? match[1] : filename;
        await supabase.storage.from('media').remove([storagePath, `whatsapp/${filename}`, filename]);
        deletedSomething = true;
      }
    } catch (e: any) {
      console.warn('[MediaCleaner] Supabase storage delete error:', e.message);
    }

    // 3. Supabase DB wa_connection backup purge
    if (filename) {
      try {
        await supabase.from('wa_connection').delete().eq('id', `file_${filename}`);
      } catch (e: any) {
        console.warn('[MediaCleaner] DB backup purge error:', e.message);
      }
    }
  }

  // 4. Local disk cleanup if file resides on server
  if (target.startsWith('/uploads/') || target.includes('/uploads/')) {
    try {
      const relPath = target.startsWith('/uploads/') ? target.replace('/uploads/', '') : filename;
      const fullPath = path.join(process.cwd(), 'public', 'uploads', relPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        deletedSomething = true;
        console.log(`[MediaCleaner] Deleted local file: ${fullPath}`);
      }
    } catch (e: any) {
      console.warn('[MediaCleaner] Local disk delete error:', e.message);
    }
  }

  return deletedSomething;
}

/**
 * Extracts every media URL present inside a campaign object.
 */
export function extractAllMediaUrlsFromCampaign(c: Partial<WaCampaign> | null | undefined): string[] {
  if (!c) return [];
  const urls = new Set<string>();

  const check = (val: any) => {
    if (val && typeof val === 'string' && val.trim().startsWith('http')) {
      urls.add(val.trim());
    }
  };

  ['imageUrl', 'audioUrl', 'videoUrl', 'documentUrl', 'image_url', 'audio_url', 'video_url', 'document_url'].forEach(k => {
    check((c as any)[k]);
  });

  if (Array.isArray(c.variants)) {
    c.variants.forEach((v: any) => {
      ['imageUrl', 'audioUrl', 'videoUrl', 'documentUrl'].forEach(k => {
        check((v as any)[k]);
      });
    });
  }

  const fup = c.followupConfig;
  if (fup) {
    ['followupImageUrl', 'followupAudioUrl', 'followupVideoUrl', 'followupDocumentUrl'].forEach(k => {
      check((fup as any)[k]);
    });

    if (Array.isArray(fup.steps)) {
      fup.steps.forEach((s: any) => {
        ['imageUrl', 'audioUrl', 'videoUrl', 'documentUrl'].forEach(k => {
          check((s as any)[k]);
        });
        if (Array.isArray(s.files)) {
          s.files.forEach((f: any) => {
            check(f.url);
          });
        }
      });
    }

    if (Array.isArray(fup.understandingFiles)) {
      fup.understandingFiles.forEach((f: any) => {
        check(f.url);
      });
    }

    if (Array.isArray(fup.followupVariants)) {
      fup.followupVariants.forEach((v: any) => {
        check(v.imageUrl);
      });
    }

    if (Array.isArray(fup.followupFiles)) {
      fup.followupFiles.forEach((f: any) => {
        check(f.url);
      });
    }
  }

  return Array.from(urls);
}

/**
 * When a campaign is updated, purge any media files that were removed or replaced.
 */
export async function cleanupReplacedMedia(
  existingCampaign: WaCampaign | null,
  updatedCampaign: WaCampaign
): Promise<void> {
  if (!existingCampaign) return;

  const oldUrls = extractAllMediaUrlsFromCampaign(existingCampaign);
  const newUrls = new Set(extractAllMediaUrlsFromCampaign(updatedCampaign));

  for (const oldUrl of oldUrls) {
    if (!newUrls.has(oldUrl)) {
      console.log(`[MediaCleaner] Old media replaced/removed, deleting from storage: ${oldUrl}`);
      await deleteMediaUrl(oldUrl).catch(err => {
        console.warn(`[MediaCleaner] Error deleting old media ${oldUrl}:`, err.message);
      });
    }
  }
}
