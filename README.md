# 🧠 LLM_CDS – Clinical Decision Support Platform

This project is a **Lightweight Clinical Decision Support (CDS)** system built for **BIOM9450**.  
It allows users (clinicians, researchers, admins, and patients) to securely register, log in,  
create and manage patient records, and generate AI-powered treatment plans using the **Mistral API**.

---

## 🚀 Features

- Secure **user registration and JWT-based login**
- Role-based access (clinician, researcher, admin, patient)
- Patient database with demographics, contacts, and notes
- Protected REST API built with **Express + MySQL2**
- Simple web frontend for testing (HTML + JS)
- LLM integration via **Mistral AI** for report generation

---

## 🧩 Project Structure

```
LLM_CDS/
├── Backend/
│   ├── server.js        # Express API
│   ├── database.sql     # Database schema
│   ├── .env.example     # Environment template
│   ├── test.js          # Mistral API test script
│   └── package.json
│
├── Frontend/
│   ├── index.html       # Minimal UI for testing API
│   ├── app.js           # Frontend logic (fetch calls)
│   └── style.css
│
└── README.md
```

---

## ⚙️ Prerequisites

Before running the project, install the following:

- **Node.js** ≥ 18  
- **MySQL** ≥ 8.0  
- (Optional) **curl** for quick endpoint testing  
- A **Mistral API key** from [https://console.mistral.ai](https://console.mistral.ai)

---

## 🧰 Installation & Setup

### 1️⃣ Clone the repository

```bash
git clone https://github.com/yourusername/LLM_CDS.git
cd LLM_CDS/Backend
```

---

### 2️⃣ Install backend dependencies

```bash
npm install
```

---

### 3️⃣ Create the MySQL database

Start MySQL and then run:

```sql
CREATE DATABASE cds_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cds_user'@'127.0.0.1' IDENTIFIED BY 'StrongPass!123';
GRANT ALL PRIVILEGES ON cds_db.* TO 'cds_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Then import the schema:

```bash
mysql -u cds_user -pStrongPass!123 -h 127.0.0.1 cds_db < database.sql
```

---

### 4️⃣ Create a `.env` file in `/Backend`

Example:

```bash
# --- MySQL ---
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=cds_user
DB_PASS=StrongPass!123
DB_NAME=cds_db

# --- JWT ---
JWT_SECRET=SuperSecretKey

# --- Mistral API ---
MISTRAL_API_KEY=your_actual_api_key_here
```

---

### 5️⃣ Start the server

```bash
npm run dev
```

or manually:

```bash
node server.js
```

If everything works, you should see:

```
DB cfg in use: { host: '127.0.0.1', user: 'cds_user', name: 'cds_db' }
🚀 Server running at http://localhost:8000
```

---

### 6️⃣ Open the frontend

Open in your browser:

```
http://localhost:8000
```

or if you prefer local file view:

```
Frontend/index.html
```

---

### 7️⃣ Test Mistral AI integration

```bash
cd Backend
node test.js
```

Expected output (example):

```
Key length = 32 starts with = 6eitnt
Chat: In Cantonese, you can say “你好” (nei5 hou2) to mean “hello”.
```

---

## 🔑 Default User Roles

| Role | Description | Access |
|------|--------------|--------|
| **admin** | Full access to all users and patients | All routes |
| **clinician** | Can create & view patients | Patients CRUD |
| **researcher** | Can view anonymised patient data | Read-only |
| **patient** | Can view their own records only | Limited |

---

## 🧭 API Reference

Base URL (dev): `http://localhost:8000`  
All JSON bodies use `Content-Type: application/json`.

---

### Auth & Headers

Most endpoints require a JWT in the header:

```
Authorization: Bearer <token>
```

You get this token from `POST /register_user` (auto-login) or `POST /login_user`.

---

### **GET `/api/health`**
Simple DB connectivity check.

**Auth:** Not required  
**Response:**
```json
{ "ok": true }
```

---

### **GET `/ping`**
Server liveness check.

**Auth:** Not required  
**Response:**
```json
{ "pong": true, "t": 1730xxxxx }
```

---

### **POST `/register_user`**
Create a new user. Returns a JWT token so the user is “logged in” immediately.

**Auth:** Not required  
**Body (JSON):**
- `email` (string, **required**)
- `password` (string, **required**, min 8 chars)
- `role` (enum, **required**): `clinician`, `researcher`, `admin`, `patient`
- `prefix` (string, optional)
- `first_name` (string, **required**)
- `middle_name` (string, optional)
- `last_name` (string, **required**)

**Example:**
```bash
curl -X POST http://localhost:8000/register_user \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@clinic.org","password":"Passw0rd!","role":"clinician","first_name":"Alice","last_name":"Ng"}'
```

---

### **POST `/login_user`**
Login and get a JWT token.

**Auth:** Not required  
**Body:**
```json
{ "email": "alice@clinic.org", "password": "Passw0rd!" }
```

**Response:**
```json
{ "token": "<JWT>" }
```

---

### **GET `/me`**
Get current user info (decoded JWT).

**Auth:** Required  
**Response:**
```json
{ "me": { "uid": 3, "role": "clinician", "email": "alice@clinic.org" } }
```

---

### **POST `/patients`**
Create a new patient.

**Auth:** Required  
**Body (JSON):**
```json
{
  "first_name": "Sam",
  "last_name": "Lee",
  "date_of_birth": "1985-04-11",
  "sex": "F",
  "address": "1 High St, NSW",
  "phone_number": "0400 000 000"
}
```

**Response:**
```json
{ "patient_id": 12, "first_name": "Sam", "last_name": "Lee" }
```

---

### **GET `/patients`**
List all patients (role-aware).

**Auth:** Required  
**Response:**
```json
[
  {
    "patient_id": 12,
    "first_name": "Sam",
    "last_name": "Lee",
    "dob": "1985-04-11"
  }
]
```

---

### **GET `/patients/search`**
Search by ID, or last name (plus optional first name + DOB).

**Auth:** Required  
**Query params:**
```
id          (number, optional)
last_name   (string, required if no id)
first_name  (string, optional)
dob         (string, optional, YYYY-MM-DD)
```

**Example:**
```bash
curl "http://localhost:8000/patients/search?last_name=Lee&first_name=Sam" \
  -H "Authorization: Bearer <JWT>"
```

---

## 🧠 LLM Integration

The `test.js` script demonstrates how to send patient data to **Mistral AI**  
for automated medical summaries and treatment plans.

**Command:**
```bash
node test.js
```

It outputs a structured Markdown report with:
1. Summary
2. Differential diagnosis
3. Management plan
4. Patient education

---

## 🧱 Database Schema Overview

### `users`
| Column | Type | Required | Description |
|--------|------|-----------|-------------|
| `user_id` | INT AUTO_INCREMENT | ✅ | Primary key |
| `prefix` | VARCHAR(20) | ❌ | e.g. Dr., Mr., Ms. |
| `first_name` | VARCHAR(50) | ✅ | User’s first name |
| `middle_name` | VARCHAR(50) | ❌ | Optional |
| `last_name` | VARCHAR(50) | ✅ | User’s last name |
| `email` | VARCHAR(100) | ✅ | Unique |
| `password_hash` | VARCHAR(255) | ✅ | Bcrypt hash |
| `role` | ENUM(...) | ✅ | admin, clinician, etc. |

### `patients`
| Column | Type | Required | Description |
|--------|------|-----------|-------------|
| `patient_id` | INT AUTO_INCREMENT | ✅ | Primary key |
| `prefix` | VARCHAR(20) | ❌ | e.g. Mr., Ms. |
| `first_name` | VARCHAR(50) | ✅ | Patient’s first name |
| `middle_name` | VARCHAR(50) | ❌ | Optional |
| `last_name` | VARCHAR(50) | ✅ | Patient’s last name |
| `date_of_birth` | DATE | ❌ | Optional |
| `sex` | VARCHAR(10) | ❌ | Optional |
| `phone_number` | VARCHAR(20) | ❌ | Optional |
| `address` | TEXT | ❌ | Optional |
| `email` | VARCHAR(100) | ❌ | Optional |
| `emergency_contact_name` | VARCHAR(100) | ❌ | Optional |
| `emergency_contact_phone` | VARCHAR(20) | ❌ | Optional |
| `notes_text` | TEXT | ❌ | Optional |

---

## 🧾 License

MIT License © 2025  
Developed by **Mina Truong** for the BIOM9450 project.

---