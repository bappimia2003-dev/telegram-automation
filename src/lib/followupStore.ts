import fs from 'fs';
import path from 'path';
import os from 'os';
import { getAllApiKeys } from './db';
import { getAllWaConnections, getAllCampaigns, updateCampaign } from './whatsappDb';
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
  min_contact_age_days: number;
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
const TMP_STORE_PATH = path.join(os.tmpdir(), 'followup_store.json');

let inMemoryStore: FollowupStoreData | null = null;

const defaultVariants: WaCampaignVariant[] = [];

const defaultStore: FollowupStoreData = {
  settings: {
    auto_followup: true,
    ai_brain: false,
    antiban: true,
    auto_cleanup: true,
    gender_detection: true,
    assigned_account_id: 'acc_4929c1a7',
    assigned_account_phone: '8801830086837',
    assigned_account_name: 'gemini',
    gemini_api_key: '',
    working_hours_start: '08:00',
    working_hours_end: '23:59',
    max_daily_messages: 30,
    rolling_days: 30,
    min_delay_minutes: 2,
    max_delay_minutes: 4,
    min_batch_people: 3,
    max_batch_people: 5,
    duration_hours: 6,
    total_duration_days: 30,
    min_contact_age_days: 0,
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
  if (inMemoryStore) {
    return inMemoryStore;
  }

  let raw = '';
  // Try reading from STORE_PATH first
  try {
    if (fs.existsSync(STORE_PATH)) {
      raw = fs.readFileSync(STORE_PATH, 'utf-8');
    }
  } catch {}

  // If STORE_PATH had nothing or failed, try TMP_STORE_PATH
  if (!raw) {
    try {
      if (fs.existsSync(TMP_STORE_PATH)) {
        raw = fs.readFileSync(TMP_STORE_PATH, 'utf-8');
      }
    } catch {}
  }

  if (raw) {
    try {
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
      inMemoryStore = storeObj;
      return storeObj;
    } catch (e) {
      console.error('Error parsing followup store JSON:', e);
    }
  }

  inMemoryStore = { ...defaultStore };
  return inMemoryStore;
}

function writeStore(data: FollowupStoreData) {
  inMemoryStore = JSON.parse(JSON.stringify(data));

  // Try writing to primary filesystem path
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    // Expected on Vercel read-only filesystem
  }

  // Also write to tmp as fallback
  try {
    fs.writeFileSync(TMP_STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    // Ignore tmp write errors
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

  // If local store has no variants (e.g. after fresh deploy), restore from Supabase campaigns' followupConfig
  if (!store.variants || store.variants.length === 0) {
    try {
      const allCamps = await getAllCampaigns();
      const campWithFupVars = allCamps.find((c) => (c.followupConfig as any)?.followupVariants?.length > 0);
      if (campWithFupVars && (campWithFupVars.followupConfig as any)?.followupVariants?.length > 0) {
        store.variants = (campWithFupVars.followupConfig as any).followupVariants;
        writeStore(store);
      } else {
        const campWithSteps = allCamps.find((c) => c.followupConfig?.steps && c.followupConfig.steps.length > 0);
        if (campWithSteps && campWithSteps.followupConfig?.steps) {
          store.variants = campWithSteps.followupConfig.steps.map((s) => ({
            id: `var_${s.stepNumber}`,
            name: s.title || `Variation ${s.stepNumber}`,
            isActive: true,
            welcomeMessage: s.message || '',
            imageUrl: s.imageUrl || '',
            audioUrl: s.audioUrl || '',
            videoUrl: s.videoUrl || '',
            documentUrl: s.documentUrl || '',
            documentName: s.documentName || '',
          }));
          writeStore(store);
        }
      }
    } catch {}
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

  if (key === 'auto_followup') {
    if (value === true && !store.settings.started_date) {
      store.settings.started_date = new Date().toISOString().split('T')[0];
    }
    // Sync toggle directly to Supabase campaigns so Railway engine immediately starts/stops follow-up
    try {
      const campaigns = await getAllCampaigns();
      for (const c of campaigns) {
        if (c.followupConfig) {
          await updateCampaign(c.id, {
            followupConfig: {
              ...c.followupConfig,
              followupEnabled: Boolean(value),
              aiEnabled: false,
            },
          });
        }
      }
    } catch (e: any) {
      console.error('Failed syncing auto_followup toggle to Supabase:', e.message);
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
    const engineUrl = process.env.WA_ENGINE_URL || 'http://localhost:3005';
    fetch(`${engineUrl}/followup/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
      signal: AbortSignal.timeout(2000),
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

export async function saveFollowupAll(payload: { variants?: WaCampaignVariant[]; settings?: Partial<FollowupSettings> }) {
  const store = readStore();
  if (Array.isArray(payload.variants)) {
    store.variants = payload.variants;
  }
  if (payload.settings) {
    store.settings = { ...store.settings, ...payload.settings };
    if (payload.settings.auto_followup && !store.settings.started_date) {
      store.settings.started_date = new Date().toISOString().split('T')[0];
    }
  }
  writeStore(store);

  // Sync variations & settings to Supabase wa_campaigns table so Railway engine receives exact text & image!
  try {
    const isAutoFollowup = Boolean(store.settings.auto_followup);
    const primaryVar = store.variants[0];
    const campaigns = await getAllCampaigns();

    for (const c of campaigns) {
      const isTarget =
        store.settings.assigned_account_id === 'all' ||
        !store.settings.assigned_account_id ||
        c.accountId === store.settings.assigned_account_id ||
        (!c.accountId && store.settings.assigned_account_id === 'main');

      if (isTarget) {
        await updateCampaign(c.id, {
          // DO NOT touch c.variants! Campaign auto-reply variants belong to the campaign.
          followupConfig: {
            ...(c.followupConfig || {}),
            followupEnabled: isAutoFollowup,
            aiEnabled: false, // User requested 100% exact text, strictly NO AI rewriting!
            minDelayMinutes: Number(store.settings.min_delay_minutes) || 3,
            maxDelayMinutes: Number(store.settings.max_delay_minutes) || 5,
            minBatchPeople: Number(store.settings.min_batch_people) || 3,
            maxBatchPeople: Number(store.settings.max_batch_people) || 5,
            minContactAgeDays: Number(store.settings.min_contact_age_days) || 0,
            totalDurationDays: Number(store.settings.total_duration_days) || 30,
            followupMessage: primaryVar?.welcomeMessage || '',
            followupImageUrl: primaryVar?.imageUrl || '',
            followupAudioUrl: primaryVar?.audioUrl || '',
            followupVideoUrl: primaryVar?.videoUrl || '',
            followupDocumentUrl: primaryVar?.documentUrl || '',
            steps: store.variants.map((v, idx) => ({
              stepNumber: idx + 1,
              title: v.name,
              message: v.welcomeMessage || '',
              imageUrl: v.imageUrl || '',
              audioUrl: v.audioUrl || '',
              videoUrl: v.videoUrl || '',
              documentUrl: v.documentUrl || '',
              documentName: v.documentName || '',
            })),
            followupVariants: store.variants,
          },
        });
      }
    }
  } catch (err: any) {
    console.error('Failed syncing followup to Supabase campaigns:', err.message);
  }

  // Sync to background WhatsApp Engine if reachable
  try {
    const engineUrl = process.env.WA_ENGINE_URL || 'http://localhost:3005';
    fetch(`${engineUrl}/followup/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: store.settings, variants: store.variants }),
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});
  } catch {}

  return { variants: store.variants, settings: store.settings };
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
