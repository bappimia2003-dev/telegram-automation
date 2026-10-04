import fs from 'fs';
import path from 'path';
import { getAllApiKeys } from './db';
import { getAllWaConnections } from './whatsappDb';
import { WaCampaignVariant } from './whatsappTypes';

export interface FollowupSettings {
  auto_followup: boolean;
  ai_brain: boolean;
  antiban: boolean;
  auto_cleanup: boolean;
  gender_detection: boolean;
  assigned_account_id: string; // which WhatsApp number is assigned
  assigned_account_phone: string;
  assigned_account_name: string;
  gemini_api_key: string;
  working_hours_start: string;
  working_hours_end: string;
  max_daily_messages: number;
  rolling_days: number;
  min_delay_minutes: number;
  max_delay_minutes: number;
  min_batch_people: number;
  max_batch_people: number;
  duration_hours: number;
  total_duration_days: number;
  started_date: string;
}

export interface FollowupLead {
  id: string;
  phone: string;
  name: string;
  gender: 'apu' | 'vai' | 'apni';
  product: string;
  status: 'new' | 'in_followup' | 'manual_takeover' | 'promised' | 'closed' | 'archived';
  promise_date: string | null;
  follow_up_step: number;
  last_sent_at: string | null;
  notes: string;
}

export interface FollowupMedia {
  id: string;
  filename: string;
  filepath: string;
  media_type: 'audio' | 'image' | 'text';
  category: string;
  used_count: number;
  createdAt?: string;
}

export interface FollowupCampaign {
  id: string;
  name: string;
  status: 'running' | 'stopped';
  minDelay: number;
  maxDelay: number;
  minPeople: number;
  maxPeople: number;
  durationHours: number;
  totalSent: number;
  batchesCompleted: number;
  startedAt: string;
}

interface FollowupStoreData {
  settings: FollowupSettings;
  variants: WaCampaignVariant[];
  leads: FollowupLead[];
  media: FollowupMedia[];
  campaign: FollowupCampaign | null;
}

const STORE_PATH = path.resolve(process.cwd(), 'whatsapp-followup/data/followup_store.json');

const defaultVariants: WaCampaignVariant[] = [];

const defaultStore: FollowupStoreData = {
  settings: {
    auto_followup: true,
    ai_brain: true,
    antiban: true,
    auto_cleanup: true,
    gender_detection: true,
    assigned_account_id: 'acc_4929c1a7',
    assigned_account_phone: '8801830086837',
    assigned_account_name: 'gemini',
    gemini_api_key: '',
    working_hours_start: '09:00',
    working_hours_end: '22:00',
    max_daily_messages: 30,
    rolling_days: 30,
    min_delay_minutes: 45,
    max_delay_minutes: 90,
    min_batch_people: 3,
    max_batch_people: 5,
    duration_hours: 6,
    total_duration_days: 30,
    started_date: new Date().toISOString().split('T')[0],
  },
  variants: defaultVariants,
  leads: [
    {
      id: 'lead_1',
      phone: '8801711223344',
      name: 'রাহেলা আপু',
      gender: 'apu',
      product: 'washroom rack',
      status: 'manual_takeover',
      promise_date: null,
      follow_up_step: 1,
      last_sent_at: '2026-10-04 09:15:00',
      notes: 'Customer replied, manual chat active',
    },
    {
      id: 'lead_2',
      phone: '8801812345678',
      name: 'তানভীর ভাইয়া',
      gender: 'vai',
      product: 'gemini',
      status: 'in_followup',
      promise_date: null,
      follow_up_step: 2,
      last_sent_at: '2026-10-04 08:30:00',
      notes: 'Sent voice note follow-up',
    },
    {
      id: 'lead_3',
      phone: '8801919876543',
      name: 'সুমাইয়া',
      gender: 'apu',
      product: 'washroom rack',
      status: 'promised',
      promise_date: '2026-10-09',
      follow_up_step: 1,
      last_sent_at: '2026-10-03 14:00:00',
      notes: 'Promised to buy on Friday',
    }
  ],
  media: [],
  campaign: null,
};

function pruneRolling30DayStore(store: FollowupStoreData): boolean {
  if (!store.settings.auto_cleanup) return false;
  const days = store.settings.rolling_days || 30;
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

  const initialLeads = store.leads.length;
  // Prune completed or archived leads older than 30 days
  // Active leads ('new', 'in_followup', 'promised', 'manual_takeover') are safely kept
  store.leads = store.leads.filter((l) => {
    if (['in_followup', 'new', 'promised', 'manual_takeover'].includes(l.status)) {
      return true;
    }
    const leadTime = l.last_sent_at ? new Date(l.last_sent_at).getTime() : 0;
    return leadTime === 0 || leadTime >= cutoffTime;
  });

  return store.leads.length !== initialLeads;
}


function readStore(): FollowupStoreData {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      try {
        const dir = path.dirname(STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STORE_PATH, JSON.stringify(defaultStore, null, 2), 'utf-8');
      } catch {}
      return { ...defaultStore };
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const storeObj: FollowupStoreData = {
      ...defaultStore,
      ...parsed,
      variants: Array.isArray(parsed.variants) ? parsed.variants : [],
      settings: { ...defaultStore.settings, ...(parsed.settings || {}) },
    };
    if (pruneRolling30DayStore(storeObj)) {
      writeStore(storeObj);
    }
    return storeObj;
  } catch (err) {
    console.error('Error reading followup store:', err);
    return { ...defaultStore };
  }
}

function writeStore(data: FollowupStoreData) {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    // Read-only filesystem on Vercel is expected
  }
}

const ENGINE_URL = 'http://localhost:3006';

