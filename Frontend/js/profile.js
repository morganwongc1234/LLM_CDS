import {
  apiGet,
  initHeader,
  requireAuthGuard,
  formatDate
} from './common.js';

const $ = (sel) => document.querySelector(sel);

/**
 * Renders a data object into a clean table
 * @param {HTMLElement} container - The element to inject the table into
 * @param {Object} data - The data to render
 * @param {string[]} fieldsToSkip - A list of keys to not include in the table
 */
function renderTable(container, data, fieldsToSkip = []) {
  if (!data) {
    container.innerHTML = '<p>No data available.</p>';
    return;
  }

  const rows = Object.entries(data)
    .filter(([key]) => !fieldsToSkip.includes(key)) // Remove skipped fields
    .map(([key, value]) => {
      // Format keys to be user-friendly (e.g., "first_name" -> "First Name")
      const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Format dates
      let formattedValue = value;
      if (key === 'date_of_birth' || key === 'created_at') {
        formattedValue = formatDate(value);
      }
      
      return `
        <tr>
          <td><strong>${formattedKey}:</strong></td>
          <td>${formattedValue ?? 'N/A'}</td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `<table class="table"><tbody>${rows}</tbody></table>`;
}

/**
 * Wires up the navigation buttons
 */
function wireButtons() {
  $('#btnUpdateDetails')?.addEventListener('click', () => {
    window.location.href = 'profile_edit.html';
  });

  $('#btnChangePassword')?.addEventListener('click', () => {
    window.location.href = 'change_password.html';
  });
}

/**
 * Main function to initialize the profile page
 */
async function initPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  const detailsEl = $('#my-details-table');

  try {
    // 1. Fetch all profile data
    const r = await apiGet('/api/profile');
    const profileData = await r.json();

    if (!r.ok) {
      detailsEl.innerHTML = `<p class="error">${profileData.error || 'Could not load profile.'}</p>`;
      return;
    }

    // 2. Start with the user data by default
    let myDetails = profileData.user;
    // ✨ FIX: Always skip user_id
    let fieldsToSkip = ['user_id', 'role']; 

    // 3. If they are a patient, MERGE the objects
    if (profileData.patient) {
      myDetails = { ...profileData.user, ...profileData.patient };
      
      // ✨ FIX: Also skip patient_id and notes_text
      fieldsToSkip = ['user_id', 'patient_id', 'email', 'role', 'notes_text'];
    }
    
    // 4. Render the single, combined table
    renderTable(detailsEl, myDetails, fieldsToSkip);
    
    // 5. Wire up the buttons
    wireButtons();

  } catch (err) {
    console.error('Error fetching profile:', err);
    detailsEl.innerHTML = '<p class="error">A network error occurred.</p>';
  }
}

document.addEventListener('DOMContentLoaded', initPage);