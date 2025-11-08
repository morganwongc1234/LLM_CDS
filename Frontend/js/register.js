// Frontend/js/register.js — client-side validation + register flow
import { apiPost, initHeader } from './common.js';

function $(sel) { return document.querySelector(sel); }
function showJSON(el, data) { if (el) el.textContent = JSON.stringify(data, null, 2); }
function setText(el, txt) { if (el) el.textContent = txt || ''; }

// --- Simple validators ---
const reName = /^[A-Za-z\-\'\s]{2,}$/; // letters, space, hyphen, apostrophe
const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg || ''; el.classList.toggle('hidden', !msg); }
}
function clearError(id) { setError(id, ''); }

function validateFirst() {
  const v = ($('#userFirst')?.value || '').trim();
  if (!reName.test(v)) { setError('errFirst', 'First name must be at least 2 letters.'); return false; }
  clearError('errFirst');
  return true;
}
function validateLast() {
  const v = ($('#userLast')?.value || '').trim();
  if (!reName.test(v)) { setError('errLast', 'Last name must be at least 2 letters.'); return false; }
  clearError('errLast');
  return true;
}
function validateEmail() {
  const v = ($('#regEmail')?.value || '').trim();
  if (!reEmail.test(v)) { setError('errEmail', 'Enter a valid email like name@example.com'); return false; }
  clearError('errEmail');
  return true;
}
function validatePass() {
  const v = $('#regPass')?.value || '';
  if (v.length < 8) { setError('errPass', 'Password must be at least 8 characters.'); return false; }
  clearError('errPass');
  return true;
}

function validateAll() {
  const ok1 = validateFirst();
  const ok2 = validateLast();
  const ok3 = validateEmail();
  const ok4 = validatePass();
  return ok1 && ok2 && ok3 && ok4;
}

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

  // onblur validations
  $('#userFirst')?.addEventListener('blur', validateFirst);
  $('#userLast')?.addEventListener('blur', validateLast);
  $('#regEmail')?.addEventListener('blur', validateEmail);
  $('#regPass')?.addEventListener('blur', validatePass);

  // also clear error while typing
  $('#userFirst')?.addEventListener('input', () => clearError('errFirst'));
  $('#userLast')?.addEventListener('input', () => clearError('errLast'));
  $('#regEmail')?.addEventListener('input', () => clearError('errEmail'));
  $('#regPass')?.addEventListener('input', () => clearError('errPass'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // client-side validation first
    if (!validateAll()) {
      setText(out, 'Please fix the highlighted fields and try again.');
      // focus first invalid field
      if (!validateFirst()) { $('#userFirst')?.focus(); return; }
      if (!validateLast()) { $('#userLast')?.focus(); return; }
      if (!validateEmail()) { $('#regEmail')?.focus(); return; }
      if (!validatePass()) { $('#regPass')?.focus(); return; }
      return;
    }

    const payload = {
      prefix: $('#userPrefix')?.value || null,
      first_name: $('#userFirst')?.value.trim(),
      middle_name: ($('#userMiddle')?.value.trim() || '') || null,
      last_name: $('#userLast')?.value.trim(),
      email: $('#regEmail')?.value.trim(),
      password: $('#regPass')?.value,
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
          setError('errEmail', 'This email is already registered.');
        } else {
          // General fallback error
          setText(out, msg);
        }

        $('#regPass').value = '';
        return;
      }

      // Success: show response and auto-login/redirect by role if token present
      showJSON(out, data);
      if (data.token) localStorage.setItem('token', data.token);
      const role = data.role || payload.role;

      // Choose dashboard based on role (files live under /homepage/)
      if (role === 'admin') {
        location.href = 'homepage/admin.html';
      } else if (role === 'clinician' || role === 'researcher') {
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
      const pass = $('#regPass');
      if (pass) pass.value = '';
    }
  });
});