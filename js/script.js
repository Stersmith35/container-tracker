// js/script.js
// All container logic is gated behind a sign-in check.

firebase.auth().onAuthStateChanged(async user => {
  if (!user) {
    // Not signed in → back to login
    window.location.href = 'login.html';
    return;
  }

  // Signed in! Grab Firestore ref
  const db = firebase.firestore();
  console.log('✅ Authenticated as', user.uid);

  // In-memory container list
  let containers = [];

  // 1) Load this user’s containers
  try {
    const snap = await db
      .collection('users').doc(user.uid)
      .collection('containers')
      .get();
    snap.forEach(doc => containers.push(doc.data()));
    console.log(`  → Loaded ${containers.length} containers`);
  } catch (e) {
    console.error('Error loading containers:', e);
  }

  // 2) Render them
  window.containers = containers;
  renderAll();

  // 3) Init Flatpickr
  if (typeof flatpickr !== 'undefined') {
    flatpickr('#eta', { dateFormat: 'd/m/Y', allowInput: true, clickOpens: true });
  }

  // 4) Handle form submissions
  const form = document.getElementById('container-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const num = document.getElementById('container-number').value;
    const eta = document.getElementById('eta').value;
    const job = document.getElementById('job-ref').value;

    containers.push({ containerNumber: num, etaDisplay: eta, etaISO: parseInputDate(eta), jobRef: job, claimed: false, onHold: false });

    // Save back to Firestore
    try {
      const batch = db.batch();
      const col = db.collection('users').doc(user.uid).collection('containers');
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
    // re-init date picker
    if (typeof flatpickr !== 'undefined') {
      flatpickr('#eta', { dateFormat: 'd/m/Y', allowInput: true, clickOpens: true });
    }
  });

  // 5) Wire up logout
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => firebase.auth().signOut());
});

// ─── Shared helpers below ────────────────────────────────────────────

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
  d.setHours(0,0,0,0);
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
  end.setHours(23,59,59,999);
  const et = startOfDay(parseISODate(iso)).getTime();
  return et > today.getTime() + 86400000 && et <= end.getTime();
}
function isUpcoming(iso) {
  const today = startOfDay(new Date());
  const end   = new Date(today);
  end.setDate(end.getDate() + (6 - today.getDay()));
  end.setHours(23,59,59,999);
  return startOfDay(parseISODate(iso)).getTime() > end.getTime();
}

function renderList(filterFn, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const groups = (window.containers || []).map((c,i)=>({c,i}))
    .filter(({c})=>filterFn(c.etaISO))
    .reduce((acc,{c,i})=>{
      const key = `${c.jobRef}|${c.etaISO}`;
      if (!acc[key]) acc[key]={jobRef:c.jobRef,etaDisplay:c.etaDisplay,etaISO:c.etaISO,items:[],onHold:!!c.onHold};
      acc[key].items.push({data:c,index:i});
      if(c.onHold) acc[key].onHold=true;
      return acc;
    }, {});
  Object.values(groups).forEach(group=>{
    const box=document.createElement('div');box.className='group-container';
    const hdr=document.createElement('h3');hdr.textContent=`Job Ref: ${group.jobRef} — ETA: ${group.etaDisplay}`;
    if(group.onHold){
      const sp=document.createElement('span');sp.className='hold-label';sp.textContent=' ON HOLD';hdr.appendChild(sp);
    }
    box.appendChild(hdr);
    const ul=document.createElement('ul');
    group.items.forEach(({data:c,index:i})=>{
      const li=document.createElement('li');
      if(c.claimed){
        const sc=document.createElement('span');sc.className='claimed-label';sc.textContent='CLAIMED';li.appendChild(sc);
      }
      li.appendChild(document.createTextNode(` ${c.containerNumber} `));
      // … your Update, Claim, Clear, On Hold buttons here …
      ul.appendChild(li);
    });
    box.appendChild(ul);
    container.appendChild(box);
  });
}
function updateSectionVisibility() {
  [['late-containers','late-list'],['due-today','due-today-list'],['due-tomorrow','due-tomorrow-list'],['due-this-week','due-this-week-list'],['upcoming','upcoming-list']]
    .forEach(([sec,lst])=>{
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
