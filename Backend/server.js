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
import crypto from 'crypto';

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

// Helper to define which columns a role is allowed to see
const getPatientColumns = (role) => {
  // Clinicians and Researchers see everything ('*')
  if (role === 'clinician' || role === 'researcher') {
    return '*';
  }
  
  // Admin role: Omit sensitive PII (phone, address, emergency contacts, notes)
  return 'patient_id, user_id, prefix, first_name, middle_name, last_name, date_of_birth, sex, email, created_at';
};

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

// --- Get All Users (Admin Only) with Filtering ---
app.get('/users', authMiddleware, async (req, res) => {
  // 1. Strict Role Check
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }

  // 2. Get filter params
  const { last_name, first_name, role } = req.query;

  try {
    let sql = 'SELECT user_id, prefix, first_name, last_name, email, role, created_at FROM users';
    const conditions = [];
    const params = [];

    // 3. Build dynamic filters
    if (last_name) {
      conditions.push('last_name LIKE ?');
      params.push(`${last_name}%`);
    }
    if (first_name) {
      conditions.push('first_name LIKE ?');
      params.push(`${first_name}%`);
    }
    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    // 4. Sort Ascending
    sql += ' ORDER BY user_id ASC';

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error in GET /users:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// --- Get Single User Details (Admin Only) ---
app.get('/users/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }

  const targetUserId = req.params.id;

  try {
    // 1. Fetch user basics
    const [userRows] = await pool.execute(
      'SELECT user_id, prefix, first_name, middle_name, last_name, email, role, created_at FROM users WHERE user_id = ?',
      [targetUserId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const targetUser = userRows[0];
    let responseData = { user: targetUser };

    // 2. If 'patient', fetch ONLY the linked patient_id
    //    (We removed DOB, phone, address, etc. as requested)
    if (targetUser.role === 'patient') {
      const [patientRows] = await pool.execute(
        `SELECT patient_id FROM patients WHERE user_id = ?`,
        [targetUserId]
      );
      
      if (patientRows.length > 0) {
        responseData.patient = patientRows[0];
      }
    }

    res.json(responseData);

  } catch (err) {
    console.error(`Error in GET /users/${targetUserId}:`, err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// --- Update ANY User (Admin Only) ---
app.put('/users/:id', authMiddleware, async (req, res) => {
  // 1. Security Check
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }

  const targetUserId = req.params.id;
  const { user, patient } = req.body; // Expect nested objects like profile update

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 2. Update the USERS table (Login info)
    // Note: Admins can update email and role, which users can't do themselves
    if (user) {
      await connection.execute(
        `UPDATE users SET 
           prefix = ?, first_name = ?, middle_name = ?, last_name = ?, 
           email = ?, role = ?
         WHERE user_id = ?`,
        [
          user.prefix, user.first_name, user.middle_name, user.last_name,
          user.email, user.role,
          targetUserId
        ]
      );
    }

    // 3. If target is a 'patient' and patient data is provided, update PATIENTS table
    if (patient) {
      const {
        prefix, first_name, middle_name, last_name,
        date_of_birth, sex, phone_number,
        address, emergency_contact_name, 
        emergency_contact_phone
      } = patient;

      await connection.execute(
        `UPDATE patients SET 
           prefix = ?, first_name = ?, middle_name = ?, last_name = ?,
           date_of_birth = ?, sex = ?, phone_number = ?, address = ?, 
           email = ?, emergency_contact_name = ?, emergency_contact_phone = ?
         WHERE user_id = ?`,
        [
          prefix, first_name, middle_name, last_name,
          date_of_birth, sex, phone_number, address,
          user.email, // Sync email from the user object
          emergency_contact_name, emergency_contact_phone,
          targetUserId
        ]
      );
    }

    await connection.commit();
    res.json({ status: 'ok', message: 'User updated successfully' });

  } catch (err) {
    if (connection) await connection.rollback();
    
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email is already in use by another user.' });
    }

    console.error(`Error in PUT /users/${targetUserId}:`, err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// --- Delete User (Admin Only) ---
app.delete('/users/:id', authMiddleware, async (req, res) => {
  // 1. Security Check: Admins only
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }

  const targetUserId = req.params.id;

  // 2. Prevent self-deletion
  if (parseInt(targetUserId) === req.user.uid) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  try {
    // 3. Execute Delete
    const [result] = await pool.execute('DELETE FROM users WHERE user_id = ?', [targetUserId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ status: 'ok', message: 'User deleted successfully' });

  } catch (err) {
    // 4. Handle Foreign Key Constraints (e.g., User is an author of EHR notes)
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ 
        error: 'Cannot delete user. This user has created clinical records or is linked to other critical data.' 
      });
    }
    
    console.error(`Error in DELETE /users/${targetUserId}:`, err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// --- Patients (protected) ---
app.get('/patients', authMiddleware, async (req, res) => {
  const columns = getPatientColumns(req.user.role); // Dynamically select columns
  try {
    const [rows] = await pool.execute(`SELECT ${columns} FROM patients ORDER BY patient_id DESC`);
    res.json(rows);
  } catch (err) {
    console.error('Error in GET /patients:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// --- REPLACE your existing app.post('/patients') route with this ---

app.post('/patients', authMiddleware, async (req, res) => {
  // 1. Get all data from the request body
  const {
    prefix = null,
    first_name = null,
    middle_name = null,
    last_name = null,
    date_of_birth = null,
    sex = null,
    phone_number = null,
    address = null,
    email = null, // This will be the new user's email
    emergency_contact_name = null,
    emergency_contact_phone = null,
    notes_text = null
  } = req.body;

  // 2. Validation
  if (!first_name || !last_name)
    return res.status(400).json({ error: 'first_name and last_name required' });
  if (!email)
    return res.status(400).json({ error: 'Email is required to create a patient user account' });

  // 3. Generate a secure random password (e.g., 'a4b2c8f1')
  const randomPassword = crypto.randomBytes(4).toString('hex');
  const hashedPassword = await bcrypt.hash(randomPassword, 10);

  // 4. We must use a transaction to create two records at once.
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 5. Create the new User first, with role 'patient'
    const [userResult] = await connection.execute(
      `INSERT INTO users (prefix, first_name, middle_name, last_name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, 'patient')`,
      [prefix, first_name, middle_name, last_name, email, hashedPassword]
    );
    
    const newUserId = userResult.insertId;

    // 6. ✨ THIS IS THE FIX ✨
    // Now, create the Patient record and link it to the new user_id
    const [patientResult] = await connection.execute(
      `INSERT INTO patients (user_id, prefix, first_name, middle_name, last_name, 
                             date_of_birth, sex, phone_number,
                             address, email, emergency_contact_name, 
                             emergency_contact_phone, notes_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, // <-- 13 placeholders
      [
        newUserId, // <-- This is the new linked ID
        prefix, first_name, middle_name, last_name,
        date_of_birth, sex, phone_number,
        address, email, emergency_contact_name,
        emergency_contact_phone, notes_text
      ]
    );

    // 7. If both inserts succeed, commit the transaction
    await connection.commit();

    // 8. Return success and the temporary password
    res.status(201).json({
      status: 'ok',
      patient_id: patientResult.insertId,
      user_id: newUserId,
      email: email,
      temp_password: randomPassword // So the clinician can give it to the patient
    });

  } catch (err) {
    // If anything fails, roll back all changes
    if (connection) await connection.rollback();

    // Handle specific errors
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('users.email')) {
        return res.status(400).json({ error: 'This email is already registered to a user.' });
      }
      if (err.message.includes('patients.user_id')) {
         return res.status(400).json({ error: 'This user is already linked to a patient profile.' });
      }
    }

    console.error('Error in POST /patients (transaction):', err);
    res.status(500).json({ error: 'Database error during transaction', detail: err.message });
  
  } finally {
    // Always release the connection back to the pool
    if (connection) connection.release();
  }
});

// --- Search patients ---
app.get('/patients/search', authMiddleware, async (req, res) => {
  const { last_name, first_name, date_of_birth } = req.query;
  const columns = getPatientColumns(req.user.role); // Dynamically select columns

  if (!last_name) return res.status(400).json({ error: 'last_name required' });

  try {
    const conditions = ['last_name LIKE ?'];
    const params = [`${last_name}%`];

    if (first_name) {
      conditions.push('first_name LIKE ?');
      params.push(`${first_name}%`);
    }
    
    if (date_of_birth) {
      conditions.push('date_of_birth = ?');
      params.push(date_of_birth);
    }
    
    const [rows] = await pool.execute(
      `SELECT ${columns} FROM patients WHERE ${conditions.join(' AND ')}`, // Use dynamic columns
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Error in GET /patients/search:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// --- Get single patient by ID ---
app.get('/patients/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const columns = getPatientColumns(req.user.role); // Dynamically select columns

  if (isNaN(Number(id))) {
    return res.status(400).json({ error: 'Invalid patient ID format' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT ${columns} FROM patients WHERE patient_id = ?`, // Use dynamic columns
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error(`Error in GET /patients/${id}:`, err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// --- Update a patient's details (by a clinician) ---
app.put('/patients/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userRole = req.user.role;

  // 1. Security Check: Only clinicians or admins can do this
  if (userRole !== 'clinician' && userRole !== 'admin') {
    return res.status(403).json({ error: 'You do not have permission to perform this action' });
  }

  // 2. Get data from the body
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

  // 3. Validation
  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: 'First name, last name, and email are required' });
  }
  
  try {
    // 4. Run the update query
    const [result] = await pool.execute(
      `UPDATE patients SET 
         prefix = ?, first_name = ?, middle_name = ?, last_name = ?,
         date_of_birth = ?, sex = ?, phone_number = ?, address = ?, 
         email = ?, emergency_contact_name = ?, emergency_contact_phone = ?, 
         notes_text = ?
       WHERE patient_id = ?`,
      [
        prefix, first_name, middle_name, last_name,
        date_of_birth, sex, phone_number, address,
        email, emergency_contact_name, emergency_contact_phone,
        notes_text,
        id // The patient_id from the URL
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Patient not found or no changes made' });
    }

    res.json({ status: 'ok', message: 'Patient updated successfully' });

  } catch (err) {
    console.error(`Error in PUT /patients/${id}:`, err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});


// --- Get complete user profile (and patient data if applicable) ---
app.get('/api/profile', authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const userRole = req.user.role;

  try {
    // 1. Fetch the user's data from the 'users' table
    const [userRows] = await pool.execute(
      'SELECT user_id, prefix, first_name, middle_name, last_name, email, role, created_at FROM users WHERE user_id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const profileData = {
      user: userRows[0],
      patient: null // Default to null
    };

    // 2. If the user is a 'patient', find their linked patient record
    if (userRole === 'patient') {
      const [patientRows] = await pool.execute(
        'SELECT * FROM patients WHERE user_id = ?',
        [userId]
      );
      
      if (patientRows.length > 0) {
        profileData.patient = patientRows[0];
      }
    }

    // 3. Return the combined profile data
    res.json(profileData);

  } catch (err) {
    console.error(`Error in GET /api/profile for user ${userId}:`, err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// --- Update user profile ---
app.put('/api/profile', authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const userRole = req.user.role;

  // 1. Get the allowed fields from the body for the 'users' table
  const {
    prefix, first_name, middle_name, last_name
  } = req.body.user;

  // 2. Get the allowed fields for the 'patients' table
  const patientData = req.body.patient;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 3. Update the 'users' table (same as before)
    await connection.execute(
      `UPDATE users SET prefix = ?, first_name = ?, middle_name = ?, last_name = ?
       WHERE user_id = ?`,
      [prefix, first_name, middle_name, last_name, userId]
    );

    // 4. If they are a patient and patient data was provided, update 'patients' table
    if (userRole === 'patient' && patientData) {
      
      // ✨ FIX: Destructure *without* notes_text
      const {
        prefix, first_name, middle_name, last_name,
        date_of_birth, sex, phone_number,
        address, emergency_contact_name, 
        emergency_contact_phone // <-- notes_text is removed
      } = patientData;

      // ✨ FIX: Update query *without* notes_text
      await connection.execute(
        `UPDATE patients SET prefix = ?, first_name = ?, middle_name = ?, last_name = ?,
         date_of_birth = ?, sex = ?, phone_number = ?, address = ?, 
         emergency_contact_name = ?, emergency_contact_phone = ?
         WHERE user_id = ?`, // <-- notes_text = ? is removed
        [
          prefix, first_name, middle_name, last_name,
          date_of_birth, sex, phone_number,
          address, emergency_contact_name, 
          emergency_contact_phone, // <-- notes_text is removed
          userId 
        ]
      );
    }

    // 5. Commit the transaction
    await connection.commit();
    res.json({ status: 'ok', message: 'Profile updated successfully' });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error(`Error in PUT /api/profile for user ${userId}:`, err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/profile/change-password', authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const { currentPassword, newPassword } = req.body;

  // 1. Validation
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  try {
    // 2. Get the user's current password hash from the DB
    const [rows] = await pool.execute(
      'SELECT password_hash FROM users WHERE user_id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = rows[0];
    
    // 3. Check if the submitted 'currentPassword' matches the one in the DB
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    // 4. Hash the new password
    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    // 5. Update the user's password in the DB
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE user_id = ?',
      [newHashedPassword, userId]
    );

    res.json({ status: 'ok', message: 'Password updated successfully' });

  } catch (err) {
    console.error(`Error in POST /api/profile/change-password for user ${userId}:`, err);
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