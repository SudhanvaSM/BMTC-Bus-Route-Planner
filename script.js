const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');
const searchBtn = document.getElementById('searchBtn');
const resultsEl = document.getElementById('results');
const recentList = document.getElementById('recentList');
const statusEl = document.getElementById('status');

let recent = [];

// Helpers
const normalize = s => s.trim().toLowerCase();
const clearResults = () => resultsEl.innerHTML = '';
const showStatus = (text, cls) => {
  statusEl.textContent = text;
  statusEl.className = cls ? 'small ' + cls : 'small';
};

function updateRecentUI() {
  recentList.innerHTML = '';
  if (!recent.length) return recentList.innerHTML = `<li>No recent searches yet</li>`;
  recent.slice().reverse().forEach(r => {
    const li = document.createElement('li');
    li.textContent = `${r.from} → ${r.to}`;
    recentList.appendChild(li);
  });
}

// Fetch routes
async function fetchRoutes() {
  try {
    const res = await fetch('http://localhost:5000/api/routes');
    if (!res.ok) throw new Error('Network error');
    return await res.json();
  } catch (err) {
    console.error(err);
    showStatus('Failed to fetch routes from server', 'no-results');
    return [];
  }
}

// Render direct route card
function renderRouteCard(route, from, to) {
  const stopsNorm = route.stops.map(normalize);
  let iFrom = stopsNorm.indexOf(normalize(from));
  let iTo = stopsNorm.indexOf(normalize(to));
  if (iFrom === -1 || iTo === -1) return null;

  const stops = iFrom < iTo ? route.stops.slice(iFrom, iTo + 1) : route.stops.slice(iTo, iFrom + 1).reverse();

  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `
    <div class="route-title">
      <div style="display:flex;gap:8px;align-items:center">
        <div style="font-size:15px">${route.number}</div>
        <div class="badge">${route.name}</div>
      </div>
      <div style="margin-left:auto; font-size:13px" class="small">${route.frequency} • ${route.start_time} - ${route.end_time}</div>
    </div>
    <div class="stops">Stops: ${stops.join(' → ')}</div>
  `;
  return div;
}

// Find one-transfer routes
function findOneTransferRoutes(from, to, allRoutes) {
  const transfers = [];
  const fromNorm = normalize(from), toNorm = normalize(to);

  allRoutes.forEach(r1 => {
    const r1Norm = r1.stops.map(normalize);
    if (!r1Norm.some(s => s.startsWith(fromNorm))) return;

    allRoutes.forEach(r2 => {
      if (r1.number === r2.number) return;
      const r2Norm = r2.stops.map(normalize);
      if (!r2Norm.some(s => s.startsWith(toNorm))) return;

      const commonStops = r1Norm.filter(s => r2Norm.includes(s));
      commonStops.forEach(cp => transfers.push({ first: r1, second: r2, transferPoint: cp }));
    });
  });

  return transfers;
}

// Render transfer card
function renderTransferCard(t, from, to) {
  const fNorm = t.first.stops.map(normalize);
  const sNorm = t.second.stops.map(normalize);

  const iFrom = fNorm.indexOf(normalize(from));
  const iTransferF = fNorm.indexOf(t.transferPoint);
  const iTransferS = sNorm.indexOf(t.transferPoint);
  const iTo = sNorm.indexOf(normalize(to));

  const stopsFirst = iFrom < iTransferF ? t.first.stops.slice(iFrom, iTransferF + 1) : t.first.stops.slice(iTransferF, iFrom + 1).reverse();
  const stopsSecond = iTransferS < iTo ? t.second.stops.slice(iTransferS + 1, iTo + 1) : t.second.stops.slice(iTo, iTransferS).reverse();

  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `
    <div class="route-title">
      <div style="display:flex; gap:8px; align-items:center">
        <div style="font-size:15px">${t.first.number}</div>
        <div class="badge">${t.first.name}</div>
      </div>
      <div style="margin-left:auto; font-size:13px" class="small">${t.first.frequency} • ${t.first.start_time} - ${t.first.end_time}</div>
    </div>
    <div class="stops">
      Stops: ${stopsFirst.join(' → ')} → Transfer at ${t.transferPoint} → ${stopsSecond.join(' → ')} (${t.second.number})
    </div>
  `;
  return div;
}

// Main search
async function handleSearch() {
  const from = fromInput.value.trim();
  const to = toInput.value.trim();
  clearResults();

  if (!from || !to) {
    showStatus('Please enter both start and destination.', 'no-results');
    return;
  }

  showStatus('Searching...', '');
  recent.push({ from, to });
  if (recent.length > 4) recent.shift();
  updateRecentUI();

  const routes = await fetchRoutes();
  const direct = routes.filter(r => {
    const stops = r.stops.map(normalize);
    const fromMatch = stops.some(s => s.startsWith(normalize(from)));
    const toMatch = stops.some(s => s.startsWith(normalize(to)));
    return fromMatch && toMatch;
  });

  const transfers = findOneTransferRoutes(from, to, routes);

  if (direct.length > 0) {
    showStatus(`Found ${direct.length} direct route(s).`, 'success');
    direct.forEach(d => {
      const card = renderRouteCard(d, from, to);
      if (card) resultsEl.appendChild(card);
    });
  } else if (transfers.length > 0) {
    showStatus(`Found ${transfers.length} alternate route(s) (1 transfer).`, 'success');
    transfers.forEach(t => resultsEl.appendChild(renderTransferCard(t, from, to)));
  } else {
    showStatus('No routes found. Try using nearby stop names or slightly different names.', 'no-results');
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="route-title"><div>No matches</div></div><div class="stops">Try partial names (e.g., "Majestic", "Silk Board") or check admin data.</div>`;
    resultsEl.appendChild(card);
  }
}

// Events
searchBtn.addEventListener('click', handleSearch);
[fromInput, toInput].forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); }));

swapBtn.addEventListener('click', () => {
  const tmp = fromInput.value;
  fromInput.value = toInput.value;
  toInput.value = tmp;
});

useLocationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return showStatus('Geolocation not supported', 'no-results');
  showStatus('Getting your location...', '');
  navigator.geolocation.getCurrentPosition(pos => {
    fromInput.value = 'Majestic'; // Demo
    showStatus(`Location detected. Searching nearby stops...`, '');
  }, err => showStatus('Unable to get location', 'no-results'));
});
