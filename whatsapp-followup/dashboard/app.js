// State & Elements
let currentFilter = 'all';
let allMediaFiles = [];

// DOM Elements
const waStatusBadge = document.getElementById('waStatusBadge');
const waStatusText = document.getElementById('waStatusText');
const btnConnectWA = document.getElementById('btnConnectWA');
const qrSection = document.getElementById('qrSection');
const qrImage = document.getElementById('qrImage');

const statActiveLeads = document.getElementById('statActiveLeads');
const statTodaySent = document.getElementById('statTodaySent');
const statTodayReplies = document.getElementById('statTodayReplies');
const statManualTakeover = document.getElementById('statManualTakeover');

const toggleAutoFollowup = document.getElementById('toggle_auto_followup');
const toggleAiBrain = document.getElementById('toggle_ai_brain');
const toggleAntiban = document.getElementById('toggle_antiban');
const toggleAutoCleanup = document.getElementById('toggle_auto_cleanup');
const toggleGenderDetection = document.getElementById('toggle_gender_detection');

const inputApiKey = document.getElementById('inputApiKey');
const btnSaveKey = document.getElementById('btnSaveKey');
const inputStartHour = document.getElementById('inputStartHour');
const inputEndHour = document.getElementById('inputEndHour');
const inputDailyMax = document.getElementById('inputDailyMax');
const inputRollingDays = document.getElementById('inputRollingDays');
const btnSaveLimits = document.getElementById('btnSaveLimits');

const campaignStatusBanner = document.getElementById('campaignStatusBanner');
const campaignStatusTitle = document.getElementById('campaignStatusTitle');
const campaignStatusSub = document.getElementById('campaignStatusSub');
const campaignName = document.getElementById('campaignName');
const campaignFilesList = document.getElementById('campaignFilesList');
const campMinDelay = document.getElementById('campMinDelay');
const campMaxDelay = document.getElementById('campMaxDelay');
const campMinPeople = document.getElementById('campMinPeople');
const campMaxPeople = document.getElementById('campMaxPeople');
const campDuration = document.getElementById('campDuration');
const btnStartCampaign = document.getElementById('btnStartCampaign');
const btnStopCampaign = document.getElementById('btnStopCampaign');

const mediaGrid = document.getElementById('mediaGrid');
const btnUploadMedia = document.getElementById('btnUploadMedia');
const mediaUploadInput = document.getElementById('mediaUploadInput');
const leadsTableBody = document.getElementById('leadsTableBody');

