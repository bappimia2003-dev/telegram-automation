"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchCampaign = matchCampaign;
exports.isAutoReplyInProgress = isAutoReplyInProgress;
exports.processIncomingMessage = processIncomingMessage;
const uuid_1 = require("uuid");
const db_js_1 = require("./db.js");
const fileSender_js_1 = require("./fileSender.js");
const utils_js_1 = require("./utils.js");
function cleanForMatching(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[?!.,;:_~#*+\-\[\]\(\)\/\\"'`|—–]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
async function matchCampaign(messageText, accountId) {
    const allActive = await (0, db_js_1.getActiveCampaigns)();
    if (allActive.length === 0)
        return null;
    // Filter campaigns assigned to this account (or assigned to 'all')
    const activeCampaigns = allActive.filter((c) => !c.accountId || c.accountId === 'all' || !accountId || c.accountId === accountId);
    if (activeCampaigns.length === 0)
        return null;
    const rawText = (messageText || '').trim();
    if (!rawText)
        return null;
    const cleanedText = cleanForMatching(rawText);
    if (!cleanedText)
        return null;
    // 1. Strict Exact Keyword Matching (only triggers when message matches the specified keyword)
    for (const campaign of activeCampaigns) {
        if (!campaign.keywords || !campaign.keywords.trim())
            continue;
        const keywords = campaign.keywords
            .split(',')
            .map((k) => cleanForMatching(k))
            .filter(Boolean);
        const words = cleanedText.split(' ');
        for (const kw of keywords) {
            const kwWords = kw.split(' ').filter((w) => w.length >= 2);
            const allKwWordsInMessage = kwWords.length > 1 && kwWords.every((w) => cleanedText.includes(w));
            const isMatch = cleanedText === kw ||
                words.includes(kw) ||
                (kw.length >= 3 && cleanedText.includes(kw)) ||
                allKwWordsInMessage;
            if (isMatch) {
                (0, utils_js_1.log)('CAMPAIGN', `[Acc: ${accountId || 'all'}] Matched keyword "${kw}" for campaign: "${campaign.name}" (incoming: "${messageText}")`);
                return campaign;
            }
        }
    }
    // 2. Fallback to default campaign if set
    const defaultCamp = activeCampaigns.find((c) => c.isDefault && (!c.keywords || !c.keywords.trim()));
    if (defaultCamp) {
        (0, utils_js_1.log)('CAMPAIGN', `[Acc: ${accountId || 'all'}] Using default fallback campaign: "${defaultCamp.name}"`);
        return defaultCamp;
    }
    (0, utils_js_1.log)('CAMPAIGN', `[Acc: ${accountId || 'all'}] Message "${messageText}" does not match any keyword. No auto-reply.`);
    return null;
}
// Track last used variant index per campaign for round-robin switching
const lastVariantIndexMap = new Map();
// Track previous delays to ensure each random millisecond differs from the last
let lastFirstDelayMs = 0;
let lastSubsequentDelayMs = 0;
// Track active auto-reply deliveries so quick 2nd messages during initial auto-reply don't kill follow-up
const activeAutoReplySet = new Set();
function isAutoReplyInProgress(sender, accountId) {
    return activeAutoReplySet.has(`${accountId || 'all'}:${sender}`) || activeAutoReplySet.has(`all:${sender}`);
}
function getRandomDelay(minMs, maxMs, previousDelay) {
    let delay;
    let attempts = 0;
    do {
        delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
        attempts++;
    } while (delay === previousDelay && attempts < 10);
    return delay;
}
async function processIncomingMessage(sock, sender, pushName, messageText, accountId, messageKey) {
    const deliveryKey = `${accountId || 'all'}:${sender}`;
    if (activeAutoReplySet.has(deliveryKey)) {
        (0, utils_js_1.log)('CAMPAIGN', `[Acc: ${accountId || 'all'}] Auto-reply already in progress for ${sender}. Skipping duplicate trigger.`);
        return;
    }
    activeAutoReplySet.add(deliveryKey);
    try {
        const campaign = await matchCampaign(messageText, accountId);
        if (!campaign) {
            (0, utils_js_1.log)('CAMPAIGN', `[Acc: ${accountId || 'all'}] No matching campaign keyword for message: "${messageText}". Ignoring.`);
            return;
        }
        (0, utils_js_1.log)('CAMPAIGN', `🚀 [Acc: ${accountId || 'all'}] Triggered by keyword! Preparing delivery for ${sender} (${pushName}) -> Campaign: "${campaign.name}"`);
        // 1. Mark incoming message as read (blue ticks in WhatsApp)
        if (messageKey) {
            try {
                await sock.readMessages([messageKey]);
                (0, utils_js_1.log)('CAMPAIGN', `Marked incoming message from ${sender} as READ.`);
            }
            catch (readErr) {
                // Continue even if read receipt fails
            }
        }
        // Set human-like typing presence
        try {
            await sock.sendPresenceUpdate('composing', sender);
        }
        catch (presErr) {
            // Ignore presence error
        }
        // 2. Select Active Variant (Variation Switching System)
        let activeVariants = (campaign.variants || []).filter((v) => v.isActive);
        // If no variants defined or all disabled, fallback to campaign's top-level info
        if (activeVariants.length === 0) {
            activeVariants = [
                {
                    id: 'var_default',
                    name: 'Main Variation',
                    isActive: true,
                    welcomeMessage: campaign.welcomeMessage || '',
                    imageUrl: campaign.imageUrl || '',
                    audioUrl: campaign.audioUrl || '',
                    videoUrl: campaign.videoUrl || '',
                    documentUrl: campaign.documentUrl || '',
                    documentName: campaign.documentName || '',
                },
            ];
        }
        // Rotate or randomly switch between active variations
        let selectedVariant = activeVariants[0];
        if (activeVariants.length > 1) {
            const lastIndex = lastVariantIndexMap.get(campaign.id) ?? -1;
            const nextIndex = (lastIndex + 1) % activeVariants.length;
            lastVariantIndexMap.set(campaign.id, nextIndex);
            selectedVariant = activeVariants[nextIndex];
            (0, utils_js_1.log)('CAMPAIGN', `🔀 [Variation Switching] Selected "${selectedVariant.name}" (${nextIndex + 1} of ${activeVariants.length} active variations) for ${sender}`);
        }
        else {
            (0, utils_js_1.log)('CAMPAIGN', `ℹ️ [Variation] Using "${selectedVariant.name}" for ${sender}`);
        }
        // Robust media fallback: if a variation doesn't define its own image/audio/video/document,
        // inherit from campaign top-level media or from the primary active variation.
        // This guarantees that when users rotate text variations, audio and images are NEVER dropped for any recipient!
        const effectiveMessage = (selectedVariant.welcomeMessage && selectedVariant.welcomeMessage.trim()) || campaign.welcomeMessage?.trim() || '';
        const effectiveImageUrl = (selectedVariant.imageUrl && selectedVariant.imageUrl.trim()) || campaign.imageUrl?.trim() || activeVariants[0]?.imageUrl?.trim() || '';
        const effectiveAudioUrl = (selectedVariant.audioUrl && selectedVariant.audioUrl.trim()) || campaign.audioUrl?.trim() || activeVariants[0]?.audioUrl?.trim() || '';
        const effectiveVideoUrl = (selectedVariant.videoUrl && selectedVariant.videoUrl.trim()) || campaign.videoUrl?.trim() || activeVariants[0]?.videoUrl?.trim() || '';
        const effectiveDocumentUrl = (selectedVariant.documentUrl && selectedVariant.documentUrl.trim()) || campaign.documentUrl?.trim() || activeVariants[0]?.documentUrl?.trim() || '';
        const effectiveDocumentName = (selectedVariant.documentName && selectedVariant.documentName.trim()) || campaign.documentName?.trim() || activeVariants[0]?.documentName?.trim() || 'Document';
        const orderList = campaign.sendOrder
            .split(',')
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
        // Filter which items in the send order actually have content
        const itemsToSend = [];
        for (const item of orderList) {
            if (item === 'message' && effectiveMessage) {
                itemsToSend.push('message');
            }
            else if (item === 'image' && effectiveImageUrl) {
                itemsToSend.push('image');
            }
            else if (item === 'video' && effectiveVideoUrl) {
                itemsToSend.push('video');
            }
            else if (item === 'audio' && effectiveAudioUrl) {
                itemsToSend.push('audio');
            }
            else if (item === 'document' && effectiveDocumentUrl) {
                itemsToSend.push('document');
            }
        }
        if (itemsToSend.length === 0) {
            (0, utils_js_1.log)('CAMPAIGN', `Selected variation "${selectedVariant.name}" has no media or text content to send.`);
            return;
        }
        // 3. First Message Delay: 3 to 4 seconds in random milliseconds (after read)
        const firstDelay = getRandomDelay(3000, 4000, lastFirstDelayMs);
        lastFirstDelayMs = firstDelay;
        (0, utils_js_1.log)('CAMPAIGN', `⏳ Waiting ${(firstDelay / 1000).toFixed(3)}s (${firstDelay}ms) before sending 1st item to ${sender}...`);
        await (0, utils_js_1.sleep)(firstDelay);
        let allSuccessful = true;
        let deliveredCount = 0;
        for (let i = 0; i < itemsToSend.length; i++) {
            const item = itemsToSend[i];
            // Keep typing/recording presence alive
            try {
                if (item === 'audio') {
                    await sock.sendPresenceUpdate('recording', sender);
                }
                else {
                    await sock.sendPresenceUpdate('composing', sender);
                }
            }
            catch (e) { }
            try {
                if (item === 'message') {
                    await (0, fileSender_js_1.sendTextMessage)(sock, sender, effectiveMessage);
                    deliveredCount++;
                    await (0, db_js_1.addMessageLog)({
                        id: (0, uuid_1.v4)(),
                        campaignId: campaign.id,
                        phoneNumber: sender,
                        contactName: pushName,
                        messageType: 'text',
                        fileUrl: '',
                        status: 'sent',
                        errorMessage: '',
                        sentAt: new Date().toISOString(),
                    });
                }
                else if (item === 'image') {
                    await (0, fileSender_js_1.sendImageMessage)(sock, sender, effectiveImageUrl);
                    deliveredCount++;
                    const cleanLogUrl = effectiveImageUrl.startsWith('data:') ? 'photo.jpg' : effectiveImageUrl;
                    await (0, db_js_1.addMessageLog)({
                        id: (0, uuid_1.v4)(),
                        campaignId: campaign.id,
                        phoneNumber: sender,
                        contactName: pushName,
                        messageType: 'image',
                        fileUrl: cleanLogUrl,
                        status: 'sent',
                        errorMessage: '',
                        sentAt: new Date().toISOString(),
                    });
                }
                else if (item === 'video') {
                    await (0, fileSender_js_1.sendVideoMessage)(sock, sender, effectiveVideoUrl);
                    deliveredCount++;
                    const cleanLogUrl = effectiveVideoUrl.startsWith('data:') ? 'video.mp4' : effectiveVideoUrl;
                    await (0, db_js_1.addMessageLog)({
                        id: (0, uuid_1.v4)(),
                        campaignId: campaign.id,
                        phoneNumber: sender,
                        contactName: pushName,
                        messageType: 'video',
                        fileUrl: cleanLogUrl,
                        status: 'sent',
                        errorMessage: '',
                        sentAt: new Date().toISOString(),
                    });
                }
                else if (item === 'audio') {
                    await (0, fileSender_js_1.sendAudioMessage)(sock, sender, effectiveAudioUrl);
                    deliveredCount++;
                    const cleanLogUrl = effectiveAudioUrl.startsWith('data:') ? 'voice_note.mp3' : effectiveAudioUrl;
                    await (0, db_js_1.addMessageLog)({
                        id: (0, uuid_1.v4)(),
                        campaignId: campaign.id,
                        phoneNumber: sender,
                        contactName: pushName,
                        messageType: 'audio',
                        fileUrl: cleanLogUrl,
                        status: 'sent',
                        errorMessage: '',
                        sentAt: new Date().toISOString(),
                    });
                }
                else if (item === 'document') {
                    await (0, fileSender_js_1.sendDocumentMessage)(sock, sender, effectiveDocumentUrl, effectiveDocumentName);
                    deliveredCount++;
                    const cleanLogUrl = effectiveDocumentUrl.startsWith('data:') ? effectiveDocumentName : effectiveDocumentUrl;
                    await (0, db_js_1.addMessageLog)({
                        id: (0, uuid_1.v4)(),
                        campaignId: campaign.id,
                        phoneNumber: sender,
                        contactName: pushName,
                        messageType: 'document',
                        fileUrl: cleanLogUrl,
                        status: 'sent',
                        errorMessage: '',
                        sentAt: new Date().toISOString(),
                    });
                }
                // 4. Delay Before Next Item: Exactly 2 to 3 seconds in random milliseconds (non-matching)
                if (i < itemsToSend.length - 1) {
                    const nextItem = itemsToSend[i + 1];
                    const nextDelay = getRandomDelay(2000, 3000, lastSubsequentDelayMs);
                    lastSubsequentDelayMs = nextDelay;
                    (0, utils_js_1.log)('CAMPAIGN', `⏳ Waiting ${(nextDelay / 1000).toFixed(3)}s (${nextDelay}ms) before item ${i + 2} (${nextItem})...`);
                    if (nextItem === 'audio') {
                        try {
                            await sock.sendPresenceUpdate('recording', sender);
                        }
                        catch (e) { }
                    }
                    await (0, utils_js_1.sleep)(nextDelay);
                }
            }
            catch (itemErr) {
                (0, utils_js_1.errLog)('CAMPAIGN', `Error sending item "${item}":`, itemErr.message);
                allSuccessful = false;
                await (0, db_js_1.addMessageLog)({
                    id: (0, uuid_1.v4)(),
                    campaignId: campaign.id,
                    phoneNumber: sender,
                    contactName: pushName,
                    messageType: item,
                    fileUrl: '',
                    status: 'failed',
                    errorMessage: itemErr.message || 'Unknown error',
                    sentAt: new Date().toISOString(),
                });
            }
        }
        // Reset any old inbound replies so the follow-up timer starts clean from this auto-campaign
        await (0, db_js_1.clearContactInboundReplies)(campaign.id, sender);
        // Mark user as contacted (records sentAt = now)
        await (0, db_js_1.markAsContacted)({
            id: (0, uuid_1.v4)(),
            campaignId: campaign.id,
            phoneNumber: sender,
            contactName: pushName,
            sentAt: new Date().toISOString(),
            status: allSuccessful || deliveredCount > 0 ? 'sent' : 'failed',
        });
        // Increment sent count
        await (0, db_js_1.incrementCampaignSentCount)(campaign.id);
        (0, utils_js_1.log)('CAMPAIGN', `✅ Delivery completed for ${sender}. Follow-up timer is now ON (Step 1 in 2 mins if no reply).`);
    }
    catch (err) {
        (0, utils_js_1.errLog)('CAMPAIGN', 'Exception in processIncomingMessage:', err.message);
    }
    finally {
        activeAutoReplySet.delete(deliveryKey);
    }
}
