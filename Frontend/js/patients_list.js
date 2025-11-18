// patients_list.js
import {
  apiGet,
  initHeader,
  requireAuthGuard,
  setError,
  clearError,
  formatDate // We moved this to common.js
} from './common.js';

const $ = (sel) => document.querySelector(sel);

// --- Element references (will be defined in DOMContentLoaded) ---
let lastEl, firstEl, dobEl;
let errLast, errDOB;
let outPatients;

// ---------------- Render Patients Table ----------------
function renderPatients(data) {
  if (!outPatients) outPatients = $('#outPatients');

  if (!Array.isArray(data)) {
    outPatients.textContent = JSON.stringify(data, null, 2);
    return;
  }

  const rows = data.map(p => `
    <tr 
      class="clickable-row" 
      onclick="window.location.href='patient_info.html?id=${p.patient_id}'"
    >
      <td>${p.patient_id}</td>
      <td>${[p.prefix, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')}</td>
      <td>${formatDate(p.date_of_birth)}</td>
      <td>${p.sex ?? ''}</td>
      <td>${p.phone_number ?? ''}</td>
      <td>${p.email ?? ''}</td>
    </tr>
  `).join('');

  outPatients.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>ID</th><th>Name</th><th>DOB</th><th>Sex</th>
          <th>Phone</th><th>Email</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="6">No results</td></tr>`}</tbody>
    </table>
  `;
}

// ---------------- Search Logic ----------------
async function search() {
  const ln = lastEl.value.trim();
  const fn = firstEl.value.trim();
  const dob = dobEl.value;

  // ✨ FIX: Use element variables instead of strings
  clearError(lastEl, errLast);

  // Basic required check
  if (!ln) {
    setError(lastEl, errLast, 'Last name is required.'); // ✨ FIX
    return;
  }

  // Check DOB is not in the future
  if (dob) {
    const dobDate = new Date(dob);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // ignore time part

    if (dobDate > today) {
      setError(dobEl, errDOB, 'DOB cannot be in the future.'); // ✨ FIX
      return;
    }
  }

  // Clear any previous DOB error if valid
  clearError(dobEl, errDOB); // ✨ FIX

  const qs = new URLSearchParams();
  qs.set('last_name', ln);
  if (fn) qs.set('first_name', fn);
  if (dob) qs.set('date_of_birth', dob);

  const r = await apiGet('/patients/search?' + qs.toString());
  const data = await r.json();
  renderPatients(data);
}

// ---------------- Real‑time Validation ----------------
function attachValidation() {
  // Elements are now defined globally in the module
  lastEl.addEventListener('blur', () => {
    if (!lastEl.value.trim()) setError(lastEl, errLast, 'Last name is required');
  });

  lastEl.addEventListener('input', () => {
    if (lastEl.value.trim()) clearError(lastEl, errLast);
  });
}

// ---------------- Init Page ----------------
document.addEventListener('DOMContentLoaded', async () => {
  await initHeader();
  if (!requireAuthGuard()) return;

  // ✨ FIX: Define all elements on page load
  lastEl = $('#qLast');
  firstEl = $('#qFirst');
  dobEl = $('#qDOB');
  errLast = $('#errQLast');
  errDOB = $('#errQDOB');
  outPatients = $('#outPatients');

  attachValidation();

  // Hook search button
  $('#btnSearch').onclick = search;
});