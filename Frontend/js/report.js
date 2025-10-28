// Frontend/js/reports.js
// Handles: Generate report and Fetch report pages
// Requires: common.js (provides apiGet/apiPost/initHeader/getToken)

import { apiGet, apiPost, initHeader, getToken } from './common.js';

const $ = (sel) => document.querySelector(sel);
const showJSON = (el, data) => { el.textContent = JSON.stringify(data, null, 2); };

function requireAuthGuard() {
  if (!getToken()) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

async function initReportsPage() {
  if (!requireAuthGuard()) return;

  // Elements from report.html
  const pidInput   = $('#rep_pid');
  const instrInput = $('#rep_instr');
  const outGen     = $('#outGen');
  const btnGen     = $('#btnGen');

  const ridInput   = $('#rep_id');
  const outGet     = $('#outGet');
  const btnGet     = $('#btnGet');

  // Generate report
  if (btnGen) {
    btnGen.onclick = async () => {
      outGen.textContent = 'Generating…';

      const patient_id = pidInput?.value ? Number(pidInput.value) : undefined;
      const user_prompt = (instrInput?.value || '').trim();

      if (!patient_id) return showJSON(outGen, { error: 'patient_id is required' });
      if (!user_prompt) return showJSON(outGen, { error: 'instructions/user_prompt is required' });

      try {
        const r = await apiPost('/reports/generate', { patient_id, user_prompt });
        const data = await r.json();
        if (!r.ok) return showJSON(outGen, data);
        showJSON(outGen, data);
      } catch (e) {
        showJSON(outGen, { error: String(e) });
      }
    };
  }

  // Fetch saved report
  if (btnGet) {
    btnGet.onclick = async () => {
      outGet.textContent = 'Fetching…';
      const rid = ridInput?.value ? Number(ridInput.value) : undefined;
      if (!rid) return showJSON(outGet, { error: 'report_id is required' });

      try {
        const r = await apiGet(`/reports/${rid}`);
        const data = await r.json();
        if (!r.ok) return showJSON(outGet, data);
        showJSON(outGet, data);
      } catch (e) {
        showJSON(outGet, { error: String(e) });
      }
    };
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initHeader();     // shows Signed in / Not signed in + logout button
  await initReportsPage();
});