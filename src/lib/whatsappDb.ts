import { getSupabase, handleSupabaseError } from './supabase';
import { deleteMediaUrl, extractAllMediaUrlsFromCampaign, cleanupReplacedMedia } from './mediaCleaner';
import { 
  WaCampaign, 
  WaCampaignVariant, 
  WaFollowupConfig,
  WaUnderstandingFile,
  WaFollowupMediaFile,
  WaContactedUser, 
  WaMessageLog, 
  WaConnection, 
  WaDashboardStats,
  WaClientProfile
} from './whatsappTypes';

// =============================================
// In-memory fallback (seeded with initial working items)
// =============================================
const initialAccounts: WaConnection[] = [
  {
    id: 'acc_4929c1a7',
    name: 'JalaBot Official SIM',
    phoneNumber: '8801830086837',
    status: 'connected',
    qrCode: '',
    lastConnected: new Date().toISOString(),
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    clientId: 'admin',
  },
  {
    id: 'acc_376edf0e',
    name: 'Primary Support SIM',
    phoneNumber: '8801993466370',
    status: 'connected',
    qrCode: '',
    lastConnected: new Date().toISOString(),
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    clientId: 'admin',
  },
  {
    id: 'acc_0ac172f0',
    name: 'Meeshomart Main Whatsapp',
    phoneNumber: '8801410449778',
    status: 'connected',
    qrCode: '',
    lastConnected: new Date().toISOString(),
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    clientId: 'admin',
  },
  {
    id: 'acc_552117bc',
    name: 'Ushan (Airtel)',
    phoneNumber: '8801609251421',
    status: 'qr_pending',
    qrCode: '',
    lastConnected: new Date().toISOString(),
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    clientId: 'cli_5tg3k2ktl',
  },
];

const initialCampaigns: WaCampaign[] = [
  {
    id: '49f77c7f-086b-40e3-a2d1-2dd9b178937a',
    name: 'JalaBot Pro Support',
    description: 'Automated customer support answering queries and subscriptions.',
    accountId: 'acc_4929c1a7',
    clientId: 'admin',
    isActive: true,
    keywords: 'jalabot, support, pro, price',
    isDefault: true,
    welcomeMessage: '🔥 মাত্র কয়েক সেকেন্ডের ব্যবধানে প্রিমিয়াম টুলস ও Canva সাবস্ক্রিপশন পান! \n\n✅ 100% Official Premium Access\n✅ Private & Shared plan available!\n\nযেকোনটি নিতে চাইলে inbox করুন!',
    imageUrl: '',
    audioUrl: '',
    videoUrl: '',
    documentUrl: '',
    documentName: '',
    sendOrder: 'random',
    delayBetweenSends: 3,
    chatReplyEnabled: true,
    totalSent: 1240,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      {
        id: 'var_test',
        name: 'Main Variation',
        isActive: true,
        welcomeMessage: '🔥 মাত্র কয়েক সেকেন্ডের ব্যবধানে ChatGPT, Gemini, Claude ও Canva সাবস্ক্রিপশন পান! \n\n✅ 100% Official Premium Access\n✅ Private & Shared plan available!\n\nযেকোনটি নিতে চাইলে inbox করুন!',
        imageUrl: '',
        audioUrl: '',
        videoUrl: '',
        documentUrl: '',
        documentName: '',
      },
    ],
  },
  {
    id: '60137183-4ad3-4961-8c8c-62f7a32c6ae8',
    name: 'Coursera Plus',
    description: 'Discount access for premium certification courses.',
    accountId: 'acc_4929c1a7',
    clientId: 'admin',
    isActive: true,
    keywords: 'coursera, plus, course, learn',
    isDefault: false,
    welcomeMessage: '🎓 ক্যারিয়ারের প্রিমিয়াম সাবস্ক্রিপশন পান 🎓\n\n👨‍🎓 7000+ Courses, Professional Certificates & Degrees!\n\nযেকোনটি নিতে চাইলে inbox করুন!',
    imageUrl: '',
    audioUrl: '',
    videoUrl: '',
    documentUrl: '',
    documentName: '',
    sendOrder: 'random',
    delayBetweenSends: 4,
    chatReplyEnabled: true,
    totalSent: 685,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      {
        id: 'var_1',
        name: 'Variation 1 (Default)',
        isActive: true,
        welcomeMessage: '🎓 ক্যারিয়ারের প্রিমিয়াম সাবস্ক্রিপশন পান 🎓\n\n👨‍🎓 7000+ Courses, Professional Certificates & Degrees!\n\nযেকোনটি নিতে চাইলে inbox করুন!',
        imageUrl: '',
        audioUrl: '',
        videoUrl: '',
        documentUrl: '',
        documentName: '',
      },
    ],
  },
  {
    id: '9d166f61-f6bf-4c02-b0a6-668c601da691',
    name: 'Smart Rack 3 layer',
    description: 'Product catalog & discount promos for home organizers.',
    accountId: 'acc_0ac172f0',
    clientId: 'admin',
    isActive: true,
    keywords: 'rack, smart rack, 3 layer',
    isDefault: false,
    welcomeMessage: 'আসসালামু আলাইকুম! আমাদের ৩ লেয়ার স্মার্ট রেক সম্পর্কে বিস্তারিত জানতে চাইলে ইনবক্স করুন।',
    imageUrl: '',
    audioUrl: '',
    videoUrl: '',
    documentUrl: '',
    documentName: '',
    sendOrder: 'random',
    delayBetweenSends: 3,
    chatReplyEnabled: true,
    totalSent: 342,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      {
        id: 'var_1',
        name: 'Variation 1 (Default)',
        isActive: true,
        welcomeMessage: 'আসসালামু আলাইকুম! আমাদের ৩ লেয়ার স্মার্ট রেক সম্পর্কে বিস্তারিত জানতে চাইলে ইনবক্স করুন।',
        imageUrl: '',
        audioUrl: '',
        videoUrl: '',
        documentUrl: '',
        documentName: '',
      },
    ],
  },
];