// Fetch System Status
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    // 1. WhatsApp status
    const wa = data.whatsapp || {};
    waStatusBadge.className = `status-badge ${wa.status}`;
    if (wa.status === 'connected') {
      waStatusText.textContent = `কানেক্টেড (${wa.phoneNumber || ''})`;
      btnConnectWA.textContent = 'ডিসকানেক্ট';
      btnConnectWA.className = 'btn btn-danger btn-sm';
      qrSection.style.display = 'none';
    } else if (wa.status === 'qr_ready') {
      waStatusText.textContent = 'QR কোড স্ক্যান করুন';
      btnConnectWA.textContent = 'কানেক্ট করা হচ্ছে...';
      btnConnectWA.className = 'btn btn-secondary btn-sm';
      if (wa.qrCode) {
        qrImage.src = wa.qrCode;
        qrSection.style.display = 'block';
      }
    } else if (wa.status === 'connecting') {
      waStatusText.textContent = 'কানেক্টিং...';
      btnConnectWA.textContent = 'কানেক্ট হচ্ছে';
      btnConnectWA.className = 'btn btn-secondary btn-sm';
      qrSection.style.display = 'none';
    } else {
      waStatusText.textContent = 'ডিসকানেক্টেড';
      btnConnectWA.textContent = 'WhatsApp কানেক্ট';
      btnConnectWA.className = 'btn btn-primary btn-sm';
      qrSection.style.display = 'none';
    }

    // 2. Stats
    const stats = data.stats || {};
    statActiveLeads.textContent = stats.activeLeads || 0;
    statTodaySent.textContent = stats.todaySent || 0;
    statTodayReplies.textContent = stats.todayReplies || 0;
    statManualTakeover.textContent = stats.manualTakeover || 0;

    // 3. Campaign status
    const camp = data.campaign || {};
    if (camp.isRunning) {
      campaignStatusBanner.className = 'campaign-banner running';
      campaignStatusTitle.textContent = `🟢 ক্যাম্পেইন চলছে: "${camp.campaign?.name || ''}"`;
      campaignStatusSub.textContent = `মোট পাঠানো হয়েছে: ${camp.campaign?.totalSent || 0} জন | ব্যাচ সম্পন্ন: ${camp.campaign?.batchesCompleted || 0}`;
      btnStartCampaign.style.display = 'none';
      btnStopCampaign.style.display = 'block';
    } else {
      campaignStatusBanner.className = 'campaign-banner stopped';
      campaignStatusTitle.textContent = '⚪ কোনো ক্যাম্পেইন চলছে না';
      campaignStatusSub.textContent = 'নতুন ক্যাম্পেইন শুরু করতে নিচের ফর্ম পূরণ করুন';
      btnStartCampaign.style.display = 'block';
      btnStopCampaign.style.display = 'none';
    }
  } catch (err) {
    console.error('Status fetch error:', err);
  }
}

// Fetch Settings
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    const s = data.settings || {};

    toggleAutoFollowup.checked = Boolean(s.auto_followup);
    toggleAiBrain.checked = Boolean(s.ai_brain);
    toggleAntiban.checked = Boolean(s.antiban);
    toggleAutoCleanup.checked = Boolean(s.auto_cleanup);
    toggleGenderDetection.checked = Boolean(s.gender_detection);

    if (s.gemini_api_key) inputApiKey.value = s.gemini_api_key;
    if (s.working_hours_start) inputStartHour.value = s.working_hours_start;
    if (s.working_hours_end) inputEndHour.value = s.working_hours_end;
    if (s.max_daily_messages) inputDailyMax.value = s.max_daily_messages;
    if (s.rolling_days) inputRollingDays.value = s.rolling_days;
  } catch (err) {
    console.error('Settings fetch error:', err);
  }
}

