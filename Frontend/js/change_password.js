import {
  apiPost,
  initHeader,
  requireAuthGuard,
  setError,
  clearError
} from './common.js';

const $ = (sel) => document.querySelector(sel);

// --- Element References ---
const form = $('#changePasswordForm');
const currentPassEl = $('#currentPassword');
const newPassEl = $('#newPassword');
const confirmPassEl = $('#confirmPassword');
const outEl = $('#outPassword');
const btnCancel = $('#btnCancel');

// --- Error Field References ---
const errCurrent = $('#errCurrent');
const errNew = $('#errNew');
const errConfirm = $('#errConfirm');

// --- Validation Functions ---

function validateCurrent() {
  if (currentPassEl.value.length === 0) {
    setError(currentPassEl, errCurrent, 'Please enter your current password.');
    return false;
  }
  clearError(currentPassEl, errCurrent);
  return true;
}

function validateNew() {
  if (newPassEl.value.length < 8) {
    setError(newPassEl, errNew, 'New password must be at least 8 characters.');
    return false;
  }
  clearError(newPassEl, errNew);
  return true;
}

function validateConfirm() {
  if (newPassEl.value !== confirmPassEl.value) {
    setError(confirmPassEl, errConfirm, 'Passwords do not match.');
    return false;
  }
  if (confirmPassEl.value.length === 0) {
    setError(confirmPassEl, errConfirm, 'Please confirm your new password.');
    return false;
  }
  clearError(confirmPassEl, errConfirm);
  return true;
}

// --- Submit Handler ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  outEl.textContent = ''; // Clear previous messages

  // Run all validations
  const valid1 = validateCurrent();
  const valid2 = validateNew();
  const valid3 = validateConfirm();

  if (!valid1 || !valid2 || !valid3) {
    outEl.textContent = '❌ Please correct the errors above.';
    return;
  }

  outEl.textContent = 'Updating password...';

  try {
    const r = await apiPost('/api/profile/change-password', {
      currentPassword: currentPassEl.value,
      newPassword: newPassEl.value
    });

    const data = await r.json();

    if (!r.ok) {
      // The server will return a specific error
      outEl.textContent = `❌ Error: ${data.error}`;
      if (data.error.includes('current password')) {
        setError(currentPassEl, errCurrent, data.error);
        currentPassEl.focus();
      }
      return;
    }

    outEl.textContent = '✅ Password updated successfully! Redirecting to your profile...';

    // Redirect back to profile page on success
    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 2000);

  } catch (err) {
    outEl.textContent = '❌ A network error occurred.';
    console.error('Change password error:', err);
  }
});

// --- Cancel Button ---
btnCancel.addEventListener('click', () => {
  window.location.href = 'profile.html';
});

// --- Init Page ---
document.addEventListener('DOMContentLoaded', async () => {
  await initHeader();
  requireAuthGuard();

  // Attach real-time validation
  currentPassEl.addEventListener('blur', validateCurrent);
  newPassEl.addEventListener('blur', validateNew);
  confirmPassEl.addEventListener('blur', validateConfirm);
});