const initialClients: WaClientProfile[] = [
  {
    id: 'cli_fpjpvr4f5',
    name: 'sabir',
    password: '5920',
    maxWhatsappNumbers: 3,
    maxCampaigns: 20,
    durationDays: 30,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    isActive: true,
    notes: 'Premium reseller account',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cli_5tg3k2ktl',
    name: 'Neuromark IT (Ushan)',
    password: 'Ushan@123',
    maxWhatsappNumbers: 1,
    maxCampaigns: 3,
    durationDays: 365,
    expiresAt: new Date(Date.now() + 350 * 86400000).toISOString(),
    isActive: true,
    notes: 'Agency partner',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const initialMessageLogs: WaMessageLog[] = [
  {
    id: 'log_01',
    campaignId: '49f77c7f-086b-40e3-a2d1-2dd9b178937a',
    phoneNumber: '8801711223344',
    contactName: 'Tanvir Ahmed',
    messageType: 'text',
    fileUrl: '',
    status: 'sent',
    errorMessage: '',
    sentAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: 'log_02',
    campaignId: '60137183-4ad3-4961-8c8c-62f7a32c6ae8',
    phoneNumber: '8801822334455',
    contactName: 'Nasrin Akter',
    messageType: 'text',
    fileUrl: '',
    status: 'sent',
    errorMessage: '',
    sentAt: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: 'log_03',
    campaignId: '9d166f61-f6bf-4c02-b0a6-668c601da691',
    phoneNumber: '8801933445566',
    contactName: 'Rafiqul Islam',
    messageType: 'text',
    fileUrl: '',
    status: 'sent',
    errorMessage: '',
    sentAt: new Date(Date.now() - 120 * 60000).toISOString(),
  },
];

interface WaGlobalMemory {
  campaigns: WaCampaign[];
  clients: WaClientProfile[];
  contactedUsers: WaContactedUser[];
  messageLogs: WaMessageLog[];
  connections: WaConnection[];
  connection: WaConnection | null;
  deletedConnectionIds: Set<string>;
  deletedCampaignIds: Set<string>;
}

const globalForWa = globalThis as unknown as { __JALABOT_WA_MEMORY__?: WaGlobalMemory };

if (!globalForWa.__JALABOT_WA_MEMORY__) {
  globalForWa.__JALABOT_WA_MEMORY__ = {
    campaigns: [...initialCampaigns] as WaCampaign[],
    clients: [...initialClients] as WaClientProfile[],
    contactedUsers: [] as WaContactedUser[],
    messageLogs: [...initialMessageLogs] as WaMessageLog[],
    connections: [...initialAccounts] as WaConnection[],
    connection: initialAccounts[0] as WaConnection,
    deletedConnectionIds: new Set<string>(),
    deletedCampaignIds: new Set<string>(),
  };
} else if (!globalForWa.__JALABOT_WA_MEMORY__.deletedCampaignIds) {
  globalForWa.__JALABOT_WA_MEMORY__.deletedCampaignIds = new Set<string>();
}

const waMemory = globalForWa.__JALABOT_WA_MEMORY__;
for (const c of waMemory.connections || []) {
  if (c.name === 'Gemini WhatsApp') c.name = 'JalaBot Official SIM';
}
for (const camp of waMemory.campaigns || []) {
  if (camp.name === 'Gemini Pro AI Support') camp.name = 'JalaBot Pro Support';
}

// =============================================
// Row Mappers (snake_case <-> camelCase)
// =============================================
function parseDescriptionTags(rawDesc: string): { 
  accountId: string; 
  clientId: string;
  variants: WaCampaignVariant[]; 
  followupConfig?: WaFollowupConfig;
  description: string; 
} {
  let description = rawDesc || '';
  let accountId = 'all';
  let clientId = 'admin';
  let variants: WaCampaignVariant[] = [];
  let followupConfig: WaFollowupConfig | undefined = undefined;

  // Extract [cli:...]
  if (description.includes('[cli:')) {
    const start = description.indexOf('[cli:');
    const end = description.indexOf(']', start);
    if (end !== -1) {
      clientId = description.substring(start + 5, end) || 'admin';
      description = (description.substring(0, start) + description.substring(end + 1)).trim();
    }
  }

  // Extract [acc:...]
  if (description.includes('[acc:')) {
    const start = description.indexOf('[acc:');
    const end = description.indexOf(']', start);
    if (end !== -1) {
      accountId = description.substring(start + 5, end);
      description = (description.substring(0, start) + description.substring(end + 1)).trim();
    }
  }

  // Extract [vars:...]
  if (description.includes('[vars:')) {
    const start = description.indexOf('[vars:');
    const end = description.indexOf(']', start);
    if (end !== -1) {
      const varsRaw = description.substring(start + 6, end);
      try {
        let decoded = varsRaw;
        if (!varsRaw.startsWith('[')) {
          decoded = Buffer.from(varsRaw, 'base64').toString('utf-8');
        }
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed)) {
          variants = parsed;
        }
      } catch (e) {
        // ignore parse error
      }
      description = (description.substring(0, start) + description.substring(end + 1)).trim();
    }
  }

  // Extract [fup:...]
  if (description.includes('[fup:')) {
    const start = description.indexOf('[fup:');
    const end = description.indexOf(']', start);
    if (end !== -1) {
      const fupRaw = description.substring(start + 5, end);
      try {
        let decoded = fupRaw;
        if (!fupRaw.startsWith('{')) {
          decoded = Buffer.from(fupRaw, 'base64').toString('utf-8');
        }
        followupConfig = JSON.parse(decoded);
      } catch (e) {
        // ignore parse error
      }
      description = (description.substring(0, start) + description.substring(end + 1)).trim();
    }
  }

  return { accountId, clientId, variants, followupConfig, description };
}

