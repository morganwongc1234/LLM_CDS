// patients_list.js
import { apiGet, requireAuthGuard, initHeader } from './common.js';

const $ = (sel) => document.querySelector(sel);

function renderPatients(data) {
  const out = $('#outPatients');
  if (!Array.isArray(data)) {
    out.textContent = JSON.stringify(data, null, 2);
    return;
  }
  const rows = data.map(p => `
    <tr>
      <td>${p.patient_id}</td>
      <td>${[p.prefix, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')}</td>
      <td>${p.dob ?? ''}</td>
      <td>${p.sex ?? ''}</td>
      <td>${p.phone ?? ''}</td>
      <td>${p.email ?? ''}</td>
      <td>${p.address ?? ''}</td>
    </tr>`).join('');

  out.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>ID</th><th>Name</th><th>DOB</th><th>Sex</th><th>Phone</th><th>Email</th><th>Address</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="7">No results</td></tr>`}</tbody>
    </table>`;
}

async function listAll() {
  const r = await apiGet('/patients');
  const data = await r.json();
  renderPatients(data);
}

async function search() {
  const ln = $('#qLast').value.trim();
  const fn = $('#qFirst').value.trim();
  const dob = $('#qDOB').value;

  if (!ln) {
    document.querySelector('#outPatients').textContent = 'Enter at least a last name.';
    return;
  }

  const qs = new URLSearchParams();
  qs.set('last_name', ln);
  if (fn) qs.set('first_name', fn);
  if (dob) qs.set('dob', dob);

  const r = await apiGet('/patients/search?' + qs.toString());
  const data = await r.json();
  renderPatients(data);
}

document.addEventListener('DOMContentLoaded', async () => {
  await initHeader();
  if (!requireAuthGuard()) return;

  // $('#btnList').onclick = listAll;
  $('#btnSearch').onclick = search;
});