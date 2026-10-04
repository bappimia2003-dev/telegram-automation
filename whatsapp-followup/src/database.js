import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../database/data.db');

// Ensure database folder exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT '',
      gender TEXT DEFAULT 'apni',
      product TEXT DEFAULT 'general',
      status TEXT DEFAULT 'new',
      promise_date TEXT DEFAULT NULL,
      follow_up_step INTEGER DEFAULT 0,
      last_sent_at TEXT DEFAULT NULL,
      next_scheduled_at TEXT DEFAULT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS message_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      sender TEXT,
      message_text TEXT,
      media_type TEXT DEFAULT 'text',
      media_file TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_vault (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      media_type TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      gemini_summary TEXT DEFAULT '',
      used_count INTEGER DEFAULT 0,
      last_used_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      media_used TEXT,
      sent_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT,
      status TEXT DEFAULT 'stopped',
      config TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Populate default settings if not exists
  const defaultSettings = [
    { key: 'auto_followup', value: '1' },
    { key: 'offer_campaign', value: '0' },
    { key: 'ai_brain', value: '1' },
    { key: 'antiban', value: '1' },
    { key: 'auto_cleanup', value: '1' },
    { key: 'gender_detection', value: '1' },
    { key: 'working_hours_start', value: '09:00' },
    { key: 'working_hours_end', value: '22:00' },
    { key: 'max_daily_messages', value: '30' },
    { key: 'rolling_days', value: '30' },
    { key: 'total_duration_days', value: '30' },
    { key: 'started_date', value: new Date().toISOString().split('T')[0] },
  ];

  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  const insertMany = db.transaction((settings) => {
    for (const s of settings) insertSetting.run(s.key, s.value);
  });
  insertMany(defaultSettings);

  // Scan media files on init
  scanLocalMediaVault();
}

// Settings methods
export function getSetting(key, defaultValue = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of rows) {
    obj[r.key] = r.value === '1' ? true : r.value === '0' ? false : r.value;
  }
  return obj;
}

// Leads methods
export function getLeadByPhone(phone) {
  return db.prepare('SELECT * FROM leads WHERE phone = ?').get(phone);
}

export function createOrUpdateLead({ phone, name = '', gender = 'apni', product = 'general' }) {
  const existing = getLeadByPhone(phone);
  if (!existing) {
    const res = db.prepare(`
      INSERT INTO leads (phone, name, gender, product, status, follow_up_step, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'new', 0, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `).run(phone, name, gender, product);
    return getLeadByPhone(phone);
  } else {
    // If name wasn't set earlier, update it
    if (!existing.name && name) {
      db.prepare(`UPDATE leads SET name = ?, updated_at = datetime('now', 'localtime') WHERE phone = ?`).run(name, phone);
    }
    return existing;
  }
}

export function updateLeadStatus(phone, status, notes = '') {
  db.prepare(`
    UPDATE leads 
    SET status = ?, notes = CASE WHEN ? != '' THEN ? ELSE notes END, updated_at = datetime('now', 'localtime')
    WHERE phone = ?
  `).run(status, notes, notes, phone);
}

export function updateLeadPromiseDate(phone, promiseDate, notes = '') {
  db.prepare(`
    UPDATE leads 
    SET promise_date = ?, status = 'promised', notes = CASE WHEN ? != '' THEN ? ELSE notes END, updated_at = datetime('now', 'localtime')
    WHERE phone = ?
  `).run(promiseDate, notes, notes, phone);
}

export function updateLeadFollowUp(phone, step, nextScheduledAt) {
  db.prepare(`
    UPDATE leads 
    SET follow_up_step = ?, 
        last_sent_at = datetime('now', 'localtime'), 
        next_scheduled_at = ?,
        status = 'in_followup',
        updated_at = datetime('now', 'localtime')
    WHERE phone = ?
  `).run(step, nextScheduledAt, phone);
}

export function logMessage(leadId, sender, messageText, mediaType = 'text', mediaFile = null) {
  db.prepare(`
    INSERT INTO message_history (lead_id, sender, message_text, media_type, media_file, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `).run(leadId, sender, messageText, mediaType, mediaFile);
}

export function getPendingFollowups() {
  return db.prepare(`
    SELECT * FROM leads 
    WHERE status IN ('new', 'in_followup')
      AND next_scheduled_at IS NOT NULL
      AND datetime('now', 'localtime') >= datetime(next_scheduled_at)
    ORDER BY next_scheduled_at ASC
    LIMIT 10
  `).all();
}