function rowToCampaign(r: any): WaCampaign {
  const { accountId, clientId, variants: parsedVariants, followupConfig, description } = parseDescriptionTags(r.description || '');

  // If no variants array in description, construct default variant 1 from row data
  let variants = parsedVariants;
  if (!variants || variants.length === 0) {
    variants = [
      {
        id: 'var_1',
        name: 'Variation 1',
        isActive: true,
        welcomeMessage: r.welcome_message || '',
        imageUrl: r.image_url || '',
        audioUrl: r.audio_url || '',
        videoUrl: r.video_url || '',
        documentUrl: r.document_url || '',
        documentName: r.document_name || '',
      },
    ];
  }

  return {
    id: r.id,
    name: r.name,
    description,
    accountId,
    clientId,
    keywords: r.keywords || '',
    isDefault: Boolean(r.is_default),
    welcomeMessage: r.welcome_message || '',
    imageUrl: r.image_url || '',
    audioUrl: r.audio_url || '',
    videoUrl: r.video_url || '',
    documentUrl: r.document_url || '',
    documentName: r.document_name || '',
    variants,
    followupConfig: followupConfig || (r.followup_config ? (typeof r.followup_config === 'string' ? JSON.parse(r.followup_config) : r.followup_config) : undefined),
    sendOrder: r.send_order || 'message,image,video,audio,document',
    delayBetweenSends: r.delay_between_sends ?? 3,
    isActive: Boolean(r.is_active),
    chatReplyEnabled: Boolean(r.chat_reply_enabled),
    totalSent: r.total_sent ?? 0,
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  };
}

function campaignToRow(c: Partial<WaCampaign>): any {
  const row: any = {};
  if (c.id !== undefined) row.id = c.id;
  if (c.name !== undefined) row.name = c.name;
  if (c.description !== undefined || c.accountId !== undefined || c.clientId !== undefined || c.variants !== undefined || c.followupConfig !== undefined) {
    let desc = c.description || '';
    if (c.followupConfig) {
      const base64Fup = Buffer.from(JSON.stringify(c.followupConfig)).toString('base64');
      desc = `[fup:${base64Fup}] ${desc}`;
    }
    if (c.variants && c.variants.length > 0) {
      const base64Vars = Buffer.from(JSON.stringify(c.variants)).toString('base64');
      desc = `[vars:${base64Vars}] ${desc}`;
    }
    if (c.accountId && c.accountId !== 'all') {
      desc = `[acc:${c.accountId}] ${desc}`;
    }
    if (c.clientId && c.clientId !== 'admin') {
      desc = `[cli:${c.clientId}] ${desc}`;
    }
    row.description = desc;
  }
  if (c.keywords !== undefined) row.keywords = c.keywords;
  if (c.isDefault !== undefined) row.is_default = c.isDefault;

  // Set top-level media fields, defaulting to first active variant if variants exist
  let welcomeMsg = c.welcomeMessage;
  let imgUrl = c.imageUrl;
  let audUrl = c.audioUrl;
  let vidUrl = c.videoUrl;
  let docUrl = c.documentUrl;
  let docName = c.documentName;

  if (c.variants && c.variants.length > 0) {
    const primary = c.variants.find((v) => v.isActive) || c.variants[0];
    if (primary) {
      if (welcomeMsg === undefined) welcomeMsg = primary.welcomeMessage;
      if (imgUrl === undefined) imgUrl = primary.imageUrl;
      if (audUrl === undefined) audUrl = primary.audioUrl;
      if (vidUrl === undefined) vidUrl = primary.videoUrl;
      if (docUrl === undefined) docUrl = primary.documentUrl;
      if (docName === undefined) docName = primary.documentName;
    }
  }

  if (welcomeMsg !== undefined) row.welcome_message = welcomeMsg;
  if (imgUrl !== undefined) row.image_url = imgUrl;
  if (audUrl !== undefined) row.audio_url = audUrl;
  if (vidUrl !== undefined) row.video_url = vidUrl;
  if (docUrl !== undefined) row.document_url = docUrl;
  if (docName !== undefined) row.document_name = docName;

  if (c.sendOrder !== undefined) row.send_order = c.sendOrder;
  if (c.delayBetweenSends !== undefined) row.delay_between_sends = c.delayBetweenSends;
  if (c.isActive !== undefined) row.is_active = c.isActive;
  if (c.chatReplyEnabled !== undefined) row.chat_reply_enabled = c.chatReplyEnabled;
  if (c.totalSent !== undefined) row.total_sent = c.totalSent;
  if (c.updatedAt !== undefined) row.updated_at = c.updatedAt;
  if (c.createdAt !== undefined) row.created_at = c.createdAt;
  return row;
}

function rowToContactedUser(r: any): WaContactedUser {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    phoneNumber: r.phone_number,
    contactName: r.contact_name || '',
    sentAt: r.sent_at || new Date().toISOString(),
    status: (r.status as any) || 'sent',
  };
}

function rowToMessageLog(r: any): WaMessageLog {
  let fileUrl = r.file_url || '';
  if (fileUrl.startsWith('data:audio')) fileUrl = 'voice_note.mp3';
  else if (fileUrl.startsWith('data:image')) fileUrl = 'photo.jpg';
  else if (fileUrl.startsWith('data:video')) fileUrl = 'video.mp4';
  else if (fileUrl.startsWith('data:')) fileUrl = 'document.bin';

  return {
    id: r.id,
    campaignId: r.campaign_id,
    phoneNumber: r.phone_number,
    contactName: r.contact_name || '',
    messageType: r.message_type as any,
    fileUrl,
    status: (r.status as any) || 'sent',
    errorMessage: r.error_message || '',
    sentAt: r.sent_at || new Date().toISOString(),
  };
}

function rowToConnection(r: any): WaConnection {
  let name = r.id === 'main' ? 'Primary WhatsApp' : `SIM ${r.id.slice(-4)}`;
  let phoneNumber = r.phone_number || '';
  let clientId = 'admin';

  if (phoneNumber.includes('[cli:')) {
    const start = phoneNumber.indexOf('[cli:');
    const end = phoneNumber.indexOf(']', start);
    if (end !== -1) {
      clientId = phoneNumber.substring(start + 5, end) || 'admin';
      phoneNumber = (phoneNumber.substring(0, start) + phoneNumber.substring(end + 1)).trim();
    }
  }

  if (phoneNumber.includes('|')) {
    const parts = phoneNumber.split('|');
    name = parts[0];
    phoneNumber = parts[1];
  }
  if (name === 'Gemini WhatsApp') {
    name = 'JalaBot Official SIM';
  }

  return {
    id: r.id || 'main',
    name,
    phoneNumber,
    status: (r.status as any) || 'disconnected',
    qrCode: r.qr_code || '',
    lastConnected: r.last_connected || new Date().toISOString(),
    createdAt: r.created_at || new Date().toISOString(),
    clientId,
  };
}

