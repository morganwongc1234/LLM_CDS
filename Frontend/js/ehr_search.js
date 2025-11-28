import { apiGet, initHeader, requireAuthGuard, formatDate, setError, clearError } from './common.js';

const $ = (sel) => document.querySelector(sel);

// --- Render Functions ---

function renderTable(rows) {
  const container = $('#resultsContainer');
  
  if (!rows || rows.length === 0) {
    container.innerHTML = '<p class="note">No patients found matching your criteria.</p>';
    return;
  }

  const formatDateTime = (isoStr) => {
    if (!isoStr) return '<span style="color:#999; font-style:italic;">N/A</span>';
    const d = new Date(isoStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const htmlRows = rows.map(r => {
    const hasReport = !!r.latest_ehr_id;
    const rowClass = hasReport ? 'clickable-row found-record' : 'clickable-row no-record';
    const dateDisplay = formatDateTime(r.latest_ehr_date);
    
    return `
    <tr class="${rowClass}" data-pid="${r.patient_id}" data-eid="${r.latest_ehr_id || ''}">
      <td>${r.prefix || ''} ${r.first_name} ${r.last_name}</td>
      <td>${formatDate(r.date_of_birth)}</td>
      <td>${r.sex || '-'}</td>
      <td style="font-weight: 600; color: var(--color-primary);">
        ${dateDisplay}
      </td>
    </tr>
  `}).join('');

  container.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Patient Name</th>
          <th>DOB</th>
          <th>Sex</th>
          <th>Latest EHR Report</th>
        </tr>
      </thead>
      <tbody>${htmlRows}</tbody>
    </table>
  `;

  container.querySelectorAll('tr.clickable-row').forEach(row => {
    row.addEventListener('click', () => {
      const ehrId = row.dataset.eid;
      const patId = row.dataset.pid;

      if (ehrId) {
        window.location.href = `ehr_report.html?id=${ehrId}`;
      } else {
        if (confirm("This patient has no EHR records yet.\n\nGo to Patient Info to add a clinical note?")) {
          window.location.href = `patient_info.html?id=${patId}`;
        }
      }
    });
  });
}

// --- Validation Logic ---

function validateLast() {
  const lastEl = $('#qLast');
  const errLast = $('#errLast');
  const val = lastEl.value.trim();

  if (!val) {
    setError(lastEl, errLast, 'Last Name is required.');
    return false;
  }

  clearError(lastEl, errLast);
  return true;
}

function validateDOB() {
  const dobEl = $('#qDOB');
  const errDOB = $('#errDOB');
  const val = dobEl.value;

  if (!val) {
    clearError(dobEl, errDOB);
    return true;
  }

  const selectedDate = new Date(val);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selectedDate > today) {
    setError(dobEl, errDOB, 'Date cannot be in the future.');
    return false;
  }

  clearError(dobEl, errDOB);
  return true;
}

// --- Search Logic ---

async function handleSearch() {
  const lastEl = $('#qLast');
  const firstEl = $('#qFirst');
  const dobEl = $('#qDOB');
  
  const last = lastEl.value.trim();
  const first = firstEl.value.trim();
  const dob = dobEl.value;

  // Reset general container
  $('#resultsContainer').innerHTML = '';

  // 1. Run Validations
  const isLastValid = validateLast();
  const isDobValid = validateDOB();

  if (!isLastValid || !isDobValid) {
    return; // Stop if any validation failed
  }

  // 2. Perform Search
  $('#resultsContainer').innerHTML = '<p>Searching...</p>';

  const qs = new URLSearchParams({ last_name: last });
  if (first) qs.append('first_name', first);
  if (dob) qs.append('dob', dob);

  try {
    const r = await apiGet(`/api/ehr/search?${qs}`);
    const data = await r.json();
    if (r.ok) {
      renderTable(data);
    } else {
      $('#resultsContainer').innerHTML = `<p class="error">Error: ${data.error}</p>`;
    }
  } catch (e) {
    console.error(e);
    $('#resultsContainer').innerHTML = '<p class="error">Network Error</p>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initHeader();
  if (!requireAuthGuard()) return;

  const btnSearch = $('#btnSearch');
  
  // --- Active Validation Listeners ---
  
  // Validate on Blur (Active Checking)
  $('#qLast').addEventListener('blur', validateLast);
  $('#qDOB').addEventListener('blur', validateDOB);

  // Clear Errors on Input (Typing)
  $('#qLast').addEventListener('input', () => clearError($('#qLast'), $('#errLast')));
  $('#qDOB').addEventListener('input', () => clearError($('#qDOB'), $('#errDOB')));

  btnSearch.addEventListener('click', handleSearch);
});