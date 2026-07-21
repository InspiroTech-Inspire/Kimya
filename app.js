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

    // Modal
    els.clearModal = document.getElementById('clear-modal');
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
    document.getElementById('import-file').addEventListener('change', importData);
    document.getElementById('clear-btn').addEventListener('click', confirmClear);
    document.getElementById('cancel-clear').addEventListener('click', closeModal);
    document.getElementById('confirm-clear').addEventListener('click', clearAllData);

    // Modal overlay click
    els.clearModal.addEventListener('click', (e) => {
        if (e.target === els.clearModal) closeModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
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
            </div>
            <div class="item-body rich-render">${sermon.notes}</div>
            <div class="item-actions">
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
            </div>
            <div class="item-body" style="font-style: italic; margin-bottom: 0.75rem;">"${escapeHtml(verse.text)}"</div>
            ${verse.note ? `<div class="item-body" style="font-size: 0.9rem; color: var(--text-secondary); border-left: 3px solid var(--accent); padding-left: 1rem;">${escapeHtml(verse.note)}</div>` : ''}
            <div class="item-actions">
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
            </div>
            <div class="item-body">${escapeHtml(prayer.text)}</div>
            <div class="item-actions">
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

function renderJournal() {
    if (store.journal.length === 0) {
        els.journalList.innerHTML = emptyState('📝', 'No journal entries yet. Write your first reflection above.');
        return;
    }

    els.journalList.innerHTML = store.journal.map(entry => `
        <div class="item">
            <div class="item-header">
                <div class="item-meta">${formatDateTime(entry.createdAt)}</div>
            </div>
            <div class="item-body">${escapeHtml(entry.text)}</div>
            <div class="item-actions">
                <button class="btn btn-sm btn-secondary" onclick="deleteJournal(${entry.id})">Delete</button>
            </div>
        </div>
    `).join('');
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
        // Enter key handling - ensure paragraphs instead of divs
        if (e.key === 'Enter' && !e.shiftKey) {
            // Let default behavior happen, but clean up on input
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
    // Clean up empty paragraphs and normalize
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