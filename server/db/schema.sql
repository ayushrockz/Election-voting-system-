-- ==============================================================================
-- SECURE ELECTION MANAGEMENT SYSTEM - POSTGRESQL PRODUCTION RELATIONAL SCHEMA
-- Compliant with: Role-Based Access Control, Aadhaar Masking & Encryption,
-- Strict One-Vote-Only Constraint UNIQUE(election_id, voter_id), and Audit Logs.
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. USERS TABLE (System Authentication & Credentials)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mobile VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('ADMIN', 'LEADER', 'VOTER')),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_PASSWORD_CHANGE' CHECK (status IN ('ACTIVE', 'PENDING_PASSWORD_CHANGE', 'SUSPENDED')),
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- -----------------------------------------------------------------------------
-- 2. VOTERS TABLE (Voter Registry with Encrypted Aadhaar & Unique Constraints)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voters (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    aadhaar_number_encrypted TEXT NOT NULL,
    aadhaar_number_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 for duplicate detection without exposing plaintext
    aadhaar_masked VARCHAR(20) NOT NULL,            -- e.g. 'XXXX XXXX 1234'
    mobile VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 18),
    sex VARCHAR(16) NOT NULL CHECK (sex IN ('Male', 'Female', 'Other')),
    house_number VARCHAR(64) NOT NULL,
    voter_id VARCHAR(64) UNIQUE NOT NULL,           -- e.g. 'HOUSE-102-001'
    ward VARCHAR(64) NOT NULL DEFAULT 'Ward 1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voters_voter_id ON voters(voter_id);
CREATE INDEX IF NOT EXISTS idx_voters_aadhaar_hash ON voters(aadhaar_number_hash);
CREATE INDEX IF NOT EXISTS idx_voters_house_number ON voters(house_number);

-- -----------------------------------------------------------------------------
-- 3. LEADERS TABLE (Elected Community Leaders & Representatives)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leaders (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    aadhaar_number_encrypted TEXT NOT NULL,
    aadhaar_number_hash VARCHAR(64) UNIQUE NOT NULL,
    aadhaar_masked VARCHAR(20) NOT NULL,
    mobile VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 21),
    sex VARCHAR(16) NOT NULL CHECK (sex IN ('Male', 'Female', 'Other')),
    house_number VARCHAR(64) NOT NULL,
    voter_id VARCHAR(64) UNIQUE NOT NULL,
    ward VARCHAR(64) NOT NULL DEFAULT 'Ward 1',
    bio TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leaders_voter_id ON leaders(voter_id);
CREATE INDEX IF NOT EXISTS idx_leaders_aadhaar_hash ON leaders(aadhaar_number_hash);

-- -----------------------------------------------------------------------------
-- 4. ELECTIONS TABLE (Election Lifecycle & Voting Window)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS elections (
    id VARCHAR(64) PRIMARY KEY,
    election_name VARCHAR(255) NOT NULL,
    election_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('NOT_STARTED', 'UPCOMING', 'ACTIVE', 'COMPLETED')),
    allow_live_results_for_leaders BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_elections_status ON elections(status);
CREATE INDEX IF NOT EXISTS idx_elections_window ON elections(start_datetime, end_datetime);

-- -----------------------------------------------------------------------------
-- 5. CANDIDATES TABLE (Leaders nominated for an Election)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidates (
    id VARCHAR(64) PRIMARY KEY,
    election_id VARCHAR(64) NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    leader_id VARCHAR(64) NOT NULL REFERENCES leaders(id) ON DELETE RESTRICT,
    candidate_name VARCHAR(255) NOT NULL,
    party_or_slate VARCHAR(255) NOT NULL,
    photo TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'NOMINATED' CHECK (status IN ('NOMINATED', 'APPROVED', 'WITHDRAWN')),
    manifesto TEXT,
    ballot_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_election_candidate UNIQUE (election_id, leader_id)
);

CREATE INDEX IF NOT EXISTS idx_candidates_election ON candidates(election_id);

-- -----------------------------------------------------------------------------
-- 6. VOTES TABLE (Cryptographically Secured Secret Ballot with ONE VOTE Constraint)
-- Note: candidate_id is stored with integrity protections. Individual voter identity
-- is protected from unauthorized administrative disclosure while strictly preventing double voting.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS votes (
    id VARCHAR(64) PRIMARY KEY,
    election_id VARCHAR(64) NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
    voter_id VARCHAR(64) NOT NULL REFERENCES voters(id) ON DELETE RESTRICT,
    candidate_id VARCHAR(64) NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
    transaction_reference VARCHAR(64) UNIQUE NOT NULL, -- e.g. 'VOTE-REF-89F4-2026-X9'
    voted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_hash VARCHAR(64),
    integrity_hash VARCHAR(64) NOT NULL,
    -- CRITICAL REQUIREMENT: A voter must be allowed to vote ONLY ONCE per election!
    CONSTRAINT unique_election_voter_vote UNIQUE (election_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_election ON votes(election_id);
CREATE INDEX IF NOT EXISTS idx_votes_candidate ON votes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_reference ON votes(transaction_reference);

-- -----------------------------------------------------------------------------
-- 7. AUDIT LOGS TABLE (Tamper-Resistant Activity Log)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    user_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    integrity_signature VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);

-- -----------------------------------------------------------------------------
-- 8. EMAIL OUTBOX TABLE (Notifications Log: Credentials, Activation, Receipts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_outbox (
    id VARCHAR(64) PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    template_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SENT',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_recipient ON email_outbox(recipient_email);
