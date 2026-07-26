/* ========== Kimya App - Offline First Journal ========== */

// ========== Data Store ==========
const store = {
    sermons: [],
    verses: [],
    prayers: [],
    journal: [],
    profile: {
        name: '',
        email: '',
        bio: '',
        notifications: { sermon: false, verse: false, prayer: false },
        theme: 'light'
    }
};

const STORAGE_KEY = 'kimya-data';

// ========== DOM Elements Cache ==========
const els = {};

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    loadData();
    setTodayDate();
    bindEvents();
    initRichEditor();
    renderAll();
    applyTheme();
    initServiceWorker();
});

function cacheElements() {
    // Navigation
    els.navBtns = document.querySelectorAll('.nav-btn');
    els.sections = document.querySelectorAll('.section');

    // Forms
    els.journalEntry = document.getElementById('journal-entry');
    els.sermonDate = document.getElementById('sermon-date');
    els.sermonPreacher = document.getElementById('sermon-preacher');
    els.sermonTopic = document.getElementById('sermon-topic');
    els.sermonNotes = document.getElementById('sermon-notes');
    els.verseRef = document.getElementById('verse-ref');
    els.verseText = document.getElementById('verse-text');
    els.verseNote = document.getElementById('verse-note');
    els.prayerName = document.getElementById('prayer-name');
    els.prayerText = document.getElementById('prayer-text');
    els.prayerStatus = document.getElementById('prayer-status');

    // Profile
    els.profileName = document.getElementById('profile-name');
    els.profileEmail = document.getElementById('profile-email');
    els.profileBio = document.getElementById('profile-bio');
    els.notifSermon = document.getElementById('notif-sermon');
    els.notifVerse = document.getElementById('notif-verse');
    els.notifPrayer = document.getElementById('notif-prayer');
    els.themeSelect = document.getElementById('theme-select');

    // Lists
    els.journalList = document.getElementById('journal-list');
    els.sermonList = document.getElementById('sermon-list');
    els.verseList = document.getElementById('verse-list');
    els.prayerList = document.getElementById('prayer-list');

    // Modals
    els.clearModal = document.getElementById('clear-modal');
    els.shareModal = document.getElementById('share-modal');
    els.shareCanvas = document.getElementById('share-canvas');
    els.toast = document.getElementById('toast');
}

function bindEvents() {
    // Navigation
    els.navBtns.forEach(btn => {
        btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    // Save buttons
    document.getElementById('save-journal').addEventListener('click', saveJournal);
    document.getElementById('save-sermon').addEventListener('click', saveSermon);
    document.getElementById('save-verse').addEventListener('click', saveVerse);
    document.getElementById('save-prayer').addEventListener('click', savePrayer);

    // Profile
    [els.profileName, els.profileEmail, els.profileBio].forEach(el => {
        el.addEventListener('change', saveProfile);
    });
    [els.notifSermon, els.notifVerse, els.notifPrayer].forEach(el => {
        el.addEventListener('change', saveProfile);
    });
    els.themeSelect.addEventListener('change', saveProfile);

    // Data management
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('restore-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    // FIX: this used to pass the raw Event object into importData(), which
    // expected an <input>. importData() would then throw trying to read
    // .files off the Event, so Restore Backup silently failed. Passing
    // e.target (the actual <input>) fixes it.
    document.getElementById('import-file').addEventListener('change', (e) => importData(e.target));
    document.getElementById('clear-btn').addEventListener('click', confirmClear);
    document.getElementById('cancel-clear').addEventListener('click', closeModal);
    document.getElementById('confirm-clear').addEventListener('click', clearAllData);

    // Modal overlay click
    els.clearModal.addEventListener('click', (e) => {
        if (e.target === els.clearModal) closeModal();
    });

    // Share modal
    document.getElementById('share-close').addEventListener('click', closeShareModal);
    document.getElementById('share-download').addEventListener('click', downloadShareCard);
    document.getElementById('share-native').addEventListener('click', shareShareCard);
    els.shareModal.addEventListener('click', (e) => {
        if (e.target === els.shareModal) closeShareModal();
    });
    if (!navigator.share) {
        const nativeBtn = document.getElementById('share-native');
        if (nativeBtn) nativeBtn.style.display = 'none';
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeShareModal();
        }
    });
}

// ========== Navigation ==========
function showSection(sectionId) {
    els.sections.forEach(s => s.classList.remove('active'));
    els.navBtns.forEach(b => b.classList.remove('active'));

    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== Data Management ==========
function loadData() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            Object.assign(store, parsed);
        }
    } catch (e) {
        console.error('Failed to load data:', e);
    }

    // Populate profile fields
    els.profileName.value = store.profile.name || '';
    els.profileEmail.value = store.profile.email || '';
    els.profileBio.value = store.profile.bio || '';
    els.notifSermon.checked = store.profile.notifications?.sermon || false;
    els.notifVerse.checked = store.profile.notifications?.verse || false;
    els.notifPrayer.checked = store.profile.notifications?.prayer || false;
    els.themeSelect.value = store.profile.theme || 'light';
}

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
        showToast('Storage error: Data may be too large');
    }
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    els.sermonDate.value = today;
}

