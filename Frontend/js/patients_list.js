// patients_list.js
import {
  apiGet,
  initHeader,
  requireAuthGuard,
  setError,
  clearError,
  formatDate
} from './common.js';

const $ = (sel) => document.querySelector(sel);

// ---------------- Render Patients Table ----------------
function renderPatients(data) {
  const out = $('#outPatients');

  if (!Array.isArray(data)) {
    out.textContent = JSON.stringify(data, null, 2);
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

  out.innerHTML = `
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
  const ln = $('#qLast').value.trim();
  const fn = $('#qFirst').value.trim();
  const dob = $('#qDOB').value; // This is the value from the date input

  clearError('#qLast');

  // Basic required check
  if (!ln) {
    setError('#qLast', '#errQLast', 'Last name is required.');
    return;
  }

  // Check DOB is not in the future
  if (dob) {
    const dobDate = new Date(dob);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // ignore time part

    if (dobDate > today) {
      setError('#qDOB', null, 'DOB cannot be in the future.');
      return;
    }
  }

  // Clear any previous DOB error if valid
  clearError('#qDOB');

  const qs = new URLSearchParams();
  qs.set('last_name', ln);
  if (fn) qs.set('first_name', fn);
  
  // ✨ UPDATED: Send 'date_of_birth' to match the server
  if (dob) qs.set('date_of_birth', dob);

  const r = await apiGet('/patients/search?' + qs.toString());
  const data = await r.json();
  renderPatients(data);
}

// ---------------- Real‑time Validation ----------------
function attachValidation() {
  const lastEl = $('#qLast');
  const errLast = $('#errQLast');

  lastEl.addEventListener('blur', () => {
    if (!lastEl.value.trim()) setError(lastEl, 'Last name is required', errLast);
  });

  lastEl.addEventListener('input', () => {
    if (lastEl.value.trim()) clearError(lastEl, errLast);
  });
}

// ---------------- Init Page ----------------
document.addEventListener('DOMContentLoaded', async () => {
  await initHeader();
  if (!requireAuthGuard()) return;

  attachValidation();

  // Hook search button
  $('#btnSearch').onclick = search;
});