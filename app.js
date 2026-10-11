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

// ========== Autosave Draft Keys ==========
const DRAFT_KEYS = {
    journal: 'kimya-draft-journal',
    sermon: 'kimya-draft-sermon',
    verse: 'kimya-draft-verse',
    prayer: 'kimya-draft-prayer'
};
let autosaveTimeout;
let editingState = { id: null, type: null }; // Tracks if we are editing an existing item

// ========== DOM Elements Cache ==========
const els = {};

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    loadData();
    setTodayDate();
    bindEvents();
    initRichEditor();
    initAutosave();
    renderAll();
    applyTheme();
    initServiceWorker();
});

function cacheElements() {
    els.navBtns = document.querySelectorAll('.nav-btn');
    els.sections = document.querySelectorAll('.section');
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
    els.profileName = document.getElementById('profile-name');
    els.profileEmail = document.getElementById('profile-email');
    els.profileBio = document.getElementById('profile-bio');
    els.notifSermon = document.getElementById('notif-sermon');
    els.notifVerse = document.getElementById('notif-verse');
    els.notifPrayer = document.getElementById('notif-prayer');
    els.themeSelect = document.getElementById('theme-select');
    els.journalList = document.getElementById('journal-list');
    els.sermonList = document.getElementById('sermon-list');
    els.verseList = document.getElementById('verse-list');
    els.prayerList = document.getElementById('prayer-list');
    els.clearModal = document.getElementById('clear-modal');
    els.shareModal = document.getElementById('share-modal');
    els.shareCanvas = document.getElementById('share-canvas');
    els.toast = document.getElementById('toast');
    els.searchInput = document.getElementById('global-search');
    els.autosaveStatus = document.getElementById('autosave-status');
}

function bindEvents() {
    els.navBtns.forEach(btn => btn.addEventListener('click', () => showSection(btn.dataset.section)));
    
    document.getElementById('save-journal').addEventListener('click', saveJournal);
    document.getElementById('save-sermon').addEventListener('click', saveSermon);
    document.getElementById('save-verse').addEventListener('click', saveVerse);
    document.getElementById('save-prayer').addEventListener('click', savePrayer);
    
    document.getElementById('cancel-edit-journal').addEventListener('click', cancelEdit);
    document.getElementById('cancel-edit-sermon').addEventListener('click', cancelEdit);
    document.getElementById('cancel-edit-verse').addEventListener('click', cancelEdit);
    document.getElementById('cancel-edit-prayer').addEventListener('click', cancelEdit);
    
    [els.profileName, els.profileEmail, els.profileBio, els.notifSermon, els.notifVerse, els.notifPrayer, els.themeSelect].forEach(el => {
        el.addEventListener('change', saveProfile);
    });
    
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('restore-btn').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', (e) => importData(e.target));
    document.getElementById('clear-btn').addEventListener('click', confirmClear);
    document.getElementById('cancel-clear').addEventListener('click', closeModal);
    document.getElementById('confirm-clear').addEventListener('click', clearAllData);
    
    els.clearModal.addEventListener('click', (e) => { if (e.target === els.clearModal) closeModal(); });
    
    document.getElementById('share-close').addEventListener('click', closeShareModal);
    document.getElementById('share-download').addEventListener('click', downloadShareCard);
    document.getElementById('share-native').addEventListener('click', shareShareCard);
    els.shareModal.addEventListener('click', (e) => { if (e.target === els.shareModal) closeShareModal(); });
    
    if (!navigator.share) {
        const nativeBtn = document.getElementById('share-native');
        if (nativeBtn) nativeBtn.style.display = 'none';
    }
    
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeShareModal(); } });
    
    if (els.searchInput) els.searchInput.addEventListener('input', (e) => filterCurrentSection(e.target.value));
    
    document.addEventListener('input', handleAutosaveInput);
    document.addEventListener('change', handleAutosaveInput);
}

