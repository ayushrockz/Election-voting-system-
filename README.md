# Secure Android & iOS Election Management System

Enterprise-grade, cryptographically secured election management platform engineered for democratic balloting across mobile (Android & iOS) and web administration consoles.

---

## 1. System Architecture & Roles

The system supports three strictly enforced roles with Role-Based Access Control (RBAC):

1. **Super Admin / Election Commissioner**:
   - Manages voter registrations and leader nominations.
   - Enforces duplicate prevention across Aadhaar, mobile, email, and Voter ID.
   - Derives configurable, privacy-preserving Voter IDs without PII.
   - Configures election dates, polling hours, and live status.
   - Monitors aggregated real-time voter turnout and leader statistics without disclosing individual secret ballots.
   - Inspects tamper-evident HMAC-SHA256 audit logs and the email notification outbox.
   - Executes the automated security test suite verifying relational constraints.

2. **Community Leader / Candidate**:
   - Authenticated leader dashboard with assigned house number and ward.
   - View election nomination, ballot position, and campaign manifesto.
   - Inspects authorized live vote tallies only when explicitly permitted by election commission configuration.
   - Restricted from creating voters, altering ballots, or accessing confidential data.

3. **Voter (Mobile App for Android & iOS)**:
   - High-contrast, touch-optimized ballot interface.
   - Prominent countdown clock (`"05 Days 14 Hours 32 Minutes 10 Seconds"`), live polling badge (`"Voting is LIVE"`), or closed notification (`"Voting has ended"`).
   - Candidate selection with candidate photo, slate affiliation, and manifesto summary.
   - Mandatory vote confirmation step: *«Please verify your selection before submitting. Your vote cannot be changed after submission.»*
   - Cryptographic vote transaction receipt (`VOTE-REF-XXXX-XXXX`) with digital seal and print/export receipt capability.
   - **One-Vote-Only Relational Invariant**: Strictly enforced at database level with `UNIQUE(election_id, voter_id)`. Subsequent voting attempts are blocked and logged.

---

## 2. Security & Privacy Architecture

- **Aadhaar Protection & Masking**:
  - Raw Aadhaar numbers are **never stored in plaintext**.
  - Encrypted at rest using **AES-256-GCM** with authenticated data tags.
  - Displayed strictly in masked format: `XXXX XXXX 1234`.
  - Duplicate detection is achieved via HMAC-SHA256 lookup hashes, preventing rainbow-table attacks while ensuring $O(1)$ duplicate interception.
- **Configurable Voter ID Generator**:
  - Voter IDs are generated from the configured template: `HOUSE-{houseNumber}-{seq}` (e.g. `HOUSE-102-001`).
  - Strict privacy rule: Aadhaar or personal data is never embedded in Voter IDs.
- **Strict Single-Vote Relational Constraint**:
  - Handled via relational database constraint `UNIQUE(election_id, voter_id)`.
  - Double voting is rejected at the database transaction layer and flagged in audit logs.
- **Tamper-Resistant Audit Logging**:
  - Every administrative action, registration, login, and balloting transaction generates a cryptographically signed audit log with HMAC-SHA256 integrity signatures.
- **Password Salting & First-Login Security**:
  - Passwords hashed using PBKDF2 with SHA-512 and unique 32-byte cryptographically secure salts.
  - Temporary passwords generated for new accounts require mandatory password reset upon initial login before balloting access is granted.
- **Ballot Secrecy in Email Notifications**:
  - Welcome credentials emails include secure activation links and login instructions.
  - Vote confirmation emails include transaction reference codes and timestamps, but **never disclose the user's candidate choice**.

---

## 3. Database Schema (PostgreSQL DDL)

See complete migration in `/server/db/schema.sql`:

```sql
-- Main Relational Tables
1. users (id, name, email, mobile, password_hash, password_salt, role, status, must_change_password)
2. voters (id, user_id, full_name, aadhaar_number_encrypted, aadhaar_number_hash, aadhaar_masked, mobile, email, age, sex, house_number, voter_id, ward)
3. leaders (id, user_id, full_name, aadhaar_number_encrypted, aadhaar_number_hash, aadhaar_masked, mobile, email, age, sex, house_number, voter_id, ward, bio, photo_url)
4. elections (id, election_name, election_date, start_time, end_time, start_datetime, end_datetime, status, allow_live_results_for_leaders)
5. candidates (id, election_id, leader_id, candidate_name, party_or_slate, photo, status, manifesto, ballot_number)
6. votes (id, election_id, voter_id, candidate_id, transaction_reference, voted_at, ip_hash, integrity_hash,
   CONSTRAINT unique_election_voter_vote UNIQUE (election_id, voter_id))
7. audit_logs (id, user_id, user_role, action, details, ip_address, status, timestamp, integrity_signature)
8. email_outbox (id, recipient_email, recipient_name, subject, template_type, payload, status, sent_at)
```

