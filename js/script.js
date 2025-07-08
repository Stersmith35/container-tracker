// ─── Firebase Auth Guard & App Init ──────────────────────────────
// Assumes compat SDKs for firebase-app, auth, firestore are loaded before this script

// Initialize Firebase Auth and Firestore globals
const auth = firebase.auth();
const db   = firebase.firestore();

// In-memory container list
let containers = [];
const hasFirestore = true;  // always use Firestore for persistence

// Auth state guard
auth.onAuthStateChanged(user => {
  if (!user) {
    // No user: redirect to login
    window.location.href = 'login.html';
  } else {
    // User signed in: proceed with app startup
    document.addEventListener('DOMContentLoaded', () => initApp());
  }
});

// Main app initialization
async function initApp() {
  // 1. Load containers from Firestore or localStorage
  await loadContainers();
  // 2. Render all categories
  renderAll();
  // 3. Initialize datepicker
  if (typeof flatpickr !== 'undefined') {
    flatpickr('#eta', { dateFormat: 'd/m/Y', allowInput: true, clickOpens: true });
  }
  // 4. Form submission
  const form = document.getElementById('container-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const num  = document.getElementById('container-number').value;
    const eta  = document.getElementById('eta').value;
    const job  = document.getElementById('job-ref').value;
    containers.push({ containerNumber: num, etaDisplay: eta, etaISO: parseInputDate(eta), jobRef: job, claimed: false, onHold: false });
    await saveContainers();
    renderAll();
    form.reset();
    if (typeof flatpickr !== 'undefined') flatpickr('#eta', { dateFormat: 'd/m/Y', allowInput: true, clickOpens: true });
  });
}

// Load all containers from Firestore (root) or fallback to localStorage
async function loadContainers() {
  containers = [];
  if (hasFirestore) {
    const snapshot = await db.collection('containers').get();
    snapshot.forEach(doc => containers.push(doc.data()));
  } else {
    const raw = localStorage.getItem('containers');
    if (raw) containers = JSON.parse(raw);
  }
}

// Save containers to Firestore (root) and localStorage
async function saveContainers() {
  if (hasFirestore) {
    const batch = db.batch();
    const colRef = db.collection('containers');
    const existing = await colRef.get();
    existing.forEach(doc => batch.delete(doc.ref));
    containers.forEach(c => batch.set(colRef.doc(), c));
    await batch.commit();
  }
  localStorage.setItem('containers', JSON.stringify(containers));
}

// Date parsing/helpers unchanged...
function parseInputDate(input) { const [d,m,y]=input.split('/'); return `${y}-${m}-${d}`; }
function parseISODate(iso) { const [y,m,d]=iso.split('-'); return new Date(y,m-1,d); }
function startOfDay(dt) { const d=new Date(dt); d.setHours(0,0,0,0); return d; }
function isLate(iso) { return startOfDay(parseISODate(iso))<startOfDay(new Date()); }
function isDueToday(iso) { return startOfDay(parseISODate(iso)).getTime()===startOfDay(new Date()).getTime(); }
function isDueTomorrow(iso) { const t=startOfDay(new Date()); t.setDate(t.getDate()+1); return startOfDay(parseISODate(iso)).getTime()===t.getTime(); }
function isDueThisWeek(iso) { const today=startOfDay(new Date()),end=new Date(today); end.setDate(end.getDate()+(6-today.getDay())); end.setHours(23,59,59,999); const eta=startOfDay(parseISODate(iso)).getTime(); return eta>today.getTime()+86400000&&eta<=end.getTime(); }
function isUpcoming(iso) { const today=startOfDay(new Date()),end=new Date(today); end.setDate(end.getDate()+(6-today.getDay())); end.setHours(23,59,59,999); return startOfDay(parseISODate(iso)).getTime()>end.getTime(); }

// Rendering functions unchanged...
function renderList(filterFn, containerId) { /* existing code */ }
function updateSectionVisibility() { /* existing code */ }
function renderAll() { renderList(isLate,'late-list'); renderList(isDueToday,'due-today-list'); renderList(isDueTomorrow,'due-tomorrow-list'); renderList(isDueThisWeek,'due-this-week-list'); renderList(isUpcoming,'upcoming-list'); updateSectionVisibility(); }
