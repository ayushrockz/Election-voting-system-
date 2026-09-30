export type UserRole = 'ADMIN' | 'LEADER' | 'VOTER';
export type ElectionStatus = 'NOT_STARTED' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
export type DeviceType = 'RESPONSIVE' | 'IOS' | 'ANDROID';

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: UserRole;
  status: 'ACTIVE' | 'PENDING_PASSWORD_CHANGE' | 'SUSPENDED';
  mustChangePassword?: boolean;
  voterId?: string;
  voterRecord?: {
    id: string;
    voter_id: string;
    house_number: string;
    ward: string;
    aadhaar_masked: string;
  };
  leaderRecord?: {
    id: string;
    voter_id: string;
    house_number: string;
    ward: string;
    aadhaar_masked: string;
    bio?: string;
  };
}

export interface VoterListItem {
  id: string;
  userId: string;
  fullName: string;
  voterId: string;
  aadhaarMasked: string;
  mobile: string;
  email: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  houseNumber: string;
  ward: string;
  hasVoted: boolean;
  accountStatus: string;
  createdAt: string;
}

export interface LeaderListItem {
  id: string;
  userId: string;
  fullName: string;
  voterId: string;
  aadhaarMasked: string;
  mobile: string;
  email: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  houseNumber: string;
  ward: string;
  bio: string;
  photoUrl: string;
  isNominated: boolean;
  createdAt: string;
}

export interface CandidateItem {
  id: string;
  leaderId: string;
  candidateName: string;
  partyOrSlate: string;
  photo: string;
  manifesto: string;
  ballotNumber: number;
  houseNumber: string;
  ward: string;
  votesReceived?: number;
  votePercentage?: number;
}

export interface ElectionInfo {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  startDatetime: string;
  endDatetime: string;
  status: ElectionStatus;
  description?: string;
  configuredStatus?: string;
  timeOverrideMode?: string;
  allowLiveResultsForLeaders?: boolean;
}

export interface DashboardData {
  election: ElectionInfo | null;
  voterStatistics: {
    totalRegisteredVoters: number;
    totalVoted: number;
    totalNotVoted: number;
    turnoutPercentage: number;
  };
  leaderStatistics: Array<{
    candidateId: string;
    leaderId: string;
    candidateName: string;
    partyOrSlate: string;
    photo: string;
    houseNumber: string;
    ward: string;
    votesReceived: number;
    votePercentage: number;
    status: string;
  }>;
  securityMetrics: {
    blockedAttempts: number;
    totalAuditLogs: number;
    voterIdPattern: string;
  };
}

export interface AuditLogItem {
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

export interface EmailOutboxItem {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  templateType: 'ACCOUNT_CREATION' | 'VOTE_CONFIRMATION' | 'PASSWORD_RESET' | 'ELECTION_ANNOUNCEMENT';
  bodyText: string;
  bodyHtml: string;
  payload: Record<string, any>;
  status: 'SENT' | 'SIMULATED';
  sentAt: string;
}

export interface VoteReceipt {
  success: boolean;
  message: string;
  transactionReference: string;
  votedAt: string;
  electionName: string;
  voterId: string;
}
