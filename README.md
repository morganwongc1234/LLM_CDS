# 🧠 LLM_CDS – Clinical Decision Support Platform

This project is a **Lightweight Clinical Decision Support (CDS)** system built for **BIOM9450**.  
It allows users (clinicians, researchers, admins, and patients) to securely register, log in,  
create and manage patient records, providing a backend framework for storing and analysing 
electronic health records. The built-in multi-agent clinical reasoning engine simulates a medical
panel, performing step-wise diagnostic reasoning using the **OpenAI API**.

---

## 🚀 Features

- Secure **user registration and JWT-based login**
- Role-based access (clinician, researcher, admin, patient)
- Patient database with demographics, contacts, and notes
- Protected REST API built with **Express + MySQL2**
- Simple web frontend for testing (HTML + JS)
- Multi-agent reasoning panel with 5 simulated clinicians
- Adaptive temperature and persona rotation for diverse reasoning
- Persistent MySQL storage for EHRs, reasoning flows, and step history

---

## 🧩 Project Structure

```
LLM_CDS/
├── Backend/
│   ├── lib/
│   │   ├── db.js           # MySQL connection pool
│   │   └── openai.js       # OpenAI JSON client helper
│   │
│   ├── panel/
│   │   ├── orchestrator.js # Core controller for reasoning
│   │   ├── panel_prompt.js # Prompt builder and temp control logic
│   │   ├── personas.js     # Defines panel rules and logic
│   │   └── schema.js       # Zod schema validation
│   │
│   ├── run_demo.js         # CLI runner
│   ├── database.sql        # Database schema
│   ├── .env.example        # Environment template
│   ├── test.js             # Mistral API test script
│   └── package.json
│
├── Frontend/
│   ├── index.html          # Minimal UI for testing API
│   ├── app.js              # Frontend logic (fetch calls)
│   └── style.css
│
└── README.md
```

---

## ⚙️ Prerequisites

Before running the project, install the following:

