import { NextResponse } from 'next/server';
import { getSessionInfo } from '@/lib/auth';
import {
  getClientById,
  updateClientProfile,
  deleteClientProfile,
  generateRandomPassword,
  getAllClients,
  getClientRemainingDays,
  isClientExpired,
  getAllCampaigns,
  updateCampaign,
} from '@/lib/whatsappDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(
  request: Request,
  { params }: { params: { clientId: string } }
) {
  try {
    const session = await getSessionInfo();
    if (!session.authenticated || session.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const clientId = params.clientId;
    const existing = await getClientById(clientId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: any = {};

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.maxWhatsappNumbers !== undefined) updates.maxWhatsappNumbers = Math.max(1, Number(body.maxWhatsappNumbers));
    if (body.maxCampaigns !== undefined) updates.maxCampaigns = Math.max(1, Number(body.maxCampaigns));
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);
    if (body.notes !== undefined) updates.notes = String(body.notes);

    // Regenerate unique password and auto-save in DB
    if (body.regeneratePassword) {
      const allClients = await getAllClients(true);
      let newPwd = (body.password || '').trim() || generateRandomPassword(8);
      while (allClients.some((c) => c.id !== clientId && c.password === newPwd)) {
        newPwd = generateRandomPassword(8);
      }
      updates.password = newPwd;
    } else if (body.password !== undefined && String(body.password).trim() !== '') {
      updates.password = String(body.password).trim();
    }

    // Set or reset subscription validity days
    if (body.resetDays !== undefined) {
      updates.resetDays = Number(body.resetDays);
    }

    const updated = await updateClientProfile(clientId, updates);
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Failed to update client' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      client: {
        ...updated,
        remainingDays: getClientRemainingDays(updated),
        isExpired: isClientExpired(updated),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { clientId: string } }
) {
  try {
    const session = await getSessionInfo();
    if (!session.authenticated || session.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const clientId = params.clientId;
    // Also turn off any active campaigns belonging to this deleted client
    const campaigns = await getAllCampaigns();
    for (const c of campaigns) {
      if (c.clientId === clientId && c.isActive) {
        await updateCampaign(c.id, { isActive: false });
      }
    }

    const ok = await deleteClientProfile(clientId);
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
