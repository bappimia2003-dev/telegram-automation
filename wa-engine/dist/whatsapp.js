"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSessionActive = isSessionActive;
exports.getConnectionInfo = getConnectionInfo;
exports.getAllAccountsInfo = getAllAccountsInfo;
exports.startWhatsApp = startWhatsApp;
exports.disconnectWhatsApp = disconnectWhatsApp;
exports.removeWhatsAppAccount = removeWhatsAppAccount;
exports.initAllAccounts = initAllAccounts;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const qrcode_1 = __importDefault(require("qrcode"));
const pino_1 = __importDefault(require("pino"));
const db_js_1 = require("./db.js");
const campaigns_js_1 = require("./campaigns.js");
const utils_js_1 = require("./utils.js");
const sessions = new Map();
const AUTH_BASE_DIR = path_1.default.resolve(process.cwd(), 'whatsapp-auth');
function getOrCreateSession(id, name) {
    if (!sessions.has(id)) {
        sessions.set(id, {
            id,
            name: name || (id === 'main' ? 'Primary WhatsApp' : `SIM ${id.slice(-4)}`),
            sock: null,
            status: 'disconnected',
            qrCode: '',
            phoneNumber: '',
        });
    }
    const s = sessions.get(id);
    if (name)
        s.name = name;
    return s;
}
function isSessionActive(accountId) {
    const s = sessions.get(accountId);
    return Boolean(s && s.sock && (s.status === 'connected' || s.status === 'connecting' || s.status === 'qr_pending'));
}
function getConnectionInfo(accountId = 'main') {
    const session = getOrCreateSession(accountId);
    return {
        id: session.id,
        name: session.name,
        status: session.status,
        qrCode: session.qrCode,
        phoneNumber: session.phoneNumber,
    };
}
function getAllAccountsInfo() {
    const list = [];
    for (const session of sessions.values()) {
        list.push({
            id: session.id,
            name: session.name,
            status: session.status,
            qrCode: session.qrCode,
            phoneNumber: session.phoneNumber,
        });
    }
    return list;
}
async function startWhatsApp(accountId = 'main', accountName) {
    const session = getOrCreateSession(accountId, accountName);
    // If already connected or already has an active socket in qr_pending or connecting, reuse it
    if (session.sock && (session.status === 'connected' || session.status === 'qr_pending' || session.status === 'connecting')) {
        (0, utils_js_1.log)('WA', `[${session.name}] Existing active socket in state '${session.status}'. Reusing...`);
        return getConnectionInfo(accountId);
    }
    // Clear any pending reconnect timer
    if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = null;
    }
    // Cleanly close previous socket if any exists
    if (session.sock) {
        try {
            session.sock.ev.removeAllListeners();
            session.sock.end(undefined);
        }
        catch { }
        session.sock = null;
    }
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = await import('@whiskeysockets/baileys');
    const authDir = path_1.default.join(AUTH_BASE_DIR, accountId);
    if (!fs_1.default.existsSync(authDir)) {
        fs_1.default.mkdirSync(authDir, { recursive: true });
    }
    // Restore auth files from Supabase if not on disk (e.g. fresh container on Railway)
    try {
        await (0, db_js_1.restoreAuthSession)(accountId, authDir);
    }
    catch (e) {
        (0, utils_js_1.errLog)('WA', `Error restoring auth for ${accountId}:`, e.message);
    }
    session.status = 'connecting';
    await (0, db_js_1.updateWaConnectionState)(accountId, { status: 'connecting', qrCode: '', name: session.name });
    try {
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const { version } = await fetchLatestBaileysVersion();
        const logger = (0, pino_1.default)({ level: 'silent' });
        const sock = makeWASocket({
            version,
            auth: state,
            logger,
            printQRInTerminal: true,
            browser: Browsers.ubuntu('Chrome'),
            generateHighQualityLinkPreview: false,
        });
        session.sock = sock;
        let backupTimer = null;
        sock.ev.on('creds.update', async () => {
            await saveCreds();
            if (backupTimer)
                clearTimeout(backupTimer);
            backupTimer = setTimeout(() => {
                (0, db_js_1.backupAuthSession)(accountId, authDir).catch(() => { });
            }, 2000);
        });
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                try {
                    session.qrCode = await qrcode_1.default.toDataURL(qr, { width: 320, margin: 2 });
                    session.status = 'qr_pending';
                    await (0, db_js_1.updateWaConnectionState)(accountId, {
                        status: 'qr_pending',
                        qrCode: session.qrCode,
                        name: session.name,
                    });
                    (0, utils_js_1.log)('WA', `[${session.name}] QR Code generated! Scan from WhatsApp.`);
                }
                catch (e) {
                    (0, utils_js_1.errLog)('WA', `[${session.name}] Failed generating QR Code:`, e.message);
                }
            }
            if (connection === 'open') {
                session.status = 'connected';
                session.qrCode = '';
                const rawId = sock?.user?.id || '';
                session.phoneNumber = rawId.split(':')[0] || rawId.split('@')[0] || '';
                await (0, db_js_1.updateWaConnectionState)(accountId, {
                    status: 'connected',
                    qrCode: '',
                    phoneNumber: session.phoneNumber,
                    lastConnected: new Date().toISOString(),
                    name: session.name,
                });
                (0, utils_js_1.log)('WA', `🎉 [${session.name}] WhatsApp connected successfully! Number: ${session.phoneNumber}`);
                // Sync fresh credentials to Supabase
                (0, db_js_1.backupAuthSession)(accountId, authDir).catch((e) => {
                    (0, utils_js_1.errLog)('WA', `Failed backing up auth session for ${accountId}:`, e.message);
                });
            }
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                session.sock = null;
                session.status = 'disconnected';
                session.qrCode = '';
                await (0, db_js_1.updateWaConnectionState)(accountId, {
                    status: 'disconnected',
                    qrCode: '',
                    name: session.name,
                });
                if (shouldReconnect) {
                    (0, utils_js_1.log)('WA', `[${session.name}] Connection closed (${statusCode || 'unknown'}). Reconnecting in 5s...`);
                    if (session.reconnectTimer)
                        clearTimeout(session.reconnectTimer);
                    session.reconnectTimer = setTimeout(() => {
                        session.reconnectTimer = null;
                        startWhatsApp(accountId, session.name).catch(() => { });
                    }, 5000);
                }
                else {
                    (0, utils_js_1.log)('WA', `[${session.name}] Logged out. Clearing auth files...`);
                    try {
                        if (fs_1.default.existsSync(authDir)) {
                            fs_1.default.rmSync(authDir, { recursive: true, force: true });
                        }
                    }
                    catch (e) {
                        (0, utils_js_1.errLog)('WA', `Error clearing auth for ${accountId}:`, e.message);
                    }
                }
            }
        });
        sock.ev.on('messages.upsert', async (event) => {
            if (event.type !== 'notify')
                return;
            for (const msg of event.messages) {
                if (!msg.key || msg.key.fromMe)
                    continue;
                const remoteJid = msg.key.remoteJid;
                if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us'))
                    continue;
                const sender = remoteJid;
                const pushName = msg.pushName || 'Customer';
                const messageText = msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.imageMessage?.caption ||
                    msg.message?.videoMessage?.caption ||
                    '';
                (0, utils_js_1.log)('WA', `📩 [${session.name}] Incoming from ${sender} (${pushName}): "${messageText}"`);
                // Process message in background with accountId and message key for read receipts
                (0, campaigns_js_1.processIncomingMessage)(sock, sender, pushName, messageText, accountId, msg.key).catch((err) => {
                    (0, utils_js_1.errLog)('WA', `Error handling incoming message on ${session.name}:`, err.message);
                });
            }
        });
        return getConnectionInfo(accountId);
    }
    catch (err) {
        (0, utils_js_1.errLog)('WA', `Failed starting WhatsApp socket for ${accountId}:`, err.message);
        session.status = 'disconnected';
        await (0, db_js_1.updateWaConnectionState)(accountId, { status: 'disconnected', qrCode: '', name: session.name });
        throw err;
    }
}
async function disconnectWhatsApp(accountId = 'main') {
    const session = sessions.get(accountId);
    if (session?.sock) {
        try {
            await session.sock.logout();
        }
        catch (e) {
            (0, utils_js_1.errLog)('WA', `Error logging out socket ${accountId}:`, e.message);
        }
        session.sock = null;
    }
    if (session) {
        session.status = 'disconnected';
        session.qrCode = '';
        session.phoneNumber = '';
    }
    await (0, db_js_1.updateWaConnectionState)(accountId, {
        status: 'disconnected',
        qrCode: '',
        phoneNumber: '',
    });
    const authDir = path_1.default.join(AUTH_BASE_DIR, accountId);
    try {
        if (fs_1.default.existsSync(authDir)) {
            fs_1.default.rmSync(authDir, { recursive: true, force: true });
        }
    }
    catch (e) {
        (0, utils_js_1.errLog)('WA', `Error removing auth dir for ${accountId}:`, e.message);
    }
    (0, utils_js_1.log)('WA', `[${accountId}] WhatsApp disconnected and credentials purged.`);
}
async function removeWhatsAppAccount(accountId) {
    await disconnectWhatsApp(accountId);
    await (0, db_js_1.deleteDbAccount)(accountId);
    sessions.delete(accountId);
    (0, utils_js_1.log)('WA', `Account ${accountId} completely removed.`);
}
async function initAllAccounts() {
    const dbAccounts = await (0, db_js_1.getAllDbAccounts)();
    if (dbAccounts.length === 0) {
        // Start default 'main' account
        startWhatsApp('main', 'Primary WhatsApp').catch((e) => {
            (0, utils_js_1.errLog)('WA', 'Auto-start main error:', e.message);
        });
    }
    else {
        for (const acc of dbAccounts) {
            getOrCreateSession(acc.id, acc.name);
            startWhatsApp(acc.id, acc.name).catch((e) => {
                (0, utils_js_1.errLog)('WA', `Auto-start account ${acc.id} error:`, e.message);
            });
        }
    }
}
