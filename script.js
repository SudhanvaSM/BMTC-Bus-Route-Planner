// DOM ELEMENT SELECTORS
const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');
const searchBtn = document.getElementById('searchBtn');
const swapBtn = document.getElementById('swapBtn');
const resultsEl = document.getElementById('results');
const recentList = document.getElementById('recentList');
const statusEl = document.getElementById('status');

// GLOBAL STATE
let recent = [];
const MAX_RECENT_SEARCHES = 6;

// HELPER FUNCTIONS
const clearResults = () => resultsEl.innerText = '';
const showStatus = (text, cls) => {
  statusEl.textContent = text;
  // Use CSS classes from your style.css
  statusEl.className = cls ? 'small ' + cls : 'small';
}

// Updates the "Recent Searches" list in the UI
function updateRecentUI() {
	recentList.innerHTML = '';
	if (!recent.length) {
		recentList.innerHTML = `<li>No recent searches yet</li>`;
		return;
  }
  // Show in reverse order (newest first)
	recent.slice().reverse().forEach(r => {
		const li = document.createElement('li');
		li.textContent = `${r.from} → ${r.to}`;
		recentList.appendChild(li);
	});
}


// ROUTE FINDING LOGIC
function renderResults(routes, container) {
	container.innerHTML = ''; // Clear previous results

	routes.forEach((r, idx) => {
		const routeCard = document.createElement("div");
		routeCard.className = "card"; // Uses .card class from your CSS

		const typeLabel =
		r.type === "direct"
			? "DIRECT"
			: r.type === "1-transfer"
			? "1-TRANSFER"
			: "2-TRANSFER";

		const titleHTML = `
		<div class="route-title">
			<span class="badge">${typeLabel}</span>
		</div>
		`;

		// Legs: Details of each leg
		const legsHTML = r.legs.map((leg, i) => {
		const legStart = leg.stops[0];
		const legEnd = leg.stops[leg.stops.length - 1];

		// Get frequency, provide a fallback if it's missing
		const frequencyInfo = leg.route.frequency ? `(Every ${leg.route.frequency})` : '';

		// Show transfer info *before* the next leg
		const transferInfo = (i > 0 && r.transfers[i - 1])
			? `<div class="small" style="color: var(--accent); margin-top: 8px; font-weight: 600;">🔁 Transfer at ${r.transfers[i - 1]}</div>`
			: '';

		// This HTML creates a cleaner layout for each leg
		return `
			${transferInfo}
			<div class="stops">
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
				<strong style="font-size: 1.1em; color: #fff;">${leg.route.number}</strong>
				<span style="color: var(--muted); font-size: 0.9em;">${frequencyInfo}</span>
				</div>
				<div style="font-weight: 500; color: #eee; margin-bottom: 4px;">${legStart} → ${legEnd}</div>
				<span style="color: var(--muted); font-size: 0.9em;">${leg.stops.join(" → ")}</span>
			</div>
		`;
		}).join("");

		routeCard.innerHTML = titleHTML + legsHTML;
		container.appendChild(routeCard);
	});
}

// MAIN SEARCH HANDLER
async function handleSearch() {
	const from = fromInput.value.trim();
	const to = toInput.value.trim();

	// Basic validation
	if (!from || !to) {
		showStatus('Please enter both start and destination.', 'no-results');
		return;
	}

	showStatus('Searching...', '');
	resultsEl.innerHTML = ''; // Clear old results

	try {
		// 1. Create a URL with query parameters
		const params = new URLSearchParams({from,to});

		// 2. Fetch the NEW endpoint
		const res = await fetch(`http://localhost:5000/api/find-routes?${params.toString()}`);

		if (!res.ok) {
			throw new Error(`Server error: ${res.status} ${res.statusText}`);
		}

		// 3. Get the FINAL, pre-calculated results from the server
        const allResults = await res.json();

		// 4. Handle no results
		if (allResults.length === 0) {
		showStatus(`No routes found from "${from}" to "${to}".`, 'no-results');
		return;
		}

		// 5. Update recent searches
		recent.push({ from, to });
		if (recent.length > MAX_RECENT_SEARCHES) {
		recent.shift(); // Remove the oldest item
		}
		updateRecentUI();

		// 6. Sort results by transfers
		allResults.sort((a, b) => a.legs.length - b.legs.length);

		// 7. Render results
		showStatus(`Found ${allResults.length} route(s).`, 'success');
		renderResults(allResults, resultsEl);

	} catch (err) {
		console.error("Fetch Error:", err);
		showStatus('Error connecting to server. Is it running?', 'no-results');
	}
}

// EVENT LISTENERS
// 1. Search button click
searchBtn.addEventListener('click', handleSearch);

// 2. 'Enter' key press in either input box
[fromInput, toInput].forEach(inp => inp.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    handleSearch();
  }
}));

// 3. Swap button click
swapBtn.addEventListener('click', () => {
  const tmp = fromInput.value;
  fromInput.value = toInput.value;
  toInput.value = tmp;
});

// 4. Initial call to set up recent list
updateRecentUI();