-- =======================================================
-- Telegram Chat Automation System - Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- =======================================================

-- 1. Bots Table
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

-- 2. API Keys Table (Google AI Studio Gemini Keys)
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

-- 3. Chat Messages Table
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_bot_id ON chat_messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bots_is_active ON bots(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);

-- Enable Row Level Security (RLS)
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Allow full access to bots" ON bots;
DROP POLICY IF EXISTS "Allow full access to api_keys" ON api_keys;
DROP POLICY IF EXISTS "Allow full access to chat_messages" ON chat_messages;

-- Create policies allowing full access via service_role and anon (backend API routes)
CREATE POLICY "Allow full access to bots" ON bots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to api_keys" ON api_keys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to chat_messages" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