// ========== Edit Mode Management ==========
function enableEditMode(type, id) {
    editingState = { id, type };
    const saveBtn = document.getElementById(`save-${type}`);
    const cancelBtn = document.getElementById(`cancel-edit-${type}`);
    if (saveBtn) {
        saveBtn.textContent = 'Update Entry';
        saveBtn.classList.add('btn-update');
    }
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    
    const form = saveBtn?.closest('.card');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
    editingState = { id: null, type: null };
    ['journal', 'sermon', 'verse', 'prayer'].forEach(type => {
        const saveBtn = document.getElementById(`save-${type}`);
        const cancelBtn = document.getElementById(`cancel-edit-${type}`);
        if (saveBtn) {
            saveBtn.classList.remove('btn-update');
            const defaults = { journal: 'Save Entry', sermon: 'Save Sermon Note', verse: 'Save Verse', prayer: 'Save Prayer' };
            saveBtn.textContent = defaults[type];
        }
        if (cancelBtn) cancelBtn.classList.add('hidden');
    });
    resetSermonForm(); resetVerseForm(); resetPrayerForm();
    els.journalEntry.value = '';
    Object.values(DRAFT_KEYS).forEach(key => localStorage.removeItem(key));
}

// ========== Autosave Engine ==========
function initAutosave() {
    ['journal', 'sermon', 'verse', 'prayer'].forEach(loadDraft);
}

function handleAutosaveInput(e) {
    const target = e.target;
    let draftKey = null;
    if (target === els.journalEntry) draftKey = 'journal';
    else if ([els.sermonDate, els.sermonPreacher, els.sermonTopic, els.sermonNotes].includes(target)) draftKey = 'sermon';
    else if ([els.verseRef, els.verseText, els.verseNote].includes(target)) draftKey = 'verse';
    else if ([els.prayerName, els.prayerText, els.prayerStatus].includes(target)) draftKey = 'prayer';
    
    if (draftKey) {
        showAutosaveStatus('saving');
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(() => {
            saveDraft(draftKey);
            showAutosaveStatus('saved');
        }, 800);
    }
}

function saveDraft(key) {
    let data = {};
    if (key === 'journal') data.text = els.journalEntry.value;
    else if (key === 'sermon') {
        data.date = els.sermonDate.value; data.preacher = els.sermonPreacher.value;
        data.topic = els.sermonTopic.value; data.notes = getRichContent('sermon-notes');
    } else if (key === 'verse') {
        data.ref = els.verseRef.value; data.text = els.verseText.value; data.note = els.verseNote.value;
    } else if (key === 'prayer') {
        data.name = els.prayerName.value; data.text = els.prayerText.value; data.status = els.prayerStatus.value;
    }
    localStorage.setItem(DRAFT_KEYS[key], JSON.stringify(data));
}

function loadDraft(key) {
    const raw = localStorage.getItem(DRAFT_KEYS[key]);
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        if (key === 'journal') els.journalEntry.value = data.text || '';
        else if (key === 'sermon') {
            if (data.date) els.sermonDate.value = data.date;
            if (data.preacher) els.sermonPreacher.value = data.preacher;
            if (data.topic) els.sermonTopic.value = data.topic;
            if (data.notes) setRichContent('sermon-notes', data.notes);
        } else if (key === 'verse') {
            if (data.ref) els.verseRef.value = data.ref;
            if (data.text) els.verseText.value = data.text;
            if (data.note) els.verseNote.value = data.note;
        } else if (key === 'prayer') {
            if (data.name) els.prayerName.value = data.name;
            if (data.text) els.prayerText.value = data.text;
            if (data.status) els.prayerStatus.value = data.status;
        }
    } catch (e) {}
}

function clearDraft(key) { localStorage.removeItem(DRAFT_KEYS[key]); }

function showAutosaveStatus(state) {
    if (!els.autosaveStatus) return;
    if (state === 'saving') {
        els.autosaveStatus.textContent = 'Saving draft...';
        els.autosaveStatus.className = 'autosave-status saving';
    } else {
        els.autosaveStatus.textContent = '✓ Draft saved';
        els.autosaveStatus.className = 'autosave-status saved';
        setTimeout(() => { els.autosaveStatus.textContent = ''; els.autosaveStatus.className = 'autosave-status'; }, 2000);
    }
}