// =============================================
// CAMPAIGNS CRUD & IN-MEMORY CACHE
// =============================================
let campaignsCache: WaCampaign[] | null = null;
let campaignsCacheTime = 0;
const CAMPAIGNS_CACHE_TTL_MS = 15000; // 15 seconds short-term cache

export function invalidateCampaignsCache() {
  campaignsCache = null;
  campaignsCacheTime = 0;
}

export async function getAllCampaigns(forceRefresh = false): Promise<WaCampaign[]> {
  const now = Date.now();
  if (!forceRefresh && campaignsCache && (now - campaignsCacheTime < CAMPAIGNS_CACHE_TTL_MS)) {
    return campaignsCache.filter((c) => !waMemory.deletedCampaignIds.has(c.id));
  }
  const supabase = getSupabase();
  if (!supabase) return waMemory.campaigns.filter((c) => !waMemory.deletedCampaignIds.has(c.id));

  try {
    const { data, error } = await supabase.from('wa_campaigns').select('*').order('created_at', { ascending: false });
    if (error) {
      handleSupabaseError('fetching wa_campaigns', error);
      return (campaignsCache || waMemory.campaigns).filter((c) => !waMemory.deletedCampaignIds.has(c.id));
    }

    // Check if system_clients row exists in data and enforce expiry
    const sysClientsRow = (data || []).find((r: any) => r.id === 'system_clients');
    const expiredClientIds = new Set<string>();
    if (sysClientsRow?.description) {
      try {
        let raw = sysClientsRow.description.trim();
        if (!raw.startsWith('[')) {
          raw = Buffer.from(raw, 'base64').toString('utf-8');
        }
        const parsed: WaClientProfile[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const cli of parsed) {
            if (isClientExpired(cli)) {
              expiredClientIds.add(cli.id);
            }
          }
        }
      } catch {}
    }

    const campaigns = (data || [])
      .filter((r: any) => !r.id?.startsWith('system_') && !waMemory.deletedCampaignIds.has(r.id))
      .map((r: any) => {
        const camp = rowToCampaign(r);
        if (camp.name === 'Gemini Pro AI Support') camp.name = 'JalaBot Pro Support';
        if (camp.isActive && camp.clientId && expiredClientIds.has(camp.clientId)) {
          camp.isActive = false;
          // Persist auto-off in Supabase asynchronously
          supabase.from('wa_campaigns').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', camp.id).then(() => {}, () => {});
        }
        return camp;
      });

    campaignsCache = campaigns;
    campaignsCacheTime = now;
    return campaigns;
  } catch (err: any) {
    handleSupabaseError('fetching wa_campaigns', err);
    return (campaignsCache || waMemory.campaigns).filter((c) => !waMemory.deletedCampaignIds.has(c.id));
  }
}

export async function getActiveCampaigns(): Promise<WaCampaign[]> {
  const all = await getAllCampaigns();
  return all.filter(c => c.isActive);
}

export async function getCampaignById(id: string): Promise<WaCampaign | null> {
  if (campaignsCache) {
    const cached = campaignsCache.find(c => c.id === id);
    if (cached) return cached;
  }
  const supabase = getSupabase();
  if (!supabase) return waMemory.campaigns.find(c => c.id === id) || null;

  try {
    const { data, error } = await supabase.from('wa_campaigns').select('*').eq('id', id).maybeSingle();
    if (error || !data) {
      if (error) handleSupabaseError('fetching campaign', error);
      return waMemory.campaigns.find(c => c.id === id) || null;
    }
    return rowToCampaign(data);
  } catch (err: any) {
    handleSupabaseError('fetching campaign', err);
    return waMemory.campaigns.find(c => c.id === id) || null;
  }
}

export async function createCampaign(campaign: WaCampaign): Promise<WaCampaign> {
  invalidateCampaignsCache();
  const supabase = getSupabase();
  if (!supabase) {
    waMemory.campaigns.push(campaign);
    return campaign;
  }
  const row = campaignToRow(campaign);
  try {
    const { data, error } = await supabase.from('wa_campaigns').insert(row).select().single();
    if (error) {
      handleSupabaseError('creating campaign', error);
      waMemory.campaigns.push(campaign);
      return campaign;
    }
    return rowToCampaign(data);
  } catch (err: any) {
    handleSupabaseError('creating campaign', err);
    waMemory.campaigns.push(campaign);
    return campaign;
  }
}

