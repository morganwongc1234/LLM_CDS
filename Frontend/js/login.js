import { apiPost, setToken, initHeader, setError, clearError } from './common.js'; // <-- 1. ADDED IMPORTS
const $ = (sel) => document.querySelector(sel);

const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  console.log('[login] init');

  const loginForm = $('#loginForm');
  const emailEl = $('#loginEmail');
  const passEl = $('#loginPass');
  const errEmail = $('#errLoginEmail');
  const errPass = $('#errLoginPass');

  // === Validation helpers ===
  // <-- 2. DELETED LOCAL FUNCTIONS -->

  function validateEmail() {
    const value = emailEl?.value.trim();
    if (!value) {
      setError(emailEl, errEmail, 'Please fill in this field'); // <-- Now uses common helper
      return false;
    }
    if (!reEmail.test(value)) {
      setError(emailEl, errEmail, 'Please enter a valid email address'); // <-- Now uses common helper
      return false;
    }
    clearError(emailEl, errEmail); // <-- Now uses common helper
    return true;
  }

  function validatePassword() {
    const value = passEl?.value;
    if (!value) {
      setError(passEl, errPass, 'Please fill in this field'); // <-- Now uses common helper
      return false;
    }
    clearError(passEl, errPass); // <-- Now uses common helper
    return true;
  }

  // === Event listeners ===
  emailEl?.addEventListener('blur', validateEmail);
  passEl?.addEventListener('blur', validatePassword);

  emailEl?.addEventListener('input', () => clearError(emailEl, errEmail));
  passEl?.addEventListener('input', () => clearError(passEl, errPass));

  // === Form submission ===
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();

      const validEmail = validateEmail();
      const validPass = validatePassword();
      if (!validEmail || !validPass) return;

      try {
        const r = await apiPost('/login_user', {
          email: emailEl.value.trim(),
          password: passEl.value
        });
        const data = await r.json();
        console.log('[login] /login_user status', r.status, data);

        if (r.ok && data.token) {
          setToken(data.token);

          const role = data.role;
          if (role === 'clinician' || role === 'researcher') {
            location.href = 'homepage/clinician.html';
          } else if (role === 'admin') {
            location.href = 'homepage/admin.html';
          } else if (role === 'patient') {
            location.href = 'homepage/patient.html';
          } else {
            location.href = 'dashboard.html';
          }
        } else {
          const msg = data?.message || data?.error || data?.detail || `Request failed (HTTP ${r.status})`;

          if (/email/i.test(msg)) {
            setError(emailEl, errEmail, msg);
          } else if (/password/i.test(msg)) {
            setError(passEl, errPass, msg);
          } else {
            setError(passEl, errPass, msg);
          }

          passEl.value = '';
          passEl.focus();
        }
      } catch (err) {
        passEl.value = '';
      }
    };
  }

  const btnGoRegister = $('#btnGoRegister');
  if (btnGoRegister) {
    btnGoRegister.addEventListener('click', () => {
      location.href = 'register.html';
    });
  }
});