import { apiPost, setToken, initHeader } from './common.js';
const $ = (sel) => document.querySelector(sel);

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  console.log('[login] init');

  const loginForm = $('#loginForm');
  const emailEl = $('#loginEmail');
  const passEl = $('#loginPass');
  const errEmail = $('#errLoginEmail');
  const errPass = $('#errLoginPass');

  // === Validation helpers ===
  function setError(el, msg, errField) {
    if (errField) errField.textContent = msg;
    if (el) el.classList.add('input-error');
  }

  function clearError(el, errField) {
    if (errField) errField.textContent = '';
    if (el) el.classList.remove('input-error');
  }

  function validateEmail() {
    const value = emailEl?.value.trim();
    if (!value) {
      setError(emailEl, 'Please fill in this field', errEmail);
      return false;
    }
    clearError(emailEl, errEmail);
    return true;
  }

  function validatePassword() {
    const value = passEl?.value;
    if (!value) {
      setError(passEl, 'Please fill in this field', errPass);
      return false;
    }
    clearError(passEl, errPass);
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
            setError(emailEl, msg, errEmail);
          } else if (/password/i.test(msg)) {
            setError(passEl, msg, errPass);
          } else {
            setError(passEl, msg, errPass);
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