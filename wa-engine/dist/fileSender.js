"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTextMessage = sendTextMessage;
exports.sendImageMessage = sendImageMessage;
exports.sendVideoMessage = sendVideoMessage;
exports.sendAudioMessage = sendAudioMessage;
exports.sendDocumentMessage = sendDocumentMessage;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_js_1 = require("./db.js");
const utils_js_1 = require("./utils.js");
async function getMediaBuffer(source) {
    if (source.startsWith('data:')) {
        const [, b64] = source.split(';base64,');
        return Buffer.from(b64, 'base64');
    }
    // Local file on disk
    const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
    const possibleFilename = source.split('/').pop()?.split('?')[0];
    if (possibleFilename && fs_1.default.existsSync(path_1.default.join(uploadsDir, possibleFilename))) {
        return fs_1.default.readFileSync(path_1.default.join(uploadsDir, possibleFilename));
    }
    if (fs_1.default.existsSync(source)) {
        return fs_1.default.readFileSync(source);
    }
    if (source.startsWith('http://') || source.startsWith('https://')) {
        try {
            const res = await fetch(source, { signal: AbortSignal.timeout(15000) });
            if (res.ok) {
                const arrayBuf = await res.arrayBuffer();
                return Buffer.from(arrayBuf);
            }
        }
        catch { }
        // Fallback: restore from Supabase Cloud DB if URL is an uploaded file
        if (possibleFilename) {
            const restored = await (0, db_js_1.restoreMediaBackup)(possibleFilename);
            if (restored) {
                return restored.buffer;
            }
        }
        throw new Error(`Media source not found or unreachable: ${source}`);
    }
    if (possibleFilename) {
        const restored = await (0, db_js_1.restoreMediaBackup)(possibleFilename);
        if (restored)
            return restored.buffer;
    }
    throw new Error(`Media source not found or unreachable: ${source}`);
}
async function sendTextMessage(sock, jid, text) {
    await sock.sendMessage(jid, { text });
    (0, utils_js_1.log)('SENDER', `Sent text to ${jid}`);
}
async function sendImageMessage(sock, jid, imageSource, caption) {
    const buffer = await getMediaBuffer(imageSource);
    const cleanUrl = imageSource.split('?')[0].toLowerCase();
    let mimetype = 'image/jpeg';
    if (cleanUrl.endsWith('.png') || imageSource.startsWith('data:image/png'))
        mimetype = 'image/png';
    else if (cleanUrl.endsWith('.webp') || imageSource.startsWith('data:image/webp'))
        mimetype = 'image/webp';
    else if (cleanUrl.endsWith('.gif') || imageSource.startsWith('data:image/gif'))
        mimetype = 'image/gif';
    const payload = { image: buffer, mimetype };
    if (caption)
        payload.caption = caption;
    await sock.sendMessage(jid, payload);
    (0, utils_js_1.log)('SENDER', `Sent image (${(buffer.length / 1024).toFixed(1)} KB, ${mimetype}) to ${jid}`);
}
async function sendVideoMessage(sock, jid, videoSource, caption) {
    const buffer = await getMediaBuffer(videoSource);
    const payload = { video: buffer };
    if (caption)
        payload.caption = caption;
    if (videoSource.startsWith('data:')) {
        const match = videoSource.match(/^data:([^;]+);/);
        if (match && match[1])
            payload.mimetype = match[1];
    }
    await sock.sendMessage(jid, payload);
    (0, utils_js_1.log)('SENDER', `Sent video to ${jid}`);
}
async function sendAudioMessage(sock, jid, audioSource) {
    const buffer = await getMediaBuffer(audioSource);
    const cleanUrl = audioSource.split('?')[0].toLowerCase();
    let mimetype = 'audio/mpeg';
    if (audioSource.startsWith('data:')) {
        const match = audioSource.match(/^data:([^;]+);/);
        if (match && match[1]) {
            mimetype = match[1];
        }
    }
    else if (cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.opus')) {
        mimetype = 'audio/ogg; codecs=opus';
    }
    else if (cleanUrl.endsWith('.mp3')) {
        mimetype = 'audio/mpeg';
    }
    else if (cleanUrl.endsWith('.m4a') || cleanUrl.endsWith('.mp4')) {
        mimetype = 'audio/mp4';
    }
    // WhatsApp on Android (Vivo, Samsung, Xiaomi, etc.) STRICTLY requires OGG Opus for PTT Voice Notes.
    // If an MP3 (audio/mpeg) has ptt: true, Android ExoPlayer throws:
    // "This audio is not available because something is wrong with the audio file."
    // Setting ptt to true ONLY for Opus/Ogg ensures 100% playback compatibility across all Android, iOS, and PC devices.
    const isOpusVoiceNote = mimetype.includes('ogg') || mimetype.includes('opus');
    await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: isOpusVoiceNote ? 'audio/ogg; codecs=opus' : (mimetype || 'audio/mpeg'),
        ptt: isOpusVoiceNote,
    });
    (0, utils_js_1.log)('SENDER', `Sent audio message (${mimetype}, ptt: ${isOpusVoiceNote}) to ${jid}`);
}
async function sendDocumentMessage(sock, jid, docSource, fileName) {
    const buffer = await getMediaBuffer(docSource);
    const ext = path_1.default.extname(fileName || 'doc.pdf').toLowerCase();
    const mimeMap = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.txt': 'text/plain',
    };
    const mimetype = mimeMap[ext] || 'application/octet-stream';
    await sock.sendMessage(jid, {
        document: buffer,
        mimetype,
        fileName: fileName || 'Document',
    });
    (0, utils_js_1.log)('SENDER', `Sent document (${fileName}) to ${jid}`);
}