export function getPromisedFollowups() {
  const today = new Date().toISOString().split('T')[0];
  return db.prepare(`
    SELECT * FROM leads 
    WHERE status = 'promised'
      AND promise_date <= ?
    ORDER BY promise_date ASC
    LIMIT 10
  `).all(today);
}

export function getAllLeads(statusFilter = '') {
  if (statusFilter && statusFilter !== 'all') {
    return db.prepare('SELECT * FROM leads WHERE status = ? ORDER BY updated_at DESC').all(statusFilter);
  }
  return db.prepare('SELECT * FROM leads ORDER BY updated_at DESC').all();
}

// Media Vault methods
export function scanLocalMediaVault() {
  const baseDir = path.resolve(__dirname, '../media');
  const types = [
    { folder: 'audio', type: 'audio' },
    { folder: 'images', type: 'image' },
    { folder: 'texts', type: 'text' },
  ];

  for (const { folder, type } of types) {
    const dir = path.join(baseDir, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const existing = db.prepare('SELECT id FROM media_vault WHERE filename = ?').get(file);
        if (!existing) {
          db.prepare(`
            INSERT INTO media_vault (filename, filepath, media_type, category)
            VALUES (?, ?, ?, 'general')
          `).run(file, fullPath, type);
        }
      }
    }
  }
}

export function getMediaVault(type = null) {
  if (type) {
    return db.prepare('SELECT * FROM media_vault WHERE media_type = ? ORDER BY used_count ASC').all(type);
  }
  return db.prepare('SELECT * FROM media_vault ORDER BY used_count ASC').all();
}

export function recordMediaUsage(id) {
  db.prepare(`
    UPDATE media_vault 
    SET used_count = used_count + 1, last_used_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(id);
}

// Campaign methods
export function getCampaignEligibleLeads(campaignId, limit = 5) {
  return db.prepare(`
    SELECT * FROM leads 
    WHERE status NOT IN ('manual_takeover', 'closed', 'archived')
      AND phone NOT IN (SELECT phone FROM campaign_logs WHERE campaign_id = ?)
      AND (last_sent_at IS NULL OR datetime(last_sent_at) < datetime('now', 'localtime', '-24 hours'))
    ORDER BY RANDOM()
    LIMIT ?
  `).all(campaignId, limit);
}

export function logCampaignSent(campaignId, phone, mediaUsed) {
  db.prepare(`
    INSERT INTO campaign_logs (campaign_id, phone, media_used, sent_at)
    VALUES (?, ?, ?, datetime('now', 'localtime'))
  `).run(campaignId, phone, mediaUsed);
}

// Statistics methods
export function getStats() {
  const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
  const activeLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status IN ('new', 'in_followup', 'promised')").get().count;
  const manualTakeover = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'manual_takeover'").get().count;
  const closedLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'closed'").get().count;
  const archivedLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'archived'").get().count;
  
  const todaySent = db.prepare(`
    SELECT COUNT(*) as count FROM message_history 
    WHERE sender = 'bot' AND date(created_at) = date('now', 'localtime')
  `).get().count;

  const todayReplies = db.prepare(`
    SELECT COUNT(*) as count FROM message_history 
    WHERE sender = 'customer' AND date(created_at) = date('now', 'localtime')
  `).get().count;

  return {
    totalLeads,
    activeLeads,
    manualTakeover,
    closedLeads,
    archivedLeads,
    todaySent,
    todayReplies,
  };
}

// Rolling 30-Day Cleanup Worker
export function performRollingCleanup(days = 30) {
  const windowDays = `-${Number(days)} days`;
  
  // 1. Delete all message_history older than 30 days (rolling window)
  const res1 = db.prepare(`
    DELETE FROM message_history 
    WHERE created_at < datetime('now', 'localtime', ?)
  `).run(windowDays);

  // 2. Delete campaign logs older than 30 days
  const res2 = db.prepare(`
    DELETE FROM campaign_logs 
    WHERE sent_at < datetime('now', 'localtime', ?)
  `).run(windowDays);

  // 3. Delete completed/closed/archived leads older than 30 days
  const res3 = db.prepare(`
    DELETE FROM leads 
    WHERE updated_at < datetime('now', 'localtime', ?)
      AND status IN ('archived', 'closed')
  `).run(windowDays);

  return {
    deletedMessages: res1.changes,
    deletedCampaignLogs: res2.changes,
    deletedArchivedLeads: res3.changes,
  };
}