export async function updateCampaign(id: string, updates: Partial<WaCampaign>): Promise<WaCampaign | null> {
  invalidateCampaignsCache();
  const supabase = getSupabase();
  const existing = await getCampaignById(id);
  const merged: WaCampaign = {
    ...(existing || ({} as WaCampaign)),
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Automatically delete any replaced or removed media from Cloudflare R2 / storage
  if (existing) {
    cleanupReplacedMedia(existing, merged).catch(err => {
      console.warn('[UpdateCampaign] Error cleaning replaced media:', err);
    });
  }

  const rowUpdates = campaignToRow(merged);

  if (!supabase) {
    const idx = waMemory.campaigns.findIndex(c => c.id === id);
    if (idx === -1) return null;
    waMemory.campaigns[idx] = merged;
    return merged;
  }

  try {
    const { data, error } = await supabase.from('wa_campaigns').update(rowUpdates).eq('id', id).select().maybeSingle();
    if (error || !data) {
      if (error) handleSupabaseError('updating campaign', error);
      const idx = waMemory.campaigns.findIndex(c => c.id === id);
      if (idx !== -1) waMemory.campaigns[idx] = merged;
      return merged;
    }
    return rowToCampaign(data);
  } catch (err: any) {
    handleSupabaseError('updating campaign', err);
    const idx = waMemory.campaigns.findIndex(c => c.id === id);
    if (idx !== -1) waMemory.campaigns[idx] = merged;
    return merged;
  }
}

export async function deleteCampaign(id: string): Promise<boolean> {
  invalidateCampaignsCache();
  waMemory.deletedCampaignIds.add(id);

  // 1. Purge all campaign media files from Cloudflare R2 and Supabase storage
  const existing = await getCampaignById(id);
  if (existing) {
    const urls = extractAllMediaUrlsFromCampaign(existing);
    for (const url of urls) {
      deleteMediaUrl(url).catch(() => {});
    }
  }

  waMemory.campaigns = waMemory.campaigns.filter(c => c.id !== id);
  waMemory.contactedUsers = waMemory.contactedUsers.filter(u => u.campaignId !== id);
  waMemory.messageLogs = waMemory.messageLogs.filter(l => l.campaignId !== id);

  const supabase = getSupabase();
  if (!supabase) {
    return true;
  }
  try {
    await supabase.from('wa_message_logs').delete().eq('campaign_id', id);
    await supabase.from('wa_contacted_users').delete().eq('campaign_id', id);
    await supabase.from('wa_campaigns').delete().eq('id', id);
    return true;
  } catch (err: any) {
    handleSupabaseError('deleting campaign', err);
    return true;
  }
}

export async function incrementCampaignSentCount(id: string): Promise<void> {
  const campaign = await getCampaignById(id);
  if (campaign) {
    await updateCampaign(id, { totalSent: (campaign.totalSent || 0) + 1 });
  }
}

// =============================================
// CONTACTED USERS
// =============================================
export async function isAlreadyContacted(campaignId: string, phoneNumber: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    return waMemory.contactedUsers.some(u => u.campaignId === campaignId && u.phoneNumber === phoneNumber);
  }
  try {
    const { data, error } = await supabase
      .from('wa_contacted_users')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('phone_number', phoneNumber)
      .maybeSingle();
    if (error) {
      handleSupabaseError('checking contacted user', error);
      return waMemory.contactedUsers.some(u => u.campaignId === campaignId && u.phoneNumber === phoneNumber);
    }
    return !!data;
  } catch (err: any) {
    handleSupabaseError('checking contacted user', err);
    return waMemory.contactedUsers.some(u => u.campaignId === campaignId && u.phoneNumber === phoneNumber);
  }
}

export async function markAsContacted(entry: WaContactedUser): Promise<void> {
  const supabase = getSupabase();
  waMemory.contactedUsers.push(entry);

  if (supabase) {
    try {
      const { error } = await supabase.from('wa_contacted_users').insert({
        id: entry.id,
        campaign_id: entry.campaignId,
        phone_number: entry.phoneNumber,
        contact_name: entry.contactName,
        sent_at: entry.sentAt,
        status: entry.status,
      });
      if (error) {
        handleSupabaseError('marking contacted user', error);
      }
    } catch (err: any) {
      handleSupabaseError('marking contacted user', err);
    }
  }
}

export async function getContactedUsers(campaignId: string, limit = 50): Promise<WaContactedUser[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return waMemory.contactedUsers.filter(u => u.campaignId === campaignId).slice(-limit);
  }
  try {
    const { data, error } = await supabase
      .from('wa_contacted_users')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: false })
      .limit(limit);
    if (error) {
      handleSupabaseError('fetching contacted users', error);
      return waMemory.contactedUsers.filter(u => u.campaignId === campaignId).slice(-limit);
    }
    return (data || []).map(rowToContactedUser);
  } catch (err: any) {
    handleSupabaseError('fetching contacted users', err);
    return waMemory.contactedUsers.filter(u => u.campaignId === campaignId).slice(-limit);
  }
}

export async function getUniqueContactedCount(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) {
    const uniquePhones = new Set(waMemory.contactedUsers.map(u => u.phoneNumber));
    return uniquePhones.size;
  }
  try {
    const { count, error } = await supabase
      .from('wa_contacted_users')
      .select('*', { count: 'exact', head: true });
    if (error) {
      handleSupabaseError('counting unique users', error);
      const uniquePhones = new Set(waMemory.contactedUsers.map(u => u.phoneNumber));
      return uniquePhones.size;
    }
    return count || 0;
  } catch (err: any) {
    handleSupabaseError('counting unique users', err);
    const uniquePhones = new Set(waMemory.contactedUsers.map(u => u.phoneNumber));
    return uniquePhones.size;
  }
}

// =============================================
// MESSAGE LOGS
// =============================================
export async function addMessageLog(log: WaMessageLog): Promise<void> {
  const supabase = getSupabase();
  waMemory.messageLogs.push(log);

  if (supabase) {
    let cleanUrl = log.fileUrl || '';
    if (cleanUrl.startsWith('data:audio')) cleanUrl = 'voice_note.mp3';
    else if (cleanUrl.startsWith('data:image')) cleanUrl = 'photo.jpg';
    else if (cleanUrl.startsWith('data:video')) cleanUrl = 'video.mp4';
    else if (cleanUrl.startsWith('data:')) cleanUrl = 'media.bin';

    try {
      const { error } = await supabase.from('wa_message_logs').insert({
        id: log.id,
        campaign_id: log.campaignId,
        phone_number: log.phoneNumber,
        contact_name: log.contactName,
        message_type: log.messageType,
        file_url: cleanUrl,
        status: log.status,
        error_message: log.errorMessage,
        sent_at: log.sentAt,
      });
      if (error) {
        handleSupabaseError('adding message log', error);
      }
    } catch (err: any) {
      handleSupabaseError('adding message log', err);
    }
  }
}

export async function getMessageLogs(campaignId?: string, limit = 100): Promise<WaMessageLog[]> {
  const supabase = getSupabase();
  if (!supabase) {
    let logs = waMemory.messageLogs;
    if (campaignId) logs = logs.filter(l => l.campaignId === campaignId);
    return logs.slice(-limit);
  }

  try {
    let query = supabase.from('wa_message_logs').select('*').order('sent_at', { ascending: false }).limit(limit);
    if (campaignId) query = query.eq('campaign_id', campaignId);

    const { data, error } = await query;
    if (error) {
      handleSupabaseError('fetching message logs', error);
      let logs = waMemory.messageLogs;
      if (campaignId) logs = logs.filter(l => l.campaignId === campaignId);
      return logs.slice(-limit);
    }
    return (data || []).map(rowToMessageLog);
  } catch (err: any) {
    handleSupabaseError('fetching message logs', err);
    let logs = waMemory.messageLogs;
    if (campaignId) logs = logs.filter(l => l.campaignId === campaignId);
    return logs.slice(-limit);
  }
}

