"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const whatsapp_js_1 = require("./whatsapp.js");
const db_js_1 = require("./db.js");
const utils_js_1 = require("./utils.js");
const followupScheduler_js_1 = require("./followupScheduler.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 3005;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '100mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '100mb' }));
const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Auto-restore uploaded media from Supabase Cloud DB if missing from container disk (survives redeploys)
app.get('/uploads/:filename', async (req, res, next) => {
    const filename = req.params.filename;
    const filePath = path_1.default.join(uploadsDir, filename);
    if (fs_1.default.existsSync(filePath)) {
        return next();
    }
    try {
        const restored = await (0, db_js_1.restoreMediaBackup)(filename);
        if (restored) {
            await fs_1.default.promises.writeFile(filePath, restored.buffer).catch(() => { });
            res.setHeader('Content-Type', restored.mimeType);
            return res.send(restored.buffer);
        }
    }
    catch (err) {
        (0, utils_js_1.errLog)('MEDIA', `Failed restoring ${filename}:`, err.message);
    }
    next();
});
app.use('/uploads', express_1.default.static(uploadsDir));
// Dedicated file upload endpoint for WhatsApp media (audio, video, images, documents)
app.post('/upload', async (req, res) => {
    try {
        const { filename, base64, mimeType } = req.body;
        if (!filename || !base64) {
            return res.status(400).json({ ok: false, error: 'Missing filename or base64 data' });
        }
        const ext = path_1.default.extname(filename) || '.bin';
        const safeName = `wa-${Date.now()}-${(0, uuid_1.v4)().slice(0, 8)}${ext}`;
        const filePath = path_1.default.join(uploadsDir, safeName);
        const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        // 1. Write to container disk
        await fs_1.default.promises.writeFile(filePath, buffer);
        // 2. Persist permanently to Supabase Cloud DB so it survives redeploys
        (0, db_js_1.saveMediaBackup)(safeName, cleanBase64, mimeType || 'application/octet-stream').catch(() => { });
        const host = req.get('x-forwarded-host') || req.get('host');
        const proto = req.get('x-forwarded-proto') || 'https';
        const publicUrl = `${proto}://${host}/uploads/${safeName}`;
        (0, utils_js_1.log)('UPLOAD', `Saved ${safeName} (${(cleanBase64.length * 0.75 / 1024).toFixed(1)} KB) -> ${publicUrl} (Cloud backed up)`);
        res.json({ ok: true, url: publicUrl, filename });
    }
    catch (err) {
        (0, utils_js_1.errLog)('UPLOAD', 'Upload error:', err.message);
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
    res.type('text/plain').send((0, utils_js_1.getInMemoryLogs)().join('\n'));
});
// 2. Multi-Account: Get all accounts info
app.get('/accounts', (_req, res) => {
    const accounts = (0, whatsapp_js_1.getAllAccountsInfo)();
    res.json({ ok: true, accounts });
});
// 3. Multi-Account: Create and connect new account
app.post('/accounts', async (req, res) => {
    try {
        const name = (req.body?.name || '').trim() || `SIM ${Date.now().toString().slice(-4)}`;
        const accountId = req.body?.id || `acc_${Date.now()}`;
        const info = await (0, whatsapp_js_1.startWhatsApp)(accountId, name);
        res.json({ ok: true, account: info });
    }
    catch (err) {
        (0, utils_js_1.errLog)('API', 'Create account error:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    }
});
// 4. Multi-Account: Connect specific account
app.post('/accounts/:id/connect', async (req, res) => {
    try {
        const accountId = req.params.id;
        const name = req.body?.name;
        const info = await (0, whatsapp_js_1.startWhatsApp)(accountId, name);
        res.json({ ok: true, account: info });
    }
    catch (err) {
        (0, utils_js_1.errLog)('API', 'Account connect error:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    }
});
// 5. Multi-Account: Disconnect specific account
app.post('/accounts/:id/disconnect', async (req, res) => {
    try {
        const accountId = req.params.id;
        await (0, whatsapp_js_1.disconnectWhatsApp)(accountId);
        res.json({ ok: true, disconnected: true });
    }
    catch (err) {
        (0, utils_js_1.errLog)('API', 'Account disconnect error:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    }
});
// 6. Multi-Account: Delete account completely
app.delete('/accounts/:id', async (req, res) => {
    try {
        const accountId = req.params.id;
        await (0, whatsapp_js_1.removeWhatsAppAccount)(accountId);
        res.json({ ok: true, deleted: true });
    }
    catch (err) {
        (0, utils_js_1.errLog)('API', 'Delete account error:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    }
});
// --- Legacy / Default routes for 'main' account ---
app.get('/status', (req, res) => {
    const accountId = req.query?.accountId || 'main';
    const info = (0, whatsapp_js_1.getConnectionInfo)(accountId);
    res.json({
        status: info.status,
        phoneNumber: info.phoneNumber,
        hasQr: Boolean(info.qrCode),
    });
});
app.get('/qr', (req, res) => {
    const accountId = req.query?.accountId || 'main';
    const info = (0, whatsapp_js_1.getConnectionInfo)(accountId);
    res.json({
        status: info.status,
        qrCode: info.qrCode,
        phoneNumber: info.phoneNumber,
    });
});
app.post('/connect', async (req, res) => {
    try {
        const accountId = req.body?.accountId || 'main';
        const info = await (0, whatsapp_js_1.startWhatsApp)(accountId);
        res.json({ ok: true, ...info });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});
app.post('/disconnect', async (req, res) => {
    try {
        const accountId = req.body?.accountId || 'main';
        await (0, whatsapp_js_1.disconnectWhatsApp)(accountId);
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});
app.listen(PORT, '0.0.0.0', () => {
    (0, utils_js_1.log)('SERVER', `🚀 Multi-Session WhatsApp Automation Engine listening on 0.0.0.0:${PORT}`);
    // Automatically start all registered accounts
    (0, whatsapp_js_1.initAllAccounts)().catch((err) => {
        (0, utils_js_1.errLog)('SERVER', 'Error initializing accounts on boot:', err.message);
    });
    // Start the follow-up scheduler (checks every 60s for pending follow-ups)
    (0, followupScheduler_js_1.startFollowupScheduler)();
    // Watcher: Poll DB every 12s for any account marked 'connecting' or 'connected' without an active socket
    setInterval(async () => {
        try {
            const dbAccounts = await (0, db_js_1.getAllDbAccounts)();
            for (const acc of dbAccounts) {
                if ((acc.status === 'connecting' || acc.status === 'connected') && !(0, whatsapp_js_1.isSessionActive)(acc.id)) {
                    (0, utils_js_1.log)('WATCHER', `Account ${acc.name} (${acc.id}) has '${acc.status}' state in DB but no active socket. Starting socket...`);
                    (0, whatsapp_js_1.startWhatsApp)(acc.id, acc.name).catch((err) => {
                        (0, utils_js_1.errLog)('WATCHER', `Failed starting account ${acc.id}:`, err.message);
                    });
                }
            }
        }
        catch (err) {
            // transient network error
        }
    }, 12000);
});