// ========== Global Search Filter ==========
function filterCurrentSection(query) {
    const activeSection = document.querySelector('.section.active');
    if (!activeSection) return;
    const q = query.toLowerCase().trim();
    const items = activeSection.querySelectorAll('.item');
    let visibleCount = 0;
    
    items.forEach(item => {
        if (!q || item.textContent.toLowerCase().includes(q)) {
            item.style.display = ''; visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    const listContainer = activeSection.querySelector('.item-list');
    if (!listContainer) return;
    let noResultsEl = listContainer.querySelector('.no-results');
    if (q && visibleCount === 0) {
        if (!noResultsEl) {
            noResultsEl = document.createElement('div');
            noResultsEl.className = 'empty-state no-results';
            noResultsEl.innerHTML = '<div class="empty-state-icon">🔍</div><p>No results found.</p>';
            listContainer.appendChild(noResultsEl);
        }
        noResultsEl.style.display = 'block';
    } else if (noResultsEl) {
        noResultsEl.style.display = 'none';
    }
    const emptyState = listContainer.querySelector('.empty-state:not(.no-results)');
    if (emptyState) emptyState.style.display = q ? 'none' : '';
}

// ========== Bible Reference Linker ==========
function linkifyBible(text) {
    if (!text) return '';
    const books = '(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation)';
    const regex = new RegExp(`\\b(${books}\\s\\d+:\\d+(?:-\\d+)?)\\b`, 'gi');
    return text.replace(regex, (match) => {
        const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(match)}`;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="bible-link">${match}</a>`;
    });
}

// ========== Navigation ==========
function showSection(sectionId) {
    els.sections.forEach(s => s.classList.remove('active'));
    els.navBtns.forEach(b => b.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    if (els.searchInput) els.searchInput.value = '';
    filterCurrentSection('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== Data Management ==========
function loadData() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) Object.assign(store, JSON.parse(data));
    } catch (e) { console.error('Failed to load data:', e); }
    els.profileName.value = store.profile.name || '';
    els.profileEmail.value = store.profile.email || '';
    els.profileBio.value = store.profile.bio || '';
    els.notifSermon.checked = store.profile.notifications?.sermon || false;
    els.notifVerse.checked = store.profile.notifications?.verse || false;
    els.notifPrayer.checked = store.profile.notifications?.prayer || false;
    els.themeSelect.value = store.profile.theme || 'light';
}

function saveToStorage() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } 
    catch (e) { showToast('Storage error: Data may be too large'); }
}

function setTodayDate() { els.sermonDate.value = new Date().toISOString().split('T')[0]; }

// ========== Sermons ==========
function saveSermon() {
    const date = els.sermonDate.value, preacher = els.sermonPreacher.value.trim();
    const topic = els.sermonTopic.value.trim(), notes = getRichContent('sermon-notes').trim();
    if (!topic || !notes) { showToast('Please fill in the topic and notes'); return; }
    
    if (editingState.id && editingState.type === 'sermon') {
        const idx = store.sermons.findIndex(s => s.id === editingState.id);
        if (idx !== -1) store.sermons[idx] = { ...store.sermons[idx], date, preacher, topic, notes, updatedAt: new Date().toISOString() };
        cancelEdit();
    } else {
        store.sermons.unshift({ id: Date.now(), date, preacher, topic, notes, createdAt: new Date().toISOString() });
    }
    saveToStorage(); renderSermons(); renderStats(); resetSermonForm(); clearDraft('sermon');
    showToast(editingState.id ? 'Sermon note updated' : 'Sermon note saved');
}

function editSermon(id) {
    const s = store.sermons.find(x => x.id === id); if (!s) return;
    showSection('sermons');
    els.sermonDate.value = s.date; els.sermonPreacher.value = s.preacher;
    els.sermonTopic.value = s.topic; setRichContent('sermon-notes', s.notes);
    enableEditMode('sermon', id);
}

function resetSermonForm() { els.sermonPreacher.value = ''; els.sermonTopic.value = ''; clearRichContent('sermon-notes'); setTodayDate(); }
function deleteSermon(id) { store.sermons = store.sermons.filter(s => s.id !== id); saveToStorage(); renderSermons(); renderStats(); showToast('Sermon deleted'); }
function shareSermon(id) {
    const s = store.sermons.find(x => x.id === id); if (!s) return;
    openShareCard({ kind: 'sermon', title: s.topic, subtitle: [formatDate(s.date), s.preacher].filter(Boolean).join('  •  '), body: s.notes, date: formatDate(s.createdAt) });
}
function renderSermons() {
    if (store.sermons.length === 0) { els.sermonList.innerHTML = emptyState('📖', 'No sermon notes yet.'); return; }
    els.sermonList.innerHTML = store.sermons.map(s => `
        <div class="item">
            <div class="item-header">
                <div><div class="item-title">${escapeHtml(s.topic)}</div><div class="item-meta">${formatDate(s.date)} ${s.preacher ? '• ' + escapeHtml(s.preacher) : ''}</div></div>
                <button class="item-collapse-btn" onclick="toggleItemCollapse(this)" aria-expanded="false" title="Show more"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
            </div>
            <div class="item-body collapsed rich-render">${linkifyBible(s.notes)}</div>
            <div class="item-actions">
                <button class="btn btn-sm btn-secondary" onclick="editSermon(${s.id})">Edit</button>
                <button class="btn btn-sm btn-secondary" onclick="shareSermon(${s.id})">Share</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteSermon(${s.id})">Delete</button>
            </div>
        </div>`).join('');
}

