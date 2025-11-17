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

// ------- Path prefix helper (so links work from /homepage/* too) -------
function prefixToRoot() {
  // If this page lives in /homepage/, links need "../"
  const p = location.pathname;
  if (p.includes('/homepage/')) return '../';
  // add more folders here if needed in future (e.g., /patients/)
  return '';
}

// ------- Main Nav rendering (with Patients dropdown) -------
// ------- Main Nav rendering (with Patients dropdown) -------
export function renderMainNav(containerEl, user) {
  if (!containerEl) return;

  const pre = prefixToRoot();
  const isAuthed = !!user;
  const email = user?.email || null;

  // Choose dashboard page based on role
  let dashboardHref = `${pre}index.html`; // safe fallback
  const role = (user?.role || '').toLowerCase();
  if (role === 'admin') {
    dashboardHref = `${pre}homepage/admin.html`;
  } else if (role === 'clinician' || role === 'researcher') {
    dashboardHref = `${pre}homepage/clinician.html`;
  } else if (role === 'patient') {
    dashboardHref = `${pre}homepage/patient.html`;
  }

  // Conditionally create links based on role
  const patientsDropdown = (role !== 'patient')
    ? `
    <div class="dropdown">
      <button class="dropbtn" type="button" style="font-weight:700;">
        Patients 
      </button>
      <div class="dropdown-content" role="menu">
        <a href="${pre}patients_list.html" role="menuitem">Patients List</a>
        <a href="${pre}patient_register.html" role="menuitem">Register Patient</a>
      </div>
    </div>
  `
    : '';

  const reportsLink = (role !== 'patient')
    ? `<a href="${pre}reports.html">Reports</a>`
    : '';

  const analyticsLink = (role !== 'patient')
    ? `<a href="${pre}analytics.html">Analytics</a>`
    : '';

  // Left: if authed -> full; else minimal
  const left = isAuthed
    ? `
      <a href="${pre}index.html">Home</a>
      <a href="${dashboardHref}">Dashboard</a>
      ${patientsDropdown}
      ${reportsLink}
      ${analyticsLink}
    `
    : `
      <a href="${pre}index.html">Home</a>
      <a href="${pre}login.html">Login</a>
      <a href="${pre}register.html">Register</a>
    `;

  const right = isAuthed
    ? `
      <span class="badge ok">${email}</span>
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

  // Support both hover (CSS) and click (JS) for accessibility
  const dd = containerEl.querySelector('.dropdown');
  const btn = containerEl.querySelector('.dropbtn');
  const panel = containerEl.querySelector('.dropdown-content');

  if (dd && btn && panel) {
    // Toggle on click using classes instead of inline styles
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dd.classList.toggle('open');
    });

    // Close when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!dd.contains(e.target)) {
        dd.classList.remove('open');
      }
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
export function setError(inputSel, errorSel = null, msg = '') {
  const inputEl = document.querySelector(inputSel);
  const errorEl = errorSel ? document.querySelector(errorSel) : inputEl?.nextElementSibling;

  if (inputEl) inputEl.classList.add('error');
  if (errorEl) errorEl.textContent = msg;
}

export function clearError(inputSel, errorSel = null) {
  const inputEl = document.querySelector(inputSel);
  const errorEl = errorSel ? document.querySelector(errorSel) : inputEl?.nextElementSibling;

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