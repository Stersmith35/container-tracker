// ─── In-Memory & Persistence ─────────────────────────────────────────
let containers = [];

// Load the containers from Firestore
async function loadContainers() {
  containers = [];  // reset array
  const snapshot = await db.collection('containers').get();
  snapshot.forEach(doc => {
    containers.push(doc.data());
  });
}

// Save the current containers array to Firestore
async function saveContainers() {
  const batch = db.batch();
  const colRef = db.collection('containers');
  // Remove all existing docs then re-add
  const existing = await colRef.get();
  existing.forEach(doc => batch.delete(doc.ref));
  containers.forEach(c => {
    const docRef = colRef.doc();
    batch.set(docRef, c);
  });
  await batch.commit();
}

// ─── Date Parsing & Category Checks ──────────────────────────────────
function parseInputDate(input) {
  const [d, m, y] = input.split('/');
  return `${y}-${m}-${d}`;
}
function parseISODate(iso) {
  const [y, m, d] = iso.split('-');
  return new Date(y, m - 1, d);
}
function startOfDay(dt) {
  const d = new Date(dt);
  d.setHours(0, 0, 0, 0);
  return d;
}
function isLate(iso) {
  return startOfDay(parseISODate(iso)) < startOfDay(new Date());
}
function isDueToday(iso) {
  return startOfDay(parseISODate(iso)).getTime() === startOfDay(new Date()).getTime();
}
function isDueTomorrow(iso) {
  const t = startOfDay(new Date()); t.setDate(t.getDate() + 1);
  return startOfDay(parseISODate(iso)).getTime() === t.getTime();
}
function isDueThisWeek(iso) {
  const today = startOfDay(new Date());
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - today.getDay())); end.setHours(23, 59, 59, 999);
  const etaTime = startOfDay(parseISODate(iso)).getTime();
  return etaTime > today.getTime() + 86400000 && etaTime <= end.getTime();
}
function isUpcoming(iso) {
  const today = startOfDay(new Date());
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - today.getDay())); end.setHours(23, 59, 59, 999);
  return startOfDay(parseISODate(iso)).getTime() > end.getTime();
}

// ─── Rendering ────────────────────────────────────────────────────────
function renderList(filterFn, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  // Group items by jobRef+etaISO
  const groups = containers
    .map((c, idx) => ({ c, idx }))
    .filter(({ c }) => filterFn(c.etaISO))
    .reduce((acc, { c, idx }) => {
      const key = `${c.jobRef}|${c.etaISO}`;
      if (!acc[key]) {
        acc[key] = { jobRef: c.jobRef, etaDisplay: c.etaDisplay, etaISO: c.etaISO, items: [], onHold: !!c.onHold };
      }
      acc[key].items.push({ data: c, index: idx });
      if (c.onHold) acc[key].onHold = true;
      return acc;
    }, {});

  Object.values(groups).forEach(group => {
    const box = document.createElement('div');
    box.className = 'group-container';

    // Header
    const hdr = document.createElement('h3');
    hdr.textContent = `Job Ref: ${group.jobRef} — ETA: ${group.etaDisplay}`;
    if (group.onHold) {
      const spanHold = document.createElement('span');
      spanHold.className = 'hold-label'; spanHold.textContent = ' ON HOLD';
      hdr.appendChild(spanHold);
    }
    box.appendChild(hdr);

    const ul = document.createElement('ul');
    group.items.forEach(({ data: c, index: i }) => {
      const li = document.createElement('li');
      // Claimed label before number
      if (c.claimed) {
        const spanClaim = document.createElement('span');
        spanClaim.className = 'claimed-label'; spanClaim.textContent = 'CLAIMED';
        li.appendChild(spanClaim);
      }
      li.appendChild(document.createTextNode(` ${c.containerNumber} `));

      // Update ETA
      const btnU = document.createElement('button'); btnU.textContent = 'Update ETA';
      btnU.addEventListener('click', async () => {
        const newEta = prompt('Enter new ETA (DD/MM/YYYY):', c.etaDisplay);
        if (!newEta || !/^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/.test(newEta)) return alert('Cancelled or invalid format.');
        containers[i].etaDisplay = newEta; containers[i].etaISO = parseInputDate(newEta);
        await saveContainers(); renderAll();
      }); li.appendChild(btnU);

      // Claim/Unclaim
      const btnClaim = document.createElement('button');
      btnClaim.textContent = c.claimed ? 'Unclaim' : 'Claim'; btnClaim.className = c.claimed ? 'btn-unclaim' : 'btn-claim';
      btnClaim.addEventListener('click', async () => {
        containers[i].claimed = !containers[i].claimed;
        await saveContainers(); renderAll();
      }); li.appendChild(btnClaim);

      // Cleared
      const btnC = document.createElement('button'); btnC.textContent = 'Clear'; btnC.className = 'btn-clear';
      btnC.addEventListener('click', async () => {
        if (!confirm('Remove container?')) return;
        containers.splice(i,1); await saveContainers(); renderAll();
      }); li.appendChild(btnC);

      // On Hold
      const btnHold = document.createElement('button');
      btnHold.textContent = group.onHold ? 'Hold Cleared' : 'On Hold';
      btnHold.className = group.onHold ? 'btn-hold-cleared' : 'btn-on-hold';
      btnHold.addEventListener('click', async () => {
        const newHold = !group.onHold;
        containers.forEach(c0 => { if (c0.jobRef===group.jobRef && c0.etaISO===group.etaISO) c0.onHold = newHold; });
        await saveContainers(); renderAll();
      }); li.appendChild(btnHold);

      ul.appendChild(li);
    });
    box.appendChild(ul);
    container.appendChild(box);
  });
}

