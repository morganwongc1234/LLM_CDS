// server.js — main Express backend for BIOM9450 CDS
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

// --- Database connection pool ---
const pool = mysql.createPool({
  host: (process.env.DB_HOST || '127.0.0.1').trim(),
  port: Number((process.env.DB_PORT || '3306').trim()),
  user: (process.env.DB_USER || 'cds_user').trim(),
  password: (process.env.DB_PASS || 'StrongPass!123').trim(),
  database: (process.env.DB_NAME || 'cds_db').trim(),
});

// --- Express setup ---
const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../Frontend')));

// --- JWT helper ---
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing token' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- Health check ---
app.get('/api/health', (req, res) => res.send('✅ Server is healthy'));

// --- Register user ---
app.post('/register_user', async (req, res) => {
  const { prefix, first_name, middle_name, last_name, email, password, role } = req.body;

  if (!email || !password || !first_name || !last_name || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.execute(
      `INSERT INTO users (prefix, first_name, middle_name, last_name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [prefix, first_name, middle_name, last_name, email, hash, role]
    );

    const newUserId = r.insertId;
    const token = jwt.sign(
      { uid: newUserId, role, email },
      process.env.JWT_SECRET || 'devsecret',
      { expiresIn: '2h' }
    );

    return res.status(201).json({
      status: 'ok',
      user_id: newUserId,
      email,
      role,
      token
    });

  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        error: 'This email is already registered.'
      });
    }

    console.error('Register error', err);
    return res.status(500).json({
      error: 'Database error',
      detail: err.message
    });
  }
});

// --- Login user (returns token + role) ---
app.post('/login_user', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Missing credentials', error_code: 'MISSING_CREDENTIALS' });

  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      // Email not found
      return res.status(401).json({
        error: 'This email is not registered. Please check and try again.',
        error_code: 'INVALID_EMAIL'
      });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      // Password mismatch
      return res.status(401).json({
        error: 'Incorrect password.',
        error_code: 'INVALID_PASSWORD'
      });
    }

    const token = jwt.sign(
      { uid: user.user_id, role: user.role, email: user.email },
      process.env.JWT_SECRET || 'devsecret',
      { expiresIn: '2h' }
    );
    res.json({ token, role: user.role, email: user.email });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// --- Current user ---
app.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, first_name, last_name, email, role FROM users WHERE user_id = ?',
      [req.user.uid]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ me: rows[0] });
  } catch (err) {
    console.error('[ERROR] /me failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Patients (protected) ---
app.get('/patients', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM patients ORDER BY patient_id DESC');
    res.json(rows);
  } catch (err) {
    // ✨ ADDED LOGGING
    console.error('Error in GET /patients:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

app.post('/patients', authMiddleware, async (req, res) => {
  // 1. UPDATE DESTRUCTURING to default to 'null'
  // This prevents 'undefined' errors
  const {
    prefix = null,
    first_name = null,
    middle_name = null,
    last_name = null,
    date_of_birth = null,
    sex = null,
    phone_number = null,
    address = null,
    email = null,
    emergency_contact_name = null,
    emergency_contact_phone = null,
    notes_text = null
  } = req.body;

  // 2. Your validation remains (first_name and last_name are required)
  if (!first_name || !last_name)
    return res.status(400).json({ error: 'first_name and last_name required' });

  try {
    // This SQL and params array are now safe
    const [r] = await pool.execute(
      `INSERT INTO patients (prefix, first_name, middle_name, last_name, 
                             date_of_birth, sex, phone_number,
                             address, email, emergency_contact_name, 
                             emergency_contact_phone, notes_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prefix, first_name, middle_name, last_name,
       date_of_birth, sex, phone_number,
       address, email, emergency_contact_name,
       emergency_contact_phone, notes_text]
    );

    res.status(201).json({ status: 'ok', patient_id: r.insertId });

  } catch (err) {
    console.error('Error in POST /patients:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// --- Search patients ---
app.get('/patients/search', authMiddleware, async (req, res) => {
  // 1. Read 'date_of_birth' from the query (or 'dob' if you prefer, but be consistent)
  const { last_name, first_name, date_of_birth } = req.query;

  if (!last_name) return res.status(400).json({ error: 'last_name required' });

  try {
    const conditions = ['last_name LIKE ?'];
    const params = [`%${last_name}%`];

    if (first_name) {
      conditions.push('first_name LIKE ?');
      params.push(`%${first_name}%`);
    }
    
    // 2. Check for 'date_of_birth' and use the correct column name in the SQL
    if (date_of_birth) {
      conditions.push('date_of_birth = ?'); // <-- CORRECTED COLUMN NAME
      params.push(date_of_birth);
    }
    
    const [rows] = await pool.execute(
      `SELECT * FROM patients WHERE ${conditions.join(' AND ')}`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Error in GET /patients/search:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// // --- Reports (placeholder for LLM integration) ---
// app.post('/reports/generate', authMiddleware, async (req, res) => {
//   const { patient_id, user_prompt } = req.body;
//   if (!patient_id || !user_prompt)
//     return res.status(400).json({ error: 'Missing required fields' });
//   // TODO: integrate Mistral API (test2.js logic)
//   res.json({ message: 'LLM generation placeholder', patient_id, user_prompt });
// });

// --- Fallback (Frontend index) ---
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

// --- Start server ---
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});