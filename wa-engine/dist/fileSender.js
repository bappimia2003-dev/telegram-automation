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
const utils_js_1 = require("./utils.js");
async function getMediaBuffer(source) {
    if (source.startsWith('data:')) {
        const [, b64] = source.split(';base64,');
        return Buffer.from(b64, 'base64');
    }
    if (source.startsWith('http://') || source.startsWith('https://')) {
        const res = await fetch(source);
        if (!res.ok)
            throw new Error(`HTTP Error ${res.status} fetching media from ${source}`);
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
    }
    // Local file
    if (fs_1.default.existsSync(source)) {
        return fs_1.default.readFileSync(source);
    }
    throw new Error(`Media source not found or unreachable: ${source}`);
}
async function sendTextMessage(sock, jid, text) {
    await sock.sendMessage(jid, { text });
    (0, utils_js_1.log)('SENDER', `Sent text to ${jid}`);
}
async function sendImageMessage(sock, jid, imageSource, caption) {
    const buffer = await getMediaBuffer(imageSource);
    const payload = { image: buffer };
    if (caption)
        payload.caption = caption;
    await sock.sendMessage(jid, payload);
    (0, utils_js_1.log)('SENDER', `Sent image to ${jid}`);
}
async function sendVideoMessage(sock, jid, videoSource, caption) {
    const buffer = await getMediaBuffer(videoSource);
    const payload = { video: buffer };
    if (caption)
        payload.caption = caption;
    await sock.sendMessage(jid, payload);
    (0, utils_js_1.log)('SENDER', `Sent video to ${jid}`);
}
async function sendAudioMessage(sock, jid, audioSource) {
    const buffer = await getMediaBuffer(audioSource);
    const cleanUrl = audioSource.split('?')[0].toLowerCase();
    let mimetype = 'audio/mp4';
    if (cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.opus')) {
        mimetype = 'audio/ogg; codecs=opus';
    }
    else if (cleanUrl.endsWith('.mp3')) {
        mimetype = 'audio/mpeg';
    }
    await sock.sendMessage(jid, {
        audio: buffer,
        mimetype,
        ptt: true, // Send as voice note with waveform
    });
    (0, utils_js_1.log)('SENDER', `Sent voice note (${mimetype}) to ${jid}`);
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
