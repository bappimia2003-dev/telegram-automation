import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  startWhatsApp,
  disconnectWhatsApp,
  getConnectionInfo,
  getAllAccountsInfo,
  removeWhatsAppAccount,
  initAllAccounts,
  isSessionActive,
  updateAccountInfo,
} from './whatsapp.js';
import { getAllDbAccounts, saveMediaBackup, restoreMediaBackup } from './db.js';
import { log, errLog, getInMemoryLogs } from './utils.js';
import { startFollowupScheduler } from './followupScheduler.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3005;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Auto-restore uploaded media from Supabase Cloud DB if missing from container disk (survives redeploys)
app.get('/uploads/:filename', async (req, res, next) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);

  if (fs.existsSync(filePath)) {
    return next();
  }

  try {
    const restored = await restoreMediaBackup(filename);
    if (restored) {
      await fs.promises.writeFile(filePath, restored.buffer).catch(() => {});
      res.setHeader('Content-Type', restored.mimeType);
      return res.send(restored.buffer);
    }
  } catch (err: any) {
    errLog('MEDIA', `Failed restoring ${filename}:`, err.message);
  }

  next();
});

app.use('/uploads', express.static(uploadsDir));

// Dedicated file upload endpoint for WhatsApp media (audio, video, images, documents)
app.post('/upload', async (req, res) => {
  try {
    const { filename, base64, mimeType } = req.body;
    if (!filename || !base64) {
      return res.status(400).json({ ok: false, error: 'Missing filename or base64 data' });
    }
    const ext = path.extname(filename) || '.bin';
    const safeName = `wa-${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
    const filePath = path.join(uploadsDir, safeName);
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // 1. Write to container disk
    await fs.promises.writeFile(filePath, buffer);

    // 2. Persist permanently to Supabase Cloud DB so it survives redeploys
    saveMediaBackup(safeName, cleanBase64, mimeType || 'application/octet-stream').catch(() => {});

    const host = req.get('x-forwarded-host') || req.get('host');
    const proto = req.get('x-forwarded-proto') || 'https';
    const publicUrl = `${proto}://${host}/uploads/${safeName}`;

    log('UPLOAD', `Saved ${safeName} (${(cleanBase64.length * 0.75 / 1024).toFixed(1)} KB) -> ${publicUrl} (Cloud backed up)`);
    res.json({ ok: true, url: publicUrl, filename });
  } catch (err: any) {
    errLog('UPLOAD', 'Upload error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 1. Health check & version
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    version: '2.7.0',
    buildDate: '2026-10-04T06:30:00Z',
    features: ['random-ms-delay-3-4s', 'variation-rotation-ab', 'intelligent-multistep-followup', 'promise-date-scheduler', 'trigger-followup-on-reply-off', 'persistent-cloud-media'],
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get('/version', (_req, res) => {
  res.json({
    version: '2.7.0',
    buildDate: '2026-10-04T06:30:00Z',
    features: ['random-ms-delay-3-4s', 'variation-rotation-ab', 'intelligent-multistep-followup', 'promise-date-scheduler', 'trigger-followup-on-reply-off', 'persistent-cloud-media'],
    uptime: Math.floor(process.uptime()),
  });
});

app.get('/debug-logs', (_req, res) => {
  res.type('text/plain').send(getInMemoryLogs().join('\n'));
});

// 2. Multi-Account: Get all accounts info
app.get('/accounts', (_req, res) => {
  const accounts = getAllAccountsInfo();
  res.json({ ok: true, accounts });
});

// 3. Multi-Account: Create and connect new account
app.post('/accounts', async (req, res) => {
  try {
    const name = (req.body?.name || '').trim() || `SIM ${Date.now().toString().slice(-4)}`;
    const accountId = req.body?.id || `acc_${Date.now()}`;
    const info = await startWhatsApp(accountId, name);
    res.json({ ok: true, account: info });
  } catch (err: any) {
    errLog('API', 'Create account error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Multi-Account: Connect specific account
app.post('/accounts/:id/connect', async (req, res) => {
  try {
    const accountId = req.params.id;
    const name = req.body?.name;
    await startWhatsApp(accountId, name);

    // Wait up to 3 seconds for initial QR code or connection
    const start = Date.now();
    while (Date.now() - start < 3000) {
      const info = getConnectionInfo(accountId);
      if (info.qrCode || info.status === 'connected') {
        return res.json({ ok: true, account: info });
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    const finalInfo = getConnectionInfo(accountId);
    res.json({ ok: true, account: finalInfo });
  } catch (err: any) {
    errLog('API', 'Account connect error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Multi-Account: Disconnect specific account
app.post('/accounts/:id/disconnect', async (req, res) => {
  try {
    const accountId = req.params.id;
    await disconnectWhatsApp(accountId);
    res.json({ ok: true, disconnected: true });
  } catch (err: any) {
    errLog('API', 'Account disconnect error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. Multi-Account: Delete account completely
app.delete('/accounts/:id', async (req, res) => {
  try {
    const accountId = req.params.id;
    await removeWhatsAppAccount(accountId);
    res.json({ ok: true, deleted: true });
  } catch (err: any) {
    errLog('API', 'Delete account error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7. Multi-Account: Update account details in memory
app.put('/accounts/:id', (req, res) => {
  try {
    const accountId = req.params.id;
    const { name, phoneNumber } = req.body;
    updateAccountInfo(accountId, name, phoneNumber);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 8. Follow-up: Sync settings and variations
app.post('/followup/sync', (_req, res) => {
  log('FOLLOWUP', '🔄 Follow-up configuration sync received from web dashboard.');
  res.json({ ok: true });
});

// --- Legacy / Default routes for 'main' account ---
app.get('/status', (req, res) => {
  const accountId = (req.query?.accountId as string) || 'main';
  const info = getConnectionInfo(accountId);
  res.json({
    status: info.status,
    phoneNumber: info.phoneNumber,
    hasQr: Boolean(info.qrCode),
  });
});

app.get('/qr', (req, res) => {
  const accountId = (req.query?.accountId as string) || 'main';
  const info = getConnectionInfo(accountId);
  res.json({
    status: info.status,
    qrCode: info.qrCode,
    phoneNumber: info.phoneNumber,
  });
});

app.post('/connect', async (req, res) => {
  try {
    const accountId = (req.body?.accountId as string) || 'main';
    const info = await startWhatsApp(accountId);
    res.json({ ok: true, ...info });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/disconnect', async (req, res) => {
  try {
    const accountId = (req.body?.accountId as string) || 'main';
    await disconnectWhatsApp(accountId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  log('SERVER', `🚀 Multi-Session WhatsApp Automation Engine listening on 0.0.0.0:${PORT}`);

  // Automatically start all registered accounts
  initAllAccounts().catch((err) => {
    errLog('SERVER', 'Error initializing accounts on boot:', err.message);
  });

  // Start the follow-up scheduler (checks every 60s for pending follow-ups)
  startFollowupScheduler();

  // Watcher: Poll DB every 12s for any account marked 'connecting' or 'connected' without an active socket
  setInterval(async () => {
    try {
      const dbAccounts = await getAllDbAccounts();
      for (const acc of dbAccounts) {
        if ((acc.status === 'connecting' || acc.status === 'connected') && !isSessionActive(acc.id)) {
          log('WATCHER', `Account ${acc.name} (${acc.id}) has '${acc.status}' state in DB but no active socket. Starting socket...`);
          startWhatsApp(acc.id, acc.name).catch((err) => {
            errLog('WATCHER', `Failed starting account ${acc.id}:`, err.message);
          });
        }
      }
    } catch (err: any) {
      // transient network error
    }
  }, 12000);
});

