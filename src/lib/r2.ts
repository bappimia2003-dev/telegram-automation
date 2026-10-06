import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '74b43556742be3e2b1e44e9465084ef4';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'telegramautomation';
const R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || 'https://pub-dd84232508704c3d9a399cd0b52cc72f.r2.dev').replace(/\/$/, '');
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'f88e0483320a0702a7bc9f3456c7e643';
const rawSecret = process.env.R2_SECRET_ACCESS_KEY || '1b054a65efa235c23fcf8d001fcc894efb1a4f1125059c894bed9e7b88823270';

// If secret is the Cloudflare Bearer Token (cfat_...), compute its SHA256 hex as required by S3 API
const R2_SECRET_ACCESS_KEY = rawSecret.startsWith('cfat_')
  ? crypto.createHash('sha256').update(rawSecret).digest('hex')
  : rawSecret;

let r2ClientInstance: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ACCOUNT_ID && R2_BUCKET_NAME);
}

export function getR2Client(): S3Client | null {
  if (!isR2Configured()) {
    return null;
  }
  if (!r2ClientInstance) {
    r2ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2ClientInstance;
}

/**
 * Uploads a file buffer directly to Cloudflare R2
 * Returns the public CDN URL with ZERO bandwidth / egress fee!
 */
export async function uploadToR2(
  buffer: Buffer,
  filename: string,
  contentType = 'application/octet-stream'
): Promise<string> {
  const client = getR2Client();
  if (!client) {
    throw new Error('Cloudflare R2 is not configured. Missing R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY.');
  }

  const cleanFilename = filename.replace(/^\/+/, '');
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: cleanFilename,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);
  return `${R2_PUBLIC_DOMAIN}/${cleanFilename}`;
}

/**
 * Deletes a file from Cloudflare R2
 * Accepts either a key (e.g. 'whatsapp/img.jpg') or full URL (e.g. 'https://pub-...r2.dev/whatsapp/img.jpg')
 */
export async function deleteFromR2(filenameOrUrl: string): Promise<boolean> {
  const client = getR2Client();
  if (!client || !filenameOrUrl) return false;

  try {
    let key = filenameOrUrl.trim();
    if (key.startsWith('http://') || key.startsWith('https://')) {
      try {
        const parsed = new URL(key);
        key = decodeURIComponent(parsed.pathname);
      } catch {}
    }
    const cleanFilename = key.replace(/^\/+/, '');
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: cleanFilename,
    });
    await client.send(command);
    console.log(`[R2] Deleted file from Cloudflare R2: ${cleanFilename}`);
    return true;
  } catch (err) {
    console.warn('[R2] Delete file error:', err);
    return false;
  }
}