- **Node.js** ≥ 18  
- **MySQL** ≥ 8.0  
- (Optional) **curl** or **Postman** for testing REST endpoints
- An **OpenAI API key** from [https://platform.openai.com](https://platform.openai.com)

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

### 7️⃣ Test ChatGPT AI integration

```bash
cd Backend
node test.js
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

The `test.js` script demonstrates how to send patient data to the **OpenAI API**  
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
| `prefix` | VARCHAR(20) | ❌ | e.g. Dr., Prof., Ms. |
| `first_name` | VARCHAR(100) | ✅ | User’s first name |
| `middle_name` | VARCHAR(100) | ❌ | Optional |
| `last_name` | VARCHAR(100) | ✅ | User’s last name |
| `email` | VARCHAR(255) | ✅ | Unique user email |
| `password_hash` | VARCHAR(255) | ✅ | Hashed password (bcrypt) |
| `role` | ENUM('clinician','researcher','admin','patient') | ✅ | Application role |
| `created_at` | TIMESTAMP | ✅ | Auto-generated creation timestamp |

---

### `patients`
| Column | Type | Required | Description |
|--------|------|-----------|-------------|
| `patient_id` | INT AUTO_INCREMENT | ✅ | Primary key |
| `prefix` | VARCHAR(20) | ❌ | e.g. Mr., Ms., Dr. |
| `first_name` | VARCHAR(100) | ✅ | Patient’s first name |
| `middle_name` | VARCHAR(100) | ❌ | Optional |
| `last_name` | VARCHAR(100) | ✅ | Patient’s last name |
| `date_of_birth` | DATE | ❌ | Optional |
| `sex` | ENUM('M','F','Other') | ❌ | Optional |
| `phone_number` | VARCHAR(50) | ❌ | Optional |
| `address` | VARCHAR(255) | ❌ | Optional |
| `email` | VARCHAR(255) | ❌ | Optional |
| `emergency_contact_name` | VARCHAR(100) | ❌ | Optional |
| `emergency_contact_phone` | VARCHAR(50) | ❌ | Optional |
| `notes_text` | TEXT | ❌ | Optional |
| `created_at` | TIMESTAMP | ✅ | Auto-generated creation timestamp |

---

### `ehr_inputs`
| Column | Type | Required | Description |
|--------|------|-----------|-------------|
| `ehr_id` | INT AUTO_INCREMENT | ✅ | Primary key |
| `patient_id` | INT | ✅ | Foreign key → `patients.patient_id` |
| `author_user_id` | INT | ✅ | Foreign key → `users.user_id` |
| `labs_json` | JSON | ❌ | Structured lab results |
| `symptoms_json` | JSON | ❌ | Structured symptom data |
| `history_text` | TEXT | ❌ | Free-text clinical history |
| `created_at` | TIMESTAMP | ✅ | Auto-generated creation timestamp |

---

### `llm_reports`
| Column | Type | Required | Description |
|--------|------|-----------|-------------|
| `report_id` | INT AUTO_INCREMENT | ✅ | Primary key |
| `ehr_id` | INT | ✅ | Foreign key → `ehr_inputs.ehr_id` |
| `task_type` | ENUM('diagnosis','treatment','literature','management') | ✅ | Report category |
| `model_name` | VARCHAR(100) | ✅ | LLM model used (e.g. gpt-4o) |
| `output_md` | MEDIUMTEXT | ✅ | Markdown-formatted output |
| `citations_json` | JSON | ❌ | Optional structured references |
| `created_at` | TIMESTAMP | ✅ | Auto-generated creation timestamp |

---

### `prompt_history`
| Column | Type | Required | Description |
|--------|------|-----------|-------------|
| `prompt_id` | INT AUTO_INCREMENT | ✅ | Primary key |
| `report_id` | INT | ✅ | Foreign key → `llm_reports.report_id` |
| `prompt_text` | MEDIUMTEXT | ✅ | Prompt used for report generation |
| `params_json` | JSON | ❌ | Temperature, model parameters, etc. |
| `created_at` | TIMESTAMP | ✅ | Auto-generated creation timestamp |

---

### `feedback`
| Column | Type | Required | Description |
|--------|------|-----------|-------------|
| `feedback_id` | INT AUTO_INCREMENT | ✅ | Primary key |
| `report_id` | INT | ✅ | Foreign key → `llm_reports.report_id` |
| `user_id` | INT | ✅ | Foreign key → `users.user_id` |
| `stars` | TINYINT | ✅ | Rating between 1 and 5 |
| `comment` | TEXT | ❌ | Optional feedback text |
| `created_at` | TIMESTAMP | ✅ | Auto-generated creation timestamp |

---

### `literature_db`
| Column | Type | Required | Description |
|--------|------|-----------|-------------|
| `doc_id` | INT AUTO_INCREMENT | ✅ | Primary key |
| `source` | VARCHAR(50) | ✅ | e.g. PubMed, OMIM |
| `title` | VARCHAR(512) | ✅ | Document title |
| `url` | VARCHAR(2048) | ❌ | Reference link |
| `abstract_txt` | MEDIUMTEXT | ❌ | Optional abstract |
| `embedding_vec` | BLOB | ❌ | Optional vector embedding |
| `created_at` | TIMESTAMP | ✅ | Auto-generated creation timestamp |

---

### `llm_flows`
| Column | Type | Required | Description |
|--------|------|-----------|-------------|
| `flow_id` | CHAR(36) | ✅ | Primary key (UUID) |
| `ehr_id` | INT | ✅ | Foreign key → `ehr_inputs.ehr_id` |
| `model_name` | VARCHAR(64) | ❌ | Model used for reasoning |
| `started_at` | TIMESTAMP | ✅ | Start time |
| `finished_at` | TIMESTAMP | ❌ | End time |
| `status` | ENUM('running','ok','error') | ❌ | Current flow status |

---

### `panel_turns`
| Column | Type | Required | Description |
|--------|------|-----------|-------------|
| `turn_id` | INT AUTO_INCREMENT | ✅ | Primary key |
| `flow_id` | CHAR(36) | ✅ | Foreign key → `llm_flows.flow_id` |
| `step_index` | INT | ✅ | Step number in reasoning sequence |
| `panel_json` | JSON | ✅ | Full panel output (5 personas) |
| `action` | ENUM('ASK','ORDER','COMMIT') | ✅ | Panel consensus action |
| `questions_json` | JSON | ❌ | Patient questions (if ASK) |
| `orders_json` | JSON | ❌ | Test orders (if ORDER) |
| `diagnosis_json` | JSON | ❌ | Diagnosis data (if COMMIT) |
| `certainty` | DECIMAL(5,3) | ❌ | Consensus certainty (0–1) |
| `created_at` | TIMESTAMP | ✅ | Auto-generated creation timestamp |

---

## 🧾 License

MIT License © 2025  
Developed by **Morgan Wong** and **James Fong** for the BIOM9450 project.

---
