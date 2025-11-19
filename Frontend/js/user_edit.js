import {
  apiGet,
  apiPut,
  initHeader,
  requireAuthGuard
} from './common.js';

const $ = (sel) => document.querySelector(sel);

let targetUserId = null;

// --- Form Element References ---
const elements = {};

function getElements() {
  elements.form = $('#editUserForm');
  
  // User Fields
  elements.userId = $('#userId');
  elements.role = $('#userRole');
  elements.prefix = $('#userPrefix');
  elements.first = $('#userFirst');
  elements.middle = $('#userMiddle');
  elements.last = $('#userLast');
  elements.email = $('#userEmail');

  // Patient Section & Fields
  elements.patientSection = $('#patient-identity-section');
  elements.patDOB = $('#patDOB');
  elements.patSex = $('#patSex');
  elements.patPhone = $('#patPhone');
  elements.patAddress = $('#patAddress');

  // Buttons & Output
  elements.btnSave = $('#btnSaveChanges');
  elements.btnCancel = $('#btnCancel');
  elements.outUpdate = $('#outUpdate');
}

function fillForm(data) {
  const u = data.user;
  const p = data.patient;

  // Fill User Data
  elements.userId.value = u.user_id;
  elements.role.value = u.role;
  elements.prefix.value = u.prefix || '';
  elements.first.value = u.first_name || '';
  elements.middle.value = u.middle_name || '';
  elements.last.value = u.last_name || '';
  elements.email.value = u.email || '';

  // If patient data exists, show the section and fill it
  if (p) {
    elements.patientSection.style.display = 'block';
    
    const dob = p.date_of_birth ? p.date_of_birth.split('T')[0] : '';
    elements.patDOB.value = dob;
    elements.patSex.value = p.sex || '';
    elements.patPhone.value = p.phone_number || '';
    elements.patAddress.value = p.address || '';
  } else {
    elements.patientSection.style.display = 'none';
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  elements.outUpdate.textContent = 'Saving...';

  // 1. Construct User Object
  const userPayload = {
    role: elements.role.value,
    prefix: elements.prefix.value,
    first_name: elements.first.value.trim(),
    middle_name: elements.middle.value.trim() || null,
    last_name: elements.last.value.trim(),
    email: elements.email.value.trim()
  };

  // 2. Construct Patient Object (if visible)
  let patientPayload = null;
  if (elements.patientSection.style.display !== 'none') {
    patientPayload = {
      date_of_birth: elements.patDOB.value || null,
      sex: elements.patSex.value || null,
      phone_number: elements.patPhone.value.trim() || null,
      address: elements.patAddress.value.trim() || null,
      // Note: We are preserving name/email sync by sending them again if needed by backend logic,
      // but usually the backend syncs email automatically.
      // We intentionally DO NOT send notes or emergency contacts here to keep it simple.
    };
  }

  const payload = {
    user: userPayload,
    patient: patientPayload
  };

  try {
    const r = await apiPut(`/users/${targetUserId}`, payload);
    const data = await r.json();

    if (!r.ok) {
      elements.outUpdate.textContent = `❌ Error: ${data.error || data.detail}`;
      return;
    }

    elements.outUpdate.textContent = '✅ User updated successfully! Redirecting...';
    setTimeout(() => {
      window.location.href = `user_detail.html?id=${targetUserId}`;
    }, 1500);

  } catch (err) {
    elements.outUpdate.textContent = '❌ A network error occurred.';
    console.error(err);
  }
}

async function initPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  getElements();

  const urlParams = new URLSearchParams(window.location.search);
  targetUserId = urlParams.get('id');

  if (!targetUserId) {
    elements.outUpdate.textContent = '❌ No User ID provided.';
    return;
  }

  // Wire Buttons
  elements.form.addEventListener('submit', handleSubmit);
  elements.btnCancel.addEventListener('click', () => {
    window.location.href = `user_detail.html?id=${targetUserId}`;
  });

  // Fetch Data
  try {
    const r = await apiGet(`/users/${targetUserId}`);
    const data = await r.json();

    if (!r.ok) {
      elements.outUpdate.textContent = `❌ Error: ${data.error || 'Access denied'}`;
      return;
    }

    fillForm(data);

  } catch (err) {
    console.error(err);
    elements.outUpdate.textContent = '❌ Network error fetching user data.';
  }
}

document.addEventListener('DOMContentLoaded', initPage);