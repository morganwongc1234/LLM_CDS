// Frontend/js/index.js
// Page-specific logic for Home (index.html)

import { apiGet, initHeader, setYear } from './common.js';

const $ = (sel) => document.querySelector(sel);

function wireHealth() {
  const btn = $('#btnHealth');
  const out = $('#outHealth');

  if (!btn || !out) {
    console.warn('[index.js] Missing element(s):', {
      hasBtn: !!btn,
      hasOut: !!out
    });
    return false;
  }

  // Avoid double-binding if hot reloaded
  if (btn.__wired) {
    console.log('[index.js] btnHealth already wired');
    return true;
  }

  const handler = async (e) => {
    // In case the button sits in a <form>, prevent submit/navigation
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    out.textContent = 'Checking…';
    console.log('[index.js] Health click → fetching /api/health');

    try {
      const r = await apiGet('/api/health'); // server usually returns plain text
      const txt = await r.text();
      out.textContent = txt;
      console.log('[index.js] /api/health response:', txt);
    } catch (err) {
      out.textContent = `Error: ${err}`;
      console.error('[index.js] /api/health error:', err);
    }
  };

  // Belt-and-braces: bind both styles (some frameworks overwrite onclick)
  btn.addEventListener('click', handler);
  btn.onclick = handler;

  btn.__wired = true;
  console.log('[index.js] Wired btnHealth click handler');
  return true;
}

async function initHomePage() {
  console.log('[index.js] initHomePage() start');

  // Build the main nav + auth badge
  await initHeader();
  console.log('[index.js] initHeader() done');

  // Footer year
  setYear('#year');

  // Wire the health check button
  const wired = wireHealth();
  if (!wired) {
    // Try once more after a tick if DOM is still rendering
    setTimeout(() => {
      console.log('[index.js] retry wiring health button');
      wireHealth();
    }, 0);
  }
}

document.addEventListener('DOMContentLoaded', initHomePage);