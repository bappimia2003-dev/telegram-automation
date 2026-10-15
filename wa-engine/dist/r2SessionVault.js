"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupSessionToR2 = backupSessionToR2;
exports.restoreSessionFromR2 = restoreSessionFromR2;
exports.deleteSessionFromR2 = deleteSessionFromR2;
exports.listAllR2Sessions = listAllR2Sessions;
const client_s3_1 = require("@aws-sdk/client-s3");
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
const utils_js_1 = require("./utils.js");
dotenv_1.default.config();
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '74b43556742be3e2b1e44e9465084ef4';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'telegramautomation';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'f88e0483320a0702a7bc9f3456c7e643';
const rawSecret = process.env.R2_SECRET_ACCESS_KEY || '1b054a65efa235c23fcf8d001fcc894efb1a4f1125059c894bed9e7b88823270';
const R2_SECRET_ACCESS_KEY = rawSecret.startsWith('cfat_')
    ? crypto_1.default.createHash('sha256').update(rawSecret).digest('hex')
    : rawSecret;
let r2Client = null;
function getClient() {
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ACCOUNT_ID || !R2_BUCKET_NAME) {
        return null;
    }
    if (!r2Client) {
        r2Client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: R2_ACCESS_KEY_ID,
                secretAccessKey: R2_SECRET_ACCESS_KEY,
            },
        });
    }
    return r2Client;
}
/**
 * Backup gzipped base64 session bundle to Cloudflare R2
 * Cloudflare R2 has ZERO egress fees and never blocks database migrations!
 */
async function backupSessionToR2(accountId, gzippedBase64) {
    const client = getClient();
    if (!client) {
        (0, utils_js_1.log)('R2_VAULT', 'Cloudflare R2 is not configured. Skipping R2 session backup.');
        return false;
    }
    try {
        const key = `whatsapp-sessions/auth_${accountId}.json.gz`;
        const buffer = Buffer.from(gzippedBase64, 'base64');
        const command = new client_s3_1.PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: 'application/gzip',
            Metadata: {
                accountId,
                updatedAt: new Date().toISOString(),
            },
        });
        await client.send(command);
        (0, utils_js_1.log)('R2_VAULT', `🛡️ [Dual-Vault] Session for ${accountId} backed up to Cloudflare R2 (${(buffer.length / 1024).toFixed(1)} KB)`);
        return true;
    }
    catch (err) {
        (0, utils_js_1.errLog)('R2_VAULT', `Error backing up session ${accountId} to R2:`, err.message);
        return false;
    }
}
/**
 * Restore gzipped base64 session bundle from Cloudflare R2
 * Used as automatic fallback whenever Supabase database is new, empty, or restricted.
 */
async function restoreSessionFromR2(accountId) {
    const client = getClient();
    if (!client)
        return null;
    try {
        const key = `whatsapp-sessions/auth_${accountId}.json.gz`;
        const command = new client_s3_1.GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        });
        const response = await client.send(command);
        if (!response.Body)
            return null;
        const byteArray = await response.Body.transformToByteArray();
        const gzippedBase64 = Buffer.from(byteArray).toString('base64');
        (0, utils_js_1.log)('R2_VAULT', `🛡️ [Dual-Vault] Restored session for ${accountId} from Cloudflare R2 (${(byteArray.length / 1024).toFixed(1)} KB)`);
        return gzippedBase64;
    }
    catch (err) {
        // NoSuchKey is normal if not in R2 yet
        if (err.name !== 'NoSuchKey') {
            (0, utils_js_1.errLog)('R2_VAULT', `Error restoring session ${accountId} from R2:`, err.message);
        }
        return null;
    }
}
/**
 * Delete session from Cloudflare R2 when account is explicitly removed
 */
async function deleteSessionFromR2(accountId) {
    const client = getClient();
    if (!client)
        return;
    try {
        const key = `whatsapp-sessions/auth_${accountId}.json.gz`;
        await client.send(new client_s3_1.DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        }));
        (0, utils_js_1.log)('R2_VAULT', `Purged R2 session for ${accountId}`);
    }
    catch (err) {
        (0, utils_js_1.errLog)('R2_VAULT', `Error deleting R2 session for ${accountId}:`, err.message);
    }
}
/**
 * List all saved session accounts in Cloudflare R2 Vault
 */
async function listAllR2Sessions() {
    const client = getClient();
    if (!client)
        return [];
    try {
        const command = new client_s3_1.ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: 'whatsapp-sessions/auth_',
        });
        const res = await client.send(command);
        if (!res.Contents)
            return [];
        return res.Contents.map((obj) => {
            const match = obj.Key?.match(/whatsapp-sessions\/auth_(.+)\.json\.gz/);
            return match ? match[1] : '';
        }).filter(Boolean);
    }
    catch (err) {
        (0, utils_js_1.errLog)('R2_VAULT', 'Error listing R2 sessions:', err.message);
        return [];
    }
}