// ========== Sermons ==========
function saveSermon() {
    const date = els.sermonDate.value;
    const preacher = els.sermonPreacher.value.trim();
    const topic = els.sermonTopic.value.trim();
    const notes = getRichContent('sermon-notes').trim();

    if (!topic || !notes) {
        showToast('Please fill in the topic and notes');
        return;
    }

    store.sermons.unshift({
        id: Date.now(),
        date,
        preacher,
        topic,
        notes,
        createdAt: new Date().toISOString()
    });

    saveToStorage();
    renderSermons();
    resetSermonForm();
    showToast('Sermon note saved');
}

function resetSermonForm() {
    els.sermonPreacher.value = '';
    els.sermonTopic.value = '';
    clearRichContent('sermon-notes');
    setTodayDate();
}

function deleteSermon(id) {
    store.sermons = store.sermons.filter(s => s.id !== id);
    saveToStorage();
    renderSermons();
    showToast('Sermon deleted');
}

function shareSermon(id) {
    const sermon = store.sermons.find(s => s.id === id);
    if (!sermon) return;
    openShareCard({
        kind: 'sermon',
        title: sermon.topic,
        subtitle: [formatDate(sermon.date), sermon.preacher].filter(Boolean).join('  •  '),
        body: stripHtml(sermon.notes)
    });
}

