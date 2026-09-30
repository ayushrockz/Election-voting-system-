import {
  User,
  DashboardData,
  VoterListItem,
  LeaderListItem,
  CandidateItem,
  ElectionInfo,
  AuditLogItem,
  EmailOutboxItem,
  VoteReceipt,
} from '../types';

let authToken: string | null = localStorage.getItem('election_token');

export function setApiToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('election_token', token);
  } else {
    localStorage.removeItem('election_token');
  }
}

export function getApiToken(): string | null {
  return authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }

  return data as T;
}

export const api = {
  // Authentication
  auth: {
    login: (identifier: string, password: string, roleHint?: string) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, roleHint }),
      }),
    logout: () =>
      request<{ message: string }>('/auth/logout', { method: 'POST' }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ message: string; token: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    forgotPassword: (email: string) =>
      request<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    me: () => request<{ user: User }>('/auth/me'),
  },

  // Admin APIs
  admin: {
    getDashboard: () => request<DashboardData>('/admin/dashboard'),
    getVoters: () => request<{ voters: VoterListItem[] }>('/admin/voters'),
    createVoter: (voterData: {
      fullName: string;
      aadhaarNumber: string;
      mobile: string;
      email: string;
      age: number;
      sex: 'Male' | 'Female' | 'Other';
      houseNumber: string;
      ward?: string;
      voterId?: string;
    }) =>
      request<{ message: string; voter: any; generatedCredentials: any }>('/admin/voters', {
        method: 'POST',
        body: JSON.stringify(voterData),
      }),
    updateVoter: (id: string, voterData: any) =>
      request<{ message: string; voter: any }>(`/admin/voters/${id}`, {
        method: 'PUT',
        body: JSON.stringify(voterData),
      }),
    getLeaders: () => request<{ leaders: LeaderListItem[] }>('/admin/leaders'),
    createLeader: (leaderData: {
      fullName: string;
      aadhaarNumber: string;
      mobile: string;
      email: string;
      age: number;
      sex: 'Male' | 'Female' | 'Other';
      houseNumber: string;
      ward?: string;
      bio?: string;
      photoUrl?: string;
      partyOrSlate?: string;
      manifesto?: string;
      nominatedForElection?: boolean;
    }) =>
      request<{ message: string; leader: any; generatedCredentials: any }>('/admin/leaders', {
        method: 'POST',
        body: JSON.stringify(leaderData),
      }),
    updateElection: (
      id: string,
      data: {
        electionName?: string;
        electionDate?: string;
        startTime?: string;
        endTime?: string;
        timeOverrideMode?: string;
        allowLiveResults?: boolean;
      }
    ) =>
      request<{ message: string; election: any; timeOverrideMode: string }>(`/admin/elections/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    configureVoterIdPattern: (pattern: string) =>
      request<{ message: string; pattern: string; sample: string }>('/admin/config/voter-id-pattern', {
        method: 'POST',
        body: JSON.stringify({ pattern }),
      }),
    getAuditLogs: () => request<{ logs: AuditLogItem[] }>('/admin/audit-logs'),
    getOutbox: () => request<{ outbox: EmailOutboxItem[] }>('/admin/outbox'),
    runTests: () =>
      request<{ summary: string; results: Array<{ test: string; status: 'PASSED' | 'FAILED'; details: string }> }>(
        '/admin/run-tests',
        { method: 'POST' }
      ),
    downloadReportCsv: async (reportType: 'voting-stats' | 'audit-logs' | 'voters') => {
      const token = getApiToken();
      const res = await fetch(`/api/admin/reports/${reportType}/csv`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to download report');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Election_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    logPdfExport: (reportType: string, title: string) =>
      request<{ success: boolean }>('/admin/reports/log-pdf-export', {
        method: 'POST',
        body: JSON.stringify({ reportType, title }),
      }),
  },

  // Election & Voting
  elections: {
    getActive: () => request<{ election: ElectionInfo }>('/elections/active'),
    getCandidates: (electionId: string) =>
      request<{ candidates: CandidateItem[] }>(`/elections/${electionId}/candidates`),
    vote: (electionId: string, candidateId: string) =>
      request<VoteReceipt>(`/elections/${electionId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ candidateId }),
      }),
    getVotingStatus: () =>
      request<{
        hasVoted: boolean;
        transactionReference?: string;
        votedAt?: string;
        electionName?: string;
        voterId?: string;
      }>('/elections/voters/me/voting-status'),
  },

  // Leader APIs
  leaders: {
    getCampaign: () =>
      request<{
        leader: any;
        election: any;
        candidate: any;
      }>('/elections/leaders/me/campaign'),
  },
};
