// Shared frontend logic for all pages
const API_BASE = ''; // same origin: http://localhost:8000 (proxy or serve Frontend statically via backend)
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));

function setToken(tok) { localStorage.setItem('token', tok); }
function getToken() { return localStorage.getItem('token'); }
function clearToken() { localStorage.removeItem('token'); }

function authHeaders(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  const t = getToken();
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}

async function apiGet(path) {
  const r = await fetch(API_BASE + path, { headers: authHeaders() });
  return r;
}
async function apiPost(path, body) {
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body || {})
  });
  return r;
}

// ---- Page initialisers (called per page if elements exist) ----
async function initHeader() {
  const badge = $('#jsAuthBadge');
  const logout = $('#jsLogout');
  if (!badge || !logout) return;

  const t = getToken();
  if (!t) {
    badge.innerHTML = '<span class="badge">Not signed in</span>';
    logout.classList.add('hidden');
    return;
  }

  // Try to decode a little information from /me (protected)
  try {
    const r = await apiGet('/me');
    const data = await r.json();
    if (r.ok) {
      const who = data?.me?.email || 'user';
      badge.innerHTML = `<span class="badge ok">Signed in</span> <span class="note">${who}</span>`;
      logout.classList.remove('hidden');
    } else {
      badge.innerHTML = `<span class="badge err">Token invalid</span>`;
      logout.classList.add('hidden');
      clearToken();
    }
  } catch {
    badge.innerHTML = `<span class="badge err">Server offline</span>`;
    logout.classList.add('hidden');
  }

  logout.onclick = () => {
    clearToken();
    location.href = 'index.html';
  };
}

async function initHome() {
  const healthBtn = $('#btnHealth');
  const out = $('#outHealth');
  if (!healthBtn) return;
  healthBtn.onclick = async () => {
    out.textContent = 'Checking...';
    const r = await apiGet('/api/health');
    out.textContent = await r.text();
  };
}

function initRegister() {
  const form = $('#regForm');
  const out = $('#outRegister');
  if (!form) return;

  form.onsubmit = async (e) => {
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
    out.textContent = 'Registering...';
    const r = await apiPost('/register_user', payload);
    const data = await r.json();
    out.textContent = JSON.stringify(data, null, 2);

    // Auto-login if registration succeeded and backend returns token
    if (r.ok && data.token) {
      setToken(data.token);
      location.href = 'dashboard.html';
    }
  };
}

function initLogin() {
  const form = $('#loginForm');
  const out = $('#outLogin');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    out.textContent = 'Logging in...';
    const r = await apiPost('/login_user', {
      email: $('#loginEmail').value.trim(),
      password: $('#loginPass').value
    });
    const data = await r.json();
    out.textContent = JSON.stringify(data, null, 2);
    if (r.ok && data.token) {
      setToken(data.token);
      location.href = 'dashboard.html';
    }
  };
}

function requireAuthGuard() {
  if (!getToken()) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

function initDashboard() {
  if (!requireAuthGuard()) return;

  const out = $('#outPatients');
  const btnList = $('#btnListPatients');
  const btnCreate = $('#btnCreatePatient');
  const btnSearch = $('#btnSearchPatient');

  // List all
  btnList.onclick = async () => {
    out.textContent = 'Loading...';
    const r = await apiGet('/patients');
    const data = await r.json();
    renderPatients(data);
  };

  // Create
  btnCreate.onclick = async () => {
    const body = {
      prefix: $('#patPrefix').value || null,
      first_name: $('#patFirst').value.trim(),
      middle_name: $('#patMiddle').value.trim() || null,
      last_name: $('#patLast').value.trim(),
      dob: $('#patDOB').value || null,
      sex: $('#patSex').value || null,
      phone: $('#patPhone').value || null,
      address: $('#patAddress').value || null,
      email: $('#patEmail').value || null,
      emergency_name: $('#patEmergencyName').value || null,
      emergency_phone: $('#patEmergencyPhone').value || null,
      notes: $('#patNotes').value || null
    };
    out.textContent = 'Creating...';
    const r = await apiPost('/patients', body);
    const data = await r.json();
    out.textContent = JSON.stringify(data, null, 2);
  };

  // Search (by last name required; first_name/dob optional)
  btnSearch.onclick = async () => {
    const ln = $('#qLast').value.trim();
    const fn = $('#qFirst').value.trim();
    const dob = $('#qDOB').value;
    if (!ln) { out.textContent = 'Enter at least a last name.'; return; }

    const qs = new URLSearchParams();
    qs.set('last_name', ln);
    if (fn) qs.set('first_name', fn);
    if (dob) qs.set('dob', dob);

    out.textContent = 'Searching...';
    const r = await apiGet('/patients/search?' + qs.toString());
    const data = await r.json();
    renderPatients(data);
  };

  function renderPatients(data) {
    if (!Array.isArray(data)) {
      $('#outPatients').textContent = JSON.stringify(data, null, 2);
      return;
    }
    const rows = data.map(p => `
      <tr>
        <td>${p.patient_id}</td>
        <td>${[p.prefix, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')}</td>
        <td>${p.dob ?? ''}</td>
        <td>${p.sex ?? ''}</td>
        <td>${p.phone ?? ''}</td>
        <td>${p.email ?? ''}</td>
        <td>${p.address ?? ''}</td>
      </tr>`).join('');
    $('#outPatients').innerHTML = `
      <table class="table">
        <thead>
          <tr><th>ID</th><th>Name</th><th>DOB</th><th>Sex</th><th>Phone</th><th>Email</th><th>Address</th></tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="7">No results</td></tr>`}</tbody>
      </table>`;
  }
}

// ---- Kick off per-page initialisers ----
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initHome();
  initRegister();
  initLogin();
  if (location.pathname.endsWith('dashboard.html')) initDashboard();
});