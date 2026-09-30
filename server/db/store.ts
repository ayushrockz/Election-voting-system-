import {
  hashPassword,
  encryptAadhaar,
  maskAadhaar,
  hashAadhaarForLookup,
  generateVoteTransactionReference,
  calculateVoteIntegrityHash,
  createAuditSignature,
  generateVoterId,
} from '../security/crypto.ts';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  mobile: string;
  password_hash: string;
  password_salt: string;
  role: 'ADMIN' | 'LEADER' | 'VOTER';
  status: 'ACTIVE' | 'PENDING_PASSWORD_CHANGE' | 'SUSPENDED';
  must_change_password: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface VoterRecord {
  id: string;
  user_id: string;
  full_name: string;
  aadhaar_number_encrypted: string;
  aadhaar_number_hash: string;
  aadhaar_masked: string;
  mobile: string;
  email: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  house_number: string;
  voter_id: string;
  ward: string;
  created_at: string;
  updated_at: string;
}

export interface LeaderRecord {
  id: string;
  user_id: string;
  full_name: string;
  aadhaar_number_encrypted: string;
  aadhaar_number_hash: string;
  aadhaar_masked: string;
  mobile: string;
  email: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  house_number: string;
  voter_id: string;
  ward: string;
  bio: string;
  photo_url: string;
  created_at: string;
  updated_at: string;
}

export interface ElectionRecord {
  id: string;
  election_name: string;
  election_date: string;
  start_time: string;
  end_time: string;
  start_datetime: string;
  end_datetime: string;
  status: 'NOT_STARTED' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
  allow_live_results_for_leaders: boolean;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateRecord {
  id: string;
  election_id: string;
  leader_id: string;
  candidate_name: string;
  party_or_slate: string;
  photo: string;
  status: 'NOMINATED' | 'APPROVED' | 'WITHDRAWN';
  manifesto: string;
  ballot_number: number;
  created_at: string;
}

export interface VoteRecord {
  id: string;
  election_id: string;
  voter_id: string; // Foreign key to voters(id)
  candidate_id: string;
  transaction_reference: string;
  voted_at: string;
  ip_hash: string;
  integrity_hash: string;
}

export interface AuditLogRecord {
  id: string;
  user_id?: string;
  user_role: string;
  action: string;
  details: Record<string, any>;
  ip_address: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  timestamp: string;
  integrity_signature: string;
}

export interface SystemConfig {
  voter_id_pattern: string; // default "HOUSE-{houseNumber}-{seq}"
  time_override_mode: 'AUTO' | 'FORCE_ACTIVE' | 'FORCE_UPCOMING' | 'FORCE_COMPLETED';
  live_stream_tally: boolean;
}

// -----------------------------------------------------------------------------
// Relational Store In-Memory with Foreign Keys & Constraint Checking
// -----------------------------------------------------------------------------
class RelationalStore {
  users: Map<string, UserRecord> = new Map();
  voters: Map<string, VoterRecord> = new Map();
  leaders: Map<string, LeaderRecord> = new Map();
  elections: Map<string, ElectionRecord> = new Map();
  candidates: Map<string, CandidateRecord> = new Map();
  votes: Map<string, VoteRecord> = new Map();
  audit_logs: AuditLogRecord[] = [];
  config: SystemConfig = {
    voter_id_pattern: 'HOUSE-{houseNumber}-{seq}',
    time_override_mode: 'FORCE_ACTIVE', // Defaults to ACTIVE for immediate balloting demo
    live_stream_tally: true,
  };

  private houseSequenceCounters: Map<string, number> = new Map();

  constructor() {
    this.seedInitialData();
  }

  getNextHouseSequence(houseNumber: string): number {
    const key = houseNumber.toUpperCase().trim();
    const current = this.houseSequenceCounters.get(key) || 0;
    const next = current + 1;
    this.houseSequenceCounters.set(key, next);
    return next;
  }