// ========== Verses ==========
function saveVerse() {
    const ref = els.verseRef.value.trim(), text = els.verseText.value.trim(), note = els.verseNote.value.trim();
    if (!ref || !text) { showToast('Please fill in the reference and verse text'); return; }
    
    if (editingState.id && editingState.type === 'verse') {
        const idx = store.verses.findIndex(v => v.id === editingState.id);
        if (idx !== -1) store.verses[idx] = { ...store.verses[idx], ref, text, note, updatedAt: new Date().toISOString() };
        cancelEdit();
    } else {
        store.verses.unshift({ id: Date.now(), ref, text, note, createdAt: new Date().toISOString() });
    }
    saveToStorage(); renderVerses(); renderStats(); resetVerseForm(); clearDraft('verse');
    showToast(editingState.id ? 'Verse updated' : 'Verse saved');
}

function editVerse(id) {
    const v = store.verses.find(x => x.id === id); if (!v) return;
    showSection('verses');
    els.verseRef.value = v.ref; els.verseText.value = v.text; els.verseNote.value = v.note;
    enableEditMode('verse', id);
}

function resetVerseForm() { els.verseRef.value = ''; els.verseText.value = ''; els.verseNote.value = ''; }
function deleteVerse(id) { store.verses = store.verses.filter(v => v.id !== id); saveToStorage(); renderVerses(); renderStats(); showToast('Verse deleted'); }
function shareVerse(id) {
    const v = store.verses.find(x => x.id === id); if (!v) return;
    openShareCard({ kind: 'verse', title: v.ref, subtitle: v.note || '', body: v.text, date: formatDate(v.createdAt) });
}
function renderVerses() {
    if (store.verses.length === 0) { els.verseList.innerHTML = emptyState('✨', 'No favourite verses yet.'); return; }
    els.verseList.innerHTML = store.verses.map(v => `
        <div class="item">
            <div class="item-header">
                <div><div class="item-title">${escapeHtml(v.ref)}</div></div>
                <button class="item-collapse-btn" onclick="toggleItemCollapse(this)" aria-expanded="false" title="Show more"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
            </div>
            <div class="item-body collapsed">
                <div style="font-style: italic; margin-bottom: 0.75rem;">"${linkifyBible(escapeHtml(v.text))}"</div>
                ${v.note ? `<div style="font-size: 0.9rem; color: var(--text-secondary); border-left: 3px solid var(--accent); padding-left: 1rem;">${linkifyBible(escapeHtml(v.note))}</div>` : ''}
            </div>
            <div class="item-actions">
                <button class="btn btn-sm btn-secondary" onclick="editVerse(${v.id})">Edit</button>
                <button class="btn btn-sm btn-secondary" onclick="shareVerse(${v.id})">Share</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteVerse(${v.id})">Delete</button>
            </div>
        </div>`).join('');
}

// ========== Prayers ==========
function savePrayer() {
    const name = els.prayerName.value.trim(), text = els.prayerText.value.trim(), status = els.prayerStatus.value;
    if (!name || !text) { showToast('Please fill in the prayer name and text'); return; }
    
    if (editingState.id && editingState.type === 'prayer') {
        const idx = store.prayers.findIndex(p => p.id === editingState.id);
        if (idx !== -1) store.prayers[idx] = { ...store.prayers[idx], name, text, status, updatedAt: new Date().toISOString() };
        cancelEdit();
    } else {
        store.prayers.unshift({ id: Date.now(), name, text, status, createdAt: new Date().toISOString() });
    }
    saveToStorage(); renderPrayers(); renderStats(); resetPrayerForm(); clearDraft('prayer');
    showToast(editingState.id ? 'Prayer updated' : 'Prayer saved');
}

