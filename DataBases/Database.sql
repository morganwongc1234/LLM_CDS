-- ============================================
-- BIOM9450 CDS – Fresh database schema
-- ============================================

-- 0) Create DB & defaults
DROP DATABASE IF EXISTS cds_db;
CREATE DATABASE cds_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cds_db;
SET NAMES utf8mb4;
SET sql_mode = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- 1) Users
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  prefix VARCHAR(20) NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('clinician', 'researcher', 'admin', 'patient') NOT NULL DEFAULT 'clinician',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_name (last_name, first_name)
) ENGINE = InnoDB;

-- 2) Patients
CREATE TABLE patients (
  patient_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NULL UNIQUE, -- Linked User ID
  prefix VARCHAR(20) NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NULL,
  sex ENUM('M', 'F', 'Other') NULL,
  phone_number VARCHAR(50) NULL,
  address VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  emergency_contact_name VARCHAR(100) NULL,
  emergency_contact_phone VARCHAR(50) NULL,
  notes_text TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_patient_name (last_name, first_name),
  INDEX idx_patient_email (email),
  CONSTRAINT fk_patient_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB;

-- 3) EHR inputs
CREATE TABLE ehr_inputs (
  ehr_id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  author_user_id INT NOT NULL,
  labs_json JSON NULL,
  symptoms_json JSON NULL,
  history_text TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ehr_patient (patient_id),
  INDEX idx_ehr_author (author_user_id, created_at),
  CONSTRAINT fk_ehr_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ehr_author FOREIGN KEY (author_user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB;

-- 4) LLM reports
CREATE TABLE llm_reports (
  report_id INT PRIMARY KEY AUTO_INCREMENT,
  ehr_id INT NOT NULL,
  task_type ENUM('diagnosis','treatment','literature','management') NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  output_md MEDIUMTEXT NOT NULL,
  citations_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reports_ehr (ehr_id),
  INDEX idx_reports_task (task_type, created_at),
  CONSTRAINT fk_reports_ehr FOREIGN KEY (ehr_id) REFERENCES ehr_inputs(ehr_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB;

-- 5) Prompt history
CREATE TABLE prompt_history (
  prompt_id INT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  prompt_text MEDIUMTEXT NOT NULL,
  params_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prompt_report (report_id),
  CONSTRAINT fk_prompt_report FOREIGN KEY (report_id) REFERENCES llm_reports(report_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB;

-- 6) Feedback
CREATE TABLE feedback (
  feedback_id INT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  user_id INT NOT NULL,
  stars TINYINT NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fb_report (report_id),
  INDEX idx_fb_user (user_id),
  CONSTRAINT chk_stars CHECK (stars BETWEEN 1 AND 5),
  CONSTRAINT fk_fb_report FOREIGN KEY (report_id) REFERENCES llm_reports(report_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_fb_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB;

-- 7) Literature DB
CREATE TABLE literature_db (
  doc_id INT PRIMARY KEY AUTO_INCREMENT,
  source VARCHAR(50) NOT NULL,
  title VARCHAR(512) NOT NULL,
  url VARCHAR(2048) NULL,
  abstract_txt MEDIUMTEXT NULL,
  embedding_vec BLOB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lit_source (source, created_at)
) ENGINE = InnoDB;

-- ============================================
-- 8) Seed Data (Preset Users & Patients)
--    All passwords are: qwer1122
-- ============================================

INSERT INTO users (user_id, prefix, first_name, middle_name, last_name, email, password_hash, role)
VALUES 
(1, 'Dr.', 'Morgan', NULL, 'Wong', 'morganwongc@gmail.com', '$2b$10$6pMGtTRTrpFcAJzkxIu5oel5MkcnCPmOPGXv1PulzTKWt1BlCxCu.', 'clinician'),
(2, 'Mr.', 'Morgan', NULL, 'Wong', 'morganwongcc@gmail.com', '$2b$10$6pMGtTRTrpFcAJzkxIu5oel5MkcnCPmOPGXv1PulzTKWt1BlCxCu.', 'admin'),
(3, 'Mr.', 'Morgan', NULL, 'Wong', 'morganwongccc@gmail.com', '$2b$10$6pMGtTRTrpFcAJzkxIu5oel5MkcnCPmOPGXv1PulzTKWt1BlCxCu.', 'patient');

-- Existing Patient for User 3 (KEEP THIS)
INSERT INTO patients (
  user_id, prefix, first_name, middle_name, last_name, 
  date_of_birth, sex, phone_number, 
  address, email, 
  emergency_contact_name, emergency_contact_phone, notes_text
)
VALUES (
  3, 'Mr.', 'Morgan', NULL, 'Wong', 
  '2005-04-06', 'M', '0481 302 032', 
  '100 Bellamy Street, Pennat Hills, Sydney, NSW, 2120', 'morganwongccc@gmail.com', 
  'Mina Truong', '0412 160 405', 'Preset test patient.'
);