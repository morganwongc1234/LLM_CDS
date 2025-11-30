import {
  apiGet,
  apiPost,
  initHeader,
  requireAuthGuard,
  formatDate
} from './common.js';

const $ = (sel) => document.querySelector(sel);

// --- Helper Functions ---

function renderList(arr) {
  if (!arr || arr.length === 0) return '<span style="color:#ccc">None</span>';
  // Creates the blue bubbles
  return arr.map(item => `<span class="badge-tag">${item}</span>`).join('');
}

function renderObjectTable(obj) {
  if (!obj || Object.keys(obj).length === 0) return '<span style="color:#ccc">None</span>';
  const rows = Object.entries(obj).map(([k, v]) => 
    `<tr><td style="width:40%; color:#666;">${k}</td><td><strong>${v}</strong></td></tr>`
  ).join('');
  return `<table class="table" style="margin-top:0;">${rows}</table>`;
}

// --- 1. Render Patient Details ---
function renderPatientDetail(patient) {
  const container = $('#patientDetailsContent'); 
  if (!container) return;

  const fullName = `${patient.prefix || ''} ${patient.first_name} ${patient.middle_name || ''} ${patient.last_name}`;
  const pageTitle = $('#pageTitle');
  if (pageTitle) pageTitle.textContent = fullName;

  const row = (label, value) => `
    <div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value">${value || '<span style="color:#ccc">-</span>'}</span>
    </div>
  `;

  container.innerHTML = `
    ${row('Patient ID', patient.patient_id)}
    ${row('DOB', formatDate(patient.date_of_birth))}
    ${row('Sex', patient.sex)}
    ${row('Phone', patient.phone_number)}
    ${row('Email', patient.email)}
    ${row('Address', patient.address)}
    
    <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 1rem 0;">
    ${row('Emergency Contact', patient.emergency_contact_name)}
    ${row('Emergency Phone', patient.emergency_contact_phone)}
    
    <div style="margin-top: 1rem;">
      <span class="detail-label" style="display:block; margin-bottom: 0.5rem;">Background Notes</span>
      <div style="background: #f9fafb; padding: 0.75rem; border-radius: 0.5rem; font-size: 0.9rem; color: #555; line-height: 1.5;">
        ${patient.notes_text || 'No background notes recorded.'}
      </div>
    </div>
  `;
}

// --- 2. Render Latest Report Dashboard (2x2 Grid) ---
function renderLatestReport(snapshot) {
  const container = $('#latestReportContent');
  const card = $('#latestReportCard');

  if (!snapshot) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';

  // Using grid-template-columns: 1fr 1fr to create the 2-column layout
  container.innerHTML = `
    <div class="data-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start;">
      
      <div class="form-wrapper section-card" style="grid-column: 1 / -1; margin: 0; width: auto;">
        <h3>Clinical Findings</h3>
        <p><strong>Chief Complaint:</strong> ${snapshot.chief_complaint || 'N/A'}</p>
        <p style="margin-top:0.5rem;">${snapshot.history_of_present_illness || 'N/A'}</p>
      </div>

      <div class="form-wrapper section-card" style="margin: 0; display: flex; flex-direction: column; width: auto;">
        <h3>Medications & Allergies</h3>
        <div style="flex-grow: 1;">
          <div style="margin-bottom: 1rem;">
            <small style="font-weight:700; color:#666;">MEDICATIONS</small><br>
            <div style="margin-top:0.3rem;">${renderList(snapshot.meds)}</div>
          </div>
          <div>
            <small style="font-weight:700; color:#666;">ALLERGIES</small><br>
            <div style="margin-top:0.3rem;">${renderList(snapshot.allergies)}</div>
          </div>
        </div>
      </div>

      <div class="form-wrapper section-card" style="margin: 0; display: flex; flex-direction: column; width: auto;">
        <h3>Vital Signs</h3>
        <div style="flex-grow: 1;">${renderObjectTable(snapshot.vitals)}</div>
      </div>

      <div class="form-wrapper section-card" style="margin: 0; display: flex; flex-direction: column; width: auto;">
        <h3>Pathology & Labs</h3>
        <div style="flex-grow: 1;">${renderObjectTable(snapshot.labs)}</div>
      </div>

      <div class="form-wrapper section-card" style="margin: 0; display: flex; flex-direction: column; width: auto;">
        <h3>Plan & Suggestions</h3>
        <div style="flex-grow: 1;">
          <div style="margin-bottom: 1rem;">
            <small style="font-weight:700; color:#666;">SUGGESTED</small><br>
            <div style="margin-top:0.3rem;">${renderList(snapshot.suggested_investigations)}</div>
          </div>
          <div>
            <small style="font-weight:700; color:#666;">GOALS</small><br>
            <div style="margin-top:0.3rem;">${renderList(snapshot.goals)}</div>
          </div>
        </div>
      </div>

      <div class="form-wrapper section-card" style="grid-column: 1 / -1; margin: 0; width: auto;">
        <h3>History</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <small style="font-weight:700; color:#666;">PAST MEDICAL</small><br>
            <div style="margin-top:0.3rem;">${renderList(snapshot.pmh)}</div>
          </div>
          <div>
            <small style="font-weight:700; color:#666;">SOCIAL</small><br>
            <div style="margin-top:0.3rem;">${renderList(snapshot.shx)}</div>
          </div>
        </div>
      </div>

    </div>
  `;
}