// Toggle Handler
async function updateToggle(key, value) {
  try {
    await fetch('/api/settings/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
  } catch (err) {
    alert('টগল সেভ করতে সমস্যা হয়েছে: ' + err.message);
  }
}

// Attach toggle event listeners
toggleAutoFollowup.addEventListener('change', (e) => updateToggle('auto_followup', e.target.checked));
toggleAiBrain.addEventListener('change', (e) => updateToggle('ai_brain', e.target.checked));
toggleAntiban.addEventListener('change', (e) => updateToggle('antiban', e.target.checked));
toggleAutoCleanup.addEventListener('change', (e) => updateToggle('auto_cleanup', e.target.checked));
toggleGenderDetection.addEventListener('change', (e) => updateToggle('gender_detection', e.target.checked));

// Save API Key
btnSaveKey.addEventListener('click', async () => {
  const key = inputApiKey.value.trim();
  await updateToggle('gemini_api_key', key);
  alert('Gemini API Key সফলভাবে সেভ হয়েছে!');
});

// Save Limits
btnSaveLimits.addEventListener('click', async () => {
  await updateToggle('working_hours_start', inputStartHour.value);
  await updateToggle('working_hours_end', inputEndHour.value);
  await updateToggle('max_daily_messages', inputDailyMax.value);
  await updateToggle('rolling_days', inputRollingDays.value);
  alert('কাজের সময় ও লিমিট আপডেট করা হয়েছে!');
});

// WhatsApp Connect / Disconnect Action
btnConnectWA.addEventListener('click', async () => {
  const isConnected = waStatusBadge.classList.contains('connected');
  const endpoint = isConnected ? '/api/whatsapp/disconnect' : '/api/whatsapp/connect';
  try {
    await fetch(endpoint, { method: 'POST' });
    fetchStatus();
  } catch (err) {
    alert('অ্যাকশন সম্পন্ন করা যায়নি: ' + err.message);
  }
});

// Fetch Media Vault
async function fetchMedia() {
  try {
    const res = await fetch('/api/media');
    const data = await res.json();
    allMediaFiles = data.media || [];

    // Render Media Grid
    mediaGrid.innerHTML = '';
    if (allMediaFiles.length === 0) {
      mediaGrid.innerHTML = '<p class="text-muted">কোনো মিডিয়া ফাইল পাওয়া যায়নি। "+ নতুন ফাইল আপলোড" বাটনে ক্লিক করুন।</p>';
    } else {
      allMediaFiles.forEach((m) => {
        const card = document.createElement('div');
        card.className = 'media-card';
        const badgeClass = m.media_type === 'audio' ? 'badge-audio' : m.media_type === 'image' ? 'badge-image' : 'badge-text';
        const typeLabel = m.media_type === 'audio' ? '🎙️ Audio' : m.media_type === 'image' ? '🖼️ Image' : '📝 Text';

        card.innerHTML = `
          <div>
            <span class="media-badge ${badgeClass}">${typeLabel}</span>
            <div class="media-name" title="${m.filename}">${m.filename}</div>
            <div class="media-meta">ব্যবহার হয়েছে: ${m.used_count || 0} বার</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="deleteMedia(${m.id})">মুছুন</button>
        `;
        mediaGrid.appendChild(card);
      });
    }

    // Render Campaign File Picker
    campaignFilesList.innerHTML = '';
    if (allMediaFiles.length === 0) {
      campaignFilesList.innerHTML = '<p class="text-muted">আগে মিডিয়া ভল্টে অডিও বা ছবি আপলোড করুন।</p>';
    } else {
      allMediaFiles.forEach((m) => {
        const item = document.createElement('label');
        item.className = 'file-check-item';
        const typeEmoji = m.media_type === 'audio' ? '🎙️' : m.media_type === 'image' ? '🖼️' : '📝';
        item.innerHTML = `
          <input type="checkbox" name="campFiles" value="${m.id}" data-type="${m.media_type}" data-path="${m.filepath}" data-filename="${m.filename}">
          <span>${typeEmoji} ${m.filename}</span>
        `;
        campaignFilesList.appendChild(item);
      });
    }
  } catch (err) {
    console.error('Media fetch error:', err);
  }
}

// Upload Media
btnUploadMedia.addEventListener('click', () => mediaUploadInput.click());
mediaUploadInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', 'general');

  try {
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.ok) {
      fetchMedia();
    } else {
      alert('আপলোড ব্যর্থ: ' + data.error);
    }
  } catch (err) {
    alert('আপলোড এরর: ' + err.message);
  }
  mediaUploadInput.value = '';
});

// Delete Media
window.deleteMedia = async function (id) {
  if (!confirm('আপনি কি নিশ্চিত এই ফাইলটি মুছে ফেলতে চান?')) return;
  try {
    await fetch(`/api/media/${id}`, { method: 'DELETE' });
    fetchMedia();
  } catch (err) {
    alert('মুছতে সমস্যা হয়েছে: ' + err.message);
  }
};