function editPrayer(id) {
    const p = store.prayers.find(x => x.id === id); if (!p) return;
    showSection('prayers');
    els.prayerName.value = p.name; els.prayerText.value = p.text; els.prayerStatus.value = p.status;
    enableEditMode('prayer', id);
}

function resetPrayerForm() { els.prayerName.value = ''; els.prayerText.value = ''; els.prayerStatus.value = 'active'; }
function deletePrayer(id) { store.prayers = store.prayers.filter(p => p.id !== id); saveToStorage(); renderPrayers(); renderStats(); showToast('Prayer deleted'); }
function sharePrayer(id) {
    const p = store.prayers.find(x => x.id === id); if (!p) return;
    openShareCard({ kind: 'prayer', title: p.name, subtitle: 'Prayer  •  ' + p.status, body: p.text, date: formatDate(p.createdAt) });
}
function renderPrayers() {
    if (store.prayers.length === 0) { els.prayerList.innerHTML = emptyState('🙏', 'No prayers saved yet.'); return; }
    els.prayerList.innerHTML = store.prayers.map(p => `
        <div class="item">
            <div class="item-header">
                <div><div class="item-title">${escapeHtml(p.name)}</div><div class="item-meta"><span class="badge ${p.status}">${p.status}</span><span>${formatDate(p.createdAt)}</span></div></div>
                <button class="item-collapse-btn" onclick="toggleItemCollapse(this)" aria-expanded="false" title="Show more"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
            </div>
            <div class="item-body collapsed">${linkifyBible(escapeHtml(p.text))}</div>
            <div class="item-actions">
                <button class="btn btn-sm btn-secondary" onclick="editPrayer(${p.id})">Edit</button>
                <button class="btn btn-sm btn-secondary" onclick="sharePrayer(${p.id})">Share</button>
                <button class="btn btn-sm btn-secondary" onclick="deletePrayer(${p.id})">Delete</button>
            </div>
        </div>`).join('');
}

// ========== Journal ==========
function saveJournal() {
    const text = els.journalEntry.value.trim();
    if (!text) { showToast('Please write something first'); return; }
    
    if (editingState.id && editingState.type === 'journal') {
        const idx = store.journal.findIndex(j => j.id === editingState.id);
        if (idx !== -1) store.journal[idx] = { ...store.journal[idx], text, updatedAt: new Date().toISOString() };
        cancelEdit();
    } else {
        store.journal.unshift({ id: Date.now(), text, createdAt: new Date().toISOString() });
    }
    saveToStorage(); renderJournal(); renderStats(); els.journalEntry.value = ''; clearDraft('journal');
    showToast(editingState.id ? 'Entry updated' : 'Entry saved');
}

function editJournal(id) {
    const j = store.journal.find(x => x.id === id); if (!j) return;
    showSection('journal');
    els.journalEntry.value = j.text;
    enableEditMode('journal', id);
}

function deleteJournal(id) { store.journal = store.journal.filter(j => j.id !== id); saveToStorage(); renderJournal(); renderStats(); showToast('Entry deleted'); }
function shareJournal(id) {
    const j = store.journal.find(x => x.id === id); if (!j) return;
    openShareCard({ kind: 'journal', title: 'Journal Entry', subtitle: formatDateTime(j.createdAt), body: j.text, date: formatDate(j.createdAt) });
}
function renderJournal() {
    if (store.journal.length === 0) { els.journalList.innerHTML = emptyState('📝', 'No journal entries yet.'); return; }
    els.journalList.innerHTML = store.journal.map(j => `
        <div class="item">
            <div class="item-header">
                <div class="item-meta">${formatDateTime(j.createdAt)}</div>
                <button class="item-collapse-btn" onclick="toggleItemCollapse(this)" aria-expanded="false" title="Show more"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
            </div>
            <div class="item-body collapsed">${linkifyBible(escapeHtml(j.text))}</div>
            <div class="item-actions">
                <button class="btn btn-sm btn-secondary" onclick="editJournal(${j.id})">Edit</button>
                <button class="btn btn-sm btn-secondary" onclick="shareJournal(${j.id})">Share</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteJournal(${j.id})">Delete</button>
            </div>
        </div>`).join('');
}

