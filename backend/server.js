const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express ();
app.use(express.json());
app.use(cors());

mongoose.connect('mongodb://127.0.0.1:27017/bmtc_routes')
.then(() => { console.log('MongoDB connected');
	loadData();
})
.catch(err => console.error('MongoDB error: ', err));

const routeSchema = new mongoose.Schema({
    number: String,
    name: String,
    stops: [String],
    start_time: String,
    end_time: String,
    frequency: String
});

const Route = mongoose.model('Route', routeSchema);

let allRouteData = [];

// Function to load all routes into memory when the server starts
async function loadData() {
    try {
        allRoutesData = await Route.find({});
        console.log(`Successfully loaded ${allRoutesData.length} routes into memory.`);
    } catch (err) {
        console.error("Failed to load routes:", err);
    }
}

// Normalization Helper
const normalize = s => s.trim().toLowerCase();

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

// Create Unique 
function routeKey(obj) {
  if (obj.type === 'direct') {
    return `direct:${obj.legs[0].route.number}`;
  } else {
    return `${obj.type}:${obj.legs.map(l => l.route.number).join(',')}:${obj.transfers.join('|')}`;
  }
}


// Finds all 0, 1, and 2-transfer routes.
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

  // DIRECT ROUTES
  (stopMap.get(fromNorm) || []).forEach(r => {
    const stopsNorm = r.stops.map(normalize);
    const iFrom = stopsNorm.indexOf(fromNorm);
    const iTo = stopsNorm.indexOf(toNorm);
    if (iFrom !== -1 && iTo !== -1 && iFrom < iTo) {
      addUnique({ type: "direct", legs: [{ route: r, stops: r.stops.slice(iFrom, iTo + 1) }], transfers: [] });
    }
  });

  // 1-TRANSFER ROUTES
  (stopMap.get(fromNorm) || []).forEach(r1 => {
    const r1Norm = r1.stops.map(normalize);
    const iFrom = r1Norm.indexOf(fromNorm);
    if (iFrom === -1) return;

    // Only consider stops after start on r1 as transfer
    r1Norm.slice(iFrom + 1).forEach(transfer => {
      (stopMap.get(transfer) || []).forEach(r2 => {
        if (r2.number === r1.number) return;
        const r2Norm = r2.stops.map(normalize);
        const iTransferR2 = r2Norm.indexOf(transfer);
        const iTo = r2Norm.indexOf(toNorm);
        if (iTransferR2 === -1 || iTo === -1 || iTransferR2 >= iTo) return;

        addUnique({
          type: "1-transfer",
          legs: [
            { route: r1, stops: r1.stops.slice(iFrom, r1Norm.indexOf(transfer) + 1) },
            { route: r2, stops: r2.stops.slice(iTransferR2, iTo + 1) }
          ],
          transfers: [transfer]
        });
      });
    });
  });

  // 2-TRANSFER ROUTES
  (stopMap.get(fromNorm) || []).forEach(r1 => {
    const r1Norm = r1.stops.map(normalize);
    const iFrom = r1Norm.indexOf(fromNorm);
    if (iFrom === -1) return;

    r1Norm.slice(iFrom + 1).forEach(t1 => {
      (stopMap.get(t1) || []).forEach(r2 => {
        if (r2.number === r1.number) return;
        const r2Norm = r2.stops.map(normalize);
        const iT1_r2 = r2Norm.indexOf(t1);
        if (iT1_r2 === -1) return;

        // Stops after t1 on r2 for second transfer
        r2Norm.slice(iT1_r2 + 1).forEach(t2 => {
          (stopMap.get(t2) || []).forEach(r3 => {
            if ([r1.number, r2.number].includes(r3.number)) return;
            const r3Norm = r3.stops.map(normalize);
            const iT2_r3 = r3Norm.indexOf(t2);
            const iTo = r3Norm.indexOf(toNorm);
            if (iT2_r3 === -1 || iTo === -1 || iT2_r3 >= iTo) return;

            addUnique({
              type: "2-transfer",
              legs: [
                { route: r1, stops: r1.stops.slice(iFrom, r1Norm.indexOf(t1) + 1) },
                { route: r2, stops: r2.stops.slice(iT1_r2, r2Norm.indexOf(t2) + 1) },
                { route: r3, stops: r3.stops.slice(iT2_r3, iTo + 1) }
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

app.get('/api/find-routes', async (req, res) => {
	const {from, to} = req.query;

	if (!from || !to) {
		return res.status(400).json ({ error: "Missing 'from' or 'to' query parameters"});
	}

	try {
        const results = findRoutes(from, to, allRoutesData);
        res.json(results);
    } catch (err) {
        console.error("Error during route finding:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(5000, () => console.log('Server running on http://localhost:5000'));