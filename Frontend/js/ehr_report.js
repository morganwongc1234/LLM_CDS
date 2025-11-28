import { apiGet, initHeader, requireAuthGuard, formatDate } from './common.js';

const $ = (sel) => document.querySelector(sel);

function renderList(arr) {
  if (!arr || arr.length === 0) return '<span style="color:#ccc">None</span>';
  return arr.map(item => `<span class="badge-tag">${item}</span>`).join('');
}

function renderObjectTable(obj) {
  if (!obj || Object.keys(obj).length === 0) return '<span style="color:#ccc">None</span>';
  const rows = Object.entries(obj).map(([k, v]) => 
    `<tr><td style="width:40%; color:#666;">${k}</td><td><strong>${v}</strong></td></tr>`
  ).join('');
  return `<table class="table" style="margin-top:0;">${rows}</table>`;
}

function renderParsedData(snapshot) {
  const container = $('#parsedContent');
  if (!snapshot) {
    container.innerHTML = '<p>No parsed data available.</p>';
    return;
  }

  const sections = [
    {
      title: "Clinical Findings",
      // ✨ NEW: Add a flag to signal full width
      isFullWidth: true, 
      content: `
        <p><strong>Chief Complaint:</strong> ${snapshot.chief_complaint || 'N/A'}</p>
        <p><strong>History of Present Illness:</strong><br>${snapshot.history_of_present_illness || 'N/A'}</p>
      `
    },
    {
      title: "Vitals & Measurements",
      content: renderObjectTable(snapshot.vitals)
    },
    {
      title: "Lists",
      content: `
        <div style="margin-bottom:1rem;"><strong>Allergies:</strong><br>${renderList(snapshot.allergies)}</div>
        <div style="margin-bottom:1rem;"><strong>Medications:</strong><br>${renderList(snapshot.meds)}</div>
        <div style="margin-bottom:1rem;"><strong>Past History:</strong><br>${renderList(snapshot.pmh)}</div>
        <div><strong>Social History:</strong><br>${renderList(snapshot.shx)}</div>
      `
    },
    {
      title: "Labs & Imaging",
      content: `
        <div style="margin-bottom:1rem;"><strong>Lab Results:</strong><br>${renderObjectTable(snapshot.labs)}</div>
        <div><strong>Imaging:</strong><br>${renderList(snapshot.imaging)}</div>
      `
    },
    {
      title: "Plan & Suggestions",
      content: `
        <div style="margin-bottom:1rem;"><strong>Suggested Investigations:</strong><br>${renderList(snapshot.suggested_investigations)}</div>
        <div><strong>Goals:</strong><br>${renderList(snapshot.goals)}</div>
      `
    }
  ];

  container.className = "data-grid";
  container.innerHTML = sections.map(sec => {
    const style = sec.isFullWidth ? 'margin:0; grid-column: 1 / -1;' : 'margin:0;';
    
    return `
    <div class="form-wrapper section-card" style="${style}">
      <h3>${sec.title}</h3>
      ${sec.content}
    </div>
  `}).join('');
}

async function initPage() {
  await initHeader();
  if (!requireAuthGuard()) return;

  const params = new URLSearchParams(window.location.search);
  const ehrId = params.get('id');

  if (!ehrId) {
    alert('No EHR ID provided');
    window.location.href = 'ehr_search.html';
    return;
  }

  $('#btnBack').onclick = () => window.location.href = 'ehr_search.html';

  try {
    const r = await apiGet(`/api/ehr/${ehrId}`);
    const data = await r.json();

    if (!r.ok) {
      $('#parsedContent').innerHTML = `<p class="error">Error: ${data.error}</p>`;
      return;
    }

    // 1. Render Metadata (Split View)
    $('#metaContent').innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
        
        <div>
          <h4 style="margin-top:0; color: var(--color-text-muted); text-transform: uppercase; font-size: 0.85rem;">Patient</h4>
          <p style="font-size: 1.1rem; margin-bottom: 0.2rem;"><strong>${data.patient_name}</strong></p>
          <p style="margin:0; color: #666;">
            DOB: ${formatDate(data.dob)} &nbsp;|&nbsp; Sex: ${data.sex}
          </p>
        </div>

        <div style="border-left: 1px solid #eee; padding-left: 2rem;">
          <h4 style="margin-top:0; color: var(--color-text-muted); text-transform: uppercase; font-size: 0.85rem;">Note Details</h4>
          <p style="margin-bottom: 0.2rem;"><strong>Date:</strong> ${formatDate(data.created_at)}</p>
          <p style="margin:0; color: #666;">EHR ID: ${data.ehr_id} &nbsp;|&nbsp; Author ID: ${data.author_user_id}</p>
        </div>

      </div>
    `;

    // 2. Render Raw Text
    $('#rawTextContent').textContent = data.history_text || "No text content.";

    // 3. Render Snapshot
    renderParsedData(data.snapshot);

  } catch (err) {
    console.error(err);
    $('#parsedContent').innerHTML = '<p class="error">Network error.</p>';
  }
}

document.addEventListener('DOMContentLoaded', initPage);