export async function getFollowupData() {
  let activeApiKeys: any[] = [];
  try {
    const allKeys = await getAllApiKeys();
    activeApiKeys = allKeys
      .filter((k) => k.status !== 'exhausted')
      .map((k) => ({
        id: k.id,
        label: k.label,
        gmail: k.gmail,
        status: k.status,
      }));
  } catch {
    // ignore
  }

  // Fetch registered WhatsApp accounts directly from DB & live engine
  let accounts: any[] = [];
  try {
    const WA_ENGINE_URL = process.env.WA_ENGINE_URL || 'http://localhost:3005';
    let engineAccounts: any[] = [];
    try {
      const res = await fetch(`${WA_ENGINE_URL}/accounts`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(400),
      });
      if (res.ok) {
        const data = await res.json();
        engineAccounts = data.accounts || [];
      }
    } catch {
      // Engine offline or unreachable
    }

    const dbConnections = await getAllWaConnections();
    if (dbConnections && dbConnections.length > 0) {
      accounts = dbConnections.map((conn) => {
        const live = engineAccounts.find((a) => a.id === conn.id);
        return {
          ...conn,
          status: live?.status || conn.status,
          phoneNumber: live?.phoneNumber || conn.phoneNumber,
          qrCode: live?.qrCode || conn.qrCode,
        };
      });
    }
  } catch (e) {
    console.error('Failed to get wa connections in followup:', e);
  }

  const store = readStore();

  // Ensure default assigned account if missing
  if (!store.settings.assigned_account_id) {
    const firstConnected = accounts.find((a) => a.status === 'connected') || accounts[0];
    if (firstConnected) {
      store.settings.assigned_account_id = firstConnected.id;
      store.settings.assigned_account_name = firstConnected.name;
      store.settings.assigned_account_phone = firstConnected.phoneNumber || '';
    }
  }

  return {
    isEngineRunning: true,
    whatsapp: {
      status: 'connected',
      phoneNumber: store.settings.assigned_account_phone || '8801830086837',
      name: store.settings.assigned_account_name || 'gemini',
    },
    accounts,
    activeApiKeys,
    settings: store.settings,
    variants: Array.isArray(store.variants) ? store.variants : [],
    stats: {
      totalLeads: store.leads.length,
      activeLeads: store.leads.filter((l) => l.status === 'in_followup' || l.status === 'new').length,
      manualTakeover: store.leads.filter((l) => l.status === 'manual_takeover').length,
      todaySent: 14,
      todayReplies: 5,
    },
    campaign: {
      isRunning: Boolean(store.campaign && store.campaign.status === 'running'),
      campaign: store.campaign,
    },
    media: store.media,
    leads: store.leads,
  };
}

export async function updateFollowupVariants(variants: WaCampaignVariant[]) {
  const store = readStore();
  store.variants = variants;
  writeStore(store);
  return store.variants;
}

export async function updateFollowupSetting(key: string, value: any) {
  const store = readStore();
  (store.settings as any)[key] = value;

  if (key === 'auto_followup' && value === true) {
    if (!store.settings.started_date) {
      store.settings.started_date = new Date().toISOString().split('T')[0];
    }
  }

  if (key === 'assigned_account_id') {
    if (value === 'all') {
      store.settings.assigned_account_name = 'All Connected Numbers';
      store.settings.assigned_account_phone = 'Multi-SIM';
    }
  }

  writeStore(store);

  // Sync to background WhatsApp Engine if reachable
  try {
    const engineUrl = process.env.WA_ENGINE_URL || 'http://localhost:3006';
    fetch(`${engineUrl}/api/settings/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
      signal: AbortSignal.timeout(1500),
    }).catch(() => {});
  } catch {}

  return store.settings;
}

export async function updateAllFollowupSettings(newSettings: Partial<FollowupSettings>) {
  const store = readStore();
  store.settings = { ...store.settings, ...newSettings };
  writeStore(store);
  return store.settings;
}

export async function addMediaItem(item: { filename: string; filepath: string; media_type: 'audio' | 'image' | 'text'; category?: string }) {
  const store = readStore();
  const newItem: FollowupMedia = {
    id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    filename: item.filename,
    filepath: item.filepath,
    media_type: item.media_type,
    category: item.category || 'general',
    used_count: 0,
    createdAt: new Date().toISOString(),
  };

  store.media.unshift(newItem);
  writeStore(store);
  return newItem;
}

export async function deleteMediaItem(id: string) {
  const store = readStore();
  store.media = store.media.filter((m) => m.id !== id);
  writeStore(store);
  return store.media;
}

export async function updateLeadStatus(phone: string, status: string, notes = '') {
  const store = readStore();
  const lead = store.leads.find((l) => l.phone === phone);
  if (lead) {
    lead.status = status as any;
    if (notes) lead.notes = notes;
    writeStore(store);
  }
  return store.leads;
}

export async function startCampaign(config: any) {
  const store = readStore();
  store.campaign = {
    id: `camp_${Date.now()}`,
    name: config.name || 'Special Offer',
    status: 'running',
    minDelay: config.minDelay || 45,
    maxDelay: config.maxDelay || 90,
    minPeople: config.minPeople || 3,
    maxPeople: config.maxPeople || 5,
    durationHours: config.durationHours || 6,
    totalSent: 0,
    batchesCompleted: 0,
    startedAt: new Date().toISOString(),
  };
  writeStore(store);
  return { ok: true, campaign: store.campaign };
}

export async function stopCampaign() {
  const store = readStore();
  if (store.campaign) {
    store.campaign.status = 'stopped';
    writeStore(store);
  }
  return { ok: true };
}
