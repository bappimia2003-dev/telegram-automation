import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  '';

let client: SupabaseClient | null = null;
let isUnreachable = false;
let lastUnreachableCheck = 0;
const UNREACHABLE_COOLDOWN_MS = 60000; // 1 minute cooldown

export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseKey) {
    return false;
  }

  const lowerUrl = supabaseUrl.toLowerCase().trim();
  const lowerKey = supabaseKey.toLowerCase().trim();

  // Validate placeholder or example values
  if (
    lowerUrl.includes('your-project') ||
    lowerUrl.includes('example.com') ||
    lowerUrl.includes('placeholder') ||
    lowerKey.includes('your-supabase') ||
    lowerKey.includes('placeholder')
  ) {
    return false;
  }

  // Ensure URL is well-formed
  try {
    const parsed = new URL(supabaseUrl);
    if (!parsed.protocol.startsWith('http') || !parsed.hostname || parsed.hostname === 'your-project.supabase.co') {
      return false;
    }
  } catch {
    return false;
  }

  // Circuit breaker: cooldown if network/DNS failure was recently detected
  if (isUnreachable && Date.now() - lastUnreachableCheck < UNREACHABLE_COOLDOWN_MS) {
    return false;
  }

  return true;
}

export function markSupabaseUnreachable(): void {
  isUnreachable = true;
  lastUnreachableCheck = Date.now();
}

export function handleSupabaseError(context: string, error: any): void {
  const msg = error?.message || String(error || '');
  if (
    msg.includes('fetch failed') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('network') ||
    msg.includes('Failed to fetch')
  ) {
    markSupabaseUnreachable();
    // Log informative warning instead of crashing or spamming errors
    console.warn(`[Database] Supabase network unreachable during ${context} (${msg}). Operating in local in-memory store mode.`);
  } else {
    console.error(`Error in ${context}:`, msg);
  }
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return client;
}