  // ---------------------------------------------------------------------------
  // Audit Logger
  // ---------------------------------------------------------------------------
  logAudit(entry: {
    userId?: string;
    userRole: string;
    action: string;
    details: Record<string, any>;
    ipAddress?: string;
    status?: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  }): AuditLogRecord {
    const id = `AUDIT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
    const timestamp = new Date().toISOString();
    const signature = createAuditSignature(entry.action, entry.userId || 'ANON', timestamp);
    const log: AuditLogRecord = {
      id,
      user_id: entry.userId,
      user_role: entry.userRole,
      action: entry.action,
      details: entry.details,
      ip_address: entry.ipAddress || '127.0.0.1',
      status: entry.status || 'SUCCESS',
      timestamp,
      integrity_signature: signature,
    };
    this.audit_logs.unshift(log);
    // Keep max 500 audit logs
    if (this.audit_logs.length > 500) {
      this.audit_logs.pop();
    }
    return log;
  }

  // ---------------------------------------------------------------------------
  // Election Lifecycle Calculator
  // ---------------------------------------------------------------------------
  computeElectionStatus(election: ElectionRecord): 'NOT_STARTED' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED' {
    if (this.config.time_override_mode !== 'AUTO') {
      if (this.config.time_override_mode === 'FORCE_ACTIVE') return 'ACTIVE';
      if (this.config.time_override_mode === 'FORCE_UPCOMING') return 'UPCOMING';
      if (this.config.time_override_mode === 'FORCE_COMPLETED') return 'COMPLETED';
    }

    const now = Date.now();
    const start = new Date(election.start_datetime).getTime();
    const end = new Date(election.end_datetime).getTime();

    if (now < start) {
      // If within 7 days, it's upcoming; otherwise not started
      return (start - now <= 7 * 24 * 3600 * 1000) ? 'UPCOMING' : 'NOT_STARTED';
    }
    if (now >= start && now <= end) {
      return 'ACTIVE';
    }
    return 'COMPLETED';
  }

  // ---------------------------------------------------------------------------
  // Vote Casting with STRICT Server-side UNIQUE(election_id, voter_id) Enforcement
  // ---------------------------------------------------------------------------
  castVote(params: {
    electionId: string;
    voterId: string;
    candidateId: string;
    ipAddress?: string;
  }): { vote: VoteRecord; transactionRef: string; votedAt: string } {
    // 1. Validate Election Exists
    const election = this.elections.get(params.electionId);
    if (!election) {
      throw new Error('Election not found');
    }

    // 2. Validate Election Status is ACTIVE
    const currentStatus = this.computeElectionStatus(election);
    if (currentStatus !== 'ACTIVE') {
      throw new Error(`Voting is not available. Election status is currently ${currentStatus}.`);
    }

    // 3. Validate Voter Exists
    const voter = this.voters.get(params.voterId);
    if (!voter) {
      throw new Error('Voter record not found');
    }

    // 4. Validate Candidate Exists in this Election
    const candidate = this.candidates.get(params.candidateId);
    if (!candidate || candidate.election_id !== params.electionId) {
      throw new Error('Invalid candidate selection for this election');
    }

    // 5. CRITICAL: RELATIONAL UNIQUE CONSTRAINT ENFORCEMENT
    // Check if voter has ALREADY voted in this election
    for (const v of this.votes.values()) {
      if (v.election_id === params.electionId && v.voter_id === params.voterId) {
        this.logAudit({
          userId: voter.user_id,
          userRole: 'VOTER',
          action: 'DUPLICATE_VOTE_ATTEMPT_BLOCKED',
          details: {
            electionId: params.electionId,
            voterId: params.voterId,
            existingTransaction: v.transaction_reference,
          },
          ipAddress: params.ipAddress,
          status: 'BLOCKED',
        });
        throw new Error('You have already voted in this election.');
      }
    }

    // 6. Generate cryptographic receipt and hashes
    const transactionRef = generateVoteTransactionReference(params.electionId);
    const votedAt = new Date().toISOString();
    const integrityHash = calculateVoteIntegrityHash(
      params.electionId,
      params.voterId,
      params.candidateId,
      votedAt,
      transactionRef
    );

    const voteRecord: VoteRecord = {
      id: `VOTE-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase(),
      election_id: params.electionId,
      voter_id: params.voterId,
      candidate_id: params.candidateId,
      transaction_reference: transactionRef,
      voted_at: votedAt,
      ip_hash: params.ipAddress ? Buffer.from(params.ipAddress).toString('base64') : 'LOCAL',
      integrity_hash: integrityHash,
    };

    this.votes.set(voteRecord.id, voteRecord);

    // Audit log (without recording candidate choice for ballot secrecy)
    this.logAudit({
      userId: voter.user_id,
      userRole: 'VOTER',
      action: 'VOTE_CAST_SUCCESSFUL',
      details: {
        electionId: params.electionId,
        voterIdMasked: voter.voter_id,
        transactionRef,
      },
      ipAddress: params.ipAddress,
      status: 'SUCCESS',
    });

    return { vote: voteRecord, transactionRef, votedAt };
  }

