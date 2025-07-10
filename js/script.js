// js/script.js — Container Tracker App Logic with Buttons Restored

// Auth & Firestore references (initialized in app.html)

// Wait for auth state
firebase.auth().onAuthStateChanged(async user => {
if (!user) {
window\.location.href = 'login.html';
return;
}

const db = firebase.firestore();
console.log('Authenticated as', user.uid);

// In-memory containers list
let containers = \[];

// 1) Load this user’s containers
try {
const snap = await db.collection('users').doc(user.uid).collection('containers').get();
snap.forEach(doc => containers.push(doc.data()));
console.log(`Loaded ${containers.length} containers`);
} catch (e) {
console.error('Load error:', e);
}

// 2) Render
window\.containers = containers;
renderAll();

// 3) Date picker
if (typeof flatpickr !== 'undefined') {
flatpickr('#eta', { dateFormat: 'd/m/Y', allowInput: true, clickOpens: true });
}

// 4) Form handler
const form = document.getElementById('container-form');
if (form) {
form.addEventListener('submit', async e => {
e.preventDefault();
const num = document.getElementById('container-number').value;
const eta = document.getElementById('eta').value;
const job = document.getElementById('job-ref').value;

```
  containers.push({ containerNumber: num, etaDisplay: eta, etaISO: parseInputDate(eta), jobRef: job, claimed: false, onHold: false });

  // Save
  try {
    const batch = db.batch();
    const col = db.collection('users').doc(user.uid).collection('containers');
    const existing = await col.get();
    existing.forEach(d => batch.delete(d.ref));
    containers.forEach(c => batch.set(col.doc(c.containerNumber), c));
    await batch.commit();
  } catch (err) {
    console.error('Save error:', err);
  }

  renderAll();
  form.reset();
  if (typeof flatpickr !== 'undefined') flatpickr('#eta', { dateFormat: 'd/m/Y', allowInput: true, clickOpens: true });
});
```

}

// 5) Logout
const logoutBtn = document.getElementById('logout');
if (logoutBtn) logoutBtn.addEventListener('click', () => firebase.auth().signOut());
});

// ─── Shared Helpers ───────────────────────────────────────────────────
async function saveContainers() {}
function parseInputDate(input) { const \[d,m,y]=input.split('/'); return `${y}-${m}-${d}`; }
function parseISODate(iso)    { const \[y,m,d]=iso.split('-'); return new Date(y,m-1,d); }
function startOfDay(dt)       { const d=new Date(dt); d.setHours(0,0,0,0); return d; }
function isLate(iso)          { return startOfDay(parseISODate(iso))\<startOfDay(new Date()); }
function isDueToday(iso)      { return startOfDay(parseISODate(iso)).getTime()===startOfDay(new Date()).getTime(); }
function isDueTomorrow(iso)   { const t=startOfDay(new Date()); t.setDate(t.getDate()+1); return startOfDay(parseISODate(iso)).getTime()===t.getTime(); }
function isDueThisWeek(iso)   { const t0=startOfDay(new Date()),end=new Date(t0);end.setDate(end.getDate()+(6-t0.getDay()));end.setHours(23,59,59,999);const et=startOfDay(parseISODate(iso)).getTime();return et>t0.getTime()+86400000&\&et<=end.getTime(); }
function isUpcoming(iso)      { const t0=startOfDay(new Date()),end=new Date(t0);end.setDate(end.getDate()+(6-t0.getDay()));end.setHours(23,59,59,999);return startOfDay(parseISODate(iso)).getTime()>end.getTime(); }

function renderList(filterFn, containerId) {
const container = document.getElementById(containerId);
container.innerHTML = '';
const groups = (window\.containers || \[]).map((c,i)=>({c,i})).filter(({c})=>filterFn(c.etaISO)).reduce((acc,{c,i})=>{ const key=`${c.jobRef}|${c.etaISO}`; if(!acc\[key])acc\[key]={jobRef\:c.jobRef,etaDisplay\:c.etaDisplay,etaISO\:c.etaISO,items:\[],onHold:!!c.onHold}; acc\[key].items.push({data\:c,index\:i}); if(c.onHold)acc\[key].onHold=true; return acc; },{});
Object.values(groups).forEach(group=>{
const box=document.createElement('div');box.className='group-container';
const hdr=document.createElement('h3');hdr.textContent=`Job Ref: ${group.jobRef} — ETA: ${group.etaDisplay}`;
if(group.onHold){const sp=document.createElement('span');sp.className='hold-label';sp.textContent=' ON HOLD';hdr.appendChild(sp);}box.appendChild(hdr);
const ul=document.createElement('ul');group.items.forEach(({data\:c,index\:i})=>{
const li=document.createElement('li');
if(c.claimed){const sc=document.createElement('span');sc.className='claimed-label';sc.textContent='CLAIMED';li.appendChild(sc);}
li.appendChild(document.createTextNode(`${c.containerNumber}`));

```
  // Update ETA
  const btnU=document.createElement('button');btnU.textContent='Update ETA';btnU.addEventListener('click',async()=>{const ne=prompt('New ETA (DD/MM/YYYY):',c.etaDisplay);if(!ne||!/^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/.test(ne))return;containers[i].etaDisplay=ne;containers[i].etaISO=parseInputDate(ne); await firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).collection('containers').doc(c.containerNumber).update({etaDisplay:ne,etaISO:parseInputDate(ne)});renderAll();});li.appendChild(btnU);

  // Claim / Unclaim
  const btnC=document.createElement('button');btnC.textContent=c.claimed?'Unclaim':'Claim';btnC.addEventListener('click',async()=>{containers[i].claimed=!containers[i].claimed;await firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).collection('containers').doc(c.containerNumber).update({claimed:containers[i].claimed});renderAll();});li.appendChild(btnC);

  // Clear
  const btnX=document.createElement('button');btnX.textContent='Clear';btnX.addEventListener('click',async()=>{if(!confirm('Remove?'))return;await firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).collection('containers').doc(c.containerNumber).delete();containers.splice(i,1);renderAll();});li.appendChild(btnX);

  // On Hold / Hold Cleared
  const btnH=document.createElement('button');btnH.textContent=group.onHold?'Hold Cleared':'On Hold';btnH.addEventListener('click',async()=>{const nh=!group.onHold;group.items.forEach(({data})=>data.onHold=nh);const col=firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).collection('containers');const batch=firebase.firestore().batch();group.items.forEach(({data})=>batch.update(col.doc(data.containerNumber),{onHold:nh}));await batch.commit();renderAll();});li.appendChild(btnH);

  ul.appendChild(li);
});box.appendChild(ul);container.appendChild(box);
```

});
}

function updateSectionVisibility(){\[\['late-containers','late-list'],\['due-today','due-today-list'],\['due-tomorrow','due-tomorrow-list'],\['due-this-week','due-this-week-list'],\['upcoming','upcoming-list']].forEach((\[s,l])=>{const sec=document.getElementById(s),has=document.getElementById(l).children.length>0;if(sec)sec.style.display=has?'block':'none';});}

function renderAll(){renderList(isLate,'late-list');renderList(isDueToday,'due-today-list');renderList(isDueTomorrow,'due-tomorrow-list');renderList(isDueThisWeek,'due-this-week-list');renderList(isUpcoming,'upcoming-list');updateSectionVisibility();}
