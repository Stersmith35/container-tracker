// Combined and cleaned script.js with debugging logs

// ─── In-Memory & Persistence Setup ───────────────────────────────────
let containers = [];
const hasFirestore = typeof db !== 'undefined';

async function loadContainers() {
  containers = [];
  if (hasFirestore) {
    console.log('Loading from Firestore');
    const snapshot = await db.collection('containers').get();
    snapshot.forEach(doc => containers.push(doc.data()));
  } else {
    console.log('Loading from localStorage');
    const raw = localStorage.getItem('containers');
    if (raw) containers = JSON.parse(raw);
  }
}

async function saveContainers() {
  console.log('Saving containers, hasFirestore=', hasFirestore);
  if (hasFirestore) {
    const batch = db.batch();
    const colRef = db.collection('containers');
    const existing = await colRef.get();
    existing.forEach(doc => batch.delete(doc.ref));
    containers.forEach(c => batch.set(colRef.doc(c.containerNumber), c));
    await batch.commit();
    console.log('Firestore save complete');
  }
  localStorage.setItem('containers', JSON.stringify(containers));
  console.log('localStorage save complete');
}

// ─── Initialization & Binding ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, initializing');

  // Load & render
  try {
    await loadContainers();
    console.log('Loaded containers:', containers);
    renderAll();
  } catch (e) {
    console.error('Error loading containers:', e);
  }

  // Flatpickr init
  if (typeof flatpickr !== 'undefined') {
    console.log('Initializing flatpickr');
    flatpickr('#eta', { dateFormat: 'd/m/Y', allowInput: true, clickOpens: true });
  } else {
    console.warn('flatpickr is undefined');
  }

  // Form submit handler
  const form = document.getElementById('container-form');
  if (form) {
    form.addEventListener('submit', async e => {
      console.log('Form submitted');
      e.preventDefault();
      const num = document.getElementById('container-number').value;
      const eta = document.getElementById('eta').value;
      const job = document.getElementById('job-ref').value;

      containers.push({ containerNumber: num, etaDisplay: eta, etaISO: parseInputDate(eta), jobRef: job, claimed: false, onHold: false });
      console.log('New containers:', containers);
      try {
        await saveContainers();
      } catch (err) {
        console.error('Error saving containers:', err);
      }
      renderAll();
      form.reset();
      // Re-init Flatpickr in case the input was replaced
      if (typeof flatpickr !== 'undefined') {
        flatpickr('#eta', { dateFormat: 'd/m/Y', allowInput: true, clickOpens: true });
      }
    });
  } else {
    console.error('Form #container-form not found');
  }

});

// Note: renderList, renderAll, parsing and category functions remain unchanged
