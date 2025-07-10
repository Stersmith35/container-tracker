// js/script.js — Container Tracker with Proper Auth Guard

// ─── Firebase references (from app.html) ─────────────────────────────
const auth = firebase.auth();
const db   = firebase.firestore();

// ─── Auth guard & app initialization ────────────────────────────────
auth.onAuthStateChanged(async user => {
  if (!user) {
    // not signed in → kick back to login
    window.location.href = 'login.html';
    return;
  }

  // ─── 1) Load per-user containers ─────────────────────────────────
  let containers = [];
  try {
    console.log('User signed in:', user.uid);
    const snap = await db
      .collection('users').doc(user.uid)
      .collection('containers')
      .get();
    snap.forEach(doc => containers.push(doc.data()));
    console.log(`  → Loaded ${containers.length} containers`);
  } catch (err) {
    console.error('Error loading containers:', err);
  }

  // ─── 2) Render all categories ────────────────────────────────────
  window.containers = containers;  // make it global for renderList to see
  renderAll();

  // ─── 3) Init the date‐picker ────────────────────────────────────
  if (typeof flatpickr !== 'undefined') {
    flatpickr('#eta', { dateFormat:'d/m/Y', allowInput:true, clickOpens:true });
  }

  // ─── 4) Wire up “Add Container” form ───────────────────────────
  const form = document.getElementById('container-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const num = document.getElementById('container-number').value;
    const eta = document.getElementById('eta').value;
    const job = document.getElementById('job-ref').value;

    containers.push({
      containerNumber: num,
      etaDisplay:      eta,
      etaISO:          parseInputDate(eta),
      jobRef:          job,
      claimed:         false,
      onHold:          false
    });

    // Save back into the same per-user path
    try {
      const batch = db.batch();
      const col = db
        .collection('users').doc(user.uid)
        .collection('containers');
      // wipe & re-add
      const existing = await col.get();
      existing.forEach(d => batch.delete(d.ref));
      containers.forEach(c => batch.set(col.doc(c.containerNumber), c));
      await batch.commit();
      console.log(`  → Saved ${containers.length} containers`);
    } catch (err) {
      console.error('Error saving containers:', err);
    }

    renderAll();
    form.reset();
    if (typeof flatpickr !== 'undefined') {
      flatpickr('#eta', { dateFormat:'d/m/Y', allowInput:true, clickOpens:true });
    }
  });

  // ─── 5) Wire up logout ───────────────────────────────────────────
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());
});

// ─── Date helpers & category checks — UNCHANGED ─────────────────────
function parseInputDate(input) { /* … */ }
function parseISODate(iso)    { /* … */ }
function startOfDay(dt)       { /* … */ }
function isLate(iso)          { /* … */ }
function isDueToday(iso)      { /* … */ }
function isDueTomorrow(iso)   { /* … */ }
function isDueThisWeek(iso)   { /* … */ }
function isUpcoming(iso)      { /* … */ }

// ─── Rendering functions — UNCHANGED ───────────────────────────────
function renderList(filterFn, containerId) { /* … */ }
function updateSectionVisibility() { /* … */ }
function renderAll() { /* … */ }