---

## 4. API Endpoints Specification

### Authentication
- `POST /api/auth/login`: Authenticate via Voter ID, Email, or Mobile + Password.
- `POST /api/auth/logout`: Revoke active session.
- `POST /api/auth/change-password`: Update password (clears `must_change_password`).
- `POST /api/auth/forgot-password`: Dispatches time-limited reset instructions.
- `GET /api/auth/me`: Current user profile & linked voter/leader records.

### Admin Operations
- `GET /api/admin/dashboard`: Aggregated election turnout, candidate leader vote counts, and security metrics.
- `GET /api/admin/reports/voting-stats/csv`: Export official certified voting statistics and candidate vote distribution as RFC 4180 CSV.
- `GET /api/admin/reports/audit-logs/csv`: Export tamper-evident audit ledger with HMAC-SHA256 signatures as CSV.
- `GET /api/admin/reports/voters/csv`: Export registered voter roster with masked Aadhaar (`XXXX XXXX 1234`) as CSV.
- `POST /api/admin/reports/log-pdf-export`: Log PDF gazette generation events in the central audit ledger.
- `POST /api/admin/voters`: Create voter with format generation, duplicate validation, and email dispatch.
- `GET /api/admin/voters`: List enrolled voters with masked Aadhaar.
- `POST /api/admin/leaders`: Register leader and optionally nominate as candidate.
- `GET /api/admin/leaders`: List civic leaders.
- `PUT /api/admin/elections/:id`: Update polling window, time simulation override, and live results toggle.
- `POST /api/admin/config/voter-id-pattern`: Customize Voter ID pattern (e.g. `HOUSE-{houseNumber}-{seq}`).
- `GET /api/admin/audit-logs`: Audit trail with cryptographic verification signatures.
- `GET /api/admin/outbox`: Inspect all transactional emails sent by the system.
- `POST /api/admin/run-tests`: Execute live automated verification suite.

### Polling & Balloting
- `GET /api/elections/active`: Primary active election status and countdown data.
- `GET /api/elections/:id/candidates`: Candidate ballot roster.
- `POST /api/elections/:id/vote`: Submit secret ballot (strictly enforces `UNIQUE(election_id, voter_id)`).
- `GET /api/elections/voters/me/voting-status`: Check whether current voter has voted and view transaction receipt.
- `GET /api/elections/leaders/me/campaign`: Leader campaign status and authorized tally metrics.

---

## 5. Mobile Application Deliverables

- **Interactive Mobile Viewports**: Use the built-in device switcher in the top navigation bar to test the live mobile experience:
  - **iPhone 16 Pro**: Dynamic Island, iOS system status bar, fluid touch targets ($\ge 44\text{px}$), and bottom indicator.
  - **Android Pixel**: Material 3 system bar, punch-hole camera, and gesture navigation.
  - **Full Display**: Responsive desktop and tablet command console for election commissioners.
- **Native Flutter Implementation**: Production Flutter client located at `/src/mobile-export/Flutter_Election_App.dart`.
- **Native React Native Implementation**: Production React Native client located at `/src/mobile-export/ReactNative_Election_App.tsx`.

---

## 6. Demonstration Credentials

| Role | Name | Login Identifier | Password | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Chief Commissioner | `admin@election.gov.in` | `AdminPassword@2026` | Full administrative console |
| **Leader** | Ananya Sharma | `ananya.sharma@council.org` | `LeaderPassword@2026` | Ward 1 Leader & Ballot Candidate 1 |
| **Leader** | Rajesh Patel | `rajesh.patel@council.org` | `LeaderPassword@2026` | Ward 1 Leader & Ballot Candidate 2 |
| **Voter** | Aarav Gupta | `aarav.voter@gmail.com` (or `HOUSE-102-001`) | `Voter@102A` | House 102, Ward 1 · Ready to cast ballot |
| **Voter** | Devendra Joshi | `devendra.voter@gmail.com` (or `HOUSE-104-001`) | `Voter@104C` | Pre-voted sample to show receipt & lock |
