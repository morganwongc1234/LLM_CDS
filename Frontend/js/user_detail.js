import { apiGet, apiDelete, initHeader, requireAuthGuard, formatDate } from './common.js';

const $ = (sel) => document.querySelector(sel);

function renderTable(data) {
  const container = $('#userDetailTable');
  if (!data) return;

  const u = data.user;
  const p = data.patient;

  // 1. Construct the display object explicitly to control the Order
  const displayData = {
    "User ID": u.user_id,
  };

  // Add Patient ID immediately after User ID, if the record exists
  if (p) {
    displayData["Patient ID"] = p.patient_id;
  }

  // Add the rest of the standard user fields
  displayData["Role"] = u.role;
  displayData["Name"] = [u.prefix, u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ');
  displayData["Email"] = u.email;
  displayData["Account Created"] = formatDate(u.created_at);

  // 2. Render
  const rows = Object.entries(displayData).map(([label, value]) => {
    return `
      <tr>
        <td style="width: 30%; text-align: right; color: #555;"><strong>${label}:</strong></td>
        <td>${value ?? '<span style="color:#ccc">N/A</span>'}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `<table class="table"><tbody>${rows}</tbody></table>`;
}

async function initPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('id');

  if (!userId) {
    $('#userDetailTable').innerHTML = '<p class="error">No User ID provided.</p>';
    return;
  }

  // Setup Buttons
  $('#btnBack').onclick = () => window.location.href = 'users.html';
  $('#btnEditUser').onclick = () => window.location.href = `user_edit.html?id=${userId}`;
  
  // Delete Logic (using standard browser confirm)
  $('#btnDeleteUser').onclick = async () => {
    // This is the browser confirmation popup
    if (!confirm('⚠️ Are you sure you want to delete this user?\n\nThis action cannot be undone.')) {
      return;
    }

    // Disable button and show loading state
    const btn = $('#btnDeleteUser');
    btn.disabled = true;
    btn.textContent = 'Deleting...';

    try {
      const r = await apiDelete(`/users/${userId}`);
      const data = await r.json();

      if (r.ok) {
        alert('User deleted successfully.');
        window.location.href = 'users.html'; // Redirect back to list
      } else {
        alert(`Error: ${data.error || 'Could not delete user.'}`);
        btn.disabled = false;
        btn.textContent = 'Delete User';
      }
    } catch (err) {
      console.error(err);
      alert('A network error occurred.');
      btn.disabled = false;
      btn.textContent = 'Delete User';
    }
  };

  // ... (rest of existing fetch logic) ...

  try {
    const r = await apiGet(`/users/${userId}`);
    const data = await r.json();

    if (!r.ok) {
      $('#userDetailTable').innerHTML = `<p class="error">${data.error || 'Error loading user.'}</p>`;
      return;
    }

    renderTable(data); // <-- This will now find the function above

  } catch (err) {
    console.error(err);
    $('#userDetailTable').innerHTML = '<p class="error">Network error.</p>';
  }
}

document.addEventListener('DOMContentLoaded', initPage);