// Frontend/js/clinician.js
import { apiGet, initHeader, requireAuthGuard } from './common.js';

function $(sel) { return document.querySelector(sel); }

async function initClinicianDashboard() {
  // Require authentication
  if (!requireAuthGuard()) return;

  // Show the logged-in user and load any relevant data
  console.log('Clinician dashboard initialised.');

  // Optional: Example – check server status or stats
  const summaryEl = document.createElement('pre');
  summaryEl.textContent = 'Loading system summary...';
  document.querySelector('main').appendChild(summaryEl);

  try {
    const r = await apiGet('/api/health');
    const data = await r.text();
    summaryEl.textContent = `✅ Backend health: ${data}`;
  } catch (err) {
    summaryEl.textContent = `❌ Could not reach backend: ${err}`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initHeader(); // Builds nav and badge
  await initClinicianDashboard();
});