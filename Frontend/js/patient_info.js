import {
  apiGet,
  initHeader,
  requireAuthGuard,
  formatDate
} from './common.js';

const $ = (sel) => document.querySelector(sel);

// Helper to fetch the current user's role
async function getCurrentUserRole() {
  try {
    const r = await apiGet('/me');
    if (r.ok) {
      const data = await r.json();
      // Ensure role is lowercased for safe comparison
      return data?.me?.role?.toLowerCase() || null; 
    }
  } catch {}
  return null;
}

// This function will render the patient data (kept the same)
function renderPatientDetail(patient) {
  const container = $('#patientInfo'); 
  if (!container) return;

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


async function initPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  const container = $('#patientInfo');
  
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get('id');

  if (!patientId) {
    container.innerHTML = '<p class="error">Error: No patient ID found in URL.</p>';
    return;
  }
  
  // ✨ Get the user's role
  const role = await getCurrentUserRole();
  const btnUpdate = $('#btnUpdatePatientDetails');

  // ✨ Role Check: Disable button if Admin
  if (role === 'admin') {
    if (btnUpdate) {
        btnUpdate.disabled = true;
        btnUpdate.textContent = 'Editing Not Permitted (Admin)';
        btnUpdate.style.opacity = 0.5;
        btnUpdate.style.cursor = 'not-allowed';
    }
  } else {
    // Only wire the button if it's NOT an Admin
    if (btnUpdate) {
      btnUpdate.onclick = () => {
        window.location.href = `patient_edit.html?id=${patientId}`;
      };
    }
  }

  // Fetch the patient data
  try {
    const r = await apiGet(`/patients/${patientId}`);
    const data = await r.json();

    if (!r.ok) {
      container.innerHTML = `<p class="error">Error: ${data.error || 'Could not fetch patient data.'}</p>`;
      return;
    }

    renderPatientDetail(data);

  } catch (err) {
    console.error('Fetch error:', err);
    container.innerHTML = '<p class="error">A network error occurred.</p>';
  }
}

document.addEventListener('DOMContentLoaded', initPage);