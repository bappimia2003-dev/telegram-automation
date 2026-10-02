"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const whatsapp_js_1 = require("./whatsapp.js");
const db_js_1 = require("./db.js");
const utils_js_1 = require("./utils.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 3005;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// 1. Health check
app.get('/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
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
    // Watcher: Poll DB every 4s for any account marked 'connecting' without an active socket
    setInterval(async () => {
        try {
            const dbAccounts = await (0, db_js_1.getAllDbAccounts)();
            for (const acc of dbAccounts) {
                if (acc.status === 'connecting' && !(0, whatsapp_js_1.isSessionActive)(acc.id)) {
                    (0, utils_js_1.log)('WATCHER', `Account ${acc.name} (${acc.id}) has 'connecting' state in DB. Starting socket...`);
                    (0, whatsapp_js_1.startWhatsApp)(acc.id, acc.name).catch((err) => {
                        (0, utils_js_1.errLog)('WATCHER', `Failed starting account ${acc.id}:`, err.message);
                    });
                }
            }
        }
        catch (err) {
            // transient network error
        }
    }, 4000);
});