// ========== Stats Dashboard ==========
function renderStats() {
    const setStat = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setStat('stat-journal', store.journal.length);
    setStat('stat-sermons', store.sermons.length);
    setStat('stat-verses', store.verses.length);
    setStat('stat-answered', store.prayers.filter(p => p.status === 'answered').length);
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
    store.profile.name = els.profileName.value; store.profile.email = els.profileEmail.value; store.profile.bio = els.profileBio.value;
    store.profile.notifications.sermon = els.notifSermon.checked; store.profile.notifications.verse = els.notifVerse.checked; store.profile.notifications.prayer = els.notifPrayer.checked;
    store.profile.theme = els.themeSelect.value;
    saveToStorage(); applyTheme();
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
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `kimya-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('Backup downloaded');
}

function importData(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data && Array.isArray(data.sermons) && Array.isArray(data.verses) && Array.isArray(data.prayers) && Array.isArray(data.journal) && data.profile) {
                Object.assign(store, data); saveToStorage(); loadData(); renderAll(); showToast('Backup restored successfully');
            } else { throw new Error('Invalid structure'); }
        } catch (err) { showToast('Error: Invalid backup file'); }
        input.value = '';
    };
    reader.onerror = () => showToast('Error reading file');
    reader.readAsText(file);
}

function confirmClear() { els.clearModal.classList.add('active'); document.body.style.overflow = 'hidden'; }
function closeModal() { els.clearModal.classList.remove('active'); document.body.style.overflow = ''; }
function clearAllData() {
    localStorage.removeItem(STORAGE_KEY); Object.values(DRAFT_KEYS).forEach(key => localStorage.removeItem(key));
    store.sermons = []; store.verses = []; store.prayers = []; store.journal = [];
    store.profile = { name: '', email: '', bio: '', notifications: { sermon: false, verse: false, prayer: false }, theme: 'light' };
    loadData(); renderAll(); closeModal(); cancelEdit(); showToast('All data cleared');
}

// ========== Share Cards with Rich Text ==========
function openShareCard({ kind, title, subtitle, body, date }) {
    drawShareCard(els.shareCanvas, { kind, title, subtitle, body, date });
    els.shareModal.classList.add('active'); document.body.style.overflow = 'hidden';
}

function closeShareModal() { els.shareModal.classList.remove('active'); document.body.style.overflow = ''; }

function downloadShareCard() {
    els.shareCanvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `kimya-${Date.now()}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
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
            } else { showToast('Sharing not supported here — try Download Image'); }
        } catch (err) { if (err.name !== 'AbortError') showToast('Could not share'); }
    }, 'image/png');
}

function drawShareCard(canvas, { kind, title, subtitle, body, date }) {
    const W = 1080, H = 1350;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const palette = { bg: '#FDFCF8', bgAccent: '#F3F0EB', text: '#1C1917', textSecondary: '#78716C', accent: '#B45309', border: '#E7E5E4' };

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, palette.bg); grad.addColorStop(1, palette.bgAccent);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    const margin = 60, cardX = margin, cardY = margin, cardW = W - margin * 2, cardH = H - margin * 2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, cardX, cardY, cardW, cardH, 40); ctx.fill();
    
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = palette.border; ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, 40); ctx.stroke();

    const padX = cardX + 80;
    let cursorY = cardY + 100;

    ctx.fillStyle = palette.textSecondary; ctx.font = '600 24px -apple-system, "Segoe UI", sans-serif';
    ctx.fillText('KIMYA JOURNAL', padX, cursorY);
    cursorY += 60;

    const kindLabels = { sermon: 'SERMON NOTE', verse: 'BIBLE VERSE', prayer: 'PRAYER', journal: 'JOURNAL' };
    const label = kindLabels[kind] || 'ENTRY';
    ctx.fillStyle = palette.bgAccent;
    roundRect(ctx, padX, cursorY - 30, ctx.measureText(label).width + 40, 36, 18); ctx.fill();
    ctx.fillStyle = palette.accent; ctx.font = '700 22px -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(label, padX + 20, cursorY - 6);
    cursorY += 60;

    ctx.fillStyle = palette.text; ctx.font = '700 64px Georgia, "Times New Roman", serif';
    let titleLines = wrapCanvasText(ctx, title || 'Untitled', cardW - 160);
    if (titleLines.length > 3) { titleLines = titleLines.slice(0, 3); titleLines[2] = titleLines[2].replace(/\s+\S*$/, '') + '…'; }
    titleLines.forEach((l, i) => ctx.fillText(l, padX, cursorY + i * 72));
    cursorY += titleLines.length * 72 + 40;

    ctx.fillStyle = palette.accent; ctx.fillRect(padX, cursorY, 80, 6);
    cursorY += 50;

    if (subtitle) {
        ctx.fillStyle = palette.textSecondary; ctx.font = '400 32px -apple-system, "Segoe UI", sans-serif';
        const subLines = wrapCanvasText(ctx, subtitle, cardW - 160);
        subLines.forEach((l, i) => ctx.fillText(l, padX, cursorY + i * 44));
        cursorY += subLines.length * 44 + 40;
    }

    const bodyMaxWidth = cardW - 160;
    const maxBodyBottom = cardY + cardH - 140;
    
    ctx.fillStyle = palette.text;
    const defaultFont = kind === 'verse' 
        ? 'italic 500 40px Georgia, "Times New Roman", serif'
        : '400 36px -apple-system, "Segoe UI", sans-serif';
    const defaultLineHeight = kind === 'verse' ? 60 : 54;
    
    cursorY = renderRichTextToCanvas(ctx, body || '', padX, cursorY, bodyMaxWidth, maxBodyBottom, defaultFont, defaultLineHeight, palette);
    
    const footerY = cardY + cardH - 70;
    ctx.fillStyle = palette.textSecondary; ctx.font = '400 26px -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(date ? `${date}  •  Shared via Kimya` : 'Shared via Kimya', padX, footerY);
    
    ctx.fillStyle = palette.accent; ctx.globalAlpha = 0.08;
    ctx.beginPath(); ctx.arc(cardX + cardW, cardY, 150, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;
}

