// Frontend/js/index.js
// Page-specific logic for Home (index.html)

import { apiGet, initHeader, setYear } from './common.js';

const $ = (sel) => document.querySelector(sel);

export function wireHealth() {
  const btn = $('#btnHealth');
  const out = $('#outHealth');

  if (!btn || !out) {
    console.warn('[index.js] Missing element(s):', {
      hasBtn: !!btn,
      hasOut: !!out
    });
    return false;
  }

  if (btn.__wired) {
    console.log('[index.js] btnHealth already wired');
    return true;
  }

  const handler = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    out.textContent = 'Checking…';
    console.log('[index.js] Health click → fetching /api/health');

    try {
      const r = await apiGet('/api/health');
      const txt = await r.text();
      out.textContent = txt;
      console.log('[index.js] /api/health response:', txt);
    } catch (err) {
      out.textContent = `Error: ${err}`;
      console.error('[index.js] /api/health error:', err);
    }
  };

  btn.addEventListener('click', handler);
  btn.onclick = handler;

  btn.__wired = true;
  console.log('[index.js] Wired btnHealth click handler');
  return true;
}