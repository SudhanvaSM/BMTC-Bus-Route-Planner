const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');
const searchBtn = document.getElementById('searchBtn');
const swapBtn = document.getElementById('swapBtn');
const useLocationBtn = document.getElementById('useLocationBtn');
const resultsEl = document.getElementById('results');
const recentList = document.getElementById('recentList');
const statusEl = document.getElementById('status');

let recent = [];

// Normalization Helper
const normalize = s => s.trim().toLowerCase();
const clearResults = () => resultsEl.innerText = '';
const showStatus = (text, cls) => {
  statusEl.textContent = text;
  statusEl.className = cls ? 'small ' + cls : 'small';
}

function updateRecentUI() {
  recentList.innerHTML = '';
  if (!recent.length) return recentList.innerHTML = `<li>No recent searches yet</li>`;
  recent.slice().reverse().forEach(r => {
    const li = document.createElement('li');
    li.textContent = `${r.from} → ${r.to}`;
    recentList.appendChild(li);
  });
}

// =============================
// ROUTE FINDING LOGIC
// =============================

function buildStopMap(routes) {
	const stopMap = new Map();
	routes.forEach(route => {
		route.stops.forEach(stop => {
		const n = normalize(stop);
		if (!stopMap.has(n)) stopMap.set(n, []);
		stopMap.get(n).push(route);
		});
	});
	return stopMap;
}

function routeKey(obj) {
	if (obj.type === 'direct') {
		return `direct:${obj.legs[0].route.number}`;
	} else {
		return `${obj.type}:${obj.legs.map(l => l.route.number).join(',')}:${obj.transfers.join('|')}`;
	}
}

function findRoutes(from, to, routes) {
	const fromNorm = normalize(from);
	const toNorm = normalize(to);
	const stopMap = buildStopMap(routes);

	const allRoutes = [];
	const seen = new Set();

	function addUnique(obj) {
		const k = routeKey(obj);
		if (!seen.has(k)) {
		seen.add(k);
		allRoutes.push(obj);
		}
	}

	// =============== DIRECT ROUTES ===============
	(stopMap.get(fromNorm) || []).forEach(route => {
		const stopsNorm = route.stops.map(normalize);
		const iFrom = stopsNorm.indexOf(fromNorm);
		const iTo = stopsNorm.indexOf(toNorm);
		if (iFrom !== -1 && iTo !== -1 && iFrom !== iTo) {
		const subStops = iFrom < iTo
			? route.stops.slice(iFrom, iTo + 1)
			: route.stops.slice(iTo, iFrom + 1).reverse();

		addUnique({
			type: "direct",
			legs: [{ route, stops: subStops }],
			transfers: []
		});
		}
	});

	// =============== 1-TRANSFER ROUTES ===============
	(stopMap.get(fromNorm) || []).forEach(r1 => {
		const r1Norm = r1.stops.map(normalize);
		const iFrom = r1Norm.indexOf(fromNorm);
		if (iFrom === -1) return;

		r1Norm.forEach(transfer => {
		if (transfer === fromNorm || transfer === toNorm) return;

		(stopMap.get(transfer) || []).forEach(r2 => {
			if (r2.number === r1.number) return;
			const r2Norm = r2.stops.map(normalize);
			const iTo = r2Norm.indexOf(toNorm);
			if (iTo === -1) return;

			const iTransferR1 = r1Norm.indexOf(transfer);
			const iTransferR2 = r2Norm.indexOf(transfer);

			if (iTransferR1 === -1 || iTransferR2 === -1) return;

			const leg1 = iFrom < iTransferR1
			? r1.stops.slice(iFrom, iTransferR1 + 1)
			: r1.stops.slice(iTransferR1, iFrom + 1).reverse();
			const leg2 = iTransferR2 < iTo
			? r2.stops.slice(iTransferR2, iTo + 1)
			: r2.stops.slice(iTo, iTransferR2 + 1).reverse();

			if (leg1.length < 2 || leg2.length < 2) return;

			addUnique({
			type: "1-transfer",
			legs: [
				{ route: r1, stops: leg1 },
				{ route: r2, stops: leg2 }
			],
			transfers: [transfer]
			});
		});
		});
	});

	// =============== 2-TRANSFER ROUTES ===============
	(stopMap.get(fromNorm) || []).forEach(r1 => {
		const r1Norm = r1.stops.map(normalize);
		const iFrom = r1Norm.indexOf(fromNorm);
		if (iFrom === -1) return;

		r1Norm.forEach(t1 => {
		if ([fromNorm, toNorm].includes(t1)) return;

		(stopMap.get(t1) || []).forEach(r2 => {
			if (r2.number === r1.number) return;
			const r2Norm = r2.stops.map(normalize);

			r2Norm.forEach(t2 => {
			if ([t1, fromNorm, toNorm].includes(t2)) return;

			(stopMap.get(t2) || []).forEach(r3 => {
				if ([r1.number, r2.number].includes(r3.number)) return;
				const r3Norm = r3.stops.map(normalize);
				const iTo = r3Norm.indexOf(toNorm);
				if (iTo === -1) return;

				// Index checks
				const iT1_r1 = r1Norm.indexOf(t1);
				const iT1_r2 = r2Norm.indexOf(t1);
				const iT2_r2 = r2Norm.indexOf(t2);
				const iT2_r3 = r3Norm.indexOf(t2);
				if (iT1_r1 === -1 || iT1_r2 === -1 || iT2_r2 === -1 || iT2_r3 === -1) return;

				// Define legs
				const leg1 = iFrom < iT1_r1
				? r1.stops.slice(iFrom, iT1_r1 + 1)
				: r1.stops.slice(iT1_r1, iFrom + 1).reverse();
				const leg2 = iT1_r2 < iT2_r2
				? r2.stops.slice(iT1_r2, iT2_r2 + 1)
				: r2.stops.slice(iT2_r2, iT1_r2 + 1).reverse();
				const leg3 = iT2_r3 < iTo
				? r3.stops.slice(iT2_r3, iTo + 1)
				: r3.stops.slice(iTo, iT2_r3 + 1).reverse();

				if (leg1.length < 2 || leg2.length < 2 || leg3.length < 2) return;

				addUnique({
				type: "2-transfer",
				legs: [
					{ route: r1, stops: leg1 },
					{ route: r2, stops: leg2 },
					{ route: r3, stops: leg3 }
				],
				transfers: [t1, t2]
				});
			});
			});
		});
		});
	});

	return allRoutes;
}

