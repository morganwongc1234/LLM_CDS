import { apiGet, initHeader, requireAuthGuard, formatDate } from './common.js';

const $ = (sel) => document.querySelector(sel);

// Element references
let lastEl, firstEl, roleEl, btnFilter, container;

function renderUsersTable(users) {
  if (!users || users.length === 0) {
    container.innerHTML = '<p>No users found matching your criteria.</p>';
    return;
  }

  const rows = users.map(u => `
    <tr>
      <td>${u.user_id}</td>
      <td>${[u.prefix, u.first_name, u.last_name].filter(Boolean).join(' ')}</td>
      <td>${u.email}</td>
      <td><span class="status neutral">${u.role}</span></td>
      <td>${formatDate(u.created_at)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function loadUsers() {
  // 1. Collect values
  const ln = lastEl.value.trim();
  const fn = firstEl.value.trim();
  const role = roleEl.value;

  // 2. Build Query String
  const qs = new URLSearchParams();
  if (ln) qs.set('last_name', ln);
  if (fn) qs.set('first_name', fn);
  if (role) qs.set('role', role);

  container.innerHTML = '<p>Loading...</p>';

  try {
    // 3. Call API with filters
    const r = await apiGet('/users?' + qs.toString());
    const data = await r.json();

    if (!r.ok) {
      container.innerHTML = `<p class="error">Error: ${data.error || 'Access denied'}</p>`;
      return;
    }

    renderUsersTable(data);

  } catch (err) {
    console.error('Fetch error:', err);
    container.innerHTML = '<p class="error">A network error occurred.</p>';
  }
}

async function initPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  // Find elements
  lastEl = $('#qLast');
  firstEl = $('#qFirst');
  roleEl = $('#qRole');
  btnFilter = $('#btnFilter');
  container = $('#usersTableContainer');

  // Wire up button
  btnFilter.addEventListener('click', loadUsers);

  // Initial load (show all)
  loadUsers();
}

document.addEventListener('DOMContentLoaded', initPage);