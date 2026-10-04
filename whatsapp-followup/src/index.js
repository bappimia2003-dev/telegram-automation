import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';

import {
  initDatabase,
  getAllSettings,
  setSetting,
  getAllLeads,
  updateLeadStatus,
  getMediaVault,
  getStats,
  performRollingCleanup,
  db,
  scanLocalMediaVault,
} from './database.js';
import {
  initWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp,
} from './whatsapp.js';
import { initScheduler } from './scheduler.js';
import {
  startOfferCampaign,
  stopOfferCampaign,
  getActiveCampaignInfo,
} from './campaign.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & scan media
initDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3006;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend dashboard
const dashboardDir = path.resolve(__dirname, '../dashboard');
app.use(express.static(dashboardDir));

// Serve media files statically for preview
const mediaDir = path.resolve(__dirname, '../media');
app.use('/media', express.static(mediaDir));

// Multer storage for media upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'images';
    if (file.mimetype.startsWith('audio/')) folder = 'audio';
    else if (file.mimetype.startsWith('text/')) folder = 'texts';
    const dest = path.join(mediaDir, folder);
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${cleanName}_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// 1. Complete System Status
app.get('/api/status', (_req, res) => {
  res.json({
    whatsapp: getWhatsAppStatus(),
    settings: getAllSettings(),
    stats: getStats(),
    campaign: getActiveCampaignInfo(),
  });
});

// 2. WhatsApp Connect / Disconnect
app.post('/api/whatsapp/connect', async (_req, res) => {
  try {
    await initWhatsApp();
    res.json({ ok: true, whatsapp: getWhatsAppStatus() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/disconnect', async (_req, res) => {
  try {
    await disconnectWhatsApp();
    res.json({ ok: true, whatsapp: getWhatsAppStatus() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. Settings & Toggles
app.get('/api/settings', (_req, res) => {
  res.json({ ok: true, settings: getAllSettings() });
});

app.post('/api/settings/toggle', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ ok: false, error: 'Key is required' });
  setSetting(key, typeof value === 'boolean' ? (value ? '1' : '0') : value);
  res.json({ ok: true, settings: getAllSettings() });
});

// 4. Leads Management
app.get('/api/leads', (req, res) => {
  const filter = req.query.filter || 'all';
  const leads = getAllLeads(filter);
  res.json({ ok: true, leads });
});

app.post('/api/leads/status', (req, res) => {
  const { phone, status, notes } = req.body;
  if (!phone || !status) {
    return res.status(400).json({ ok: false, error: 'Phone and status required' });
  }
  updateLeadStatus(phone, status, notes || '');
  res.json({ ok: true });
});

// 5. Media Vault
app.get('/api/media', (_req, res) => {
  scanLocalMediaVault();
  const media = getMediaVault();
  res.json({ ok: true, media });
});

app.post('/api/media/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
    let mediaType = 'image';
    if (req.file.mimetype.startsWith('audio/')) mediaType = 'audio';
    else if (req.file.mimetype.startsWith('text/')) mediaType = 'text';

    const filename = req.file.filename;
    const filepath = req.file.path;
    const category = req.body.category || 'general';

    db.prepare(`
      INSERT INTO media_vault (filename, filepath, media_type, category)
      VALUES (?, ?, ?, ?)
    `).run(filename, filepath, mediaType, category);

    res.json({ ok: true, filename, filepath, mediaType });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/media/:id', (req, res) => {
  try {
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM media_vault WHERE id = ?').get(id);
    if (row && fs.existsSync(row.filepath)) {
      try {
        fs.unlinkSync(row.filepath);
      } catch (e) {
        // ignore
      }
    }
    db.prepare('DELETE FROM media_vault WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. Offer Campaign Controls
app.get('/api/campaign/status', (_req, res) => {
  res.json({ ok: true, campaign: getActiveCampaignInfo() });
});

app.post('/api/campaign/start', (req, res) => {
  try {
    const { name, selectedFiles, minDelay, maxDelay, minPeople, maxPeople, durationHours } = req.body;
    const camp = startOfferCampaign({
      name: name || 'Special Offer',
      selectedFiles: selectedFiles || [],
      minDelayMinutes: minDelay || 45,
      maxDelayMinutes: maxDelay || 90,
      minPeople: minPeople || 3,
      maxPeople: maxPeople || 5,
      durationHours: durationHours || 6,
    });
    res.json({ ok: true, campaign: camp });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/campaign/stop', (_req, res) => {
  const stopped = stopOfferCampaign();
  res.json({ ok: true, campaign: stopped });
});

// 7. Stats & Rolling Cleanup Trigger
app.get('/api/stats', (_req, res) => {
  res.json({ ok: true, stats: getStats() });
});

app.post('/api/cleanup', (req, res) => {
  const days = req.body.days || 30;
  const result = performRollingCleanup(days);
  res.json({ ok: true, result });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 WhatsApp Follow-up & Campaign Server is running!`);
  console.log(`👉 Web Dashboard: http://localhost:${PORT}`);
  console.log(`=======================================================`);

  // Start Background Schedulers
  initScheduler();

  // Initialize WhatsApp connection
  initWhatsApp().catch((err) => {
    console.error('[WhatsApp] Startup connection error:', err.message);
  });
});
