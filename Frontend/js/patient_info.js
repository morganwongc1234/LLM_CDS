// js/patient_info.js
import { apiGet, initHeader, requireAuthGuard } from './common.js';

function $(sel) { return document.querySelector(sel); }

document.addEventListener('DOMContentLoaded', async () => {
  await initHeader();
  if (!requireAuthGuard()) return;

  const patientId = getPatientIdFromURL();
  if (!patientId) return showError('No patient ID provided in URL.');

  try {
    const user = await fetchCurrentUser();
    const role = user?.role;
    if (!role) return showError('Missing user role.');

    const r = await apiGet(`/api/patient/${patientId}`);
    if (!r.ok) return showError(`Could not load patient (HTTP ${r.status})`);

    const patient = await r.json();
    renderPatientInfo(patient, role);
  } catch (err) {
    showError(`Unexpected error: ${err.message}`);
  }
});

function getPatientIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function fetchCurrentUser() {
  const r = await apiGet('/me');
  if (!r.ok) return null;
  const data = await r.json();
  return data?.me || null;
}

function renderPatientInfo(p, role) {
  const infoEl = $('#patientDetails');
  if (!infoEl) return;

  const safe = (val) => val ?? '—';

  const fields = [];

  fields.push(`<h2>${safe(p.first_name)} ${safe(p.last_name)}</h2>`);

  if (['clinician', 'admin', 'researcher'].includes(role)) {
    fields.push(`<p><strong>DOB:</strong> ${safe(p.date_of_birth)}</p>`);
    fields.push(`<p><strong>Sex:</strong> ${safe(p.sex)}</p>`);
  }

  if (['clinician', 'admin'].includes(role)) {
    fields.push(`<p><strong>Phone:</strong> ${safe(p.phone_number)}</p>`);
    fields.push(`<p><strong>Address:</strong> ${safe(p.address)}</p>`);
    fields.push(`<p><strong>Email:</strong> ${safe(p.email)}</p>`);
    fields.push(`<p><strong>Emergency Contact:</strong> ${safe(p.emergency_contact_name)} (${safe(p.emergency_contact_phone)})</p>`);
    fields.push(`<p><strong>Notes:</strong><br><em>${safe(p.notes_text)}</em></p>`);
  }

  if (role === 'patient') {
    // Only show non-sensitive personal info
    fields.push(`<p><strong>DOB:</strong> ${safe(p.date_of_birth)}</p>`);
    fields.push(`<p><strong>Sex:</strong> ${safe(p.sex)}</p>`);
  }

  infoEl.innerHTML = fields.join('\n');
}

function showError(msg) {
  const el = $('#patientDetails');
  if (el) el.innerHTML = `<p class="error">${msg}</p>`;
}