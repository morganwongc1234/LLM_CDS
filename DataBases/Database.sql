-- ============================================
-- BIOM9450 CDS – Fresh database schema (renamed)
-- ============================================

-- 0) Create DB & defaults
DROP DATABASE IF EXISTS cds_db;
CREATE DATABASE cds_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE cds_db;
SET NAMES utf8mb4;

-- (Helpful strictness)
SET sql_mode = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- 1) Users
--    Application users who log into the system.
--    Includes structured name fields.
CREATE TABLE users (
  user_id       INT PRIMARY KEY AUTO_INCREMENT,
  prefix        VARCHAR(20) NULL,                 -- e.g. Dr., Prof., Ms.
  first_name    VARCHAR(100) NOT NULL,
  middle_name   VARCHAR(100) NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('clinician','researcher','admin','patient') NOT NULL DEFAULT 'clinician',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_name (last_name, first_name)
) ENGINE=InnoDB;

-- 2) Patients
--    Real-world patients (not app users). Identifier is patient_id (AUTO_INCREMENT).
--    Includes structured name fields + demographics/contact.
CREATE TABLE patients (
  patient_id                 INT PRIMARY KEY AUTO_INCREMENT,
  prefix                     VARCHAR(20) NULL,    -- e.g. Mr., Ms., Dr.
  first_name                 VARCHAR(100) NOT NULL,
  middle_name                VARCHAR(100) NULL,
  last_name                  VARCHAR(100) NOT NULL,
  date_of_birth              DATE NULL,
  sex                        ENUM('M','F','Other') NULL,
  phone_number               VARCHAR(50) NULL,
  address                    VARCHAR(255) NULL,
  email                      VARCHAR(255) NULL,
  emergency_contact_name     VARCHAR(100) NULL,
  emergency_contact_phone    VARCHAR(50) NULL,
  notes_text                 TEXT NULL,
  created_at                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_patient_name (last_name, first_name),
  INDEX idx_patient_email (email)
) ENGINE=InnoDB;

-- 3) EHR inputs
--    Structured/unstructured inputs captured for a patient (labs, symptoms, history).
--    author_user_id indicates who entered the record.
CREATE TABLE ehr_inputs (
  ehr_id         INT PRIMARY KEY AUTO_INCREMENT,
  patient_id     INT NOT NULL,
  author_user_id INT NOT NULL,
  labs_json      JSON NULL,
  symptoms_json  JSON NULL,
  history_text   TEXT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ehr_patient (patient_id),
  INDEX idx_ehr_author (author_user_id, created_at),
  CONSTRAINT fk_ehr_patient
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ehr_author
    FOREIGN KEY (author_user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 4) LLM reports
--    Output produced by an LLM for a given EHR input (diagnosis, treatment, etc.).
CREATE TABLE llm_reports (
  report_id      INT PRIMARY KEY AUTO_INCREMENT,
  ehr_id         INT NOT NULL,
  task_type      ENUM('diagnosis','treatment','literature','management') NOT NULL,
  model_name     VARCHAR(100) NOT NULL,       -- e.g. mistral-small-latest, gpt-4o, etc.
  output_md      MEDIUMTEXT NOT NULL,         -- markdown for display
  citations_json JSON NULL,                   -- optional structured citations
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reports_ehr (ehr_id),
  INDEX idx_reports_task (task_type, created_at),
  CONSTRAINT fk_reports_ehr
    FOREIGN KEY (ehr_id) REFERENCES ehr_inputs(ehr_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 5) Prompt history
--    Prompts/parameters used to generate a given LLM report (traceability).
CREATE TABLE prompt_history (
  prompt_id    INT PRIMARY KEY AUTO_INCREMENT,
  report_id    INT NOT NULL,
  prompt_text  MEDIUMTEXT NOT NULL,
  params_json  JSON NULL,                     -- temperature, top_p, etc.
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prompt_report (report_id),
  CONSTRAINT fk_prompt_report
    FOREIGN KEY (report_id) REFERENCES llm_reports(report_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 6) Feedback (optional but recommended)
--    Users rate/comment on a specific LLM report.
CREATE TABLE feedback (
  feedback_id INT PRIMARY KEY AUTO_INCREMENT,
  report_id   INT NOT NULL,
  user_id     INT NOT NULL,
  stars       TINYINT NOT NULL,
  comment     TEXT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fb_report (report_id),
  INDEX idx_fb_user (user_id),
  CONSTRAINT chk_stars CHECK (stars BETWEEN 1 AND 5),
  CONSTRAINT fk_fb_report
    FOREIGN KEY (report_id) REFERENCES llm_reports(report_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_fb_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 7) Literature DB (optional for future RAG)
CREATE TABLE literature_db (
  doc_id        INT PRIMARY KEY AUTO_INCREMENT,
  source        VARCHAR(50) NOT NULL,         -- "PubMed", "OMIM", etc.
  title         VARCHAR(512) NOT NULL,
  url           VARCHAR(2048) NULL,
  abstract_txt  MEDIUMTEXT NULL,
  embedding_vec BLOB NULL,                    -- store elsewhere if large
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lit_source (source, created_at)
) ENGINE=InnoDB;

-- End of schema (no seed rows).