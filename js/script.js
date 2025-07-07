// ─── In-Memory & Persistence ─────────────────────────────────────────
let containers = [];

function loadContainers() {
  try {
    const raw = localStorage.getItem('containers');
    if (raw) containers = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading containers:', e);
  }
}

function saveContainers() {
  try {
    localStorage.setItem('containers', JSON.stringify(containers));
  } catch (e) {
    console.error('Error saving containers:', e);
  }
}

// ─── Date Parsing & Category Checks ──────────────────────────────────
function parseInputDate(input) {
  // "DD/MM/YYYY" → "YYYY-MM-DD"
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
  const t = startOfDay(new Date());
  t.setDate(t.getDate() + 1);
  return startOfDay(parseISODate(iso)).getTime() === t.getTime();
}
function isDueThisWeek(iso) {
  const today = startOfDay(new Date());
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + (6 - today.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);
  const etaTime = startOfDay(parseISODate(iso)).getTime();
  return etaTime > today.getTime() + 86_400_000 && etaTime <= endOfWeek.getTime();
}
function isUpcoming(iso) {
  const today = startOfDay(new Date());
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + (6 - today.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);
  return startOfDay(parseISODate(iso)).getTime() > endOfWeek.getTime();
}

// ─── Grouped Rendering ────────────────────────────────────────────────
function renderList(filterFn, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  // 1) Build groups keyed by "jobRef|etaISO"
  const groups = containers
    .map((c, idx) => ({ c, idx }))
    .filter(({ c }) => filterFn(c.etaISO))
    .reduce((acc, { c, idx }) => {
      const key = `${c.jobRef}|${c.etaISO}`;
      if (!acc[key]) {
        acc[key] = { jobRef: c.jobRef, etaDisplay: c.etaDisplay, items: [] };
      }
      acc[key].items.push({ data: c, index: idx });
      return acc;
    }, {});

  // 2) Render each group box
  Object.values(groups).forEach(group => {
    const box = document.createElement('div');
    box.className = 'group-container';

    // Header: Job Ref + ETA
    const hdr = document.createElement('h3');
    hdr.textContent = `Job Ref: ${group.jobRef} — ETA: ${group.etaDisplay}`;
    box.appendChild(hdr);

    // List of container entries
    const ul = document.createElement('ul');
    group.items.forEach(({ data: c, index: i }) => {
      const li = document.createElement('li');
      // Container number text
      li.appendChild(document.createTextNode(c.containerNumber));

      // Update ETA button
      const btnU = document.createElement('button');
      btnU.textContent = 'Update ETA';
      btnU.addEventListener('click', () => {
        const newEta = prompt('Enter new ETA (DD/MM/YYYY):', c.etaDisplay);
        if (!newEta || !/^\d{2}\/\d{2}\/\d{4}$/.test(newEta)) {
          alert('Cancelled or invalid format.');
          return;
        }
        containers[i].etaDisplay = newEta;
        containers[i].etaISO     = parseInputDate(newEta);
        saveContainers();
        renderAll();
      });
      li.appendChild(btnU);

      // Container Cleared button
      const btnC = document.createElement('button');
      btnC.textContent = 'Container Cleared';
      btnC.addEventListener('click', () => {
        if (!confirm('Are you sure? This will remove the container.')) return;
        containers.splice(i, 1);
        saveContainers();
        renderAll();
      });
      li.appendChild(btnC);

      ul.appendChild(li);
    });

    box.appendChild(ul);
    container.appendChild(box);
  });
}

// Hide any empty category sections
function updateSectionVisibility() {
  [
    ['late-containers','late-list'],
    ['due-today','due-today-list'],
    ['due-tomorrow','due-tomorrow-list'],
    ['due-this-week','due-this-week-list'],
    ['upcoming','upcoming-list']
  ].forEach(([sec, lst]) => {
    const section = document.getElementById(sec);
    const hasItems = document.getElementById(lst).children.length > 0;
    if (section) section.style.display = hasItems ? 'block' : 'none';
  });
}

// Call all renders
function renderAll() {
  renderList(isLate,        'late-list');
  renderList(isDueToday,    'due-today-list');
  renderList(isDueTomorrow, 'due-tomorrow-list');
  renderList(isDueThisWeek, 'due-this-week-list');
  renderList(isUpcoming,    'upcoming-list');
  updateSectionVisibility();
}

// ─── Initialization & Form Handling ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 1. Load saved containers and show them
  loadContainers();
  renderAll();
   flatpickr("#eta", {
    dateFormat: "d/m/Y",  // DD/MM/YYYY
    allowInput: true,     // still allow typing
    clickOpens: true
  });

  // 2. Wire up “Add Container” form
  const form = document.getElementById('container-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const num  = document.getElementById('container-number').value;
    const eta  = document.getElementById('eta').value;
    const job  = document.getElementById('job-ref').value;

    containers.push({
      containerNumber: num,
      etaDisplay:      eta,
      etaISO:          parseInputDate(eta),
      jobRef:          job
    });
    saveContainers();
    renderAll();
    form.reset();
  });
});