// ========== Rich Text Canvas Renderer ==========
function renderRichTextToCanvas(ctx, html, x, startY, maxWidth, maxY, defaultFont, defaultLineHeight, palette) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    let cursorY = startY;
    
    function renderNode(node, indent = 0) {
        if (cursorY > maxY) return;
        
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (!text) return;
            
            const lines = wrapCanvasText(ctx, text, maxWidth - indent);
            lines.forEach((line, i) => {
                if (cursorY > maxY) return;
                ctx.fillText(line, x + indent, cursorY);
                cursorY += defaultLineHeight;
            });
            return;
        }
        
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        
        const tagName = node.tagName.toLowerCase();
        let fontSize = 36;
        let fontWeight = '400';
        let fontStyle = '';
        let fontFamily = '-apple-system, "Segoe UI", sans-serif';
        let lineHeight = defaultLineHeight;
        let extraSpacing = 0;
        
        if (tagName === 'h1') {
            fontSize = 56; fontWeight = '700'; fontFamily = 'Georgia, "Times New Roman", serif'; lineHeight = 72; extraSpacing = 20;
        } else if (tagName === 'h2') {
            fontSize = 48; fontWeight = '700'; fontFamily = 'Georgia, "Times New Roman", serif'; lineHeight = 64; extraSpacing = 15;
        } else if (tagName === 'h3') {
            fontSize = 42; fontWeight = '600'; fontFamily = 'Georgia, "Times New Roman", serif'; lineHeight = 58; extraSpacing = 10;
        } else if (tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
            fontSize = 40; fontWeight = '600'; lineHeight = 56; extraSpacing = 8;
        } else if (tagName === 'strong' || tagName === 'b') {
            fontWeight = '700';
        } else if (tagName === 'em' || tagName === 'i') {
            fontStyle = 'italic';
        } else if (tagName === 'p') {
            extraSpacing = 15;
        } else if (tagName === 'br') {
            cursorY += lineHeight * 0.5;
            return;
        } else if (tagName === 'ul') {
            Array.from(node.children).forEach(li => {
                if (cursorY > maxY) return;
                ctx.fillText('•', x + indent, cursorY);
                renderNode(li, indent + 30);
            });
            cursorY += extraSpacing;
            return;
        } else if (tagName === 'ol') {
            let counter = 0;
            Array.from(node.children).forEach(li => {
                if (cursorY > maxY) return;
                counter++;
                ctx.fillText(`${counter}.`, x + indent, cursorY);
                renderNode(li, indent + 40);
            });
            cursorY += extraSpacing;
            return;
        } else if (tagName === 'li') {
            Array.from(node.childNodes).forEach(child => renderNode(child, indent));
            return;
        } else if (tagName === 'div') {
            extraSpacing = 10;
        }
        
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        
        Array.from(node.childNodes).forEach(child => {
            if (cursorY > maxY) return;
            renderNode(child, indent);
        });
        
        if (tagName === 'u') {
            const text = node.textContent;
            const lines = wrapCanvasText(ctx, text, maxWidth - indent);
            let underlineY = cursorY - lineHeight + fontSize * 0.15;
            lines.forEach(line => {
                const lineWidth = ctx.measureText(line).width;
                ctx.strokeStyle = palette.accent;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x + indent, underlineY);
                ctx.lineTo(x + indent + lineWidth, underlineY);
                ctx.stroke();
                underlineY += lineHeight;
            });
        }
        
        cursorY += extraSpacing;
        ctx.font = defaultFont;
    }
    
    ctx.font = defaultFont;
    Array.from(tempDiv.childNodes).forEach(node => renderNode(node, 0));
    
    return cursorY;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function wrapCanvasText(ctx, text, maxWidth) {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lines = []; let line = '';
    words.forEach(word => {
        const test = line ? line + ' ' + word : word;
        if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = word; } 
        else { line = test; }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
}

function stripHtml(html) { const div = document.createElement('div'); div.innerHTML = html || ''; return div.textContent || div.innerText || ''; }

// ========== Service Worker ==========
function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(reg => console.log('SW registered:', reg.scope)).catch(err => console.log('SW registration failed:', err));
    }
}

