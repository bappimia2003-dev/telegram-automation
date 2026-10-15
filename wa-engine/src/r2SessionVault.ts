import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { log, errLog } from './utils.js';

dotenv.config();

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'telegramautomation';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const rawSecret = process.env.R2_SECRET_ACCESS_KEY || '';

const R2_SECRET_ACCESS_KEY = rawSecret.startsWith('cfat_')
  ? crypto.createHash('sha256').update(rawSecret).digest('hex')
  : rawSecret;

let r2Client: S3Client | null = null;

function getClient(): S3Client | null {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ACCOUNT_ID || !R2_BUCKET_NAME) {
    return null;
  }
  if (!r2Client) {
    r2Client = new S3Client({
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
export async function backupSessionToR2(accountId: string, gzippedBase64: string): Promise<boolean> {
  const client = getClient();
  if (!client) {
    log('R2_VAULT', 'Cloudflare R2 is not configured. Skipping R2 session backup.');
    return false;
  }

  try {
    const key = `whatsapp-sessions/auth_${accountId}.json.gz`;
    const buffer = Buffer.from(gzippedBase64, 'base64');
    const command = new PutObjectCommand({
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
    log('R2_VAULT', `🛡️ [Dual-Vault] Session for ${accountId} backed up to Cloudflare R2 (${(buffer.length / 1024).toFixed(1)} KB)`);
    return true;
  } catch (err: any) {
    errLog('R2_VAULT', `Error backing up session ${accountId} to R2:`, err.message);
    return false;
  }
}

/**
 * Restore gzipped base64 session bundle from Cloudflare R2
 * Used as automatic fallback whenever Supabase database is new, empty, or restricted.
 */
export async function restoreSessionFromR2(accountId: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const key = `whatsapp-sessions/auth_${accountId}.json.gz`;
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await client.send(command);
    if (!response.Body) return null;

    const byteArray = await response.Body.transformToByteArray();
    const gzippedBase64 = Buffer.from(byteArray).toString('base64');
    log('R2_VAULT', `🛡️ [Dual-Vault] Restored session for ${accountId} from Cloudflare R2 (${(byteArray.length / 1024).toFixed(1)} KB)`);
    return gzippedBase64;
  } catch (err: any) {
    // NoSuchKey is normal if not in R2 yet
    if (err.name !== 'NoSuchKey') {
      errLog('R2_VAULT', `Error restoring session ${accountId} from R2:`, err.message);
    }
    return null;
  }
}

/**
 * Delete session from Cloudflare R2 when account is explicitly removed
 */
export async function deleteSessionFromR2(accountId: string): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    const key = `whatsapp-sessions/auth_${accountId}.json.gz`;
    await client.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
    log('R2_VAULT', `Purged R2 session for ${accountId}`);
  } catch (err: any) {
    errLog('R2_VAULT', `Error deleting R2 session for ${accountId}:`, err.message);
  }
}

/**
 * List all saved session accounts in Cloudflare R2 Vault
 */
export async function listAllR2Sessions(): Promise<string[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: 'whatsapp-sessions/auth_',
    });

    const res = await client.send(command);
    if (!res.Contents) return [];

    return res.Contents.map((obj) => {
      const match = obj.Key?.match(/whatsapp-sessions\/auth_(.+)\.json\.gz/);
      return match ? match[1] : '';
    }).filter(Boolean);
  } catch (err: any) {
    errLog('R2_VAULT', 'Error listing R2 sessions:', err.message);
    return [];
  }
}
