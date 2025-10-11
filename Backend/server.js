// server.js
import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import cors from 'cors';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[BOOT] starting server.js');
process.on('uncaughtException', e => console.error('[uncaughtException]', e));
process.on('unhandledRejection', e => console.error('[unhandledRejection]', e));
process.on('exit', code => console.error('[exit]', code));

// --- Database connection pool ---
const pool = mysql.createPool({
  host: (process.env.DB_HOST || '127.0.0.1').trim(),
  port: Number((process.env.DB_PORT || '3306').trim()),
  user: (process.env.DB_USER || 'cds_user').trim(),
  password: (process.env.DB_PASS || 'StrongPass!123').trim(),
  database: (process.env.DB_NAME || 'cds_db').trim(),
  connectionLimit: 10,
  connectTimeout: 5000,       // Optional: helps prevent hanging connections
  waitForConnections: true,
  queueLimit: 0
});

console.log('DB cfg in use:', {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  name: process.env.DB_NAME
});


// --- Express app setup ---
const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));
// Serve static files from LLM_CDS/Frontend (root of the frontend)
app.use(express.static(path.join(__dirname, '../Frontend')));

// Explicitly serve the frontend index file at root
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

// put this near the top, after app.use(...) middlewares
app.get('/ping', (_req, res) => res.json({ pong: true, t: Date.now() }));

