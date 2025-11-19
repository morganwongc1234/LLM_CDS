// Frontend/js/common.js
// Shared helpers + dynamic navigation (with Patients dropdown)

export const API_BASE = ''; // same origin

// ------- Token helpers -------
export function setToken(tok) { localStorage.setItem('token', tok); }
export function getToken() { return localStorage.getItem('token'); }
export function clearToken() { localStorage.removeItem('token'); }

// ------- HTTP helpers -------
function authHeaders(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  const t = getToken();
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}

export async function apiGet(path) {
  return fetch(API_BASE + path, { headers: authHeaders() });
}

export async function apiPost(path, body) {
  return fetch(API_BASE + path, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body || {})
  });
}

export async function apiPut(path, body) {
  return fetch(API_BASE + path, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body || {})
  });
}

export async function apiDelete(path) {
  return fetch(API_BASE + path, {
    method: 'DELETE',
    headers: authHeaders()
  });
}

// ------- Path prefix helper (so links work from /homepage/* too) -------
function prefixToRoot() {
  // If this page lives in /homepage/, links need "../"
  const p = location.pathname;
  if (p.includes('/homepage/')) return '../';
  // add more folders here if needed in future (e.g., /patients/)
  return '';
}

// ------- Main Nav rendering (with Patients dropdown) -------
export function renderMainNav(containerEl, user) {
  if (!containerEl) return;

  const pre = prefixToRoot();
  const isAuthed = !!user;
  const email = user?.email || null;

  // Choose dashboard page based on role
  let dashboardHref = `${pre}index.html`; // safe fallback
  const role = (user?.role || '').toLowerCase();
  
  if (role === 'admin') dashboardHref = `${pre}homepage/admin.html`;
  else if (role === 'clinician' || role === 'researcher') dashboardHref = `${pre}homepage/clinician.html`;
  else if (role === 'patient') dashboardHref = `${pre}homepage/patient.html`;

  // --- PERMISSION FLAGS ---
  const isAdmin = role === 'admin';
  const isMedicalStaff = role === 'clinician' || role === 'researcher';

  // --- CONDITIONAL NAVIGATION LINKS ---
  let patientsLinkHTML = '';
  let reportsLink = '';
  let analyticsLink = '';
  const usersLink = isAdmin ? `<a href="${pre}users.html">Users</a>` : '';


  if (isAdmin) {
      // ADMIN: Only a direct link to the list
      patientsLinkHTML = `<a href="${pre}patients_list.html">Patients</a>`;
  } else if (isMedicalStaff) {
      // CLINICIAN/RESEARCHER: Dropdown for Patient List + Register
      patientsLinkHTML = `
        <div class="dropdown">
          <button class="dropbtn" type="button" style="font-weight:700;">
            Patients 
          </button>
          <div class="dropdown-content" role="menu">
            <a href="${pre}patients_list.html" role="menuitem">Patients List</a>
            <a href="${pre}patient_register.html" role="menuitem">Register Patient</a>
          </div>
        </div>
      `;
      // Clinician/Researcher also get Reports/Analytics
      reportsLink = `<a href="${pre}reports.html">Reports</a>`;
      analyticsLink = `<a href="${pre}analytics.html">Analytics</a>`;
  }


  // Left Nav Links
  const left = isAuthed
    ? `
      <a href="${pre}index.html">Home</a>
      <a href="${dashboardHref}">Dashboard</a>
      ${usersLink}
      ${patientsLinkHTML}
      ${reportsLink}
      ${analyticsLink}
    `
    : `
      <a href="${pre}index.html">Home</a>
      <a href="${pre}login.html">Login</a>
      <a href="${pre}register.html">Register</a>
    `;

  // Right Nav Links
  const right = isAuthed
    ? `
      <span class="badge ok">${email}</span>
      <a href="${pre}profile.html" class="profile-nav-link">Profile</a>
      <button id="jsLogout">Logout</button>
    `
    : `
      <span class="badge">Logged out</span>
    `;

  containerEl.innerHTML = `
    <div class="navbar">
      ${left}
      <span style="margin-left:auto"></span>
      ${right}
    </div>
  `;

  // Logout wiring
  const logoutBtn = containerEl.querySelector('#jsLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearToken();
      location.href = `${pre}index.html`;
    });
  }

  // Dropdown wiring (only needed for the Clinician/Researcher dropdown)
  const dd = containerEl.querySelector('.dropdown');
  const btn = containerEl.querySelector('.dropbtn');
  if (dd && btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dd.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!dd.contains(e.target)) dd.classList.remove('open');
    });
  }
}

// ------- Init header on each page -------
export async function initHeader() {
  const mainNav = document.querySelector('#mainNav');
  let user = null;

  // Try to decode user from /me (protected)
  try {
    const r = await apiGet('/me');
    if (r.ok) {
      const data = await r.json();
      user = data?.me || null;
    }
  } catch {
    // ignore; user stays null
  }

  if (mainNav) renderMainNav(mainNav, user);
}

// Auto-init if the page includes #mainNav and this script is loaded standalone
document.addEventListener('DOMContentLoaded', () => {
  const mainNav = document.querySelector('#mainNav');
  if (mainNav) initHeader();
});

export function setYear(sel) {
  const el = document.querySelector(sel);
  if (el) el.textContent = new Date().getFullYear();
}

export function requireAuthGuard() {
  const token = getToken();
  if (!token) {
    alert('Please login first.');

    // Detect subfolder
    const redirect = location.pathname.includes('/homepage/')
      ? '../login.html'
      : 'login.html';

    window.location.href = redirect;
    return false;
  }
  return true;
}

// ------- Input Validation Helpers -------

export function setError(inputEl, errorEl = null, msg = '') {
  // We are now passing in the element directly, so no querySelector is needed.
  
  // If no errorEl was passed, try to find the next sibling
  if (!errorEl) {
    errorEl = inputEl?.nextElementSibling;
  }

  if (inputEl) inputEl.classList.add('error');
  if (errorEl) errorEl.textContent = msg;
}

export function clearError(inputEl, errorEl = null) {
  // We are now passing in the element directly, so no querySelector is needed.
  
  // If no errorEl was passed, try to find the next sibling
  if (!errorEl) {
    errorEl = inputEl?.nextElementSibling;
  }
  
  if (inputEl) inputEl.classList.remove('error');
  if (errorEl) errorEl.textContent = '';
}

// ------- Helper Functions -------
export function formatDate(dateString) {
  if (!dateString) {
    return '';
  }
  // This avoids timezone issues by just splitting the string
  const datePart = dateString.split('T')[0]; // -> "2003-12-11"
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`; // -> "11/12/2003"
}