// Campaign Start / Stop
btnStartCampaign.addEventListener('click', async () => {
  const selectedCheckboxes = document.querySelectorAll('input[name="campFiles"]:checked');
  const selectedFiles = Array.from(selectedCheckboxes).map((cb) => ({
    id: cb.value,
    type: cb.dataset.type,
    filepath: cb.dataset.path,
    filename: cb.dataset.filename,
  }));

  const payload = {
    name: campaignName.value.trim() || 'Special Offer',
    selectedFiles,
    minDelay: Number(campMinDelay.value),
    maxDelay: Number(campMaxDelay.value),
    minPeople: Number(campMinPeople.value),
    maxPeople: Number(campMaxPeople.value),
    durationHours: Number(campDuration.value),
  };

  try {
    const res = await fetch('/api/campaign/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      alert('ক্যাম্পেইন সফলভাবে চালু হয়েছে!');
      fetchStatus();
    } else {
      alert('ক্যাম্পেইন শুরু করা যায়নি: ' + data.error);
    }
  } catch (err) {
    alert('ক্যাম্পেইন শুরু করতে সমস্যা: ' + err.message);
  }
});

btnStopCampaign.addEventListener('click', async () => {
  if (!confirm('আপনি কি ক্যাম্পেইন বন্ধ করতে চান?')) return;
  try {
    await fetch('/api/campaign/stop', { method: 'POST' });
    fetchStatus();
  } catch (err) {
    alert('ক্যাম্পেইন থামাতে সমস্যা: ' + err.message);
  }
});

// Fetch Leads Table
async function fetchLeads() {
  try {
    const res = await fetch(`/api/leads?filter=${currentFilter}`);
    const data = await res.json();
    const leads = data.leads || [];

    leadsTableBody.innerHTML = '';
    if (leads.length === 0) {
      leadsTableBody.innerHTML = '<tr><td colspan="8" class="text-muted" style="text-align: center; padding: 20px;">কোনো কাস্টমার পাওয়া যায়নি।</td></tr>';
      return;
    }

    leads.forEach((l) => {
      const tr = document.createElement('tr');
      let statusBadge = '';
      if (l.status === 'manual_takeover') statusBadge = '<span class="lead-status status-manual">🚨 ম্যানুয়াল চ্যাট</span>';
      else if (l.status === 'in_followup') statusBadge = '<span class="lead-status status-followup">অটো ফলো-আপ</span>';
      else if (l.status === 'promised') statusBadge = '<span class="lead-status status-promised">তারিখ দেওয়া</span>';
      else statusBadge = `<span class="lead-status status-archived">${l.status}</span>`;

      const honorific = l.gender === 'apu' ? 'আপু' : l.gender === 'vai' ? 'ভাইয়া' : 'আপনি';

      tr.innerHTML = `
        <td><strong>${l.phone}</strong></td>
        <td>${l.name || 'N/A'}</td>
        <td>${honorific}</td>
        <td>${statusBadge}</td>
        <td>ধাপ ${l.follow_up_step}</td>
        <td>${l.promise_date || '-'}</td>
        <td>${l.last_sent_at ? l.last_sent_at.substring(11, 16) : '-'}</td>
        <td>
          ${
            l.status === 'manual_takeover'
              ? `<button class="btn btn-secondary btn-sm" onclick="markLeadStatus('${l.phone}', 'closed')">ক্লোজ করুন</button>`
              : `<button class="btn btn-secondary btn-sm" onclick="markLeadStatus('${l.phone}', 'manual_takeover')">টেকওভার</button>`
          }
        </td>
      `;
      leadsTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error('Leads fetch error:', err);
  }
}

window.markLeadStatus = async function (phone, status) {
  try {
    await fetch('/api/leads/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, status }),
    });
    fetchLeads();
    fetchStatus();
  } catch (err) {
    alert('স্ট্যাটাস আপডেট হয়নি: ' + err.message);
  }
};

// Filter tab clicks
document.querySelectorAll('.filter-tabs .tab').forEach((tab) => {
  tab.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-tabs .tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    fetchLeads();
  });
});

// Initialization
fetchStatus();
fetchSettings();
fetchMedia();
fetchLeads();

// Periodic Pollers
setInterval(fetchStatus, 3000);
setInterval(fetchLeads, 10000);
