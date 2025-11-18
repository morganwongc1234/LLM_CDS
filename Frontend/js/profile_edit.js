import {
  apiGet,
  apiPut, // Our new function
  initHeader,
  requireAuthGuard,
  formatDate
} from './common.js';

const $ = (sel) => document.querySelector(sel);

// --- Form Element References ---
let elements = {};

// Helper to get all form elements
function getElements() {
  elements = {
    // User fields
    userId: $('#userId'),
    userEmail: $('#userEmail'),
    userPrefix: $('#userPrefix'),
    userFirst: $('#userFirst'),
    userMiddle: $('#userMiddle'),
    userLast: $('#userLast'),
    
    // Patient section
    patientForm: $('#patient-details-form'),

    // Patient fields
    patDOB: $('#patDOB'),
    patSex: $('#patSex'),
    patPhone: $('#patPhone'),
    patAddr1: $('#patAddressLine1'),
    patAddr2: $('#patAddressLine2'),
    patSuburb: $('#patSuburb'),
    patCity: $('#patCity'),
    patState: $('#patState'),
    patPostcode: $('#patPostcode'),
    patEmergName: $('#patEmergencyName'),
    patEmergPhone: $('#patEmergencyPhone'),
    patNotes: $('#patNotes'),

    // Form and buttons
    form: $('#editProfileForm'),
    btnSave: $('#btnSaveChanges'),
    btnCancel: $('#btnCancel'),
    outUpdate: $('#outUpdate')
  };
}

/**
 * Helper to parse the combined address string back into form fields
 * @param {string} addressString - e.g., "Unit 5 / 24 Example Street, Hornsby, Sydney, NSW, 2000"
 */
function parseAddress(addressString = "") {
  const parts = addressString.split(',').map(s => s.trim());
  if (parts.length < 5) {
    // Not a full address, just set line 1
    return { line1: addressString, line2: '', suburb: '', city: '', state: '', post: '' };
  }

  const [linePart, suburb, city, state, post] = parts;
  
  // Check for "line2 / line1" format
  if (linePart.includes(' / ')) {
    const [line2, line1] = linePart.split(' / ').map(s => s.trim());
    return { line1, line2, suburb, city, state, post };
  } else {
    // Just line1
    return { line1: linePart, line2: '', suburb, city, state, post };
  }
}

/**
 * Fills the form with data fetched from the API
 * @param {object} profileData - The data object from /api/profile
 */
function fillForm(profileData) {
  const { user, patient } = profileData;

  // 1. Fill User Details
  elements.userId.value = user.user_id;
  elements.userEmail.value = user.email;
  elements.userPrefix.value = user.prefix || '';
  elements.userFirst.value = user.first_name || '';
  elements.userMiddle.value = user.middle_name || '';
  elements.userLast.value = user.last_name || '';

  // 2. Check if they are a patient
  if (patient) {
    elements.patientForm.style.display = 'block'; // Show the patient section
    
    // ... (fill dob, sex, phone, address...)
    const dob = patient.date_of_birth ? patient.date_of_birth.split('T')[0] : '';
    elements.patDOB.value = dob;
    elements.patSex.value = patient.sex || '';
    elements.patPhone.value = patient.phone_number || '';
    
    const addr = parseAddress(patient.address);
    elements.patAddr1.value = addr.line1;
    elements.patAddr2.value = addr.line2;
    elements.patSuburb.value = addr.suburb;
    elements.patCity.value = addr.city;
    elements.patState.value = addr.state;
    elements.patPostcode.value = addr.post;

    elements.patEmergName.value = patient.emergency_contact_name || '';
    elements.patEmergPhone.value = patient.emergency_contact_phone || '';
    
    // ✨ FIX: Hide the Notes field and its label
    if (elements.patNotes) {
      elements.patNotes.style.display = 'none';
      const notesLabel = document.querySelector('label[for="patNotes"]');
      if (notesLabel) notesLabel.style.display = 'none';
    }
  }
}

/**
 * Handles the form submission
 * @param {Event} e 
 */
async function handleSubmit(e) {
  e.preventDefault();
  elements.outUpdate.textContent = 'Saving...';

  // 1. Collect User data (same as before)
  const userData = {
    prefix: elements.userPrefix.value,
    first_name: elements.userFirst.value.trim(),
    middle_name: elements.userMiddle.value.trim() || null,
    last_name: elements.userLast.value.trim(),
  };

  let patientData = null;

  // 2. Collect Patient data (if visible)
  if (elements.patientForm.style.display === 'block') {
    // ... (re-build the address string)
    const addrParts = [
      elements.patAddr1.value.trim(),
      elements.patSuburb.value.trim(),
      elements.patCity.value.trim(),
      elements.patState.value,
      elements.patPostcode.value.trim()
    ];
    let finalAddress = addrParts.join(', ');
    if (elements.patAddr2.value.trim()) {
      finalAddress = `${elements.patAddr2.value.trim()} / ${finalAddress}`;
    }

    patientData = {
      prefix: elements.userPrefix.value, 
      first_name: elements.userFirst.value.trim(),
      middle_name: elements.userMiddle.value.trim() || null,
      last_name: elements.userLast.value.trim(),
      date_of_birth: elements.patDOB.value || null,
      sex: elements.patSex.value || null,
      phone_number: elements.patPhone.value.trim() || null,
      address: finalAddress,
      emergency_contact_name: elements.patEmergName.value.trim() || null,
      emergency_contact_phone: elements.patEmergPhone.value.trim() || null,
      // ✨ FIX: 'notes_text' is no longer included in the payload
    };
  }

  // 3. Send the payload to the PUT endpoint
  const payload = {
    user: userData,
    patient: patientData
  };

  try {
    const r = await apiPut('/api/profile', payload);
    // ... (rest of the function is the same)
    const data = await r.json();

    if (!r.ok) {
      elements.outUpdate.textContent = `❌ Error: ${data.error || data.detail}`;
      return;
    }

    elements.outUpdate.textContent = '✅ Profile updated successfully! Redirecting...';
    
    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 1500);

  } catch (err) {
    elements.outUpdate.textContent = '❌ A network error occurred.';
    console.error('Update profile error:', err);
  }
}

/**
 * Main function to initialize the page
 */
async function initPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  getElements(); // Find all form elements

  // Wire up buttons
  elements.form.addEventListener('submit', handleSubmit);
  elements.btnCancel.addEventListener('click', () => {
    if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      window.location.href = 'profile.html';
    }
  });

  // Fetch current data to fill the form
  try {
    const r = await apiGet('/api/profile');
    const profileData = await r.json();
    
    if (!r.ok) {
      elements.outUpdate.textContent = `❌ Error: ${profileData.error || 'Could not load profile.'}`;
      return;
    }
    
    fillForm(profileData); // Fill the form with placeholders

  } catch (err) {
    console.error('Error fetching profile:', err);
    elements.outUpdate.textContent = '❌ A network error occurred while loading data.';
  }
}

document.addEventListener('DOMContentLoaded', initPage);