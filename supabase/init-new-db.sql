-- =======================================================
-- Telegram & WhatsApp Automation Complete Database Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ofihngjzmjtdcafudfbw/sql/new
-- =======================================================

-- 1. WhatsApp Campaigns Table
CREATE TABLE IF NOT EXISTS wa_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  keywords TEXT DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  welcome_message TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  audio_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  document_url TEXT DEFAULT '',
  document_name TEXT DEFAULT '',
  send_order TEXT DEFAULT 'message,image,video,audio,document',
  delay_between_sends INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT false,
  chat_reply_enabled BOOLEAN DEFAULT false,
  total_sent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Contacted Users
CREATE TABLE IF NOT EXISTS wa_contacted_users (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES wa_campaigns(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent',
  UNIQUE(campaign_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_wa_contacted_campaign ON wa_contacted_users(campaign_id);
CREATE INDEX IF NOT EXISTS idx_wa_contacted_phone ON wa_contacted_users(phone_number);

-- 3. Message Logs
CREATE TABLE IF NOT EXISTS wa_message_logs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES wa_campaigns(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  message_type TEXT NOT NULL,
  file_url TEXT DEFAULT '',
  status TEXT DEFAULT 'sent',
  error_message TEXT DEFAULT '',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_logs_campaign ON wa_message_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_wa_logs_sent ON wa_message_logs(sent_at DESC);

-- 4. Connection State
CREATE TABLE IF NOT EXISTS wa_connection (
  id TEXT PRIMARY KEY DEFAULT 'main',
  phone_number TEXT DEFAULT '',
  status TEXT DEFAULT 'disconnected',
  qr_code TEXT DEFAULT '',
  last_connected TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Telegram Bots Table
CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  telegram_token TEXT NOT NULL,
  chat_id TEXT,
  ai_personality TEXT NOT NULL DEFAULT '',
  ai_details TEXT DEFAULT '',
  response_style TEXT DEFAULT 'friendly',
  max_tokens INTEGER DEFAULT 500,
  api_key_id TEXT,
  current_model TEXT DEFAULT 'gemini-2.0-flash',
  is_active BOOLEAN DEFAULT false,
  webhook_url TEXT DEFAULT '',
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Telegram API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  gmail TEXT NOT NULL,
  label TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  requests_today INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  last_reset TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  sender_name TEXT DEFAULT '',
  sender_id BIGINT DEFAULT 0,
  text TEXT NOT NULL,
  ai_model TEXT DEFAULT '',
  api_key_id TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_bot_id ON chat_messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bots_is_active ON bots(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);

-- Enable RLS
ALTER TABLE wa_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_contacted_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies allowing full access
CREATE POLICY "Allow full access to wa_campaigns" ON wa_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to wa_contacted_users" ON wa_contacted_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to wa_message_logs" ON wa_message_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to wa_connection" ON wa_connection FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to bots" ON bots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to api_keys" ON api_keys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to chat_messages" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