// --- 3. Render History Tables ---
function renderHistory(data) {
  const notesEl = $('#notesList');
  const reportsEl = $('#reportsList');

  // Notes Table
  if (!data.notes || data.notes.length === 0) {
    notesEl.innerHTML = '<p class="note">No clinical notes recorded.</p>';
  } else {
    const rows = data.notes.map(n => `
      <tr class="clickable-row" onclick="window.location.href='ehr_detail.html?id=${n.ehr_id}'">
        <td>${formatDate(n.created_at)}</td>
        <td>${n.prefix || ''} ${n.last_name || 'Unknown'}</td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${n.history_text ? n.history_text.substring(0, 40) + '...' : '-'}
        </td>
      </tr>
    `).join('');
    
    notesEl.innerHTML = `
      <table class="table">
        <thead><tr><th>Date</th><th>Author</th><th>Preview</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    // Automatically show the LATEST note as the dashboard
    if (data.notes.length > 0) {
      const latestId = data.notes[0].ehr_id;
      fetchLatestEhr(latestId);
    }
  }

  // Reports Table
  if (!data.reports || data.reports.length === 0) {
    reportsEl.innerHTML = '<p class="note">No AI reports generated.</p>';
  } else {
    const rows = data.reports.map(r => `
      <tr class="clickable-row" onclick="window.location.href='reports.html?id=${r.report_id}'">
        <td>${formatDate(r.created_at)}</td>
        <td>${r.task_type.toUpperCase()}</td>
        <td>${r.model_name}</td>
      </tr>
    `).join('');

    reportsEl.innerHTML = `
      <table class="table">
        <thead><tr><th>Date</th><th>Type</th><th>Model</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }
}

async function fetchLatestEhr(ehrId) {
  try {
    const r = await apiGet(`/api/ehr/${ehrId}`);
    const data = await r.json();
    if (r.ok) renderLatestReport(data.snapshot);
  } catch (e) { console.error(e); }
}

// --- 4. Buttons & Init ---
function wireButton(patientId) {
  $('#btnUpdatePatientDetails')?.addEventListener('click', () => {
    window.location.href = `patient_edit.html?id=${patientId}`;
  });
}

function wireNoteButton(patientId) {
  const btn = $('#btnSaveNote');
  const clearBtn = $('#btnClearNote');
  const input = $('#ehrTextInput');
  const status = $('#ehrStatusMsg');

  if (!btn) return;

  if (clearBtn) clearBtn.addEventListener('click', () => { input.value = ''; status.textContent = ''; });

  btn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) {
      alert('Please enter a note.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'AI Parsing...';
    status.textContent = '⏳ Analyzing...';

    try {
      const r = await apiPost('/api/ehr/parse', { patient_id: parseInt(patientId), ehr_text: text });
      const data = await r.json();

      if (r.ok) {
        status.innerHTML = `✅ Saved!`;
        status.style.color = '#166534'; 
        input.value = ''; 
        const histReq = await apiGet(`/api/patients/${patientId}/history`);
        if (histReq.ok) renderHistory(await histReq.json());
      } else {
        status.textContent = `❌ Error: ${data.error}`;
        status.style.color = '#dc2626';
      }
    } catch (err) {
      console.error(err);
      status.textContent = '❌ Network error.';
      status.style.color = '#dc2626';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save & Parse Note';
    }
  });
}

async function initPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  const container = $('#patientDetailsContent'); 
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get('id');

  if (!patientId) {
    if (container) container.innerHTML = '<p class="error">Error: No patient ID found in URL.</p>';
    return;
  }

  // ✨ CHECK USER ROLE ✨
  try {
    const meReq = await apiGet('/me');
    if (meReq.ok) {
      const me = await meReq.json();
      const role = me.me?.role;
      
      if (role === 'admin') {
        // HIDE CLINICAL TOOLS for Admin
        const noteCard = document.querySelector('.dashboard-card:nth-child(2)'); // Right Col
        const reportCard = document.querySelector('#latestReportCard');
        const historyCard = document.querySelector('.dashboard-card.full-width:last-child');

        if (noteCard) noteCard.style.display = 'none';
        if (reportCard) reportCard.style.display = 'none'; // Ensure it stays hidden
        if (historyCard) historyCard.style.display = 'none';
        
        // Expand Patient Details to full width since right col is gone
        const detailsCard = document.querySelector('.dashboard-card:nth-child(1)');
        if(detailsCard) detailsCard.style.gridColumn = '1 / -1';
      }
    }
  } catch (e) { console.error('Role check failed', e); }

  // Fetch Patient Data
  try {
    const r = await apiGet(`/patients/${patientId}`);
    const data = await r.json();
    if (r.ok) {
      renderPatientDetail(data);
      wireButton(patientId);
      wireNoteButton(patientId);
    } else {
      if (container) container.innerHTML = `<p class="error">${data.error}</p>`;
    }
  } catch (err) {
    console.error(err);
  }

  // Fetch History
  try {
    const histReq = await apiGet(`/api/patients/${patientId}/history`);
    if (histReq.ok) renderHistory(await histReq.json());
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', initPage);