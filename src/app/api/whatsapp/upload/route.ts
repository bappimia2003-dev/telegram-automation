import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'image';

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'bin';
    const safeName = `wa-${type}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

    // 1. Try Supabase Storage 'media' bucket
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(`whatsapp/${safeName}`, buffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: true,
          });

        if (!uploadError) {
          const { data } = supabase.storage.from('media').getPublicUrl(`whatsapp/${safeName}`);
          return NextResponse.json({
            ok: true,
            url: data.publicUrl,
            filename: file.name,
          });
        }
      } catch (err: any) {
        console.warn('Supabase storage upload failed, falling back to local:', err.message);
      }
    }

    // 2. Fallback to local public/uploads/whatsapp if writable
    try {
      const localDir = path.resolve(process.cwd(), 'public', 'uploads', 'whatsapp');
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      const localFilePath = path.join(localDir, safeName);
      fs.writeFileSync(localFilePath, buffer);

      return NextResponse.json({
        ok: true,
        url: `/uploads/whatsapp/${safeName}`,
        filename: file.name,
      });
    } catch (fsErr) {
      // 3. Resilient fallback for Vercel Serverless (read-only filesystem)
      const mime = file.type || (type === 'audio' ? 'audio/mpeg' : type === 'video' ? 'video/mp4' : 'application/octet-stream');
      const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;

      return NextResponse.json({
        ok: true,
        url: dataUri,
        filename: file.name,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
