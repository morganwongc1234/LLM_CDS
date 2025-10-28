// server_min.js
import express from 'express';
const app = express();
app.get('/ping', (_req, res) => res.json({ pong: true, t: Date.now() }));
app.listen(8000, () => console.log('MIN server on http://localhost:8000'));