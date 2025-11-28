import {
  apiGet,
  apiPost, // ✨ Added apiPost
  initHeader,
  requireAuthGuard,
  formatDate
} from './common.js';

const $ = (sel) => document.querySelector(sel);

// This function will render the patient data
function renderPatientDetail(patient) {
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
            <pre>${patient.notes_text ?? 'No notes.'}</pre>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

function wireButton(patientId) {
  $('#btnUpdatePatientDetails')?.addEventListener('click', () => {
    // Go to a new edit page, passing the patient ID
    window.location.href = `patient_edit.html?id=${patientId}`;
  });
}

// ✨ NEW: Logic to handle the "Save Note" button
function wireNoteButton(patientId) {
  const btn = $('#btnSaveNote');
  const input = $('#ehrTextInput');
  const status = $('#ehrStatusMsg');

  if (!btn) return;

  btn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) {
      alert('Please enter a note.');
      return;
    }

    // 1. UI Loading State
    btn.disabled = true;
    btn.textContent = 'AI Parsing...';
    status.textContent = '⏳ Analyzing text and extracting data...';
    status.style.color = '#666';

    try {
      // 2. Send to Backend
      const r = await apiPost('/api/ehr/parse', {
        patient_id: parseInt(patientId),
        ehr_text: text
      });

      const data = await r.json();

      if (r.ok) {
        // 3. Success!
        status.innerHTML = `✅ Note Saved! (EHR ID: ${data.ehr_id})`;
        status.style.color = '#166534'; // Green
        input.value = ''; // Clear the box
        
        // Optional: Reload page after 2s to show updated data if you were listing notes
        // setTimeout(() => location.reload(), 2000); 
      } else {
        // 4. Error from Server
        status.textContent = `❌ Error: ${data.error || 'Failed to save note.'}`;
        status.style.color = '#dc2626'; // Red
      }
    } catch (err) {
      // 5. Network Error
      console.error(err);
      status.textContent = '❌ Network error.';
      status.style.color = '#dc2626';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Clinical Note';
    }
  });
}

// This function will run when the page loads
async function initPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  const container = $('#patientInfo');

  // 1. Get the patient ID from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get('id');

  if (!patientId) {
    container.innerHTML = '<p class="error">Error: No patient ID found in URL.</p>';
    return;
  }

  // 2. Fetch the data from our API endpoint
  try {
    const r = await apiGet(`/patients/${patientId}`);
    const data = await r.json();

    if (!r.ok) {
      container.innerHTML = `<p class="error">${data.error || 'Could not fetch patient data.'}</p>`;
      return;
    }

    // 3. Render the data
    renderPatientDetail(data);

    // 4. Wire up buttons
    wireButton(patientId);
    wireNoteButton(patientId); // ✨ Wire the new note button

  } catch (err) {
    console.error('Fetch error:', err);
    container.innerHTML = '<p class="error">A network error occurred.</p>';
  }
}

document.addEventListener('DOMContentLoaded', initPage);