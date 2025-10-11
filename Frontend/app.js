let token = null;
const $ = (id) => document.getElementById(id);
const show = (id, data) => { $(id).textContent = JSON.stringify(data, null, 2); };

// -------- Health --------
const btnHealth = $('btnHealth');
if (btnHealth) {
  btnHealth.onclick = async () => {
    $('outHealth').textContent = 'Loading...';
    const r = await fetch('/api/health');
    show('outHealth', await r.json());
  };
}

// -------- Register user (includes name fields) --------
const btnRegister = $('btnRegister');
if (btnRegister) {
  btnRegister.onclick = async () => {
    const email = $('regEmail').value.trim();
    const password = $('regPass').value;
    const role = $('regRole').value;

    const prefix = $('regPrefix').value || null;
    const first_name = $('regFirst').value.trim();
    const middle_name = $('regMiddle').value.trim() || null;
    const last_name = $('regLast').value.trim();

    if (!first_name || !last_name) return show('outRegister', { error: 'First & last name required' });

    $('outRegister').textContent = 'Loading...';
    const r = await fetch('/register_user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role, prefix, first_name, middle_name, last_name })
    });
    const data = await r.json();
    show('outRegister', data);

    // If backend returns token on register, cache it
    if (data && data.token) {
      token = data.token;
      const tEl = $('tokenShort');
      if (tEl) tEl.textContent = token.slice(0, 16) + '…';
    }
  };
}

// -------- Login --------
const btnLogin = $('btnLogin');
if (btnLogin) {
  btnLogin.onclick = async () => {
    const email = $('loginEmail').value.trim();
    const password = $('loginPass').value;
    $('outLogin').textContent = 'Loading...';
    const r = await fetch('/login_user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    show('outLogin', data);
    token = data.token || null;
    $('tokenShort').textContent = token ? (token.slice(0, 16) + '…') : '(none)';
  };
}

// -------- Logout --------
const btnLogout = $('btnLogout');
if (btnLogout) {
  btnLogout.onclick = async () => {
    if (!token) {
      return show('outLogin', { status: 'already_logged_out' });
    }
    try {
      const r = await fetch('/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      // Clear token on client regardless of server response
      token = null;
      $('tokenShort').textContent = '(none)';
      show('outLogin', data);
    } catch (err) {
      token = null;
      $('tokenShort').textContent = '(none)';
      show('outLogin', { error: 'Network error during logout', detail: String(err) });
    }
  };
}

// -------- Create patient (matches new DB columns) --------
const btnCreatePatient = $('btnCreatePatient');
if (btnCreatePatient) {
  btnCreatePatient.onclick = async () => {
    if (!token) return show('outPatients', { error: 'Login first to get a token' });

    const body = {
      prefix: $('patPrefix').value || null,
      first_name: $('patFirst').value.trim(),
      middle_name: $('patMiddle').value.trim() || null,
      last_name: $('patLast').value.trim(),
      date_of_birth: $('patDOB').value || null,
      sex: $('patSex').value || null,
      phone_number: $('patPhone').value.trim() || null,
      address: $('patAddress').value.trim() || null,
      email: $('patEmail').value.trim() || null,
      emergency_contact_name: $('patEmergencyName').value.trim() || null,
      emergency_contact_phone: $('patEmergencyPhone').value.trim() || null,
      notes: $('patNotes').value.trim() || null,
    };

    if (!body.first_name || !body.last_name) {
      return show('outPatients', { error: 'Patient first & last name required' });
    }

    $('outPatients').textContent = 'Creating...';
    const r = await fetch('/patients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : ''
      },
      body: JSON.stringify(body)
    });

    show('outPatients', await r.json());
  };
}

// -------- List patients --------
const btnList = $('btnListPatients');
if (btnList) {
  btnList.onclick = async () => {
    if (!token) {
      return show('outPatients', { error: 'Login first to get a token' });
    }

    $('outPatients').textContent = 'Loading...';
    try {
      const r = await fetch('/patients', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
      });

      const text = await r.text(); // read raw to debug if not JSON
      let data;
      try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }

      if (!r.ok) {
        console.error('GET /patients failed:', r.status, data);
        return show('outPatients', { error: 'Request failed', status: r.status, data });
      }

      show('outPatients', data);
    } catch (err) {
      console.error('GET /patients error:', err);
      show('outPatients', { error: 'Network error', detail: String(err) });
    }
  };
} else {
  console.warn('btnListPatients element not found in DOM');
}

// -------- Get single patient (by ID, name, DOB) --------
const btnGetOne = $('btnGetPatient');
if (btnGetOne) {
  btnGetOne.onclick = async () => {
    if (!token) return show('outPatients', { error: 'Login first to get a token' });

    const pid = $('patFetchId')?.value ? parseInt($('patFetchId').value, 10) : null;
    const first_name = $('patFetchFirst')?.value.trim() || null;
    const last_name = $('patFetchLast')?.value.trim() || null;
    const date_of_birth = $('patFetchDOB')?.value || null;

    if (!pid && !last_name) {
      return show('outPatients', { error: 'Provide either patient_id or last_name' });
    }

    $('outPatients').textContent = 'Loading...';
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (pid) params.append('id', String(pid));
      if (first_name) params.append('first_name', first_name);
      if (last_name) params.append('last_name', last_name);
      if (date_of_birth) params.append('dob', date_of_birth);

      const r = await fetch(`/patients/search?${params.toString()}`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
      });

      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!r.ok) return show('outPatients', { error: 'Request failed', status: r.status, data });
      show('outPatients', data);
    } catch (err) {
      console.error('GET /patients/search error:', err);
      show('outPatients', { error: 'Network error', detail: String(err) });
    }
  };
} else {
  console.warn('btnGetPatient element not found in DOM');
}