  // ---------------------------------------------------------------------------
  // Seed realistic demonstration dataset
  // ---------------------------------------------------------------------------
  private seedInitialData() {
    const now = new Date();
    // Default Election Date: 10 October 2026 or Current Month
    const electionDate = '2026-10-10';
    const startDatetime = new Date('2026-10-10T08:00:00Z').toISOString();
    const endDatetime = new Date('2026-10-10T18:00:00Z').toISOString();

    const electionId = 'elec-2026-general';
    this.elections.set(electionId, {
      id: electionId,
      election_name: 'Civic Community Council Election 2026',
      election_date: electionDate,
      start_time: '08:00 AM',
      end_time: '06:00 PM',
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      status: 'ACTIVE',
      allow_live_results_for_leaders: true,
      description: 'Official representative election for Ward 1 & Ward 2 Council seats.',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    // 1. Super Admin User
    const adminPass = hashPassword('AdminPassword@2026');
    const adminUserId = 'user-admin-01';
    this.users.set(adminUserId, {
      id: adminUserId,
      name: 'Chief Election Commissioner',
      email: 'admin@election.gov.in',
      mobile: '9876543210',
      password_hash: adminPass.hash,
      password_salt: adminPass.salt,
      role: 'ADMIN',
      status: 'ACTIVE',
      must_change_password: false,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    // 2. Leaders & Candidates
    const rawLeaders = [
      {
        name: 'Ananya Sharma',
        email: 'ananya.sharma@council.org',
        mobile: '9811223344',
        aadhaar: '542189012345',
        age: 38,
        sex: 'Female' as const,
        house: '102',
        ward: 'Ward 1',
        bio: 'Community advocate championing transparent municipal budgeting and green spaces.',
        party: 'Civic Integrity Alliance',
        photo: '/src/assets/images/candidate_ananya_sharma_1790730516942.jpg',
        manifesto: 'Clean municipal water, 24/7 civic clinic, solar street lamps across Ward 1.',
      },
      {
        name: 'Rajesh Patel',
        email: 'rajesh.patel@council.org',
        mobile: '9822334455',
        aadhaar: '789012345678',
        age: 46,
        sex: 'Male' as const,
        house: '104',
        ward: 'Ward 1',
        bio: 'Local merchant association president, focused on small business support and road paving.',
        party: 'Progressive Resident Forum',
        photo: '/src/assets/images/candidate_rajesh_patel_1790730528698.jpg',
        manifesto: 'Upgraded drainage grid, merchant cooperative lending, pedestrian zones.',
      },
      {
        name: 'Vikram Singh',
        email: 'vikram.singh@council.org',
        mobile: '9833445566',
        aadhaar: '901234567890',
        age: 52,
        sex: 'Male' as const,
        house: '201',
        ward: 'Ward 2',
        bio: 'Senior public works advisor, 20+ years of local governance experience.',
        party: 'Community Action Coalition',
        photo: '/src/assets/images/candidate_vikram_singh_1790730540344.jpg',
        manifesto: 'Public library expansion, rapid emergency response fleet, transparent zoning.',
      },
      {
        name: 'Priya Nair',
        email: 'priya.nair@council.org',
        mobile: '9844556677',
        aadhaar: '345678901234',
        age: 31,
        sex: 'Female' as const,
        house: '208',
        ward: 'Ward 2',
        bio: 'Civic technologist and youth sports organizer dedicated to digital transparency.',
        party: 'Youth & Sustainability Slate',
        photo: '/src/assets/images/candidate_priya_nair_1790730552256.jpg',
        manifesto: 'Fiber-to-the-home municipal mesh, youth recreation centre, waste composting.',
      },
    ];

    rawLeaders.forEach((item, index) => {
      const uId = `user-ldr-${index + 1}`;
      const ldrId = `ldr-${index + 1}`;
      const ldrSeq = this.getNextHouseSequence(item.house);
      const voterId = generateVoterId(this.config.voter_id_pattern, item.house, ldrSeq);

      const pass = hashPassword('LeaderPassword@2026');
      this.users.set(uId, {
        id: uId,
        name: item.name,
        email: item.email,
        mobile: item.mobile,
        password_hash: pass.hash,
        password_salt: pass.salt,
        role: 'LEADER',
        status: 'ACTIVE',
        must_change_password: false,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

      const leaderRec: LeaderRecord = {
        id: ldrId,
        user_id: uId,
        full_name: item.name,
        aadhaar_number_encrypted: encryptAadhaar(item.aadhaar),
        aadhaar_number_hash: hashAadhaarForLookup(item.aadhaar),
        aadhaar_masked: maskAadhaar(item.aadhaar),
        mobile: item.mobile,
        email: item.email,
        age: item.age,
        sex: item.sex,
        house_number: item.house,
        voter_id: voterId,
        ward: item.ward,
        bio: item.bio,
        photo_url: item.photo,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      this.leaders.set(ldrId, leaderRec);

      // Create candidate record
      const candId = `cand-${index + 1}`;
      this.candidates.set(candId, {
        id: candId,
        election_id: electionId,
        leader_id: ldrId,
        candidate_name: item.name,
        party_or_slate: item.party,
        photo: item.photo,
        status: 'APPROVED',
        manifesto: item.manifesto,
        ballot_number: index + 1,
        created_at: now.toISOString(),
      });
    });

    // 3. Pre-registered Voters
    const rawVoters = [
      {
        name: 'Aarav Gupta',
        email: 'aarav.voter@gmail.com',
        mobile: '9890011221',
        aadhaar: '234567890123',
        age: 29,
        sex: 'Male' as const,
        house: '102',
        ward: 'Ward 1',
        tempPass: 'Voter@102A',
      },
      {
        name: 'Sunita Rao',
        email: 'sunita.voter@gmail.com',
        mobile: '9890011222',
        aadhaar: '456789012345',
        age: 44,
        sex: 'Female' as const,
        house: '103',
        ward: 'Ward 1',
        tempPass: 'Voter@103B',
      },
      {
        name: 'Devendra Joshi',
        email: 'devendra.voter@gmail.com',
        mobile: '9890011223',
        aadhaar: '678901234567',
        age: 62,
        sex: 'Male' as const,
        house: '104',
        ward: 'Ward 1',
        tempPass: 'Voter@104C',
      },
      {
        name: 'Meera Chawla',
        email: 'meera.voter@gmail.com',
        mobile: '9890011224',
        aadhaar: '890123456789',
        age: 23,
        sex: 'Female' as const,
        house: '201',
        ward: 'Ward 2',
        tempPass: 'Voter@201D',
      },
      {
        name: 'Kabir Verma',
        email: 'kabir.voter@gmail.com',
        mobile: '9890011225',
        aadhaar: '123498765432',
        age: 35,
        sex: 'Male' as const,
        house: '202',
        ward: 'Ward 2',
        tempPass: 'Voter@202E',
      },
      {
        name: 'Fatima Sheikh',
        email: 'fatima.voter@gmail.com',
        mobile: '9890011226',
        aadhaar: '987612345678',
        age: 39,
        sex: 'Female' as const,
        house: '208',
        ward: 'Ward 2',
        tempPass: 'Voter@208F',
      },
      {
        name: 'Rohan Deshmukh',
        email: 'rohan.voter@gmail.com',
        mobile: '9890011227',
        aadhaar: '567812349012',
        age: 51,
        sex: 'Male' as const,
        house: '305',
        ward: 'Ward 2',
        tempPass: 'Voter@305G',
      },
    ];

    rawVoters.forEach((item, index) => {
      const uId = `user-vtr-${index + 1}`;
      const vtrId = `vtr-${index + 1}`;
      const seq = this.getNextHouseSequence(item.house);
      const voterId = generateVoterId(this.config.voter_id_pattern, item.house, seq);

      const pass = hashPassword(item.tempPass);
      this.users.set(uId, {
        id: uId,
        name: item.name,
        email: item.email,
        mobile: item.mobile,
        password_hash: pass.hash,
        password_salt: pass.salt,
        role: 'VOTER',
        status: index === 0 ? 'ACTIVE' : 'PENDING_PASSWORD_CHANGE',
        must_change_password: index !== 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

      this.voters.set(vtrId, {
        id: vtrId,
        user_id: uId,
        full_name: item.name,
        aadhaar_number_encrypted: encryptAadhaar(item.aadhaar),
        aadhaar_number_hash: hashAadhaarForLookup(item.aadhaar),
        aadhaar_masked: maskAadhaar(item.aadhaar),
        mobile: item.mobile,
        email: item.email,
        age: item.age,
        sex: item.sex,
        house_number: item.house,
        voter_id: voterId,
        ward: item.ward,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
    });

    // Cast a couple of initial votes so the dashboard shows real statistics immediately
    try {
      this.castVote({
        electionId,
        voterId: 'vtr-3', // Devendra Joshi
        candidateId: 'cand-1',
        ipAddress: '192.168.1.101',
      });
      this.castVote({
        electionId,
        voterId: 'vtr-4', // Meera Chawla
        candidateId: 'cand-2',
        ipAddress: '192.168.1.102',
      });
      this.castVote({
        electionId,
        voterId: 'vtr-5', // Kabir Verma
        candidateId: 'cand-1',
        ipAddress: '192.168.1.103',
      });
    } catch {
      // Ignored during seed
    }

    this.logAudit({
      userId: adminUserId,
      userRole: 'ADMIN',
      action: 'SYSTEM_BOOTSTRAP_INITIALIZED',
      details: {
        election: 'Civic Community Council Election 2026',
        registeredVoters: this.voters.size,
        registeredLeaders: this.leaders.size,
        candidates: this.candidates.size,
      },
      status: 'SUCCESS',
    });
  }
}

export const db = new RelationalStore();