function renderSermons() {
    if (store.sermons.length === 0) {
        els.sermonList.innerHTML = emptyState('📖', 'No sermon notes yet. Fill in the form above and save your first note.');
        return;
    }

    els.sermonList.innerHTML = store.sermons.map(sermon => `
        <div class="item">
            <div class="item-header">
                <div>
                    <div class="item-title">${escapeHtml(sermon.topic)}</div>
                    <div class="item-meta">${formatDate(sermon.date)} ${sermon.preacher ? '• ' + escapeHtml(sermon.preacher) : ''}</div>
                </div>
                <button class="item-collapse-btn" onclick="toggleItemCollapse(this)" aria-expanded="false" title="Show more">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
            </div>
            <div class="item-body collapsed rich-render">${sermon.notes}</div>
            <div class="item-actions">
                <button class="btn btn-sm btn-secondary" onclick="shareSermon(${sermon.id})">Share</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteSermon(${sermon.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// ========== Verses ==========
function saveVerse() {
    const ref = els.verseRef.value.trim();
    const text = els.verseText.value.trim();
    const note = els.verseNote.value.trim();

    if (!ref || !text) {
        showToast('Please fill in the reference and verse text');
        return;
    }

    store.verses.unshift({
        id: Date.now(),
        ref,
        text,
        note,
        createdAt: new Date().toISOString()
    });

    saveToStorage();
    renderVerses();
    resetVerseForm();
    showToast('Verse saved');
}

function resetVerseForm() {
    els.verseRef.value = '';
    els.verseText.value = '';
    els.verseNote.value = '';
}

function deleteVerse(id) {
    store.verses = store.verses.filter(v => v.id !== id);
    saveToStorage();
    renderVerses();
    showToast('Verse deleted');
}

function shareVerse(id) {
    const verse = store.verses.find(v => v.id === id);
    if (!verse) return;
    openShareCard({
        kind: 'verse',
        title: verse.ref,
        subtitle: verse.note || '',
        body: verse.text
    });
}

function renderVerses() {
    if (store.verses.length === 0) {
        els.verseList.innerHTML = emptyState('✨', 'No favourite verses yet. Save the verses that speak to you so they are always close.');
        return;
    }

    els.verseList.innerHTML = store.verses.map(verse => `
        <div class="item">
            <div class="item-header">
                <div>
                    <div class="item-title">${escapeHtml(verse.ref)}</div>
                </div>
                <button class="item-collapse-btn" onclick="toggleItemCollapse(this)" aria-expanded="false" title="Show more">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
            </div>
            <div class="item-body collapsed">
                <div style="font-style: italic; margin-bottom: 0.75rem;">"${escapeHtml(verse.text)}"</div>
                ${verse.note ? `<div style="font-size: 0.9rem; color: var(--text-secondary); border-left: 3px solid var(--accent); padding-left: 1rem;">${escapeHtml(verse.note)}</div>` : ''}
            </div>
            <div class="item-actions">
                <button class="btn btn-sm btn-secondary" onclick="shareVerse(${verse.id})">Share</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteVerse(${verse.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// ========== Prayers ==========
function savePrayer() {
    const name = els.prayerName.value.trim();
    const text = els.prayerText.value.trim();
    const status = els.prayerStatus.value;

    if (!name || !text) {
        showToast('Please fill in the prayer name and text');
        return;
    }

    store.prayers.unshift({
        id: Date.now(),
        name,
        text,
        status,
        createdAt: new Date().toISOString()
    });

    saveToStorage();
    renderPrayers();
    resetPrayerForm();
    showToast('Prayer saved');
}

function resetPrayerForm() {
    els.prayerName.value = '';
    els.prayerText.value = '';
    els.prayerStatus.value = 'active';
}

function deletePrayer(id) {
    store.prayers = store.prayers.filter(p => p.id !== id);
    saveToStorage();
    renderPrayers();
    showToast('Prayer deleted');
}

function sharePrayer(id) {
    const prayer = store.prayers.find(p => p.id === id);
    if (!prayer) return;
    openShareCard({
        kind: 'prayer',
        title: prayer.name,
        subtitle: 'Prayer  •  ' + prayer.status,
        body: prayer.text
    });
}

function renderPrayers() {
    if (store.prayers.length === 0) {
        els.prayerList.innerHTML = emptyState('🙏', 'No prayers saved yet. Give your first prayer a name above and save it here.');
        return;
    }

    els.prayerList.innerHTML = store.prayers.map(prayer => `
        <div class="item">
            <div class="item-header">
                <div>
                    <div class="item-title">${escapeHtml(prayer.name)}</div>
                    <div class="item-meta">
                        <span class="badge ${prayer.status}">${prayer.status}</span>
                        <span>${formatDate(prayer.createdAt)}</span>
                    </div>
                </div>
                <button class="item-collapse-btn" onclick="toggleItemCollapse(this)" aria-expanded="false" title="Show more">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
            </div>
            <div class="item-body collapsed">${escapeHtml(prayer.text)}</div>
            <div class="item-actions">
                <button class="btn btn-sm btn-secondary" onclick="sharePrayer(${prayer.id})">Share</button>
                <button class="btn btn-sm btn-secondary" onclick="deletePrayer(${prayer.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// ========== Journal ==========
function saveJournal() {
    const text = els.journalEntry.value.trim();

    if (!text) {
        showToast('Please write something first');
        return;
    }

    store.journal.unshift({
        id: Date.now(),
        text,
        createdAt: new Date().toISOString()
    });

    saveToStorage();
    renderJournal();
    els.journalEntry.value = '';
    showToast('Entry saved');
}

function deleteJournal(id) {
    store.journal = store.journal.filter(j => j.id !== id);
    saveToStorage();
    renderJournal();
    showToast('Entry deleted');
}

function shareJournal(id) {
    const entry = store.journal.find(j => j.id === id);
    if (!entry) return;
    openShareCard({
        kind: 'journal',
        title: 'Journal',
        subtitle: formatDateTime(entry.createdAt),
        body: entry.text
    });
}

function renderJournal() {
    if (store.journal.length === 0) {
        els.journalList.innerHTML = emptyState('📝', 'No journal entries yet. Write your first reflection above.');
        return;
    }

    els.journalList.innerHTML = store.journal.map(entry => `
        <div class="item">
            <div class="item-header">
                <div class="item-meta">${formatDateTime(entry.createdAt)}</div>
                <button class="item-collapse-btn" onclick="toggleItemCollapse(this)" aria-expanded="false" title="Show more">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
            </div>
            <div class="item-body collapsed">${escapeHtml(entry.text)}</div>
            <div class="item-actions">
                <button class="btn btn-sm btn-secondary" onclick="shareJournal(${entry.id})">Share</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteJournal(${entry.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// ========== Item Collapse ==========
function toggleItemCollapse(btn) {
    const item = btn.closest('.item');
    const body = item ? item.querySelector('.item-body') : null;
    if (!body) return;

    const isCollapsed = body.classList.toggle('collapsed');
    btn.classList.toggle('expanded', !isCollapsed);
    btn.setAttribute('aria-expanded', String(!isCollapsed));
    btn.title = isCollapsed ? 'Show more' : 'Show less';
}

// ========== Profile ==========
function saveProfile() {
    store.profile.name = els.profileName.value;
    store.profile.email = els.profileEmail.value;
    store.profile.bio = els.profileBio.value;
    store.profile.notifications.sermon = els.notifSermon.checked;
    store.profile.notifications.verse = els.notifVerse.checked;
    store.profile.notifications.prayer = els.notifPrayer.checked;
    store.profile.theme = els.themeSelect.value;

    saveToStorage();
    applyTheme();
}

function applyTheme() {
    const theme = store.profile.theme || 'light';
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (theme === 'dark' || (theme === 'system' && systemDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.querySelector('meta[name="theme-color"]').content = '#1a1816';
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.querySelector('meta[name="theme-color"]').content = '#f5f2ed';
    }
}

// ========== Backup & Restore ==========
function exportData() {
    const dataStr = JSON.stringify(store, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kimya-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup downloaded');
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (validateBackup(data)) {
                Object.assign(store, data);
                saveToStorage();
                loadData();
                renderAll();
                showToast('Backup restored successfully');
            } else {
                throw new Error('Invalid backup structure');
            }
        } catch (err) {
            showToast('Error: Invalid backup file');
        }
        input.value = '';
    };
    reader.onerror = () => showToast('Error reading file');
    reader.readAsText(file);
}

function validateBackup(data) {
    return data && 
           Array.isArray(data.sermons) && 
           Array.isArray(data.verses) && 
           Array.isArray(data.prayers) && 
           Array.isArray(data.journal) && 
           data.profile && typeof data.profile === 'object';
}

function confirmClear() {
    els.clearModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    els.clearModal.classList.remove('active');
    document.body.style.overflow = '';
}

function clearAllData() {
    localStorage.removeItem(STORAGE_KEY);
    store.sermons = [];
    store.verses = [];
    store.prayers = [];
    store.journal = [];
    store.profile = {
        name: '',
        email: '',
        bio: '',
        notifications: { sermon: false, verse: false, prayer: false },
        theme: 'light'
    };

    loadData();
    renderAll();
    closeModal();
    showToast('All data cleared');
}

// ========== Share Cards ==========
function openShareCard({ kind, title, subtitle, body }) {
    drawShareCard(els.shareCanvas, { kind, title, subtitle, body });
    els.shareModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeShareModal() {
    els.shareModal.classList.remove('active');
    document.body.style.overflow = '';
}

function downloadShareCard() {
    els.shareCanvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kimya-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Image saved');
    }, 'image/png');
}

function shareShareCard() {
    els.shareCanvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'kimya.png', { type: 'image/png' });
        try {
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Kimya', text: 'Shared from Kimya' });
            } else if (navigator.share) {
                await navigator.share({ title: 'Kimya', text: 'Shared from Kimya' });
            } else {
                showToast('Sharing not supported here — try Download Image');
            }
        } catch (err) {
            if (err.name !== 'AbortError') showToast('Could not share');
        }
    }, 'image/png');
}

function drawShareCard(canvas, { kind, title, subtitle, body }) {
    const W = 1080, H = 1350;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Fixed brand palette so shared cards look consistent regardless of the
    // in-app light/dark setting.
    const palette = {
        bg: '#f5f2ed',
        bg2: '#efe9df',
        surface: '#ffffff',
        text: '#2c2420',
        textSecondary: '#6b5e55',
        accent: '#8b7355',
        accentLight: '#a89070',
        border: '#e0d8d0'
    };

    const labels = {
        sermon: 'SERMON NOTE',
        verse: 'BIBLE VERSE',
        prayer: 'PRAYER',
        journal: 'JOURNAL'
    };

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, palette.bg);
    grad.addColorStop(1, palette.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Card surface
    const margin = 56;
    const cardX = margin, cardY = margin, cardW = W - margin * 2, cardH = H - margin * 2;
    ctx.fillStyle = palette.surface;
    roundRect(ctx, cardX, cardY, cardW, cardH, 32);
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, 32);
    ctx.stroke();

    const padX = cardX + 72;
    let cursorY = cardY + 110;

    // Kicker label
    ctx.fillStyle = palette.accent;
    ctx.font = '700 28px -apple-system, "Segoe UI", sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(labels[kind] || 'KIMYA', padX, cursorY);

    // Accent rule
    cursorY += 28;
    ctx.fillStyle = palette.accentLight;
    ctx.fillRect(padX, cursorY, 64, 5);
    cursorY += 70;

    // Title
    ctx.fillStyle = palette.text;
    ctx.font = '700 56px Georgia, "Times New Roman", serif';
    let titleLines = wrapCanvasText(ctx, title || 'Untitled', cardW - 144);
    if (titleLines.length > 3) {
        titleLines = titleLines.slice(0, 3);
        titleLines[2] = titleLines[2].replace(/\s+\S*$/, '') + '…';
    }
    titleLines.forEach((l, i) => ctx.fillText(l, padX, cursorY + i * 64));
    cursorY += titleLines.length * 64 + 8;

    // Subtitle
    if (subtitle) {
        ctx.fillStyle = palette.textSecondary;
        ctx.font = '400 32px -apple-system, "Segoe UI", sans-serif';
        ctx.fillText(subtitle, padX, cursorY);
        cursorY += 50;
    }

    cursorY += 30;

    // Decorative quote mark for verses
    if (kind === 'verse') {
        ctx.fillStyle = palette.border;
        ctx.font = '700 170px Georgia, serif';
        ctx.fillText('\u201C', padX - 12, cursorY + 100);
        cursorY += 90;
    }

    // Body text
    ctx.fillStyle = palette.text;
    ctx.font = kind === 'verse'
        ? 'italic 500 44px Georgia, "Times New Roman", serif'
        : '400 38px -apple-system, "Segoe UI", sans-serif';

    const bodyMaxWidth = cardW - 144;
    const lineHeight = kind === 'verse' ? 62 : 56;
    const maxBodyBottom = cardY + cardH - 130;
    const maxLines = Math.max(2, Math.floor((maxBodyBottom - cursorY) / lineHeight));

    let lines = wrapCanvasText(ctx, body || '', bodyMaxWidth);
    if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, '').replace(/[.,;:]?$/, '') + '\u2026';
    }
    lines.forEach((l, i) => ctx.fillText(l, padX, cursorY + i * lineHeight));

    // Footer / brand
    ctx.fillStyle = palette.accent;
    ctx.font = '700 34px Georgia, "Times New Roman", serif';
    ctx.fillText('Kimya', padX, cardY + cardH - 56);
    ctx.fillStyle = palette.textSecondary;
    ctx.font = '400 24px -apple-system, sans-serif';
    ctx.fillText('sermons, verses & prayers', padX + 130, cardY + cardH - 56);
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function wrapCanvasText(ctx, text, maxWidth) {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach(word => {
        const test = line ? line + ' ' + word : word;
        if (line && ctx.measureText(test).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
}

function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return div.textContent || div.innerText || '';
}

// ========== Service Worker ==========
function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW registration failed:', err));
    }
}

// ========== Utilities ==========
function renderAll() {
    renderSermons();
    renderVerses();
    renderPrayers();
    renderJournal();
}

function emptyState(icon, text) {
    return `
        <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <p>${text}</p>
        </div>
    `;
}

function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');

    // Clear existing timeout if any
    if (els.toast.timeout) clearTimeout(els.toast.timeout);

    els.toast.timeout = setTimeout(() => {
        els.toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });
}


