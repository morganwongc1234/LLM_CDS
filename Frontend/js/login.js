// login.js — register + login pages
import { apiPost, setToken, initHeader } from './common.js';
const $ = (sel) => document.querySelector(sel);

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  console.log('[login] init');
  const status = document.querySelector('#statusMsg');

  // --- Register page (if present) ---
  const regForm = $('#regForm');
  const outReg = $('#outRegister');
  if (regForm) {
    console.log('[login] register form found');
    regForm.onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        prefix: $('#userPrefix').value || null,
        first_name: $('#userFirst').value.trim(),
        middle_name: $('#userMiddle').value.trim() || null,
        last_name: $('#userLast').value.trim(),
        email: $('#regEmail').value.trim(),
        password: $('#regPass').value,
        role: $('#regRole').value
      };
      outReg.textContent = 'Registering...';
      if (status) status.textContent = 'Registering…';
      try {
        const r = await apiPost('/register_user', payload);
        const data = await r.json();
        console.log('[login] /register_user status', r.status, data);
        outReg.textContent = JSON.stringify(data, null, 2);
        if (status) {
          if (r.ok) {
            status.textContent = '✅ Registration successful';
            status.className = 'success';
          } else {
            status.textContent = `❌ Registration failed: ${data?.error || r.status}`;
            status.className = 'error';
          }
        }
        if (r.ok && data.token) {
          setToken(data.token);
          if (data.role === 'clinician' || data.role === 'researcher') {
            location.href = 'homepage/clinician.html';
          } else if (data.role === 'admin') {
            location.href = 'homepage/admin.html';
          } else if (data.role === 'patient') {
            location.href = 'homepage/patient.html';
          }
        }
      } catch (err) {
        outReg.textContent = JSON.stringify({ error: String(err) }, null, 2);
        if (status) status.textContent = `❌ Registration error: ${String(err)}`;
      }
    };
  }

  // --- Login page (if present) ---
  const loginForm = $('#loginForm');
  if (loginForm) {
    const emailEl = $('#loginEmail');
    const passEl = $('#loginPass');
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      if (status) status.className = '';
      if (status) status.textContent = 'Logging in…';

      try {
        const r = await apiPost('/login_user', {
          email: emailEl?.value.trim(),
          password: passEl?.value
        });
        const data = await r.json();
        console.log('[login] /login_user status', r.status, data);

        if (r.ok && data.token) {
          if (status) {
            status.textContent = '✅ Login successful. Redirecting…';
            status.className = 'success';
          }
          setToken(data.token);
          if (data.role === 'clinician' || data.role === 'researcher') {
            location.href = 'homepage/clinician.html';
          } else if (data.role === 'admin') {
            location.href = 'homepage/admin.html';
          } else if (data.role === 'patient') {
            location.href = 'homepage/patient.html';
          } else {
            location.href = 'dashboard.html';
          }
        } else {
          const msg = data?.message || data?.error || data?.detail || `Request failed (HTTP ${r.status})`;
          if (status) {
            status.textContent = `❌ ${msg}`;
            status.className = 'error';
          }
          if (passEl) passEl.value = '';
          if (passEl) passEl.focus();
        }
      } catch (err) {
        if (status) {
          status.textContent = `❌ Login error: ${String(err)}`;
          status.className = 'error';
        }
        if (passEl) passEl.value = '';
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