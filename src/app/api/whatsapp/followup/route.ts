import { NextResponse } from 'next/server';
import {
  getFollowupData,
  updateFollowupSetting,
  updateAllFollowupSettings,
  updateLeadStatus,
  addMediaItem,
  deleteMediaItem,
  updateFollowupVariants,
  saveFollowupAll,
  startCampaign,
  stopCampaign,
} from '@/lib/followupStore';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const data = await getFollowupData();
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle Multipart Form Data for File Upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const mediaTypeRaw = (formData.get('media_type') as string) || '';

      if (!file) {
        return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop() || 'bin';
      
      let mediaType: 'audio' | 'image' | 'text' = 'image';
      if (file.type.startsWith('audio/') || ['mp3', 'ogg', 'wav', 'm4a'].includes(ext.toLowerCase())) {
        mediaType = 'audio';
      } else if (file.type.startsWith('text/') || ['txt', 'md'].includes(ext.toLowerCase())) {
        mediaType = 'text';
      }

      const safeName = `vault-${mediaType}-${Date.now()}.${ext}`;

      // Save to public/uploads/vault
      const targetDir = path.resolve(process.cwd(), 'public', 'uploads', 'vault');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const targetPath = path.join(targetDir, safeName);
      fs.writeFileSync(targetPath, buffer);

      const publicUrl = `/uploads/vault/${safeName}`;

      const created = await addMediaItem({
        filename: file.name,
        filepath: publicUrl,
        media_type: mediaType,
        category: (formData.get('category') as string) || 'general',
      });

      return NextResponse.json({ ok: true, media: created });
    }

    // JSON body actions
    const body = await request.json();
    const action = body.action;

    if (action === 'toggle_setting') {
      const { key, value } = body;
      const settings = await updateFollowupSetting(key, value);
      return NextResponse.json({ ok: true, settings });
    }

    if (action === 'update_settings') {
      const { settings: newSettings } = body;
      const settings = await updateAllFollowupSettings(newSettings);
      return NextResponse.json({ ok: true, settings });
    }

    if (action === 'update_assigned_account') {
      const { accountId, accountName, accountPhone } = body;
      await updateFollowupSetting('assigned_account_id', accountId);
      if (accountName) await updateFollowupSetting('assigned_account_name', accountName);
      if (accountPhone) await updateFollowupSetting('assigned_account_phone', accountPhone);
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete_media') {
      const { id } = body;
      const media = await deleteMediaItem(id);
      return NextResponse.json({ ok: true, media });
    }

    if (action === 'update_lead_status') {
      const { phone, status, notes } = body;
      const leads = await updateLeadStatus(phone, status, notes);
      return NextResponse.json({ ok: true, leads });
    }

    if (action === 'save_all' || action === 'save_followup_all') {
      const result = await saveFollowupAll({
        variants: body.variants,
        settings: body.settings,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'update_variants') {
      const variants = await updateFollowupVariants(body.variants);
      return NextResponse.json({ ok: true, variants });
    }

    if (action === 'start_campaign') {
      const res = await startCampaign(body.config);
      return NextResponse.json(res);
    }

    if (action === 'stop_campaign') {
      const res = await stopCampaign();
      return NextResponse.json(res);
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
