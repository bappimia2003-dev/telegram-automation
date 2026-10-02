import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mediaType = (formData.get('type') as string) || 'media';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine extension
    let ext = path.extname(file.name || '').toLowerCase();
    if (!ext) {
      if (file.type.includes('ogg')) ext = '.ogg';
      else if (file.type.includes('webm')) ext = '.webm';
      else if (file.type.includes('mp4')) ext = '.mp4';
      else if (file.type.includes('mp3') || file.type.includes('mpeg')) ext = '.mp3';
      else if (file.type.includes('wav')) ext = '.wav';
      else if (file.type.includes('m4a')) ext = '.m4a';
      else if (file.type.includes('jpeg') || file.type.includes('jpg')) ext = '.jpg';
      else if (file.type.includes('png')) ext = '.png';
      else if (file.type.includes('gif')) ext = '.gif';
      else if (file.type.includes('webp')) ext = '.webp';
      else ext = '.bin';
    }

    const safeFilename = `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
    let publicUrl = '';

    // 1. Try uploading to Supabase Storage (Best for Vercel & Production)
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('media')
          .upload(safeFilename, buffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: true,
          });

        if (!uploadErr && uploadData) {
          const { data: pubUrlData } = supabase.storage
            .from('media')
            .getPublicUrl(safeFilename);
          if (pubUrlData?.publicUrl) {
            publicUrl = pubUrlData.publicUrl;
          }
        }
      } catch (sbErr) {
        console.warn('Supabase storage upload fallback:', sbErr);
      }
    }

    // 2. Local fallback if Supabase not used or failed
    if (!publicUrl) {
      try {
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filePath = path.join(uploadsDir, safeFilename);
        await fs.promises.writeFile(filePath, buffer);
        publicUrl = `/uploads/${safeFilename}`;
      } catch (fsErr) {
        // In serverless if disk write fails, fallback to base64 data URI
        const mime = file.type || 'application/octet-stream';
        publicUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      }
    }

    // 3. Auto-parse document content if Excel, Word, or text
    let parsedContent = '';
    const docExtensions = ['.xlsx', '.xls', '.csv', '.docx', '.txt', '.md', '.json'];
    if (docExtensions.includes(ext) || mediaType === 'document') {
      try {
        if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            if (csv.trim()) {
              parsedContent += `\n[Sheet: ${sheetName}]\n${csv}\n`;
            }
          }
          parsedContent = parsedContent.trim();
        } else if (ext === '.docx') {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer });
          parsedContent = result.value || '';
        } else if (ext === '.txt' || ext === '.json' || ext === '.md') {
          parsedContent = buffer.toString('utf-8');
        }
      } catch (err) {
        console.error('Error auto-parsing document upon upload:', err);
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename: safeFilename,
      originalName: file.name,
      size: buffer.length,
      mimeType: file.type,
      mediaType,
      parsedContent,
    });
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