// =============================
// RENDER RESULTS
// =============================

function renderResults(routes, container) {
	container.innerHTML = '';

	routes.forEach((r, idx) => {
		const routeCard = document.createElement("div");
		routeCard.className = "p-4 mb-3 border rounded-lg shadow-sm bg-white";

		const typeLabel =
		r.type === "direct"
			? "DIRECT"
			: r.type === "1-transfer"
			? "1-TRANSFER"
			: "2-TRANSFER";

		const legsHTML = r.legs
		.map((leg, i) => {
			let legHTML = `<strong>${leg.route.number}</strong> (${leg.route.name})<br>Stops: ${leg.stops.join(" → ")}`;
			if (r.transfers[i-1]) legHTML += `<br>🔁 Transfer at ${r.transfers[i-1]}`;
			return `<div class="mt-2">${legHTML}</div>`;
		})
		.join("");

		routeCard.innerHTML = `
		<h3 class="font-semibold text-lg mb-1">${idx + 1}. ${typeLabel}</h3>
		${legsHTML}
		`;

		container.appendChild(routeCard);
	});
}

async function handleSearch() {
	const from = fromInput.value.trim();
  	const to = toInput.value.trim();

    const resultDiv = document.getElementById("results");
    resultDiv.innerHTML = `<p class="text-gray-500">Searching...</p>`;

    try {
      const res = await fetch("http://localhost:5000/api/routes");
      const routes = await res.json();

      const allResults = findRoutes(from, to, routes);
      if (allResults.length === 0) {
        resultDiv.innerHTML =
          `<p class="text-red-600 font-medium">No routes found. Try using nearby stop names or slightly different spellings.</p>`;
        return;
      }

	recent.push({ from, to });
	updateRecentUI();		

    // Sort already done inside findRoutes()
	allResults.sort((a, b) => a.legs.length - b.legs.length);
    renderResults(allResults, resultDiv);

    } catch (err) {
      console.error(err);
      resultDiv.innerHTML = `<p class="text-red-600">Error connecting to server. Check if backend is running.</p>`;
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