// --- Health check ---
app.get('/api/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// --- Register user ---
app.post('/register_user', async (req, res) => {
  const {
    email,
    password,
    role = 'clinician',
    prefix = null,
    first_name = null,
    middle_name = null,
    last_name = null,
  } = req.body || {};

  if (!email || !/\S+@\S+\.\S+/.test(email))
    return res.status(400).json({ error: 'Invalid email' });
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!['clinician', 'researcher', 'admin', 'patient'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });

  // If you REQUIRE names at signup, keep this:
  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'first_name and last_name are required' });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const [r] = await pool.execute(
      `INSERT INTO users
         (email, password_hash, role, prefix, first_name, middle_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, hash, role, prefix, first_name, middle_name, last_name]
    );
    // @ts-ignore
    const token = jwt.sign(
      { uid: r.insertId, role, email },
      process.env.JWT_SECRET || 'devsecret',
      { expiresIn: '2h' }
    );
    return res.status(201).json({
      status: 'ok',
      user_id: r.insertId,
      email,
      role,
      first_name,
      last_name,
      token
    });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('REGISTER DB ERROR:', {
      code: e.code, errno: e.errno, sqlState: e.sqlState, msg: e.sqlMessage, sql: e.sql
    });
    return res.status(500).json({ error: 'Database error', code: e.code, detail: e.sqlMessage });
  }
});

// --- Login user (returns JWT) ---
app.post('/login_user', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  const [rows] = await pool.execute(
    'SELECT user_id, email, password_hash, role FROM users WHERE email = ?',
    [email]
  );
  const user = /** @type {any[]} */ (rows)[0];
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { uid: user.user_id, role: user.role, email: user.email },
    process.env.JWT_SECRET || 'devsecret',
    { expiresIn: '2h' }
  );

  return res.json({ token });
});

// --- Tiny auth middleware (for future protected routes) ---
function requireAuth(req, res, next) {
  const h = req.header('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) {
    console.warn('[AUTH] Missing token header');
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.user = payload; // { uid, role, email }
    return next();
  } catch (e) {
    console.warn('[AUTH] Invalid token:', String(e));
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Example protected route ---
// --- Helpers for field-level projection ---
function computeAge(dobStr) {
  if (!dobStr) return null;
  const d = new Date(dobStr);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function projectPatient(row, role) {
  // common base
  const base = {
    patient_id: row.patient_id,
    created_at: row.created_at,
  };

  if (role === 'admin') {
    return {
      ...base,
      prefix: row.prefix,
      first_name: row.first_name,
      middle_name: row.middle_name,
      last_name: row.last_name,
      date_of_birth: row.date_of_birth,
      sex: row.sex,
      phone_number: row.phone_number,
      address: row.address,
      email: row.email,
      emergency_contact_name: row.emergency_contact_name,
      emergency_contact_phone: row.emergency_contact_phone,
      notes: row.notes_text,
    };
  }

  if (role === 'clinician') {
    return {
      ...base,
      prefix: row.prefix,
      first_name: row.first_name,
      middle_name: row.middle_name,
      last_name: row.last_name,
      date_of_birth: row.date_of_birth,
      sex: row.sex,
      phone_number: row.phone_number,
      address: row.address,
      email: row.email,
      emergency_contact_name: row.emergency_contact_name,
      emergency_contact_phone: row.emergency_contact_phone,
      notes: row.notes_text,
    };
  }

  if (role === 'researcher') {
    // de-identified view
    return {
      ...base,
      age: computeAge(row.date_of_birth),
      sex: row.sex,
      // No names, address, phone, email
      notes: row.notes_text ? '[redacted]' : null, // or keep null/omit
    };
  }

  if (role === 'patient') {
    // patient sees their own full record only (handled by query below)
    return {
      ...base,
      prefix: row.prefix,
      first_name: row.first_name,
      middle_name: row.middle_name,
      last_name: row.last_name,
      date_of_birth: row.date_of_birth,
      sex: row.sex,
      phone_number: row.phone_number,
      address: row.address,
      email: row.email,
      emergency_contact_name: row.emergency_contact_name,
      emergency_contact_phone: row.emergency_contact_phone,
      notes: row.notes_text,
    };
  }

  // default safest
  return { ...base };
}

// --- GET /patients (role-aware) ---
app.get('/patients', requireAuth, async (req, res) => {
  const role = req.user?.role;
  const userEmail = req.user?.email;
  console.log('[GET /patients] role=%s email=%s', role, userEmail || '(none)');

  try {
    let rows;

    if (role === 'patient') {
      const [r] = await pool.execute(
        `SELECT patient_id, prefix, first_name, middle_name, last_name,
                date_of_birth, sex, phone_number, address, email,
                emergency_contact_name, emergency_contact_phone,
                notes_text, created_at
         FROM patients
         WHERE email = ?
         ORDER BY patient_id DESC`,
        [userEmail || '']
      );
      rows = r;
    } else {
      const [r] = await pool.execute(
        `SELECT patient_id, prefix, first_name, middle_name, last_name,
                date_of_birth, sex, phone_number, address, email,
                emergency_contact_name, emergency_contact_phone,
                notes_text, created_at
         FROM patients
         ORDER BY patient_id DESC`
      );
      rows = r;
    }

    const data = /** @type {any[]} */ (rows).map(row => projectPatient(row, role));
    console.log('[GET /patients] found=%d', Array.isArray(data) ? data.length : -1);
    return res.json(data);
  } catch (e) {
    console.error('[GET /patients] DB error:', e);
    return res.status(500).json({ error: 'Database error', detail: String(e) });
  }
});

app.get('/patients_raw', requireAuth, async (_req, res) => {
  try {
    const [r] = await pool.execute(
      `SELECT patient_id, prefix, first_name, middle_name, last_name,
              date_of_birth, sex, phone_number, address, email,
              emergency_contact_name, emergency_contact_phone,
              notes_text, created_at
       FROM patients
       ORDER BY patient_id DESC`
    );
    return res.json(r);
  } catch (e) {
    console.error('[GET /patients_raw] DB error:', e);
    return res.status(500).json({ error: 'Database error', detail: String(e) });
  }
});

// --- GET /patients/search (by id OR by last_name [+ first_name + dob]) ---
app.get('/patients/search', requireAuth, async (req, res) => {
  const role = req.user?.role;
  const userEmail = req.user?.email || null;

  // Query params (strings)
  const idParam = req.query.id;
  const firstParam = req.query.first_name;
  const lastParam = req.query.last_name;
  const dobParam = req.query.dob; // yyyy-mm-dd

  try {
    // If id is provided, prefer exact id lookup
    if (idParam) {
      const idNum = Number(idParam);
      if (!Number.isInteger(idNum) || idNum < 1) {
        return res.status(400).json({ error: 'Invalid id parameter' });
      }

      const params = [idNum];
      let where = 'patient_id = ?';

      if (role === 'patient' && userEmail) {
        // Patient can only retrieve their own record
        where += ' AND email = ?';
        params.push(userEmail);
      }

      const [rows] = await pool.execute(
        `SELECT patient_id, prefix, first_name, middle_name, last_name,
                date_of_birth, sex, phone_number, address, email,
                emergency_contact_name, emergency_contact_phone,
                notes_text, created_at
         FROM patients
         WHERE ${where}
         LIMIT 5`,
        params
      );

      const data = /** @type {any[]} */ (rows).map(row => projectPatient(row, role));
      return res.json(data);
    }

    // Otherwise require last_name when not using id
    const last = typeof lastParam === 'string' && lastParam.trim() ? lastParam.trim() : null;
    const first = typeof firstParam === 'string' && firstParam.trim() ? firstParam.trim() : null;
    const dob = typeof dobParam === 'string' && dobParam.trim() ? dobParam.trim() : null;

    if (!last) {
      return res.status(400).json({ error: 'last_name is required when id is not provided' });
    }

    const whereParts = ['last_name = ?'];
    const params = [last];
    if (first) { whereParts.push('first_name = ?'); params.push(first); }
    if (dob) { whereParts.push('date_of_birth = ?'); params.push(dob); }

    if (role === 'patient' && userEmail) {
      // patient can only see their own record even when searching by name
      whereParts.push('email = ?');
      params.push(userEmail);
    }

    const sql = `SELECT patient_id, prefix, first_name, middle_name, last_name,
                        date_of_birth, sex, phone_number, address, email,
                        emergency_contact_name, emergency_contact_phone,
                        notes_text, created_at
                 FROM patients
                 WHERE ${whereParts.join(' AND ')}
                 ORDER BY patient_id DESC
                 LIMIT 50`;

    const [rows] = await pool.execute(sql, params);
    const data = /** @type {any[]} */ (rows).map(row => projectPatient(row, role));
    return res.json(data);
  } catch (e) {
    console.error('[GET /patients/search] DB error:', e);
    return res.status(500).json({ error: 'Database error', detail: String(e) });
  }
});

// --- Optional: GET /patients/:id (role-aware for a single record) ---
app.get('/patients/:id', requireAuth, async (req, res) => {
  const role = req.user?.role;
  const userEmail = req.user?.email;
  const patientId = Number(req.params.id);

  if (!Number.isInteger(patientId)) {
    return res.status(400).json({ error: 'Invalid patient id' });
  }

  try {
    const params = [patientId];
    let where = 'patient_id = ?';

    if (role === 'patient') {
      // ensure the requested record belongs to the user
      where += ' AND email = ?';
      params.push(userEmail || '');
    }

    const [rows] = await pool.execute(
      `SELECT patient_id, prefix, first_name, middle_name, last_name,
              date_of_birth, sex, phone_number, address, email,
              emergency_contact_name, emergency_contact_phone,
              notes_text, created_at
       FROM patients
       WHERE ${where}
       LIMIT 1`,
      params
    );

    const row = /** @type {any[]} */ (rows)[0];
    if (!row) return res.status(404).json({ error: 'Not found' });

    res.json(projectPatient(row, role));
  } catch (e) {
    console.error('GET /patients/:id error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});


// --- Patients: create (protected) ---
app.post('/patients', requireAuth, async (req, res) => {
  // Expect detailed fields (all optional except at least one of name fields)
  const {
    prefix,
    first_name,
    middle_name,
    last_name,
    date_of_birth, // ISO yyyy-mm-dd
    sex,           // 'M' | 'F' | 'X' or similar
    phone_number,
    address,
    email,
    emergency_contact_name,
    emergency_contact_phone,
    notes
  } = req.body || {};

  // basic validation: require at least a last_name or first_name
  if (!first_name && !last_name) {
    return res.status(400).json({ error: 'first_name or last_name is required' });
  }

  try {
    const [r] = await pool.execute(
      `INSERT INTO patients (
         prefix, first_name, middle_name, last_name,
         date_of_birth, sex, phone_number, address, email,
         emergency_contact_name, emergency_contact_phone,
         notes_text
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        prefix ?? null,
        first_name ?? null,
        middle_name ?? null,
        last_name ?? null,
        date_of_birth ?? null,
        sex ?? null,
        phone_number ?? null,
        address ?? null,
        email ?? null,
        emergency_contact_name ?? null,
        emergency_contact_phone ?? null,
        notes ?? null
      ]
    );
    // @ts-ignore
    return res.status(201).json({ patient_id: r.insertId });
  } catch (e) {
    console.error('POST /patients error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

// --- Logout (invalidate token client-side only) ---
app.post('/logout', requireAuth, async (req, res) => {
  try {
    // With JWTs, logout is handled by client deletion of token.
    // But we can also record a blacklist entry or session log if needed.
    // For now, just return success.
    return res.json({ status: 'logged_out', user: req.user?.email });
  } catch (e) {
    console.error('[POST /logout] error:', e);
    return res.status(500).json({ error: 'Logout failed', detail: String(e) });
  }
});

// --- Start the server ---
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
server.on('error', err => console.error('[server error]', err));

// Generic 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', method: req.method, path: req.path });
});

app.get('/debug/db-whoami', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT CURRENT_USER() AS current_user, USER() AS user, @@socket AS socket, @@port AS port, @@hostname AS hostname"
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

