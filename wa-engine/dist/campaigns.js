"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchCampaign = matchCampaign;
exports.processIncomingMessage = processIncomingMessage;
const uuid_1 = require("uuid");
const db_js_1 = require("./db.js");
const fileSender_js_1 = require("./fileSender.js");
const utils_js_1 = require("./utils.js");
function cleanForMatching(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[?!.,;:_~#*+\-\[\]\(\)\/\\"]/g, ' ')
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
    // 1. Smart Keyword Matching (punctuation-resilient, whitespace-normalized)
    for (const campaign of activeCampaigns) {
        if (!campaign.keywords || !campaign.keywords.trim())
            continue;
        const keywords = campaign.keywords
            .split(',')
            .map((k) => cleanForMatching(k))
            .filter(Boolean);
        for (const kw of keywords) {
            if (cleanedText.includes(kw) || kw.includes(cleanedText)) {
                (0, utils_js_1.log)('CAMPAIGN', `[Acc: ${accountId || 'all'}] Matched keyword "${kw}" for campaign: "${campaign.name}" (incoming: "${messageText}")`);
                return campaign;
            }
        }
    }
    // 2. Fallback to default campaign if set
    const defaultCamp = activeCampaigns.find((c) => c.isDefault);
    if (defaultCamp) {
        (0, utils_js_1.log)('CAMPAIGN', `[Acc: ${accountId || 'all'}] Using default fallback campaign: "${defaultCamp.name}"`);
        return defaultCamp;
    }
    (0, utils_js_1.log)('CAMPAIGN', `[Acc: ${accountId || 'all'}] Message "${messageText}" does not match any keyword. No auto-reply.`);
    return null;
}
async function processIncomingMessage(sock, sender, pushName, messageText, accountId) {
    try {
        const campaign = await matchCampaign(messageText, accountId);
        if (!campaign) {
            (0, utils_js_1.log)('CAMPAIGN', `[Acc: ${accountId || 'all'}] No matching campaign keyword for message: "${messageText}". Ignoring.`);
            return;
        }
        (0, utils_js_1.log)('CAMPAIGN', `🚀 [Acc: ${accountId || 'all'}] Triggered by keyword! Starting delivery for ${sender} (${pushName}) -> Campaign: "${campaign.name}"`);
        const orderList = campaign.sendOrder
            .split(',')
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
        let allSuccessful = true;
        for (const item of orderList) {
            try {
                let sent = false;
                if (item === 'message' && campaign.welcomeMessage && campaign.welcomeMessage.trim()) {
                    await (0, fileSender_js_1.sendTextMessage)(sock, sender, campaign.welcomeMessage.trim());
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
                    sent = true;
                }
                else if (item === 'image' && campaign.imageUrl && campaign.imageUrl.trim()) {
                    await (0, fileSender_js_1.sendImageMessage)(sock, sender, campaign.imageUrl.trim());
                    const cleanLogUrl = campaign.imageUrl.startsWith('data:') ? 'photo.jpg' : campaign.imageUrl.trim();
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
                    sent = true;
                }
                else if (item === 'video' && campaign.videoUrl && campaign.videoUrl.trim()) {
                    await (0, fileSender_js_1.sendVideoMessage)(sock, sender, campaign.videoUrl.trim());
                    const cleanLogUrl = campaign.videoUrl.startsWith('data:') ? 'video.mp4' : campaign.videoUrl.trim();
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
                    sent = true;
                }
                else if (item === 'audio' && campaign.audioUrl && campaign.audioUrl.trim()) {
                    await (0, fileSender_js_1.sendAudioMessage)(sock, sender, campaign.audioUrl.trim());
                    const cleanLogUrl = campaign.audioUrl.startsWith('data:') ? 'voice_note.mp3' : campaign.audioUrl.trim();
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
                    sent = true;
                }
                else if (item === 'document' && campaign.documentUrl && campaign.documentUrl.trim()) {
                    const docName = campaign.documentName || 'Document';
                    await (0, fileSender_js_1.sendDocumentMessage)(sock, sender, campaign.documentUrl.trim(), docName);
                    const cleanLogUrl = campaign.documentUrl.startsWith('data:') ? docName : campaign.documentUrl.trim();
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
                    sent = true;
                }
                if (sent && campaign.delayBetweenSends > 0) {
                    (0, utils_js_1.log)('CAMPAIGN', `Waiting ${campaign.delayBetweenSends}s before next item...`);
                    await (0, utils_js_1.sleep)(campaign.delayBetweenSends * 1000);
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
        // Mark user as contacted (One-time guarantee!)
        await (0, db_js_1.markAsContacted)({
            id: (0, uuid_1.v4)(),
            campaignId: campaign.id,
            phoneNumber: sender,
            contactName: pushName,
            sentAt: new Date().toISOString(),
            status: allSuccessful ? 'sent' : 'failed',
        });
        // Increment sent count
        await (0, db_js_1.incrementCampaignSentCount)(campaign.id);
        (0, utils_js_1.log)('CAMPAIGN', `✅ Delivery completed for ${sender}. Marked as contacted.`);
    }
    catch (err) {
        (0, utils_js_1.errLog)('CAMPAIGN', 'Exception in processIncomingMessage:', err.message);
    }
}
