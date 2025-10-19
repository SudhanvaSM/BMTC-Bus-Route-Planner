const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express ();
app.use(express.json());
app.use(cors());

mongoose.connect('mongodb://127.0.0.1:27017/bmtc_routes', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
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

app.get('/api/routes', async (req, res) => {
  try {
    const routes = await Route.find({});
    res.json(routes);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
});

app.listen(5000, () => console.log('Server running on http://localhost:5000'));