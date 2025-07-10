

// Wait for auth state once, then bootstrap the app
firebase.auth().onAuthStateChanged(async user => {
if (!user) {
// Not authenticated → redirect to login
window\.location.href = 'login.html';
return;
}

// Authenticated: get Firestore reference

let containers = \[];

// ─── Load per-user containers ─────────────────────────────────────────
try {
console.log('User signed in:', user.uid);
const snap = await db.collection('users').doc(user.uid).collection('containers').get();
snap.forEach(doc => containers.push(doc.data()));
console.log(`  → Loaded ${containers.length} container(s)`);
} catch (err) {
console.error('Error loading containers:', err);
}

// ─── Render UI ────────────────────────────────────────────────────────
window\.containers = containers;  // make global for renderList
renderAll();

// ─── Initialize Flatpickr ────────────────────────────────────────────
if (typeof flatpickr !== 'undefined') {
flatpickr('#eta', { dateFormat: 'd/m/Y', allowInput: true, clickOpens: true });
}

// ─── Form submit handler ─────────────────────────────────────────────
const form = document.getElementById('container-form');
if (form) {
form.addEventListener('submit', async e => {
e.preventDefault();
const num = document.getElementById('container-number').value;
const eta = document.getElementById('eta').value;
const job = document.getElementById('job-ref').value;

```
  containers.push({
    containerNumber: num,
    etaDisplay:      eta,
    etaISO:          parseInputDate(eta),
    jobRef:          job,
    claimed:         false,
    onHold:          false
  });

  // Save updated list
  try {
    const batch = db.batch();
    const col = db.collection('users').doc(user.uid).collection('containers');
    const existing = await col.get();
    existing.forEach(d => batch.delete(d.ref));
    containers.forEach(c => batch.set(col.doc(c.containerNumber), c));
    await batch.commit();
    console.log(`  → Saved ${containers.length} container(s)`);
  } catch (err) {
    console.error('Error saving containers:', err);
  }

  renderAll();
  form.reset();
  if (typeof flatpickr !== 'undefined') {
    flatpickr('#eta', { dateFormat: 'd/m/Y', allowInput: true, clickOpens: true });
  }
});
```

}

// ─── Logout handler ──────────────────────────────────────────────────
const logoutBtn = document.getElementById('logout');
if (logoutBtn) logoutBtn.addEventListener('click', () => firebase.auth().signOut());
});

// ─── Persistence, Date & Rendering Helpers ─────────────────────────────────

async function saveContainers() {
// fallback: not used, save in handler above
}

function parseInputDate(input) {
const \[d, m, y] = input.split('/');
return `${y}-${m}-${d}`;
}
function parseISODate(iso) {
const \[y, m, d] = iso.split('-');
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
const t = startOfDay(new Date());
t.setDate(t.getDate() + 1);
return startOfDay(parseISODate(iso)).getTime() === t.getTime();
}
function isDueThisWeek(iso) {
const today = startOfDay(new Date());
const end   = new Date(today);
end.setDate(end.getDate() + (6 - today.getDay()));
end.setHours(23, 59, 59, 999);
const etaTime = startOfDay(parseISODate(iso)).getTime();
return etaTime > today.getTime() + 86400000 && etaTime <= end.getTime();
}
function isUpcoming(iso) {
const today = startOfDay(new Date());
const end   = new Date(today);
end.setDate(end.getDate() + (6 - today.getDay()));
end.setHours(23, 59, 59, 999);
return startOfDay(parseISODate(iso)).getTime() > end.getTime();
}

function renderList(filterFn, containerId) {
const container = document.getElementById(containerId);
container.innerHTML = '';
const groups = (window\.containers || \[]).map((c, idx) => ({ c, idx }))
.filter(({ c }) => filterFn(c.etaISO))
.reduce((acc, { c, idx }) => {
const key = `${c.jobRef}|${c.etaISO}`;
if (!acc\[key]) acc\[key] = { jobRef: c.jobRef, etaDisplay: c.etaDisplay, etaISO: c.etaISO, items: \[], onHold: !!c.onHold };
acc\[key].items.push({ data: c, index: idx });
if (c.onHold) acc\[key].onHold = true;
return acc;
}, {});
Object.values(groups).forEach(group => {
const box = document.createElement('div');
box.className = 'group-container';
const hdr = document.createElement('h3');
hdr.textContent = `Job Ref: ${group.jobRef} — ETA: ${group.etaDisplay}`;
if (group.onHold) {
const spanHold = document.createElement('span');
spanHold.className = 'hold-label';
spanHold.textContent = ' ON HOLD';
hdr.appendChild(spanHold);
}
box.appendChild(hdr);
const ul = document.createElement('ul');
group.items.forEach(({ data: c, index: i }) => {
const li = document.createElement('li');
if (c.claimed) {
const spanClaim = document.createElement('span');
spanClaim.className = 'claimed-label';
spanClaim.textContent = 'CLAIMED';
li.appendChild(spanClaim);
}
li.appendChild(document.createTextNode(`${c.containerNumber}`));
// Buttons (Update ETA, Claim, Clear, On Hold) go here…
ul.appendChild(li);
});
box.appendChild(ul);
container.appendChild(box);
});
}

function updateSectionVisibility() {
\[\['late-containers','late-list'],\['due-today','due-today-list'],\['due-tomorrow','due-tomorrow-list'],\['due-this-week','due-this-week-list'],\['upcoming','upcoming-list']]
.forEach((\[sec,lst]) => {
const section = document.getElementById(sec);
const hasItems = document.getElementById(lst).children.length > 0;
if (section) section.style.display = hasItems ? 'block' : 'none';
});
}

function renderAll() {
renderList(isLate,        'late-list');
renderList(isDueToday,    'due-today-list');
renderList(isDueTomorrow, 'due-tomorrow-list');
renderList(isDueThisWeek, 'due-this-week-list');
renderList(isUpcoming,    'upcoming-list');
updateSectionVisibility();
}
