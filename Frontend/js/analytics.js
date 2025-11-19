import { apiGet, initHeader, requireAuthGuard } from './common.js';

const $ = (sel) => document.querySelector(sel);

/**
 * Renders a standard two-column table from an array of distribution data.
 * @param {HTMLElement} containerEl - The element to inject the table into.
 * @param {string} title - Title for the table.
 * @param {Array<Object>} data - Array of objects from the API.
 * @param {string} keyField - Field name for the label (e.g., 'role', 'age_group')
 * @param {string} valueField - Field name for the count ('count')
 */
function renderDistributionTable(containerEl, title, data, keyField, valueField) {
  // Replace underscores and capitalize for display in the table headers
  const displayKey = keyField.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const displayValue = valueField.replace(/\b\w/g, l => l.toUpperCase());
  
  const rows = data.map(item => {
    // Handle NULL values (like for sex or location)
    const key = item[keyField] === null ? 'N/A' : item[keyField]; 
    return `
      <tr>
        <td>${key}</td>
        <td>${item[valueField]}</td>
      </tr>
    `;
  }).join('');

  containerEl.innerHTML = `
    <h3>${title}</h3>
    <table class="table">
      <thead>
        <tr>
          <th>${displayKey}</th>
          <th>${displayValue}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}


/**
 * Safely handles the response from a fetch call, ensuring it can always
 * consume the body without SyntaxErrors, even if the body is empty or non-JSON.
 */
async function getSafeResponseData(response) {
  try {
    return await response.json();
  } catch (e) {
    const text = await response.text();
    return { 
      error: `Server returned HTTP ${response.status}`, 
      detail: text.length > 500 ? text.substring(0, 500) + '...' : text
    };
  }
}


async function initAnalyticsPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  const scorecards = [
    { id: 'scTotalUsers', field: 'totalUsers' },
    { id: 'scTotalPatients', field: 'totalPatients' },
    { id: 'scTotalEHR', field: 'totalEHRSubmissions' },
    { id: 'scTotalReports', field: 'totalReports' },
  ];
  
  const tables = {
    usersByRole: { id: 'tableUsersByRole', title: 'User Roles', key: 'role', value: 'count' },
    ageGroups: { id: 'tableAgeGroups', title: 'Patient Age Distribution', key: 'age_group', value: 'count' },
    sexDistribution: { id: 'tableSexDistribution', title: 'Patient Sex Distribution', key: 'sex', value: 'count' },
    topLocations: { id: 'tableTopLocations', title: 'Top Patient Locations', key: 'state', value: 'count' },
  };

  try {
    const r = await apiGet('/api/admin/analytics');
    const data = await getSafeResponseData(r);

    if (!r.ok) {
      const errorEl = $('#analyticsScorecards');
      errorEl.innerHTML = `<p class="error">❌ Error: ${data.error || 'Access Denied'}</p><pre>${data.detail || 'The server did not provide a detailed error message.'}</pre>`;
      return;
    }

    console.log("Analytics Data Received:", data);

    // 1. Render Scorecards
    scorecards.forEach(card => {
      const el = $(`#${card.id}`);
      if (el) el.textContent = data[card.field] ?? 'N/A';
    });

    // 2. Render Tables (Checks added to prevent rendering if data is null)
    if (data.usersByRole) renderDistributionTable($(`#${tables.usersByRole.id}`), tables.usersByRole.title, data.usersByRole, tables.usersByRole.key, tables.usersByRole.value);
    if (data.ageGroups) renderDistributionTable($(`#${tables.ageGroups.id}`), tables.ageGroups.title, data.ageGroups, tables.ageGroups.key, tables.ageGroups.value);
    if (data.sexDistribution) renderDistributionTable($(`#${tables.sexDistribution.id}`), tables.sexDistribution.title, data.sexDistribution, tables.sexDistribution.key, tables.sexDistribution.value);
    if (data.topLocations) renderDistributionTable($(`#${tables.topLocations.id}`), tables.topLocations.title, data.topLocations, tables.topLocations.key, tables.topLocations.value);

  } catch (err) {
    console.error('Analytics Fetch Error:', err);
    $('#analyticsScorecards').innerHTML = '<p class="error">A catastrophic network error occurred while fetching analytics data.</p>';
  }
}

document.addEventListener('DOMContentLoaded', initAnalyticsPage);