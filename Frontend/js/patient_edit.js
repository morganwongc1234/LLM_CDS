import {
  apiGet,
  apiPut, // We need this new helper
  initHeader,
  requireAuthGuard,
  setError,
  clearError
} from './common.js';

const $ = (sel) => document.querySelector(sel);

// --- Form Element References ---
let elements = {};
let patientId = null; // Store the patient ID globally

// Helper to get all form elements
function getElements() {
  elements = {
    // Patient fields
    prefix: $('#patPrefix'),
    first: $('#patFirst'),
    middle: $('#patMiddle'),
    last: $('#patLast'),
    dob: $('#patDOB'),
    sex: $('#patSex'),
    phone: $('#patPhone'),
    email: $('#patEmail'),
    addr1: $('#patAddressLine1'),
    addr2: $('#patAddressLine2'),
    suburb: $('#patSuburb'),
    city: $('#patCity'),
    state: $('#patState'),
    post: $('#patPostcode'),
    emergName: $('#patEmergencyName'),
    emergPhone: $('#patEmergencyPhone'),
    notes: $('#patNotes'),

    // Form and buttons
    form: $('#editPatientForm'),
    btnSave: $('#btnSaveChanges'),
    btnCancel: $('#btnCancel'),
    outUpdate: $('#outUpdate')
  };
}

/**
 * Helper to parse the combined address string back into form fields
 */
function parseAddress(addressString = "") {
  const parts = addressString.split(',').map(s => s.trim());
  if (parts.length < 5) {
    return { line1: addressString, line2: '', suburb: '', city: '', state: '', post: '' };
  }
  const [linePart, suburb, city, state, post] = parts;
  if (linePart.includes(' / ')) {
    const [line2, line1] = linePart.split(' / ').map(s => s.trim());
    return { line1, line2, suburb, city, state, post };
  } else {
    return { line1: linePart, line2: '', suburb, city, state, post };
  }
}

/**
 * Fills the form with data fetched from the API
 * @param {Object} patient - The patient data object from /patients/:id
 */
function fillForm(patient) {
  elements.prefix.value = patient.prefix || '';
  elements.first.value = patient.first_name || '';
  elements.middle.value = patient.middle_name || '';
  elements.last.value = patient.last_name || '';
  
  const dob = patient.date_of_birth ? patient.date_of_birth.split('T')[0] : '';
  elements.dob.value = dob;
  elements.sex.value = patient.sex || '';
  elements.phone.value = patient.phone_number || '';
  elements.email.value = patient.email || '';
  
  const addr = parseAddress(patient.address);
  elements.addr1.value = addr.line1;
  elements.addr2.value = addr.line2;
  elements.suburb.value = addr.suburb;
  elements.city.value = addr.city;
  elements.state.value = addr.state;
  elements.post.value = addr.post;

  elements.emergName.value = patient.emergency_contact_name || '';
  elements.emergPhone.value = patient.emergency_contact_phone || '';
  elements.notes.value = patient.notes_text || '';
}

/**
 * Handles the form submission
 */
async function handleSubmit(e) {
  e.preventDefault();
  elements.outUpdate.textContent = 'Saving...';
  
  // (Note: We'll skip client-side validation for this edit form for brevity,
  // but you would add it here just like in patient_register.js)

  // Re-build the address string
  const addrParts = [
    elements.addr1.value.trim(),
    elements.suburb.value.trim(),
    elements.city.value.trim(),
    elements.state.value,
    elements.post.value.trim()
  ];
  let finalAddress = addrParts.join(', ');
  if (elements.addr2.value.trim()) {
    finalAddress = `${elements.addr2.value.trim()} / ${finalAddress}`;
  }

  // Collect all data into a payload
  const payload = {
    prefix: elements.prefix.value,
    first_name: elements.first.value.trim(),
    middle_name: elements.middle.value.trim() || null,
    last_name: elements.last.value.trim(),
    date_of_birth: elements.dob.value || null,
    sex: elements.sex.value || null,
    phone_number: elements.phone.value.trim() || null,
    address: finalAddress,
    email: elements.email.value.trim(),
    emergency_contact_name: elements.emergName.value.trim() || null,
    emergency_contact_phone: elements.emergPhone.value.trim() || null,
    notes_text: elements.notes.value.trim() || null,
  };

  try {
    const r = await apiPut(`/patients/${patientId}`, payload);
    const data = await r.json();

    if (!r.ok) {
      elements.outUpdate.textContent = `❌ Error: ${data.error || data.detail}`;
      return;
    }

    elements.outUpdate.textContent = '✅ Patient updated successfully! Redirecting...';
    
    // Redirect back to the patient info page
    setTimeout(() => {
      window.location.href = `patient_info.html?id=${patientId}`;
    }, 1500);

  } catch (err) {
    elements.outUpdate.textContent = '❌ A network error occurred.';
    console.error('Update patient error:', err);
  }
}

/**
 * Main function to initialize the page
 */
async function initPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  getElements(); // Find all form elements

  // Get the patient ID from the URL
  const urlParams = new URLSearchParams(window.location.search);
  patientId = urlParams.get('id');
  if (!patientId) {
    elements.outUpdate.textContent = '❌ Error: No patient ID found in URL.';
    return;
  }

  // Wire up buttons
  elements.form.addEventListener('submit', handleSubmit);
  elements.btnCancel.addEventListener('click', () => {
    // Go back to the patient info page
    window.location.href = `patient_info.html?id=${patientId}`;
  });

  // Fetch current data to fill the form
  try {
    const r = await apiGet(`/patients/${patientId}`);
    const patientData = await r.json();
    
    if (!r.ok) {
      elements.outUpdate.textContent = `❌ Error: ${patientData.error || 'Could not load patient data.'}`;
      return;
    }
    
    fillForm(patientData); // Fill the form with placeholders

  } catch (err) {
    console.error('Error fetching patient data:', err);
    elements.outUpdate.textContent = '❌ A network error occurred while loading data.';
  }
}

document.addEventListener('DOMContentLoaded', initPage);