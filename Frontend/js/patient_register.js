// patient_register.js
import { apiPost, requireAuthGuard, initHeader } from './common.js';

const $ = (sel) => document.querySelector(sel);

document.addEventListener('DOMContentLoaded', async () => {
  await initHeader();
  if (!requireAuthGuard()) return;

  $('#btnCreatePatient').onclick = async () => {
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

    // minimal client-side checks
    if (!body.first_name || !body.last_name) {
      $('#outCreate').textContent = 'First and last name are required.';
      return;
    }

    $('#outCreate').textContent = 'Creating...';
    const r = await apiPost('/patients', body);
    const data = await r.json();
    $('#outCreate').textContent = JSON.stringify(data, null, 2);
  };
});