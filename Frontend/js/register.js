// Frontend/js/register.js — client-side validation + register flow
import { apiPost, initHeader, setError, clearError } from './common.js'; // <-- 1. ADDED IMPORTS

function $(sel) { return document.querySelector(sel); }
function showJSON(el, data) { if (el) el.textContent = JSON.stringify(data, null, 2); }
function setText(el, txt) { if (el) el.textContent = txt || ''; }

// --- Simple validators ---
const reName = /^[A-Za-z\-\'\s]{2,}$/; // letters, space, hyphen, apostrophe
const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// --- DELETED old ID-based helpers ---

document.querySelector('#btnGoLogin')?.addEventListener('click', () => {
  location.href = 'login.html';
});

// --- Wire up blur/onChange validation ---
document.addEventListener('DOMContentLoaded', async () => {
  await initHeader();

  const form = $('#registerForm');
  const out = $('#outRegister');

  // Lazy-guard if page missing elements
  if (!form) return;

  // --- 2. Get Element References ---
  const userFirstEl = $('#userFirst');
  const userLastEl = $('#userLast');
  const regEmailEl = $('#regEmail');
  const regPassEl = $('#regPass');

  const errFirst = $('#errFirst');
  const errLast = $('#errLast');
  const errEmail = $('#errEmail');
  const errPass = $('#errPass');

  // --- 3. Validation functions now use elements ---
  function validateFirst() {
    const v = (userFirstEl?.value || '').trim();
    if (!reName.test(v)) {
      setError(userFirstEl, errFirst, 'First name must be at least 2 letters.'); // <-- Uses common helper
      return false;
    }
    clearError(userFirstEl, errFirst); // <-- Uses common helper
    return true;
  }
  function validateLast() {
    const v = (userLastEl?.value || '').trim();
    if (!reName.test(v)) {
      setError(userLastEl, errLast, 'Last name must be at least 2 letters.'); // <-- Uses common helper
      return false;
    }
    clearError(userLastEl, errLast); // <-- Uses common helper
    return true;
  }
  function validateEmail() {
    const v = (regEmailEl?.value || '').trim();
    if (!reEmail.test(v)) {
      setError(regEmailEl, errEmail, 'Enter a valid email like name@example.com'); // <-- Uses common helper
      return false;
    }
    clearError(regEmailEl, errEmail); // <-- Uses common helper
    return true;
  }
  function validatePass() {
    const v = regPassEl?.value || '';
    if (v.length < 8) {
      setError(regPassEl, errPass, 'Password must be at least 8 characters.'); // <-- Uses common helper
      return false;
    }
    clearError(regPassEl, errPass); // <-- Uses common helper
    return true;
  }

  function validateAll() {
    // Use & instead of && to ensure all validation functions run
    return validateFirst() & validateLast() & validateEmail() & validatePass();
  }

  // onblur validations
  userFirstEl?.addEventListener('blur', validateFirst);
  userLastEl?.addEventListener('blur', validateLast);
  regEmailEl?.addEventListener('blur', validateEmail);
  regPassEl?.addEventListener('blur', validatePass);

  // also clear error while typing
  userFirstEl?.addEventListener('input', () => clearError(userFirstEl, errFirst));
  userLastEl?.addEventListener('input', () => clearError(userLastEl, errLast));
  regEmailEl?.addEventListener('input', () => clearError(regEmailEl, errEmail));
  regPassEl?.addEventListener('input', () => clearError(regPassEl, errPass));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // client-side validation first
    if (!validateAll()) {
      setText(out, 'Please fix the highlighted fields and try again.');
      // focus first invalid field
      if (!validateFirst()) { userFirstEl?.focus(); return; }
      if (!validateLast()) { userLastEl?.focus(); return; }
      if (!validateEmail()) { regEmailEl?.focus(); return; }
      if (!validatePass()) { regPassEl?.focus(); return; }
      return;
    }

    const payload = {
      prefix: $('#userPrefix')?.value || null,
      first_name: userFirstEl?.value.trim(),
      middle_name: ($('#userMiddle')?.value.trim() || '') || null,
      last_name: userLastEl?.value.trim(),
      email: regEmailEl?.value.trim(),
      password: regPassEl?.value,
      role: $('#regRole')?.value
    };

    setText(out, 'Registering...');
    try {
      const r = await apiPost('/register_user', payload);
      const data = await r.json();

      if (!r.ok) {
        const msg = data.error;

        // Handle duplicate email
        if (msg === 'This email is already registered.') {
          setError(regEmailEl, errEmail, 'This email is already registered.');
Details
        } else {
          // General fallback error
          setText(out, msg);
        }

        regPassEl.value = '';
        return;
      }

      // Success: show response and auto-login/redirect by role if token present
      showJSON(out, data);
      if (data.token) localStorage.setItem('token', data.token);
      const role = data.role || payload.role;

      // Choose dashboard based on role (files live under /homepage/)
      if (role === 'admin') {
        location.href = 'homepage/admin.html';
      } else if (role === 'clinician' || role ==='researcher') {
        location.href = 'homepage/clinician.html';
      } else if (role === 'patient') {
        location.href = 'homepage/patient.html';
      } else {
        // Fallback to Home
        location.href = 'index.html';
      }
    } catch (err) {
      showJSON(out, { error: String(err) });
      // Clear only password on network/other errors
      const pass = regPassEl;
      if (pass) pass.value = '';
    }
  });
});