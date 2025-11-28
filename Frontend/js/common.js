// Frontend/js/common.js
// Shared helpers + dynamic navigation + footer

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

// ------- Path prefix helper -------
function prefixToRoot() {
  const p = location.pathname;
  if (p.includes('/homepage/')) return '../';
  return '';
}

// ------- Main Nav rendering -------
export function renderMainNav(containerEl, user) {
  if (!containerEl) return;

  const pre = prefixToRoot();
  const isAuthed = !!user;
  const email = user?.email || null;

  let dashboardHref = `${pre}index.html`;
  const role = (user?.role || '').toLowerCase();
  
  if (role === 'admin') dashboardHref = `${pre}homepage/admin.html`;
  else if (role === 'clinician' || role === 'researcher') dashboardHref = `${pre}homepage/clinician.html`;
  else if (role === 'patient') dashboardHref = `${pre}homepage/patient.html`;

  const isMedicalStaff = role === 'clinician' || role === 'researcher';
  const isAdmin = role === 'admin';

  // 1. Patients Dropdown (Medical Only)
  const patientsDropdown = isMedicalStaff
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
  ` : '';

  const reportsDropdown = isMedicalStaff
    ? `
    <div class="dropdown">
      <button class="dropbtn" type="button" style="font-weight:700;">
        Reports 
      </button>
      <div class="dropdown-content" role="menu">
        <a href="${pre}ehr_search.html" role="menuitem">EHR Reports</a>
        <a href="${pre}reports.html" role="menuitem">Diagnostic Reports</a>
      </div>
    </div>
  ` : '';

  const analyticsLink = isMedicalStaff ? `<a href="${pre}analytics.html">Analytics</a>` : '';
  const usersLink = isAdmin ? `<a href="${pre}users.html">Users</a>` : '';

  const left = isAuthed
    ? `
      <a href="${pre}index.html">Home</a>
      <a href="${dashboardHref}">Dashboard</a>
      ${usersLink}
      ${patientsDropdown}
      ${reportsDropdown} ${analyticsLink}
    `
    : `
      <a href="${pre}index.html">Home</a>
      <a href="${pre}login.html">Login</a>
      <a href="${pre}register.html">Register</a>
    `;

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

  // ✨ NEW: Support MULTIPLE dropdowns
  const dropdowns = containerEl.querySelectorAll('.dropdown');
  dropdowns.forEach(dd => {
    const btn = dd.querySelector('.dropbtn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Close any OTHER open dropdowns first
        dropdowns.forEach(other => {
          if (other !== dd) other.classList.remove('open');
        });

        dd.classList.toggle('open');
      });
    }
  });

  // Close ALL dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    dropdowns.forEach(dd => {
      if (!dd.contains(e.target)) {
        dd.classList.remove('open');
      }
    });
  });
}

// ------- Init header on each page -------
export async function initHeader() {
  const mainNav = document.querySelector('#mainNav');
  let user = null;

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

// ------- Footer Rendering -------
export function renderFooter() {
  const footer = document.querySelector('footer') || document.querySelector('.health-footer');
  if (!footer) return;

  const year = new Date().getFullYear();
  
  let pageName = footer.getAttribute('data-page');
  if (!pageName) {
    const title = document.title || '';
    pageName = title.split('–')[0].trim(); 
    if (!pageName) pageName = 'CDS Portal';
  }

  footer.innerHTML = `<p>${year} BIOM9450 CDS | ${pageName}</p>`;
}

// ------- Auto-Init -------
document.addEventListener('DOMContentLoaded', () => {
  const mainNav = document.querySelector('#mainNav');
  if (mainNav) initHeader();
  renderFooter();
});

export function setYear(sel) {
  const el = document.querySelector(sel);
  if (el) el.textContent = new Date().getFullYear();
}

export function requireAuthGuard() {
  const token = getToken();
  if (!token) {
    alert('Please login first.');
    const redirect = location.pathname.includes('/homepage/') ? '../login.html' : 'login.html';
    window.location.href = redirect;
    return false;
  }
  return true;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
}

// ------- Input Validation Helpers -------
export function setError(inputEl, errorEl = null, msg = '') {
  if (!errorEl) errorEl = inputEl?.nextElementSibling;
  if (inputEl) inputEl.classList.add('error');
  if (errorEl) errorEl.textContent = msg;
}

export function clearError(inputEl, errorEl = null) {
  if (!errorEl) errorEl = inputEl?.nextElementSibling;
  if (inputEl) inputEl.classList.remove('error');
  if (errorEl) errorEl.textContent = '';
}