import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WA_ENGINE_URL = process.env.WA_ENGINE_URL || 'http://localhost:3005';

export async function GET() {
  try {
    // 1. First attempt to query live status from wa-engine on Railway
    try {
      const res = await fetch(`${WA_ENGINE_URL}/targeted-followup/status`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.job) {
          return NextResponse.json({ ok: true, job: data.job, source: 'engine' });
        }
      }
    } catch (e) {
      // engine unreachable or sleeping
    }

    // 2. Fallback to Supabase database for persistent job state
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from('wa_campaigns')
        .select('*')
        .eq('id', 'tfup_active')
        .maybeSingle();

      if (data && data.description) {
        try {
          let raw = data.description;
          if (raw.startsWith('[tfup:')) {
            const end = raw.indexOf(']');
            raw = raw.substring(6, end);
          }
          const job = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
          return NextResponse.json({ ok: true, job, source: 'db' });
        } catch {}
      }
    }

    return NextResponse.json({ ok: true, job: null });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'start';

    // 1. Forward action directly to wa-engine
    let engineRes: any = null;
    try {
      const res = await fetch(`${WA_ENGINE_URL}/targeted-followup/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        engineRes = await res.json();
      }
    } catch (err: any) {
      console.warn('Could not contact wa-engine for targeted-followup:', err.message);
    }

    const job = engineRes?.job || (action === 'start' ? body : null);

    // 2. Persist to Supabase so it survives container restarts
    const supabase = getSupabase();
    if (supabase && job) {
      try {
        if (action === 'stop') {
          await supabase.from('wa_campaigns').delete().eq('id', 'tfup_active');
        } else {
          const b64 = Buffer.from(JSON.stringify(job), 'utf-8').toString('base64');
          await supabase.from('wa_campaigns').upsert({
            id: 'tfup_active',
            name: job.title || 'Targeted Follow-up Campaign',
            description: `[tfup:${b64}]`,
            is_active: job.status === 'running',
            welcome_message: job.messageText || '',
            image_url: job.imageUrl || '',
            audio_url: job.audioUrl || '',
            video_url: job.videoUrl || '',
            document_url: job.documentUrl || '',
            document_name: job.documentName || '',
            total_sent: job.sentCount || 0,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (dbErr: any) {
        console.error('Error saving targeted-followup to DB:', dbErr.message);
      }
    }

    return NextResponse.json({
      ok: true,
      job,
      engineOnline: Boolean(engineRes?.ok),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
