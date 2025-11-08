// Frontend/js/clinician.js
import { apiGet, initHeader, requireAuthGuard, getToken } from './common.js';

function $(sel) { return document.querySelector(sel); }

async function initClinicianDashboard() {
  if (!requireAuthGuard()) return;

  console.log('Clinician dashboard initialised.');

  // Show user name in welcome banner
  try {
    const r = await apiGet('/me');
    if (r.ok) {
      const data = await r.json();
      const user = data?.me;
      const name = user?.first_name || user?.email || 'User';
      $('#welcomeBanner').textContent = `Welcome back, ${name}!`;
    } else {
      $('#welcomeBanner').textContent = 'Welcome back!';
    }
  } catch (err) {
    console.error('Error fetching user for banner:', err);
    $('#welcomeBanner').textContent = 'Welcome back!';
  }

  // Optional: backend health check
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
  await initHeader();
  await initClinicianDashboard();
});