// =============================================
// CONNECTION STATE & QR GENERATOR
// =============================================
let connectionsCache: WaConnection[] | null = null;
let connectionsCacheTime = 0;
const CONNECTIONS_CACHE_TTL = 5000;

export async function generateAccountQrCode(accountId: string, accountName?: string): Promise<string> {
  const seedStr = `${accountId}:${accountName || 'JalaBot'}:${Math.floor(Date.now() / 20000)}`;
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const size = 29;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
          reserved[rr][cc] = true;
          const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
          const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[rr][cc] = inOuter || inInner;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment pattern at bottom-right (20, 20)
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = 22 + r;
      const cc = 22 + c;
      reserved[rr][cc] = true;
      grid[rr][cc] = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    grid[6][i] = i % 2 === 0;
    reserved[i][6] = true;
    grid[i][6] = i % 2 === 0;
  }

  // Deterministic pseudo-random fill for data modules
  let state = hash >>> 0 || 123456789;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        grid[r][c] = ((state >>> 0) + r * 31 + c * 17) % 100 < 48;
      }
    }
  }

  const cell = 10;
  const margin = 20;
  const total = size * cell + margin * 2;
  let paths = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        const x = margin + c * cell;
        const y = margin + r * cell;
        paths += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="1.5"/>`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="330" height="330" shape-rendering="geometricPrecision"><rect width="100%" height="100%" fill="#FFFFFF"/><g fill="#064E3B">${paths}</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export async function getAllWaConnections(): Promise<WaConnection[]> {
  const now = Date.now();
  if (connectionsCache && now - connectionsCacheTime < CONNECTIONS_CACHE_TTL) {
    return connectionsCache.filter((c) => !waMemory.deletedConnectionIds.has(c.id));
  }

  const supabase = getSupabase();
  if (!supabase) {
    const memList = (waMemory.connections || []).filter(
      (c) => !waMemory.deletedConnectionIds.has(c.id)
    );
    return memList;
  }

  try {
    const { data, error } = await supabase
      .from('wa_connection')
      .select('id, phone_number, status, qr_code, last_connected, created_at')
      .not('id', 'like', 'auth_%')
      .not('id', 'like', 'file_%')
      .not('id', 'like', 'test_%')
      .order('created_at', { ascending: true });

    if (error) {
      handleSupabaseError('fetching wa_connection', error);
      return (waMemory.connections || []).filter((c) => !waMemory.deletedConnectionIds.has(c.id));
    }

    const dbList = (data || [])
      .filter(
        (r: any) =>
          !r.id.startsWith('auth_') &&
          !r.id.startsWith('test_') &&
          !r.id.startsWith('file_') &&
          !waMemory.deletedConnectionIds.has(r.id)
      )
      .map(rowToConnection);

    // Merge with any in-memory connections that haven't been deleted
    const mergedMap = new Map<string, WaConnection>();
    for (const item of dbList) {
      mergedMap.set(item.id, item);
    }
    for (const memItem of waMemory.connections || []) {
      if (!waMemory.deletedConnectionIds.has(memItem.id)) {
        const existing = mergedMap.get(memItem.id);
        if (!existing) {
          mergedMap.set(memItem.id, memItem);
        } else if (memItem.qrCode && !existing.qrCode) {
          mergedMap.set(memItem.id, { ...existing, qrCode: memItem.qrCode, status: memItem.status });
        }
      }
    }

    const result = Array.from(mergedMap.values());
    connectionsCache = result;
    connectionsCacheTime = now;
    return result;
  } catch (err: any) {
    handleSupabaseError('fetching wa_connection', err);
    return (waMemory.connections || []).filter((c) => !waMemory.deletedConnectionIds.has(c.id));
  }
}

export async function getWaConnection(id = 'main'): Promise<WaConnection | null> {
  if (
    id.startsWith('auth_') ||
    id.startsWith('file_') ||
    id.startsWith('test_') ||
    waMemory.deletedConnectionIds.has(id)
  ) {
    return null;
  }

  const memFound = waMemory.connections?.find((c) => c.id === id);
  const supabase = getSupabase();
  if (!supabase) {
    return memFound || null;
  }

  try {
    const { data, error } = await supabase
      .from('wa_connection')
      .select('id, phone_number, status, qr_code, last_connected, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      if (error) handleSupabaseError('fetching wa_connection', error);
      return memFound || null;
    }
    const parsed = rowToConnection(data);
    if (memFound?.qrCode && !parsed.qrCode) {
      parsed.qrCode = memFound.qrCode;
      parsed.status = memFound.status;
    }
    return parsed;
  } catch (err: any) {
    handleSupabaseError('fetching wa_connection', err);
    return memFound || null;
  }
}

export async function updateWaConnection(updates: Partial<WaConnection> & { id?: string }): Promise<WaConnection> {
  connectionsCache = null;
  connectionsCacheTime = 0;
  const targetId = updates.id || 'main';
  waMemory.deletedConnectionIds.delete(targetId);

  const supabase = getSupabase();

  let updatedMemObj: WaConnection | null = null;
  if (waMemory.connections) {
    const idx = waMemory.connections.findIndex((c) => c.id === targetId);
    if (idx !== -1) {
      waMemory.connections[idx] = { ...waMemory.connections[idx], ...updates };
      updatedMemObj = waMemory.connections[idx];
    } else {
      updatedMemObj = {
        id: targetId,
        name: updates.name || (targetId === 'main' ? 'Primary WhatsApp' : `SIM ${targetId.slice(-4)}`),
        phoneNumber: updates.phoneNumber || '',
        status: updates.status || 'qr_pending',
        qrCode: updates.qrCode || '',
        lastConnected: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        clientId: updates.clientId || 'admin',
      };
      waMemory.connections.push(updatedMemObj);
    }
  }
  if (targetId === 'main' && updatedMemObj) {
    waMemory.connection = updatedMemObj;
  }

  if (!supabase) {
    return updatedMemObj as WaConnection;
  }

  // Retrieve existing to preserve phone, name, and clientId if not provided
  const existing = await getWaConnection(targetId);

  const finalName =
    updates.name !== undefined
      ? updates.name
      : existing?.name || updatedMemObj?.name || (targetId === 'main' ? 'Primary WhatsApp' : `SIM ${targetId.slice(-4)}`);
  const finalPhone =
    updates.phoneNumber !== undefined && updates.phoneNumber !== ''
      ? updates.phoneNumber
      : existing?.phoneNumber || updatedMemObj?.phoneNumber || '';
  const finalClientId =
    updates.clientId !== undefined ? updates.clientId : existing?.clientId || updatedMemObj?.clientId || 'admin';
  const cliPrefix = finalClientId && finalClientId !== 'admin' ? `[cli:${finalClientId}]` : '';

  const row: any = {
    id: targetId,
    phone_number: `${cliPrefix}${finalName}|${finalPhone}`,
  };

  if (updates.status !== undefined) row.status = updates.status;
  else if (existing?.status !== undefined) row.status = existing.status;

  if (updates.qrCode !== undefined) row.qr_code = updates.qrCode;
  else if (existing?.qrCode !== undefined) row.qr_code = existing.qrCode;

  if (updates.lastConnected !== undefined) row.last_connected = updates.lastConnected;
  else if (existing?.lastConnected !== undefined) row.last_connected = existing.lastConnected;

  try {
    const { data, error } = await supabase
      .from('wa_connection')
      .upsert(row)
      .select()
      .maybeSingle();

    if (error) {
      handleSupabaseError('updating wa_connection', error);
      return updatedMemObj || ({ ...(existing || {}), ...updates, id: targetId, clientId: finalClientId } as WaConnection);
    }
    return data
      ? rowToConnection(data)
      : updatedMemObj || ({ ...(existing || {}), ...updates, id: targetId, clientId: finalClientId } as WaConnection);
  } catch (err: any) {
    handleSupabaseError('updating wa_connection', err);
    return updatedMemObj || ({ ...(existing || {}), ...updates, id: targetId, clientId: finalClientId } as WaConnection);
  }
}

export async function deleteWaConnection(id: string): Promise<boolean> {
  connectionsCache = null;
  connectionsCacheTime = 0;
  waMemory.deletedConnectionIds.add(id);

  if (id === 'main') {
    waMemory.connection = null;
  }
  if (waMemory.connections) {
    waMemory.connections = waMemory.connections.filter((c) => c.id !== id);
  }

  const supabase = getSupabase();
  if (!supabase) return true;

  try {
    await supabase.from('wa_connection').delete().in('id', [id, `auth_${id}`]);
    await supabase.from('wa_connection').delete().like('id', `auth_${id}%`);

    // Reset any campaign assigned to this account back to 'all'
    const campaigns = await getAllCampaigns();
    for (const c of campaigns) {
      if (c.accountId === id) {
        await updateCampaign(c.id, { accountId: 'all' });
      }
    }
    return true;
  } catch (err: any) {
    handleSupabaseError('deleting wa_connection', err);
    return true;
  }
}

// =============================================
// DASHBOARD STATS
// =============================================
let lastCleanupTime = 0;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export async function getWaDashboardStats(clientId?: string): Promise<WaDashboardStats> {
  // Trigger rolling 30-day cleanup check at most once every 6 hours non-blocking
  const now = Date.now();
  if (now - lastCleanupTime > SIX_HOURS_MS) {
    lastCleanupTime = now;
    performRolling30DayCleanup(30).catch(() => {});
  }

  let campaigns = await getAllCampaigns();
  if (clientId && clientId !== 'admin') {
    campaigns = campaigns.filter(c => c.clientId === clientId);
  }
  const connection = await getWaConnection();
  const uniqueUsers = await getUniqueContactedCount();

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.isActive).length,
    totalSent: campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0),
    uniqueUsers,
    connectionStatus: connection?.status || 'disconnected',
  };
}

// =============================================
// ROLLING 30-DAY CLEANUP
// Preserves exactly 30 days of data across website WhatsApp tables.
// Day 31 -> Day 1 data deleted, Day 31 added.
// Day 32 -> Day 2 data deleted, Day 32 added.
// =============================================
export async function performRolling30DayCleanup(days = 30): Promise<{ deletedLogs: number; deletedContacted: number }> {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let deletedLogs = 0;
  let deletedContacted = 0;

  // 1. In-memory cleanup
  const prevLogsCount = waMemory.messageLogs.length;
  waMemory.messageLogs = waMemory.messageLogs.filter((l) => l.sentAt >= cutoffDate);
  deletedLogs += prevLogsCount - waMemory.messageLogs.length;

  const prevContactedCount = waMemory.contactedUsers.length;
  waMemory.contactedUsers = waMemory.contactedUsers.filter((u) => u.sentAt >= cutoffDate);
  deletedContacted += prevContactedCount - waMemory.contactedUsers.length;

  // 2. Database (Supabase) cleanup
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error: logErr } = await supabase
        .from('wa_message_logs')
        .delete()
        .lt('sent_at', cutoffDate);
      if (logErr) handleSupabaseError('cleaning rolling wa_message_logs', logErr);

      const { error: userErr } = await supabase
        .from('wa_contacted_users')
        .delete()
        .lt('sent_at', cutoffDate);
      if (userErr) handleSupabaseError('cleaning rolling wa_contacted_users', userErr);
    } catch (e: any) {
      handleSupabaseError('in performRolling30DayCleanup', e);
    }
  }

  return { deletedLogs, deletedContacted };
}

// =============================================
// MULTI-CLIENT PROFILES, QUOTAS & EXPIRY ENGINE
// Stored in wa_campaigns row id = 'system_clients'
// =============================================
const SYSTEM_CLIENTS_ROW_ID = 'system_clients';
let clientsCache: WaClientProfile[] | null = null;
let clientsCacheTime = 0;
const CLIENTS_CACHE_TTL_MS = 15000;

export function invalidateClientsCache() {
  clientsCache = null;
  clientsCacheTime = 0;
}

export function isClientExpired(client: WaClientProfile): boolean {
  if (!client.isActive) return true;
  if (!client.expiresAt) return false;
  const expMs = new Date(client.expiresAt).getTime();
  if (isNaN(expMs)) return false;
  return Date.now() >= expMs;
}

export function getClientRemainingDays(client: WaClientProfile): number | null {
  if (!client.expiresAt) return null;
  const expMs = new Date(client.expiresAt).getTime();
  if (isNaN(expMs)) return null;
  const diffMs = expMs - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function generateRandomPassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function getAllClients(forceRefresh = false): Promise<WaClientProfile[]> {
  const now = Date.now();
  if (!forceRefresh && clientsCache && (now - clientsCacheTime < CLIENTS_CACHE_TTL_MS)) {
    return clientsCache;
  }
  const supabase = getSupabase();
  if (!supabase) return waMemory.clients;

  try {
    const { data, error } = await supabase
      .from('wa_campaigns')
      .select('description')
      .eq('id', SYSTEM_CLIENTS_ROW_ID)
      .maybeSingle();

    if (error || !data || !data.description) {
      if (error) handleSupabaseError('fetching system_clients', error);
      clientsCache = waMemory.clients;
      clientsCacheTime = now;
      return waMemory.clients;
    }

    let raw = data.description.trim();
    if (!raw.startsWith('[')) {
      raw = Buffer.from(raw, 'base64').toString('utf-8');
    }
    const parsed = JSON.parse(raw);
    const list: WaClientProfile[] = Array.isArray(parsed) ? parsed : [];
    waMemory.clients = list;
    clientsCache = list;
    clientsCacheTime = now;

    // Non-blocking enforcement of expired client campaigns
    enforceClientExpirations(list).catch(() => {});

    return list;
  } catch (e: any) {
    handleSupabaseError('parsing system_clients', e);
    return clientsCache || waMemory.clients;
  }
}

export async function saveAllClients(clients: WaClientProfile[]): Promise<boolean> {
  invalidateClientsCache();
  waMemory.clients = clients;
  clientsCache = clients;
  clientsCacheTime = Date.now();

  const supabase = getSupabase();
  if (!supabase) return true;

  try {
    const encoded = Buffer.from(JSON.stringify(clients), 'base64').toString('utf-8')
      ? Buffer.from(JSON.stringify(clients)).toString('base64')
      : JSON.stringify(clients);

    const row = {
      id: SYSTEM_CLIENTS_ROW_ID,
      name: '__SYSTEM_CLIENTS__',
      description: encoded,
      keywords: '',
      is_default: false,
      welcome_message: '',
      image_url: '',
      audio_url: '',
      video_url: '',
      document_url: '',
      document_name: '',
      send_order: 'message',
      delay_between_sends: 1,
      is_active: false,
      chat_reply_enabled: false,
      total_sent: 0,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('wa_campaigns').upsert(row);
    if (error) {
      handleSupabaseError('saving system_clients', error);
      return false;
    }
    return true;
  } catch (e: any) {
    handleSupabaseError('saving system_clients', e);
    return false;
  }
}

export async function getClientById(id: string): Promise<WaClientProfile | null> {
  const clients = await getAllClients();
  return clients.find((c) => c.id === id) || null;
}

export async function getClientByPassword(password: string): Promise<WaClientProfile | null> {
  if (!password) return null;
  const clients = await getAllClients(true);
  return clients.find((c) => c.password === password.trim()) || null;
}

export async function createClientProfile(input: {
  name: string;
  password?: string;
  maxWhatsappNumbers?: number;
  maxCampaigns?: number;
  durationDays?: number;
  notes?: string;
}): Promise<WaClientProfile> {
  const clients = await getAllClients(true);
  const nowIso = new Date().toISOString();
  const durationDays = input.durationDays !== undefined ? Number(input.durationDays) : 30;
  const expiresAt = durationDays > 0
    ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  let pwd = (input.password || '').trim() || generateRandomPassword(8);
  while (clients.some((c) => c.password === pwd)) {
    pwd = generateRandomPassword(8);
  }

  const newClient: WaClientProfile = {
    id: `cli_${Math.random().toString(36).substring(2, 8)}${Date.now().toString(36).slice(-3)}`,
    name: input.name.trim(),
    password: pwd,
    maxWhatsappNumbers: Math.max(1, Number(input.maxWhatsappNumbers ?? 1)),
    maxCampaigns: Math.max(1, Number(input.maxCampaigns ?? 3)),
    durationDays,
    expiresAt,
    isActive: true,
    notes: input.notes || '',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  clients.push(newClient);
  await saveAllClients(clients);
  return newClient;
}

export async function updateClientProfile(
  id: string,
  updates: Partial<WaClientProfile> & { resetDays?: number }
): Promise<WaClientProfile | null> {
  const clients = await getAllClients(true);
  const idx = clients.findIndex((c) => c.id === id);
  if (idx === -1) return null;

  const existing = clients[idx];
  const merged: WaClientProfile = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // If admin resets or updates durationDays via resetDays
  if (updates.resetDays !== undefined) {
    const days = Number(updates.resetDays);
    merged.durationDays = days;
    if (days > 0) {
      merged.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      merged.isActive = true;
    } else if (days === 0) {
      merged.expiresAt = new Date(Date.now() - 1000).toISOString(); // Immediately expired
    }
  }

  clients[idx] = merged;
  await saveAllClients(clients);

  // Enforce expiration immediately if expired or disabled
  if (isClientExpired(merged)) {
    await enforceClientExpirations(clients);
  }

  return merged;
}

export async function deleteClientProfile(id: string): Promise<boolean> {
  const clients = await getAllClients(true);
  const filtered = clients.filter((c) => c.id !== id);
  if (filtered.length === clients.length) return false;
  await saveAllClients(filtered);
  return true;
}

export async function enforceClientExpirations(clientsList?: WaClientProfile[]): Promise<void> {
  try {
    const clients = clientsList || (await getAllClients());
    const expiredClientIds = new Set(
      clients.filter((c) => isClientExpired(c)).map((c) => c.id)
    );
    if (expiredClientIds.size === 0) return;

    const campaigns = await getAllCampaigns();
    for (const camp of campaigns) {
      if (camp.isActive && camp.clientId && expiredClientIds.has(camp.clientId)) {
        console.log(`[ClientExpiry] Auto-disabling campaign "${camp.name}" (${camp.id}) for expired client ${camp.clientId}`);
        await updateCampaign(camp.id, { isActive: false });
      }
    }
  } catch (e: any) {
    console.error('Error enforcing client expirations:', e.message);
  }
}

