import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSessionInfo } from '@/lib/auth';
import { getClientById, isClientExpired } from '@/lib/whatsappDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WA_ENGINE_URL = process.env.WA_ENGINE_URL || 'http://localhost:3005';

export async function GET(request: Request) {
  try {
    const session = await getSessionInfo();
    const { searchParams } = new URL(request.url);
    const ownerId = session.role === 'client' 
      ? session.clientId 
      : (searchParams.get('clientId') || searchParams.get('ownerId') || 'admin');

    // 1. First attempt to query live status from wa-engine on Railway
    try {
      const res = await fetch(`${WA_ENGINE_URL}/targeted-followup/status?ownerId=${encodeURIComponent(ownerId)}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.job) {
          return NextResponse.json({ ok: true, job: data.job, source: 'engine', ownerId });
        }
      }
    } catch (e) {
      // engine unreachable or sleeping
    }

    // 2. Fallback to Supabase database for persistent job state
    const supabase = getSupabase();
    if (supabase) {
      const targetDbId = `tfup_active_${ownerId}`;
      let { data } = await supabase
        .from('wa_campaigns')
        .select('*')
        .eq('id', targetDbId)
        .maybeSingle();

      if (!data && ownerId === 'admin') {
        const fallbackRes = await supabase
          .from('wa_campaigns')
          .select('*')
          .eq('id', 'tfup_active')
          .maybeSingle();
        data = fallbackRes.data;
      }

      if (data && data.description) {
        try {
          let raw = data.description;
          if (raw.startsWith('[tfup:')) {
            const end = raw.indexOf(']');
            raw = raw.substring(6, end);
          }
          const job = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
          return NextResponse.json({ ok: true, job, source: 'db', ownerId });
        } catch {}
      }
    }

    return NextResponse.json({ ok: true, job: null, ownerId });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionInfo();
    const body = await request.json();
    const action = body.action || 'start';

    let ownerId = 'admin';
    let clientName = 'Admin';

    if (session.authenticated && session.role === 'client') {
      ownerId = session.clientId;
      clientName = session.clientName || 'Client';

      const client = await getClientById(session.clientId);
      if (!client) {
        return NextResponse.json({ ok: false, error: 'ক্লায়েন্ট প্রোফাইল পাওয়া যায়নি।' }, { status: 403 });
      }
      if (isClientExpired(client)) {
        return NextResponse.json(
          { ok: false, error: 'আপনার সাবস্ক্রিপশনের মেয়াদ শেষ হয়ে গেছে। অ্যাডমিনের সাথে যোগাযোগ করুন।' },
          { status: 403 }
        );
      }
    } else if (body.clientId && body.clientId !== 'admin') {
      ownerId = body.clientId;
      clientName = body.clientName || 'Client';
    }

    body.ownerId = ownerId;
    body.clientId = ownerId;
    body.clientName = clientName;

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
        const dbId = `tfup_active_${ownerId}`;
        if (action === 'stop') {
          await supabase.from('wa_campaigns').delete().eq('id', dbId);
          if (ownerId === 'admin') {
            await supabase.from('wa_campaigns').delete().eq('id', 'tfup_active');
          }
        } else {
          const b64 = Buffer.from(JSON.stringify(job), 'utf-8').toString('base64');
          const payload = {
            id: dbId,
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
          };
          await supabase.from('wa_campaigns').upsert(payload);
          if (ownerId === 'admin') {
            await supabase.from('wa_campaigns').upsert({ ...payload, id: 'tfup_active' });
          }
        }
      } catch (dbErr: any) {
        console.error('Error saving targeted-followup to DB:', dbErr.message);
      }
    }

    return NextResponse.json({
      ok: true,
      job,
      ownerId,
      engineOnline: Boolean(engineRes?.ok),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