// ========== Rich Text Editor ==========
function initRichEditor() {
    const editor = document.getElementById('sermon-notes');
    if (!editor) return;

    const toolbar = editor.closest('.rich-editor')?.querySelector('.rich-toolbar');
    if (!toolbar) return;

    // Toolbar button clicks
    toolbar.querySelectorAll('.rich-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cmd = btn.dataset.cmd;
            if (cmd === 'removeFormat') {
                document.execCommand('removeFormat', false, null);
                document.execCommand('formatBlock', false, 'P');
            } else {
                document.execCommand(cmd, false, null);
            }
            editor.focus();
            updateToolbarState(toolbar, editor);
        });
    });

    // Update toolbar state on selection change
    editor.addEventListener('keyup', () => updateToolbarState(toolbar, editor));
    editor.addEventListener('mouseup', () => updateToolbarState(toolbar, editor));
    editor.addEventListener('click', () => updateToolbarState(toolbar, editor));

    // Keyboard shortcuts
    editor.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key.toLowerCase()) {
                case 'b': e.preventDefault(); document.execCommand('bold'); break;
                case 'i': e.preventDefault(); document.execCommand('italic'); break;
                case 'u': e.preventDefault(); document.execCommand('underline'); break;
            }
        }
    });

    // Clean up pasted content
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
    });

    // Ensure paragraphs on input
    editor.addEventListener('input', () => {
        if (editor.innerHTML === '<br>') editor.innerHTML = '';
    });
}

function updateToolbarState(toolbar, editor) {
    toolbar.querySelectorAll('.rich-btn').forEach(btn => {
        const cmd = btn.dataset.cmd;
        if (cmd === 'removeFormat') return;
        try {
            if (document.queryCommandState(cmd)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        } catch (e) {
            btn.classList.remove('active');
        }
    });
}

function getRichContent(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return '';
    let html = el.innerHTML.trim();
    if (html === '<br>' || html === '<div><br></div>') return '';
    return html;
}

function setRichContent(elementId, html) {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = html || '';
}

function clearRichContent(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = '';
}
// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