// ========== Utilities ==========
function renderAll() { renderSermons(); renderVerses(); renderPrayers(); renderJournal(); renderStats(); }
function emptyState(icon, text) { return `<div class="empty-state"> <div class="empty-state-icon">${icon}</div> <p>${text}</p> </div>`; }
function showToast(message) {
    els.toast.textContent = message; els.toast.classList.add('show');
    if (els.toast.timeout) clearTimeout(els.toast.timeout);
    els.toast.timeout = setTimeout(() => els.toast.classList.remove('show'), 3000);
}
function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function formatDate(dateStr) { if (!dateStr) return ''; const d = new Date(dateStr); return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
function formatDateTime(dateStr) { const d = new Date(dateStr); return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

// ========== Rich Text Editor ==========
function initRichEditor() {
    const editor = document.getElementById('sermon-notes'); if (!editor) return;
    const toolbar = editor.closest('.rich-editor')?.querySelector('.rich-toolbar'); if (!toolbar) return;
    
    toolbar.querySelectorAll('.rich-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cmd = btn.dataset.cmd;
            if (cmd === 'removeFormat') { document.execCommand('removeFormat', false, null); document.execCommand('formatBlock', false, 'P'); } 
            else { document.execCommand(cmd, false, null); }
            editor.focus(); updateToolbarState(toolbar, editor);
        });
    });
    
    editor.addEventListener('keyup', () => updateToolbarState(toolbar, editor));
    editor.addEventListener('mouseup', () => updateToolbarState(toolbar, editor));
    editor.addEventListener('click', () => updateToolbarState(toolbar, editor));
    
    editor.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold'); }
            if (e.key.toLowerCase() === 'i') { e.preventDefault(); document.execCommand('italic'); }
            if (e.key.toLowerCase() === 'u') { e.preventDefault(); document.execCommand('underline'); }
        }
    });
    
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
    });
    editor.addEventListener('input', () => { if (editor.innerHTML === '<br>') editor.innerHTML = ''; });
}

function updateToolbarState(toolbar, editor) {
    toolbar.querySelectorAll('.rich-btn').forEach(btn => {
        const cmd = btn.dataset.cmd; if (cmd === 'removeFormat') return;
        try { document.queryCommandState(cmd) ? btn.classList.add('active') : btn.classList.remove('active'); } 
        catch (e) { btn.classList.remove('active'); }
    });
}

function getRichContent(elementId) {
    const el = document.getElementById(elementId); if (!el) return '';
    let html = el.innerHTML.trim(); if (html === '<br>' || html === '<div><br></div>') return ''; return html;
}
function setRichContent(elementId, html) { const el = document.getElementById(elementId); if (el) el.innerHTML = html || ''; }
function clearRichContent(elementId) { const el = document.getElementById(elementId); if (el) el.innerHTML = ''; }

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
