import {
  apiGet,
  initHeader,
  requireAuthGuard,
  formatDate // We get this from common.js
} from './common.js';

const $ = (sel) => document.querySelector(sel);

// ✨ UPDATED: This function now renders a table
function renderPatientDetail(patient) {
  // Selects the <section> from your patient_info.html
  const container = $('#patientInfo'); 
  if (!container) return;

  // Render the patient data as a table
  container.innerHTML = `
    <h2>${[patient.prefix, patient.first_name, patient.last_name].filter(Boolean).join(' ')}</h2>
    
    <table class="table">
      <tbody>
        <tr>
          <td><strong>Patient ID:</strong></td>
          <td>${patient.patient_id}</td>
        </tr>
        <tr>
          <td><strong>Full Name:</strong></td>
          <td>${[patient.prefix, patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')}</td>
        </tr>
        <tr>
          <td><strong>Date of Birth:</strong></td>
          <td>${formatDate(patient.date_of_birth)}</td>
        </tr>
        <tr>
          <td><strong>Sex:</strong></td>
          <td>${patient.sex ?? 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Phone:</strong></td>
          <td>${patient.phone_number ?? 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Email:</strong></td>
          <td>${patient.email ?? 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Address:</strong></td>
          <td>${patient.address ?? 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Emergency Contact:</strong></td>
          <td>${patient.emergency_contact_name ?? 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Emergency Phone:</strong></td>
          <td>${patient.emergency_contact_phone ?? 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Notes:</strong></td>
          <td>
            <pre style="margin: 0; white-space: pre-wrap; font-family: inherit;">${patient.notes_text ?? 'No notes.'}</pre>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

// This function will run when the page loads
async function initPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  const container = $('#patientInfo'); // Matches your HTML

  // 1. Get the patient ID from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get('id');

  if (!patientId) {
    container.innerHTML = '<p class="error">Error: No patient ID found in URL.</p>';
    return;
  }

  // 2. Fetch the data from our new API endpoint
  try {
    // This calls the /patients/:id route we made in server.js
    const r = await apiGet(`/patients/${patientId}`);
    const data = await r.json();

    if (!r.ok) {
      container.innerHTML = `<p class="error">Error: ${data.error || 'Could not fetch patient data.'}</p>`;
      return;
    }

    // 3. Render the data
    renderPatientDetail(data);

  } catch (err) {
    console.error('Fetch error:', err);
    container.innerHTML = '<p class="error">A network error occurred.</p>';
  }
}

document.addEventListener('DOMContentLoaded', initPage);