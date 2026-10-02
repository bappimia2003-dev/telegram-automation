-- =======================================================
-- WhatsApp Automation System - Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- =======================================================

-- 1. WhatsApp Campaigns Table
CREATE TABLE IF NOT EXISTS wa_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',

  -- Keyword matching (Facebook Ads quick reply buttons)
  keywords TEXT DEFAULT '',
  is_default BOOLEAN DEFAULT false,

  -- Auto-send media files
  welcome_message TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  audio_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  document_url TEXT DEFAULT '',
  document_name TEXT DEFAULT '',

  -- Send order & delay
  send_order TEXT DEFAULT 'message,image,video,audio,document',
  delay_between_sends INTEGER DEFAULT 3,

  -- Controls
  is_active BOOLEAN DEFAULT false,
  chat_reply_enabled BOOLEAN DEFAULT false,

  -- Stats
  total_sent INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Contacted Users (one-time tracking per campaign per user)
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

-- 3. Message Logs (detailed send history)
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

-- Insert default connection record
INSERT INTO wa_connection (id, status) VALUES ('main', 'disconnected')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE wa_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_contacted_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_connection ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Allow full access to wa_campaigns" ON wa_campaigns;
DROP POLICY IF EXISTS "Allow full access to wa_contacted_users" ON wa_contacted_users;
DROP POLICY IF EXISTS "Allow full access to wa_message_logs" ON wa_message_logs;
DROP POLICY IF EXISTS "Allow full access to wa_connection" ON wa_connection;

-- Create policies
CREATE POLICY "Allow full access to wa_campaigns" ON wa_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to wa_contacted_users" ON wa_contacted_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to wa_message_logs" ON wa_message_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to wa_connection" ON wa_connection FOR ALL USING (true) WITH CHECK (true);