function updateSectionVisibility() {
  [['late-containers','late-list'],['due-today','due-today-list'],['due-tomorrow','due-tomorrow-list'],['due-this-week','due-this-week-list'],['upcoming','upcoming-list']]
    .forEach(([sec,lst]) => {
      const s=document.getElementById(sec),has=document.getElementById(lst).children.length>0;
      if(s) s.style.display=has?'block':'none';
    });
}

function renderAll() {
  renderList(isLate,'late-list');
  renderList(isDueToday,'due-today-list');
  renderList(isDueTomorrow,'due-tomorrow-list');
  renderList(isDueThisWeek,'due-this-week-list');
  renderList(isUpcoming,'upcoming-list');
  updateSectionVisibility();
}

// ─── Initialization & Form Handling ───────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadContainers();
  renderAll();
  flatpickr('#eta',{dateFormat:'d/m/Y',allowInput:true,clickOpens:true});

  const form = document.getElementById('container-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const num = document.getElementById('container-number').value;
    const eta = document.getElementById('eta').value;
    const job = document.getElementById('job-ref').value;

    containers.push({containerNumber:num,etaDisplay:eta,etaISO:parseInputDate(eta),jobRef:job,claimed:false,onHold:false});
    await saveContainers();
    renderAll();
    form.reset();
  });
});
// Initialize Firestore and/or fallback to localStorage
let containers = [];
const hasFirestore = typeof db !== 'undefined';

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

async function saveContainers() {
  if (hasFirestore) {
    const batch = db.batch();
    const colRef = db.collection('containers');
    const existing = await colRef.get();
    existing.forEach(doc => batch.delete(doc.ref));
    containers.forEach(c => batch.set(colRef.doc(c.containerNumber), c));
    await batch.commit();
  }
  localStorage.setItem('containers', JSON.stringify(containers));
}

// All other functions unchanged...

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  await loadContainers();
  renderAll();

  // Re-init Flatpickr
  if (typeof flatpickr !== 'undefined') {
    flatpickr('#eta', { dateFormat: 'd/m/Y', allowInput: true, clickOpens: true });
  }

  // Form handler
  const form = document.getElementById('container-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const num = document.getElementById('container-number').value;
    const eta = document.getElementById('eta').value;
    const job = document.getElementById('job-ref').value;
    containers.push({ containerNumber: num, etaDisplay: eta, etaISO: parseInputDate(eta), jobRef: job, claimed: false, onHold: false });
    await saveContainers();
    renderAll();
    form.reset();
    // Re-init Flatpickr on new field
    if (typeof flatpickr !== 'undefined') flatpickr('#eta', { dateFormat: 'd/m/Y', allowInput: true, clickOpens: true });
  });
});
