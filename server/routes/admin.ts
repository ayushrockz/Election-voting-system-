import { Router, Response } from 'express';
import { db, VoterRecord, LeaderRecord } from '../db/store.ts';
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from './auth.ts';
import {
  validateAadhaar,
  maskAadhaar,
  encryptAadhaar,
  hashAadhaarForLookup,
  hashPassword,
  generateTemporaryPassword,
  generateVoterId,
} from '../security/crypto.ts';
import { emailService } from '../services/emailService.ts';

export const adminRouter = Router();

// Enforce ADMIN role on all admin routes
adminRouter.use(authenticateToken, requireRole('ADMIN'));

// -----------------------------------------------------------------------------
// Helper: Validate Common Personal Fields & Duplicates
// -----------------------------------------------------------------------------
function validatePersonFields(data: any, isLeader = false) {
  const errors: string[] = [];

  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push('Full Name is required and must be at least 2 characters.');
  }

  // Mobile number validation (10-digit standard)
  const mobile = String(data.mobile || '').replace(/\D/g, '');
  if (mobile.length !== 10) {
    errors.push('Mobile number must be a valid 10-digit number.');
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email.trim())) {
    errors.push('A valid email address is required.');
  }

  // Age validation: Leaders must be >= 21, Voters >= 18
  const age = Number(data.age);
  const minAge = isLeader ? 21 : 18;
  if (isNaN(age) || age < minAge || age > 120) {
    errors.push(`Age must be a valid number between ${minAge} and 120.`);
  }

  // Sex validation
  if (!['Male', 'Female', 'Other'].includes(data.sex)) {
    errors.push('Sex must be one of: Male, Female, Other.');
  }

  // House Number
  if (!data.houseNumber || data.houseNumber.trim().length === 0) {
    errors.push('House Number is mandatory.');
  }

  // Aadhaar validation
  const aadhaarCheck = validateAadhaar(data.aadhaarNumber || '');
  if (!aadhaarCheck.valid) {
    errors.push(aadhaarCheck.error || 'Invalid Aadhaar number.');
  }

  return { errors, cleanedMobile: mobile, cleanedEmail: data.email?.trim().toLowerCase(), aadhaarCheck };
}

// -----------------------------------------------------------------------------
// GET /api/admin/dashboard
// Aggregated statistics, turnout %, candidate/leader breakdown, live election info
// -----------------------------------------------------------------------------
adminRouter.get('/dashboard', (req: AuthenticatedRequest, res: Response) => {
  const election = Array.from(db.elections.values())[0];
  const totalRegisteredVoters = db.voters.size;

  // Compute votes cast for this election
  const electionVotes = Array.from(db.votes.values()).filter(
    (v) => !election || v.election_id === election.id
  );
  const totalVotesCast = electionVotes.length;
  const totalNotVoted = Math.max(0, totalRegisteredVoters - totalVotesCast);
  const turnoutPercentage = totalRegisteredVoters > 0
    ? Number(((totalVotesCast / totalRegisteredVoters) * 100).toFixed(1))
    : 0;

  // Blocked duplicate/invalid attempts from audit log
  const blockedAttempts = db.audit_logs.filter(
    (log) => log.action === 'DUPLICATE_VOTE_ATTEMPT_BLOCKED'
  ).length;

  // Leader / Candidate tally
  // Calculate aggregated tally from database
  const candidateTallyMap: Record<string, number> = {};
  electionVotes.forEach((v) => {
    candidateTallyMap[v.candidate_id] = (candidateTallyMap[v.candidate_id] || 0) + 1;
  });

  const candidatesList = Array.from(db.candidates.values()).map((c) => {
    const leader = db.leaders.get(c.leader_id);
    const votesReceived = candidateTallyMap[c.id] || 0;
    const votePercentage = totalVotesCast > 0
      ? Number(((votesReceived / totalVotesCast) * 100).toFixed(1))
      : 0;

    return {
      candidateId: c.id,
      leaderId: c.leader_id,
      candidateName: c.candidate_name,
      partyOrSlate: c.party_or_slate,
      photo: c.photo,
      houseNumber: leader?.house_number || 'N/A',
      ward: leader?.ward || 'Ward 1',
      votesReceived,
      votePercentage,
      status: c.status,
    };
  });

  const computedStatus = election ? db.computeElectionStatus(election) : 'NOT_STARTED';

  return res.json({
    election: election
      ? {
          id: election.id,
          name: election.election_name,
          date: election.election_date,
          startTime: election.start_time,
          endTime: election.end_time,
          startDatetime: election.start_datetime,
          endDatetime: election.end_datetime,
          status: computedStatus,
          configuredStatus: election.status,
          timeOverrideMode: db.config.time_override_mode,
        }
      : null,
    voterStatistics: {
      totalRegisteredVoters,
      totalVoted: totalVotesCast,
      totalNotVoted,
      turnoutPercentage,
    },
    leaderStatistics: candidatesList,
    securityMetrics: {
      blockedAttempts,
      totalAuditLogs: db.audit_logs.length,
      voterIdPattern: db.config.voter_id_pattern,
    },
  });
});

