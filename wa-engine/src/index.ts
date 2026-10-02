import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { startWhatsApp, disconnectWhatsApp, getConnectionInfo } from './whatsapp.js';
import { log, errLog } from './utils.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3005;

app.use(cors());
app.use(express.json());

// 1. Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// 2. Connection status
app.get('/status', (_req, res) => {
  const info = getConnectionInfo();
  res.json({
    status: info.status,
    phoneNumber: info.phoneNumber,
    hasQr: Boolean(info.qrCode),
  });
});

// 3. Get QR code
app.get('/qr', (_req, res) => {
  const info = getConnectionInfo();
  res.json({
    status: info.status,
    qrCode: info.qrCode,
    phoneNumber: info.phoneNumber,
  });
});

// 4. Trigger connect
app.post('/connect', async (_req, res) => {
  try {
    const info = await startWhatsApp();
    res.json({ ok: true, ...info });
  } catch (err: any) {
    errLog('API', 'Connect error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Trigger disconnect
app.post('/disconnect', async (_req, res) => {
  try {
    await disconnectWhatsApp();
    res.json({ ok: true });
  } catch (err: any) {
    errLog('API', 'Disconnect error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  log('SERVER', `🚀 WhatsApp Automation Engine listening on 0.0.0.0:${PORT}`);

  // Automatically start WhatsApp on boot
  startWhatsApp().catch((err) => {
    errLog('SERVER', 'Error auto-starting WhatsApp on boot:', err.message);
  });
});