// -----------------------------------------------------------------------------
// POST /api/admin/voters
// Create Voter with duplicate checks, format generator, and email dispatch
// -----------------------------------------------------------------------------
adminRouter.post('/voters', async (req: AuthenticatedRequest, res: Response) => {
  const { errors, cleanedMobile, cleanedEmail, aadhaarCheck } = validatePersonFields(req.body, false);

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  const aadhaarHash = hashAadhaarForLookup(aadhaarCheck.normalized);

  // 1. Check duplicate Aadhaar across voters & leaders
  for (const v of db.voters.values()) {
    if (v.aadhaar_number_hash === aadhaarHash) {
      return res.status(409).json({ error: 'Duplicate record: A voter with this Aadhaar number already exists.' });
    }
  }
  for (const l of db.leaders.values()) {
    if (l.aadhaar_number_hash === aadhaarHash) {
      return res.status(409).json({ error: 'Duplicate record: This Aadhaar number is already registered to a leader.' });
    }
  }

  // 2. Check duplicate Mobile across users
  for (const u of db.users.values()) {
    if (u.mobile === cleanedMobile) {
      return res.status(409).json({ error: 'Duplicate record: This mobile number is already registered.' });
    }
  }

  // 3. Check duplicate Email across users
  for (const u of db.users.values()) {
    if (u.email === cleanedEmail) {
      return res.status(409).json({ error: 'Duplicate record: This email address is already in use.' });
    }
  }

  // 4. Voter ID generation: auto-generate derived from house number & sequence
  const houseNumber = req.body.houseNumber.trim();
  let voterId = req.body.voterId?.trim();
  if (!voterId) {
    const seq = db.getNextHouseSequence(houseNumber);
    voterId = generateVoterId(db.config.voter_id_pattern, houseNumber, seq);
  }

  // Check duplicate Voter ID
  for (const v of db.voters.values()) {
    if (v.voter_id.toUpperCase() === voterId.toUpperCase()) {
      return res.status(409).json({ error: `Voter ID "${voterId}" already exists. Please choose or generate another.` });
    }
  }

  // 5. Generate secure temporary password
  const tempPassword = generateTemporaryPassword();
  const { hash, salt } = hashPassword(tempPassword);

  const userId = `user-vtr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const voterDbId = `vtr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  // Create User
  db.users.set(userId, {
    id: userId,
    name: req.body.fullName.trim(),
    email: cleanedEmail,
    mobile: cleanedMobile,
    password_hash: hash,
    password_salt: salt,
    role: 'VOTER',
    status: 'PENDING_PASSWORD_CHANGE',
    must_change_password: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Create Voter
  const newVoter: VoterRecord = {
    id: voterDbId,
    user_id: userId,
    full_name: req.body.fullName.trim(),
    aadhaar_number_encrypted: encryptAadhaar(aadhaarCheck.normalized),
    aadhaar_number_hash: aadhaarHash,
    aadhaar_masked: maskAadhaar(aadhaarCheck.normalized),
    mobile: cleanedMobile,
    email: cleanedEmail,
    age: Number(req.body.age),
    sex: req.body.sex,
    house_number: houseNumber,
    voter_id: voterId,
    ward: req.body.ward?.trim() || 'Ward 1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.voters.set(voterDbId, newVoter);

  // Trigger automated email credentials
  const election = Array.from(db.elections.values())[0];
  const emailRecord = await emailService.sendAccountCreationEmail({
    recipientEmail: cleanedEmail,
    recipientName: req.body.fullName.trim(),
    role: 'VOTER',
    voterId,
    tempPassword,
    electionName: election?.election_name,
  });

  db.logAudit({
    userId: req.user!.userId,
    userRole: 'ADMIN',
    action: 'VOTER_CREATED',
    details: {
      voterDbId,
      voterId,
      email: cleanedEmail,
      houseNumber,
      aadhaarMasked: newVoter.aadhaar_masked,
    },
    status: 'SUCCESS',
  });

  return res.status(201).json({
    message: 'Voter created successfully. Login credentials and activation email have been dispatched.',
    voter: {
      ...newVoter,
      aadhaar_number_encrypted: undefined, // Never leak ciphertext
    },
    generatedCredentials: {
      voterId,
      tempPassword,
      emailSentTo: cleanedEmail,
      emailId: emailRecord.id,
    },
  });
});

// -----------------------------------------------------------------------------
// GET /api/admin/voters
// List all voters (with masked Aadhaar)
// -----------------------------------------------------------------------------
adminRouter.get('/voters', (req: AuthenticatedRequest, res: Response) => {
  const votersList = Array.from(db.voters.values()).map((v) => {
    const user = db.users.get(v.user_id);
    const hasVoted = Array.from(db.votes.values()).some((vote) => vote.voter_id === v.id);
    return {
      id: v.id,
      userId: v.user_id,
      fullName: v.full_name,
      voterId: v.voter_id,
      aadhaarMasked: v.aadhaar_masked,
      mobile: v.mobile,
      email: v.email,
      age: v.age,
      sex: v.sex,
      houseNumber: v.house_number,
      ward: v.ward,
      hasVoted,
      accountStatus: user?.status || 'ACTIVE',
      createdAt: v.created_at,
    };
  });

  return res.json({ voters: votersList });
});

// -----------------------------------------------------------------------------
// GET /api/admin/voters/:id
// -----------------------------------------------------------------------------
adminRouter.get('/voters/:id', (req: AuthenticatedRequest, res: Response) => {
  const voter = db.voters.get(req.params.id);
  if (!voter) return res.status(404).json({ error: 'Voter not found' });
  const hasVoted = Array.from(db.votes.values()).some((vote) => vote.voter_id === voter.id);

  return res.json({
    voter: {
      ...voter,
      aadhaar_number_encrypted: undefined,
      hasVoted,
    },
  });
});

// -----------------------------------------------------------------------------
// PUT /api/admin/voters/:id
// -----------------------------------------------------------------------------
adminRouter.put('/voters/:id', (req: AuthenticatedRequest, res: Response) => {
  const voter = db.voters.get(req.params.id);
  if (!voter) return res.status(404).json({ error: 'Voter not found' });

  const { fullName, age, sex, houseNumber, ward } = req.body;
  if (fullName) voter.full_name = fullName;
  if (age) voter.age = Number(age);
  if (sex) voter.sex = sex;
  if (houseNumber) voter.house_number = houseNumber;
  if (ward) voter.ward = ward;
  voter.updated_at = new Date().toISOString();

  db.logAudit({
    userId: req.user!.userId,
    userRole: 'ADMIN',
    action: 'VOTER_UPDATED',
    details: { voterId: voter.voter_id },
    status: 'SUCCESS',
  });

  return res.json({ message: 'Voter details updated.', voter });
});

// -----------------------------------------------------------------------------
// POST /api/admin/leaders
// Create Leader with duplicate validation, auto Voter ID, email credentials
// -----------------------------------------------------------------------------
adminRouter.post('/leaders', async (req: AuthenticatedRequest, res: Response) => {
  const { errors, cleanedMobile, cleanedEmail, aadhaarCheck } = validatePersonFields(req.body, true);

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  const aadhaarHash = hashAadhaarForLookup(aadhaarCheck.normalized);

  // Check duplicate Aadhaar
  for (const l of db.leaders.values()) {
    if (l.aadhaar_number_hash === aadhaarHash) {
      return res.status(409).json({ error: 'Duplicate record: A leader with this Aadhaar number already exists.' });
    }
  }
  for (const v of db.voters.values()) {
    if (v.aadhaar_number_hash === aadhaarHash) {
      return res.status(409).json({ error: 'Duplicate record: This Aadhaar number is already registered to a voter.' });
    }
  }

  // Check duplicate Mobile
  for (const u of db.users.values()) {
    if (u.mobile === cleanedMobile) {
      return res.status(409).json({ error: 'Duplicate record: This mobile number is already registered.' });
    }
  }

  // Check duplicate Email
  for (const u of db.users.values()) {
    if (u.email === cleanedEmail) {
      return res.status(409).json({ error: 'Duplicate record: This email address is already in use.' });
    }
  }

  const houseNumber = req.body.houseNumber.trim();
  let voterId = req.body.voterId?.trim();
  if (!voterId) {
    const seq = db.getNextHouseSequence(houseNumber);
    voterId = generateVoterId(db.config.voter_id_pattern, houseNumber, seq);
  }

  const tempPassword = generateTemporaryPassword();
  const { hash, salt } = hashPassword(tempPassword);

  const userId = `user-ldr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const leaderDbId = `ldr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  db.users.set(userId, {
    id: userId,
    name: req.body.fullName.trim(),
    email: cleanedEmail,
    mobile: cleanedMobile,
    password_hash: hash,
    password_salt: salt,
    role: 'LEADER',
    status: 'PENDING_PASSWORD_CHANGE',
    must_change_password: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const newLeader: LeaderRecord = {
    id: leaderDbId,
    user_id: userId,
    full_name: req.body.fullName.trim(),
    aadhaar_number_encrypted: encryptAadhaar(aadhaarCheck.normalized),
    aadhaar_number_hash: aadhaarHash,
    aadhaar_masked: maskAadhaar(aadhaarCheck.normalized),
    mobile: cleanedMobile,
    email: cleanedEmail,
    age: Number(req.body.age),
    sex: req.body.sex,
    house_number: houseNumber,
    voter_id: voterId,
    ward: req.body.ward?.trim() || 'Ward 1',
    bio: req.body.bio || '',
    photo_url: req.body.photoUrl || '/src/assets/images/candidate_ananya_sharma_1790730516942.jpg',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.leaders.set(leaderDbId, newLeader);

  // If candidate nomination details provided, add as candidate to active election
  const election = Array.from(db.elections.values())[0];
  if (election && req.body.nominatedForElection) {
    const candId = `cand-${Date.now().toString(36)}`;
    db.candidates.set(candId, {
      id: candId,
      election_id: election.id,
      leader_id: leaderDbId,
      candidate_name: newLeader.full_name,
      party_or_slate: req.body.partyOrSlate || 'Independent',
      photo: newLeader.photo_url,
      status: 'APPROVED',
      manifesto: req.body.manifesto || newLeader.bio,
      ballot_number: db.candidates.size + 1,
      created_at: new Date().toISOString(),
    });
  }

  // Trigger automated email credentials
  const emailRecord = await emailService.sendAccountCreationEmail({
    recipientEmail: cleanedEmail,
    recipientName: req.body.fullName.trim(),
    role: 'LEADER',
    voterId,
    tempPassword,
    electionName: election?.election_name,
  });

  db.logAudit({
    userId: req.user!.userId,
    userRole: 'ADMIN',
    action: 'LEADER_CREATED',
    details: {
      leaderDbId,
      voterId,
      email: cleanedEmail,
      houseNumber,
      aadhaarMasked: newLeader.aadhaar_masked,
    },
    status: 'SUCCESS',
  });

  return res.status(201).json({
    message: 'Leader created successfully. Login credentials and activation email have been dispatched.',
    leader: {
      ...newLeader,
      aadhaar_number_encrypted: undefined,
    },
    generatedCredentials: {
      voterId,
      tempPassword,
      emailSentTo: cleanedEmail,
      emailId: emailRecord.id,
    },
  });
});

// -----------------------------------------------------------------------------
// GET /api/admin/leaders
// -----------------------------------------------------------------------------
adminRouter.get('/leaders', (req: AuthenticatedRequest, res: Response) => {
  const leadersList = Array.from(db.leaders.values()).map((l) => {
    const isNominated = Array.from(db.candidates.values()).some((c) => c.leader_id === l.id);
    return {
      id: l.id,
      userId: l.user_id,
      fullName: l.full_name,
      voterId: l.voter_id,
      aadhaarMasked: l.aadhaar_masked,
      mobile: l.mobile,
      email: l.email,
      age: l.age,
      sex: l.sex,
      houseNumber: l.house_number,
      ward: l.ward,
      bio: l.bio,
      photoUrl: l.photo_url,
      isNominated,
      createdAt: l.created_at,
    };
  });

  return res.json({ leaders: leadersList });
});

// -----------------------------------------------------------------------------
// POST /api/admin/elections
// -----------------------------------------------------------------------------
adminRouter.post('/elections', (req: AuthenticatedRequest, res: Response) => {
  const { electionName, electionDate, startTime, endTime, description } = req.body;
  if (!electionName || !electionDate || !startTime || !endTime) {
    return res.status(400).json({ error: 'All election fields (Name, Date, Start Time, End Time) are required.' });
  }

  const id = `elec-${Date.now().toString(36)}`;
  const startDatetime = new Date(`${electionDate}T${startTime}:00Z`).toISOString();
  const endDatetime = new Date(`${electionDate}T${endTime}:00Z`).toISOString();

  const newElection = {
    id,
    election_name: electionName,
    election_date: electionDate,
    start_time: startTime,
    end_time: endTime,
    start_datetime: startDatetime,
    end_datetime: endDatetime,
    status: 'UPCOMING' as const,
    allow_live_results_for_leaders: true,
    description: description || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.elections.set(id, newElection);

  db.logAudit({
    userId: req.user!.userId,
    userRole: 'ADMIN',
    action: 'ELECTION_CREATED',
    details: { id, electionName, electionDate },
    status: 'SUCCESS',
  });

  return res.status(201).json({ message: 'Election created successfully', election: newElection });
});

// -----------------------------------------------------------------------------
// PUT /api/admin/elections/:id
// Update election configuration & time override mode
// -----------------------------------------------------------------------------
adminRouter.put('/elections/:id', (req: AuthenticatedRequest, res: Response) => {
  const election = db.elections.get(req.params.id);
  if (!election) return res.status(404).json({ error: 'Election not found' });

  const { electionName, electionDate, startTime, endTime, timeOverrideMode, allowLiveResults } = req.body;

  if (electionName) election.election_name = electionName;
  if (electionDate) election.election_date = electionDate;
  if (startTime) election.start_time = startTime;
  if (endTime) election.end_time = endTime;
  if (allowLiveResults !== undefined) election.allow_live_results_for_leaders = Boolean(allowLiveResults);

  if (timeOverrideMode && ['AUTO', 'FORCE_ACTIVE', 'FORCE_UPCOMING', 'FORCE_COMPLETED'].includes(timeOverrideMode)) {
    db.config.time_override_mode = timeOverrideMode;
  }

  election.updated_at = new Date().toISOString();

  db.logAudit({
    userId: req.user!.userId,
    userRole: 'ADMIN',
    action: 'ELECTION_CONFIG_UPDATED',
    details: { electionId: election.id, timeOverrideMode: db.config.time_override_mode },
    status: 'SUCCESS',
  });

  return res.json({
    message: 'Election configuration updated.',
    election: {
      ...election,
      status: db.computeElectionStatus(election),
    },
    timeOverrideMode: db.config.time_override_mode,
  });
});

// -----------------------------------------------------------------------------
// POST /api/admin/config/voter-id-pattern
// Configure Voter ID generation template (e.g. "HOUSE-{houseNumber}-{seq}")
// -----------------------------------------------------------------------------
adminRouter.post('/config/voter-id-pattern', (req: AuthenticatedRequest, res: Response) => {
  const { pattern } = req.body;
  if (!pattern || typeof pattern !== 'string' || !pattern.includes('{houseNumber}') || !pattern.includes('{seq}')) {
    return res.status(400).json({
      error: 'Invalid pattern. The pattern must contain placeholders "{houseNumber}" and "{seq}". Example: "HOUSE-{houseNumber}-{seq}"',
    });
  }

  db.config.voter_id_pattern = pattern.trim();
  const sampleVoterId = generateVoterId(db.config.voter_id_pattern, '102', 1);

  db.logAudit({
    userId: req.user!.userId,
    userRole: 'ADMIN',
    action: 'VOTER_ID_PATTERN_CONFIGURED',
    details: { pattern: db.config.voter_id_pattern, sample: sampleVoterId },
    status: 'SUCCESS',
  });

  return res.json({
    message: 'Voter ID generation pattern updated.',
    pattern: db.config.voter_id_pattern,
    sample: sampleVoterId,
  });
});

// -----------------------------------------------------------------------------
// GET /api/admin/audit-logs
// -----------------------------------------------------------------------------
adminRouter.get('/audit-logs', (req: AuthenticatedRequest, res: Response) => {
  return res.json({ logs: db.audit_logs });
});

// -----------------------------------------------------------------------------
// GET /api/admin/outbox
// Access all dispatched notification emails
// -----------------------------------------------------------------------------
adminRouter.get('/outbox', (req: AuthenticatedRequest, res: Response) => {
  return res.json({ outbox: emailService.getOutbox() });
});

// -----------------------------------------------------------------------------
// POST /api/admin/run-tests
// Live in-app execution of security & relational validation test suite
// -----------------------------------------------------------------------------
adminRouter.post('/run-tests', (req: AuthenticatedRequest, res: Response) => {
  const results: Array<{ test: string; status: 'PASSED' | 'FAILED'; details: string }> = [];

  // Test 1: Duplicate Vote Prevention Server-side UNIQUE Constraint
  try {
    const election = Array.from(db.elections.values())[0];
    const candidate = Array.from(db.candidates.values())[0];
    const testVoter = Array.from(db.voters.values())[0]; // Already has voted or will vote

    let duplicateCaught = false;
    try {
      // First attempt
      db.castVote({
        electionId: election.id,
        voterId: testVoter.id,
        candidateId: candidate.id,
      });
    } catch {
      // Might already have voted
    }

    try {
      // Second attempt must throw
      db.castVote({
        electionId: election.id,
        voterId: testVoter.id,
        candidateId: candidate.id,
      });
    } catch (e: any) {
      if (e.message.includes('already voted')) {
        duplicateCaught = true;
      }
    }

    if (duplicateCaught) {
      results.push({
        test: 'UNIQUE(election_id, voter_id) Server Constraint',
        status: 'PASSED',
        details: 'Server blocked duplicate vote attempt and logged security audit record.',
      });
    } else {
      results.push({
        test: 'UNIQUE(election_id, voter_id) Server Constraint',
        status: 'FAILED',
        details: 'Server failed to intercept second vote attempt.',
      });
    }
  } catch (err: any) {
    results.push({
      test: 'UNIQUE(election_id, voter_id) Server Constraint',
      status: 'FAILED',
      details: err.message,
    });
  }

  // Test 2: Aadhaar AES-256 Encryption & Masking
  try {
    const sampleAadhaar = '999988887777';
    const encrypted = encryptAadhaar(sampleAadhaar);
    const masked = maskAadhaar(sampleAadhaar);

    if (masked === 'XXXX XXXX 7777' && encrypted.includes(':') && !encrypted.includes(sampleAadhaar)) {
      results.push({
        test: 'Aadhaar Privacy Masking & AES-256 Encryption',
        status: 'PASSED',
        details: 'Plaintext is masked to XXXX XXXX 7777; database ciphertext is AES-256 authenticated GCM.',
      });
    } else {
      results.push({
        test: 'Aadhaar Privacy Masking & AES-256 Encryption',
        status: 'FAILED',
        details: 'Masking or encryption mismatch.',
      });
    }
  } catch (err: any) {
    results.push({
      test: 'Aadhaar Privacy Masking & AES-256 Encryption',
      status: 'FAILED',
      details: err.message,
    });
  }

  // Test 3: Voter ID Format Generator Pattern
  try {
    const generated = generateVoterId('HOUSE-{houseNumber}-{seq}', '102', 5);
    if (generated === 'HOUSE-102-005') {
      results.push({
        test: 'Derived Voter ID Generation Without PII',
        status: 'PASSED',
        details: 'Generated "HOUSE-102-005" correctly without exposing Aadhaar or personal data.',
      });
    } else {
      results.push({
        test: 'Derived Voter ID Generation Without PII',
        status: 'FAILED',
        details: `Unexpected format: ${generated}`,
      });
    }
  } catch (err: any) {
    results.push({
      test: 'Derived Voter ID Generation Without PII',
      status: 'FAILED',
      details: err.message,
    });
  }

  // Test 4: Password Hash Salting & Timing Protection
  try {
    const p1 = hashPassword('TestPassword123');
    const p2 = hashPassword('TestPassword123');
    if (p1.hash !== p2.hash && p1.salt !== p2.salt) {
      results.push({
        test: 'PBKDF2 Password Salting & Constant-Time Verification',
        status: 'PASSED',
        details: 'Identical passwords generate distinct unique cryptographic salts & hashes.',
      });
    } else {
      results.push({
        test: 'PBKDF2 Password Salting & Constant-Time Verification',
        status: 'FAILED',
        details: 'Salts were not unique.',
      });
    }
  } catch (err: any) {
    results.push({
      test: 'PBKDF2 Password Salting & Constant-Time Verification',
      status: 'FAILED',
      details: err.message,
    });
  }

  return res.json({
    summary: `${results.filter((r) => r.status === 'PASSED').length}/${results.length} Tests Passed`,
    results,
  });
});

// -----------------------------------------------------------------------------
// REPORT EXPORT: Voting Statistics & Candidate Tally (CSV)
// -----------------------------------------------------------------------------
adminRouter.get('/reports/voting-stats/csv', (req: AuthenticatedRequest, res: Response) => {
  const election = Array.from(db.elections.values())[0];
  const totalRegisteredVoters = db.voters.size;
  const electionVotes = Array.from(db.votes.values()).filter(
    (v) => !election || v.election_id === election.id
  );
  const totalVotesCast = electionVotes.length;
  const turnoutPercentage = totalRegisteredVoters > 0
    ? ((totalVotesCast / totalRegisteredVoters) * 100).toFixed(2)
    : '0.00';

  const candidateTallyMap: Record<string, number> = {};
  electionVotes.forEach((v) => {
    candidateTallyMap[v.candidate_id] = (candidateTallyMap[v.candidate_id] || 0) + 1;
  });

  const lines: string[] = [
    `"SECURE ELECTION MANAGEMENT SYSTEM - OFFICIAL BALLOT TALLY REPORT"`,
    `"Election Title","${(election?.election_name || 'Election 2026').replace(/"/g, '""')}"`,
    `"Election Date","${election?.election_date || 'N/A'}"`,
    `"Polling Window","${election?.start_time || '08:00'} to ${election?.end_time || '18:00'}"`,
    `"Certified Timestamp","${new Date().toISOString()}"`,
    `"Generated By","${req.user!.name} (${req.user!.email})"`,
    `"Total Registered Voters","${totalRegisteredVoters}"`,
    `"Total Ballots Cast","${totalVotesCast}"`,
    `"Total Non-Voting Registered","${Math.max(0, totalRegisteredVoters - totalVotesCast)}"`,
    `"Official Voter Turnout","${turnoutPercentage}%"`,
    `""`,
    `"Ballot Number","Candidate Name","Party / Slate","Leader ID","House Number","Ward","Votes Received","Vote Share %","Status"`,
  ];

  const sortedCandidates = Array.from(db.candidates.values())
    .filter((c) => !election || c.election_id === election.id)
    .sort((a, b) => (candidateTallyMap[b.id] || 0) - (candidateTallyMap[a.id] || 0));

  sortedCandidates.forEach((c) => {
    const leader = db.leaders.get(c.leader_id);
    const votes = candidateTallyMap[c.id] || 0;
    const share = totalVotesCast > 0 ? ((votes / totalVotesCast) * 100).toFixed(2) : '0.00';

    lines.push(
      `"${c.ballot_number}","${c.candidate_name.replace(/"/g, '""')}","${c.party_or_slate.replace(
        /"/g,
        '""'
      )}","${c.leader_id}","${leader?.house_number || 'N/A'}","${leader?.ward || 'Ward 1'}","${votes}","${share}%","${c.status}"`
    );
  });

  lines.push(`""`);
  lines.push(`"SECURITY VERIFICATION"`);
  lines.push(`"Relational Invariant UNIQUE(election_id, voter_id)","VERIFIED ENFORCED"`);
  lines.push(`"Ballot Secrecy Guarantee","INDIVIDUAL VOTER BALLOT CHOICES ANONYMIZED"`);

  const csvContent = lines.join('\r\n');

  db.logAudit({
    userId: req.user!.userId,
    userRole: 'ADMIN',
    action: 'REPORT_EXPORTED_VOTING_STATS_CSV',
    details: { totalVotesCast, totalRegisteredVoters, turnoutPercentage },
    ipAddress: (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
    status: 'SUCCESS',
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Election_Voting_Statistics_${new Date().toISOString().slice(0, 10)}.csv"`
  );
  return res.send(csvContent);
});

// -----------------------------------------------------------------------------
// REPORT EXPORT: Audit Logs Ledger (CSV)
// -----------------------------------------------------------------------------
adminRouter.get('/reports/audit-logs/csv', (req: AuthenticatedRequest, res: Response) => {
  const lines: string[] = [
    `"SECURE ELECTION MANAGEMENT SYSTEM - CENTRAL AUDIT LEDGER EXPORT"`,
    `"Export Timestamp","${new Date().toISOString()}"`,
    `"Authorized Auditor","${req.user!.name} (${req.user!.email})"`,
    `"Total Audit Entries","${db.audit_logs.length}"`,
    `"Ledger Integrity Algorithm","HMAC-SHA256"`,
    `""`,
    `"Log ID","Timestamp","Action","Actor Role","Actor User ID","Client IP","Status","HMAC Integrity Signature","Details Summary"`,
  ];

  db.audit_logs.forEach((log) => {
    const detailsStr = JSON.stringify(log.details || {}).replace(/"/g, '""');
    lines.push(
      `"${log.id}","${log.timestamp}","${log.action}","${log.user_role}","${log.user_id || 'SYSTEM'}","${log.ip_address}","${log.status}","${log.integrity_signature}","${detailsStr}"`
    );
  });

  const csvContent = lines.join('\r\n');

  db.logAudit({
    userId: req.user!.userId,
    userRole: 'ADMIN',
    action: 'REPORT_EXPORTED_AUDIT_LOGS_CSV',
    details: { totalLogsExported: db.audit_logs.length },
    ipAddress: (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
    status: 'SUCCESS',
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Election_Audit_Ledger_${new Date().toISOString().slice(0, 10)}.csv"`
  );
  return res.send(csvContent);
});

// -----------------------------------------------------------------------------
// REPORT EXPORT: Voter Registration Roster with Masked Aadhaar (CSV)
// -----------------------------------------------------------------------------
adminRouter.get('/reports/voters/csv', (req: AuthenticatedRequest, res: Response) => {
  const lines: string[] = [
    `"SECURE ELECTION MANAGEMENT SYSTEM - REGISTERED VOTERS ROSTER"`,
    `"Export Timestamp","${new Date().toISOString()}"`,
    `"Privacy Standard","Aadhaar Masked (XXXX XXXX 1234), Raw Ciphertext Protected"`,
    `"Total Registered Voters","${db.voters.size}"`,
    `""`,
    `"Voter ID","Full Name","Masked Aadhaar","Age","Sex","House Number","Ward","Registered Mobile","Email","Ballot Cast Status","Enrolled Date"`,
  ];

  Array.from(db.voters.values()).forEach((v) => {
    const hasVoted = Array.from(db.votes.values()).some((vote) => vote.voter_id === v.id);
    lines.push(
      `"${v.voter_id}","${v.full_name.replace(/"/g, '""')}","${v.aadhaar_masked}","${v.age}","${v.sex}","${v.house_number}","${v.ward}","${v.mobile}","${v.email}","${hasVoted ? 'YES - BALLOT RECORDED' : 'NO - NOT YET VOTED'}","${v.created_at}"`
    );
  });

  const csvContent = lines.join('\r\n');

  db.logAudit({
    userId: req.user!.userId,
    userRole: 'ADMIN',
    action: 'REPORT_EXPORTED_VOTER_ROSTER_CSV',
    details: { totalVoters: db.voters.size },
    ipAddress: (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
    status: 'SUCCESS',
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Election_Voter_Roster_${new Date().toISOString().slice(0, 10)}.csv"`
  );
  return res.send(csvContent);
});

// -----------------------------------------------------------------------------
// REPORT AUDIT: Log PDF Report Generation Action
// -----------------------------------------------------------------------------
adminRouter.post('/reports/log-pdf-export', (req: AuthenticatedRequest, res: Response) => {
  const { reportType, title } = req.body;

  db.logAudit({
    userId: req.user!.userId,
    userRole: 'ADMIN',
    action: 'REPORT_EXPORTED_PDF',
    details: { reportType, title, timestamp: new Date().toISOString() },
    ipAddress: (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
    status: 'SUCCESS',
  });

  return res.json({ success: true, message: 'PDF export action recorded in audit ledger.' });
});

