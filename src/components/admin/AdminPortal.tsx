import React, { useState, useEffect } from 'react';
import {
  Users,
  Vote,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  UserPlus,
  PlusCircle,
  Settings,
  FileText,
  Search,
  CheckCircle,
  Clock,
  RotateCw,
  Eye,
  KeyRound,
  Mail,
  Fingerprint,
  Calendar,
  Building,
  BarChart3,
  Terminal,
  Play,
  Download,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../api/client';
import { DashboardData, VoterListItem, LeaderListItem, AuditLogItem } from '../../types';
import { ExportReportModal } from './ExportReportModal';

export const AdminPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'voters' | 'leaders' | 'election' | 'voterIdConfig' | 'audit' | 'tests'
  >('overview');

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [voters, setVoters] = useState<VoterListItem[]>([]);
  const [leaders, setLeaders] = useState<LeaderListItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals
  const [showCreateVoter, setShowCreateVoter] = useState(false);
  const [showCreateLeader, setShowCreateLeader] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDefaultTab, setExportDefaultTab] = useState<'stats' | 'audit'>('stats');
  const [searchQuery, setSearchQuery] = useState('');

  // Forms: Create Voter
  const [voterForm, setVoterForm] = useState({
    fullName: '',
    aadhaarNumber: '',
    mobile: '',
    email: '',
    age: 24,
    sex: 'Female' as const,
    houseNumber: '105',
    ward: 'Ward 1',
    voterId: '',
  });

  // Forms: Create Leader
  const [leaderForm, setLeaderForm] = useState({
    fullName: '',
    aadhaarNumber: '',
    mobile: '',
    email: '',
    age: 35,
    sex: 'Male' as const,
    houseNumber: '106',
    ward: 'Ward 1',
    bio: '',
    partyOrSlate: '',
    manifesto: '',
    nominatedForElection: true,
  });

  // Forms: Election Config
  const [electionForm, setElectionForm] = useState({
    electionName: '',
    electionDate: '',
    startTime: '08:00',
    endTime: '18:00',
    timeOverrideMode: 'FORCE_ACTIVE',
    allowLiveResults: true,
  });

  // Forms: Voter ID Pattern
  const [patternConfig, setPatternConfig] = useState('HOUSE-{houseNumber}-{seq}');
  const [patternSample, setPatternSample] = useState('HOUSE-102-001');

  // Test Suite
  const [testResults, setTestResults] = useState<{
    summary: string;
    results: Array<{ test: string; status: 'PASSED' | 'FAILED'; details: string }>;
  } | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  // Load Dashboard Data
  const loadDashboard = async () => {
    try {
      const data = await api.admin.getDashboard();
      setDashboard(data);
      if (data.election) {
        setElectionForm({
          electionName: data.election.name,
          electionDate: data.election.date,
          startTime: data.election.startTime,
          endTime: data.election.endTime,
          timeOverrideMode: data.election.timeOverrideMode || 'FORCE_ACTIVE',
          allowLiveResults: data.election.allowLiveResultsForLeaders ?? true,
        });
      }
      if (data.securityMetrics?.voterIdPattern) {
        setPatternConfig(data.securityMetrics.voterIdPattern);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadVoters = async () => {
    try {
      const res = await api.admin.getVoters();
      setVoters(res.voters);
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadLeaders = async () => {
    try {
      const res = await api.admin.getLeaders();
      setLeaders(res.leaders);
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await api.admin.getAuditLogs();
      setAuditLogs(res.logs);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadVoters();
    loadLeaders();
    loadAuditLogs();
  }, []);

  // Update sample pattern live preview
  useEffect(() => {
    try {
      const s = patternConfig
        .replace('{houseNumber}', '102')
        .replace('{seq}', '001');
      setPatternSample(s);
    } catch {
      //
    }
  }, [patternConfig]);

  const handleCreateVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setLoading(true);

    try {
      const res = await api.admin.createVoter(voterForm);
      setActionSuccess(
        `Voter created! Generated Voter ID: ${res.generatedCredentials.voterId}. Temporary password "${res.generatedCredentials.tempPassword}" dispatched to ${res.generatedCredentials.emailSentTo}.`
      );
      setShowCreateVoter(false);
      setVoterForm({
        fullName: '',
        aadhaarNumber: '',
        mobile: '',
        email: '',
        age: 24,
        sex: 'Female',
        houseNumber: '105',
        ward: 'Ward 1',
        voterId: '',
      });
      loadVoters();
      loadDashboard();
      loadAuditLogs();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create voter.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLeader = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setLoading(true);

    try {
      const res = await api.admin.createLeader(leaderForm);
      setActionSuccess(
        `Leader created! Generated Voter ID: ${res.generatedCredentials.voterId}. Temporary password "${res.generatedCredentials.tempPassword}" dispatched to ${res.generatedCredentials.emailSentTo}.`
      );
      setShowCreateLeader(false);
      setLeaderForm({
        fullName: '',
        aadhaarNumber: '',
        mobile: '',
        email: '',
        age: 35,
        sex: 'Male',
        houseNumber: '106',
        ward: 'Ward 1',
        bio: '',
        partyOrSlate: '',
        manifesto: '',
        nominatedForElection: true,
      });
      loadLeaders();
      loadDashboard();
      loadAuditLogs();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create leader.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dashboard?.election?.id) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      await api.admin.updateElection(dashboard.election.id, electionForm);
      setActionSuccess('Election configuration and time-state updated successfully.');
      loadDashboard();
      loadAuditLogs();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update election configuration.');
    }
  };

  const handleSavePattern = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await api.admin.configureVoterIdPattern(patternConfig);
      setActionSuccess(`Voter ID pattern saved! Live preview format: "${res.sample}"`);
      loadDashboard();
      loadAuditLogs();
    } catch (err: any) {
      setActionError(err.message || 'Failed to save pattern.');
    }
  };

  const handleRunTests = async () => {
    setRunningTests(true);
    try {
      const res = await api.admin.runTests();
      setTestResults(res);
      loadAuditLogs();
    } catch (err: any) {
      console.error(err);
    } finally {
      setRunningTests(false);
    }
  };

  // Filtered voters
  const filteredVoters = voters.filter(
    (v) =>
      v.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.voterId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.houseNumber.includes(searchQuery)
  );

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 min-h-full">
      {/* Admin Subheader & Tab Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Election Commission Central Console
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
              PostgreSQL Relational Core
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Administer election lifecycles, configure voter IDs, monitor tamper-evident audit logs, and inspect live turnout.
          </p>
        </div>

        {/* Action alerts and export trigger */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setExportDefaultTab('stats');
              setShowExportModal(true);
            }}
            className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Export Official Reports (PDF / CSV)</span>
          </button>
        </div>

        {actionSuccess && (
          <div className="p-2.5 px-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 max-w-xl animate-in fade-in">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="truncate">{actionSuccess}</span>
            <button onClick={() => setActionSuccess(null)} className="ml-auto text-emerald-400 font-bold">✕</button>
          </div>
        )}
        {actionError && (
          <div className="p-2.5 px-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 max-w-xl animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="truncate">{actionError}</span>
            <button onClick={() => setActionError(null)} className="ml-auto text-rose-400 font-bold">✕</button>
          </div>
        )}
      </div>

      {/* Navigation Tabs Bar */}
      <div className="px-6 border-b border-slate-800 bg-slate-900/40 flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Dashboard & Turnout', icon: BarChart3 },
          { id: 'voters', label: 'Voters Registry', icon: Users, count: voters.length },
          { id: 'leaders', label: 'Leaders & Candidates', icon: Building, count: leaders.length },
          { id: 'election', label: 'Election Config', icon: Settings },
          { id: 'voterIdConfig', label: 'Voter ID Pattern', icon: Fingerprint },
          { id: 'audit', label: 'Audit Logs', icon: FileText, count: auditLogs.length },
          { id: 'tests', label: 'Security Test Runner', icon: Terminal },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-indigo-500 text-white bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content View */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* ===================================================================
            TAB 1: DASHBOARD & TURNOUT
        =================================================================== */}
        {activeTab === 'overview' && dashboard && (
          <div className="space-y-6">
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Total Registered Voters
                    </span>
                    <div className="text-3xl font-extrabold text-white mt-1 font-mono">
                      {dashboard.voterStatistics.totalRegisteredVoters}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  Enrolled across configured wards with encrypted Aadhaar
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Ballots Cast
                    </span>
                    <div className="text-3xl font-extrabold text-emerald-400 mt-1 font-mono">
                      {dashboard.voterStatistics.totalVoted}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-400 flex items-center justify-center">
                    <Vote className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  {dashboard.voterStatistics.totalNotVoted} registered voters yet to vote
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Voter Turnout %
                    </span>
                    <div className="text-3xl font-extrabold text-indigo-400 mt-1 font-mono">
                      {dashboard.voterStatistics.turnoutPercentage}%
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, dashboard.voterStatistics.turnoutPercentage)}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Electoral Invariants
                    </span>
                    <div className="text-3xl font-extrabold text-white mt-1 font-mono">
                      100%
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>{dashboard.securityMetrics.blockedAttempts} duplicate attempts blocked</span>
                </div>
              </div>
            </div>

            {/* Candidate & Leader Tally Grid */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    Official Candidate Balloting Results
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-950/80 border border-indigo-800 px-2 py-0.5 rounded">
                      Aggregated from DB
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Leader votes received, percentage of total votes cast, and ward location. Individual ballots remain secret.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setExportDefaultTab('stats');
                      setShowExportModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Voting Tally (PDF / CSV)</span>
                  </button>
                  <button
                    onClick={loadDashboard}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Refresh Tally</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="py-3 px-4 rounded-l-lg">Candidate / Leader</th>
                      <th className="py-3 px-4">House / Ward</th>
                      <th className="py-3 px-4">Party / Slate</th>
                      <th className="py-3 px-4 text-right">Votes Received</th>
                      <th className="py-3 px-4 text-right">Vote Share</th>
                      <th className="py-3 px-4 rounded-r-lg">Visual Distribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-sans">
                    {dashboard.leaderStatistics.map((cand) => (
                      <tr key={cand.candidateId} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                              <img
                                src={cand.photo}
                                alt={cand.candidateName}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="font-bold text-white">{cand.candidateName}</div>
                              <div className="text-[10px] text-slate-400">Nominated Leader</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono">
                          House {cand.houseNumber} · {cand.ward}
                        </td>
                        <td className="py-3 px-4 text-indigo-300 font-medium">
                          {cand.partyOrSlate}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                          {cand.votesReceived}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400 font-semibold">
                          {cand.votePercentage}%
                        </td>
                        <td className="py-3 px-4 w-48">
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${cand.votePercentage}%` }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: VOTERS REGISTRY
        =================================================================== */}
        {activeTab === 'voters' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by voter name, Voter ID, house number, or email..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      await api.admin.downloadReportCsv('voters');
                      setActionSuccess('Voter registry roster (CSV) successfully exported.');
                    } catch (e: any) {
                      setActionError(e.message || 'Export failed');
                    }
                  }}
                  className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Export Roster (CSV)</span>
                </button>
                <button
                  onClick={() => setShowCreateVoter(true)}
                  className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Create Voter (With Email Notification)</span>
                </button>
              </div>
            </div>

            {/* Voters Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Voter ID</th>
                    <th className="py-3 px-4">Masked Aadhaar</th>
                    <th className="py-3 px-4">House & Ward</th>
                    <th className="py-3 px-4">Age / Sex</th>
                    <th className="py-3 px-4">Registered Mobile</th>
                    <th className="py-3 px-4 text-center">Voting Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredVoters.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{v.fullName}</div>
                        <div className="text-[10px] text-slate-400">{v.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-indigo-300">
                        {v.voterId}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {v.aadhaarMasked}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono">
                        House {v.houseNumber} · {v.ward}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {v.age} yrs · {v.sex}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {v.mobile}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {v.hasVoted ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            Voted
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                            Not Voted
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: LEADERS & CANDIDATES
        =================================================================== */}
        {activeTab === 'leaders' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-white">Community Leaders Registry</h2>
                <p className="text-xs text-slate-400">
                  Civic representatives who can be nominated as ballot candidates. Minimum age requirement: 21.
                </p>
              </div>
              <button
                onClick={() => setShowCreateLeader(true)}
                className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-amber-600/30 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Create Leader (With Credentials Dispatch)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leaders.map((ldr) => (
                <div key={ldr.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                      <img
                        src={ldr.photoUrl}
                        alt={ldr.fullName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">{ldr.fullName}</h3>
                      <div className="text-xs text-amber-300 font-mono">{ldr.voterId}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        House {ldr.houseNumber} · {ldr.ward}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 rounded-xl p-2.5 text-xs text-slate-300 border border-slate-800 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Masked Aadhaar:</span>
                      <span className="font-mono text-slate-300">{ldr.aadhaarMasked}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Age & Sex:</span>
                      <span>{ldr.age} yrs · {ldr.sex}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Nomination Status:</span>
                      <span className="text-emerald-400 font-semibold">Active Ballot Candidate</span>
                    </div>
                  </div>

                  {ldr.bio && (
                    <p className="text-[11px] text-slate-400 italic line-clamp-2">
                      "{ldr.bio}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 4: ELECTION CONFIGURATION
        =================================================================== */}
        {activeTab === 'election' && (
          <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Election Window & Lifecycle Controls
              </h2>
              <p className="text-xs text-slate-400">
                Configure polling parameters, start and closing hours, and quick simulator overrides.
              </p>
            </div>

            <form onSubmit={handleUpdateElection} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Election Title / Name
                </label>
                <input
                  type="text"
                  required
                  value={electionForm.electionName}
                  onChange={(e) => setElectionForm({ ...electionForm, electionName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Election Date
                  </label>
                  <input
                    type="date"
                    required
                    value={electionForm.electionDate}
                    onChange={(e) => setElectionForm({ ...electionForm, electionDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Voting Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={electionForm.startTime}
                    onChange={(e) => setElectionForm({ ...electionForm, startTime: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Voting End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={electionForm.endTime}
                    onChange={(e) => setElectionForm({ ...electionForm, endTime: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Time Override Mode Selector */}
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-indigo-300">
                  Time Engine Simulator / Status Override:
                </label>
                <p className="text-[11px] text-slate-400">
                  Choose how the election status is computed for immediate testing of upcoming countdowns or active voting.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { mode: 'FORCE_ACTIVE', label: 'Force LIVE Active', desc: 'Allow immediate voting' },
                    { mode: 'FORCE_UPCOMING', label: 'Force Upcoming', desc: 'Show countdown timer' },
                    { mode: 'FORCE_COMPLETED', label: 'Force Completed', desc: 'Voting has closed' },
                    { mode: 'AUTO', label: 'Real Clock Auto', desc: 'Based on system time' },
                  ].map((item) => (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => setElectionForm({ ...electionForm, timeOverrideMode: item.mode })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        electionForm.timeOverrideMode === item.mode
                          ? 'border-indigo-500 bg-indigo-950/60 text-white'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold">{item.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live results toggle */}
              <div className="flex items-center gap-3 bg-slate-950 rounded-xl p-3 border border-slate-800">
                <input
                  type="checkbox"
                  id="allowLiveResults"
                  checked={electionForm.allowLiveResults}
                  onChange={(e) => setElectionForm({ ...electionForm, allowLiveResults: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-800 border-slate-700"
                />
                <label htmlFor="allowLiveResults" className="text-xs text-slate-300">
                  <span className="font-semibold text-white block">Authorize Leader Live Tally Access</span>
                  Allow nominated leaders to inspect aggregate vote counts on their campaign screen.
                </label>
              </div>

              <button
                type="submit"
                className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
              >
                Save Election Configuration
              </button>
            </form>
          </div>
        )}

        {/* ===================================================================
            TAB 5: VOTER ID PATTERN ENGINE
        =================================================================== */}
        {activeTab === 'voterIdConfig' && (
          <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Configurable Voter ID Generation Format
              </h2>
              <p className="text-xs text-slate-400">
                In compliance with privacy standards, Voter IDs are automatically derived from the house number and a unique sequence, strictly omitting Aadhaar and PII.
              </p>
            </div>

            <form onSubmit={handleSavePattern} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Format Pattern Template
                </label>
                <input
                  type="text"
                  required
                  value={patternConfig}
                  onChange={(e) => setPatternConfig(e.target.value)}
                  placeholder="e.g. HOUSE-{houseNumber}-{seq}"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  Supported tokens: <code className="text-indigo-400 font-mono">{"{houseNumber}"}</code> (sanitized house) and <code className="text-indigo-400 font-mono">{"{seq}"}</code> (padded 3-digit sequence).
                </div>
              </div>

              {/* Live Preview */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider">
                  Live Generated Sample Preview (House: 102, Sequence: 001)
                </span>
                <div className="text-2xl font-mono font-bold text-emerald-400 tracking-wider">
                  {patternSample}
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-400 leading-relaxed">
                <strong>Privacy Invariant (Section 3):</strong> Generating Voter IDs without Aadhaar prevents credential leakages, external correlation attacks, and unauthorized voter identity reconstruction.
              </div>

              <button
                type="submit"
                className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
              >
                Apply Voter ID Generation Rule
              </button>
            </form>
          </div>
        )}

        {/* ===================================================================
            TAB 6: AUDIT TRAIL
        =================================================================== */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-white">Tamper-Resistant Central Audit Ledger</h2>
                <p className="text-xs text-slate-400">
                  Every login, registration, balloting transaction, and blocked attempt is cryptographically recorded with HMAC-SHA256 signatures.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setExportDefaultTab('audit');
                    setShowExportModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Audit Ledger (PDF / CSV)</span>
                </button>
                <button
                  onClick={loadAuditLogs}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Refresh Logs</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-800/80 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor Role</th>
                    <th className="py-3 px-4">Client IP</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Cryptographic Signature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 font-mono text-[11px]">
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-indigo-300">
                        {log.user_role}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {log.ip_address}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-950 text-emerald-300'
                              : log.status === 'BLOCKED'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-rose-950 text-rose-300'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-xs font-mono text-[10px]">
                        {log.integrity_signature}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 7: SECURITY TEST RUNNER
        =================================================================== */}
        {activeTab === 'tests' && (
          <div className="max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Relational Invariants & Security Test Suite
                </h2>
                <p className="text-xs text-slate-400">
                  Executes automated verification verifying one-vote constraint, Aadhaar AES-256 encryption, Voter ID format, and salt generation.
                </p>
              </div>
              <button
                onClick={handleRunTests}
                disabled={runningTests}
                className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{runningTests ? 'Running Checks...' : 'Execute Test Suite'}</span>
              </button>
            </div>

            {testResults ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300">Summary:</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">
                    {testResults.summary}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {testResults.results.map((res, i) => (
                    <div
                      key={i}
                      className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3"
                    >
                      {res.status === 'PASSED' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white">{res.test}</span>
                          <span
                            className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              res.status === 'PASSED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            {res.status}
                          </span>
                        </div>
                        <p className="text-slate-400 mt-1 leading-relaxed">{res.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 text-slate-500 text-xs">
                Click "Execute Test Suite" to verify backend security and relational constraint invariants.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================
          MODAL: CREATE VOTER
      =================================================================== */}
      {showCreateVoter && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Create Voter Record</h3>
                <p className="text-[11px] text-slate-400">
                  Voter ID will auto-generate from house number & sequence. Credentials will be dispatched to email.
                </p>
              </div>
              <button
                onClick={() => setShowCreateVoter(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVoter} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={voterForm.fullName}
                  onChange={(e) => setVoterForm({ ...voterForm, fullName: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Aadhaar Number (12 digits) *</label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={voterForm.aadhaarNumber}
                    onChange={(e) => setVoterForm({ ...voterForm, aadhaarNumber: e.target.value.replace(/\D/g, '') })}
                    placeholder="12 digit number"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Mobile Number (10 digits) *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={voterForm.mobile}
                    onChange={(e) => setVoterForm({ ...voterForm, mobile: e.target.value.replace(/\D/g, '') })}
                    placeholder="10 digit mobile"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Official Email Address *</label>
                <input
                  type="email"
                  required
                  value={voterForm.email}
                  onChange={(e) => setVoterForm({ ...voterForm, email: e.target.value })}
                  placeholder="voter@example.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Age (18+) *</label>
                  <input
                    type="number"
                    min={18}
                    required
                    value={voterForm.age}
                    onChange={(e) => setVoterForm({ ...voterForm, age: parseInt(e.target.value) || 18 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Sex *</label>
                  <select
                    value={voterForm.sex}
                    onChange={(e) => setVoterForm({ ...voterForm, sex: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">House Number *</label>
                  <input
                    type="text"
                    required
                    value={voterForm.houseNumber}
                    onChange={(e) => setVoterForm({ ...voterForm, houseNumber: e.target.value })}
                    placeholder="e.g. 102"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300 block mb-0.5">Automated Actions:</span>
                • Auto-generates derived Voter ID (e.g. HOUSE-{voterForm.houseNumber || '102'}-00X)<br />
                • AES-256 encrypts Aadhaar in database & displays masked representation only<br />
                • Dispatches email with temporary password & secure activation link
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateVoter(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 disabled:opacity-50"
                >
                  {loading ? 'Registering...' : 'Create & Dispatch Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: CREATE LEADER
      =================================================================== */}
      {showCreateLeader && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Create Community Leader</h3>
                <p className="text-[11px] text-slate-400">
                  Minimum age requirement: 21. Leader credentials dispatched to email address.
                </p>
              </div>
              <button
                onClick={() => setShowCreateLeader(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLeader} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Leader Full Name *</label>
                <input
                  type="text"
                  required
                  value={leaderForm.fullName}
                  onChange={(e) => setLeaderForm({ ...leaderForm, fullName: e.target.value })}
                  placeholder="e.g. Sunita Deshmukh"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Aadhaar Number (12 digits) *</label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={leaderForm.aadhaarNumber}
                    onChange={(e) => setLeaderForm({ ...leaderForm, aadhaarNumber: e.target.value.replace(/\D/g, '') })}
                    placeholder="12 digit number"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Mobile (10 digits) *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={leaderForm.mobile}
                    onChange={(e) => setLeaderForm({ ...leaderForm, mobile: e.target.value.replace(/\D/g, '') })}
                    placeholder="10 digit mobile"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Leader Email Address *</label>
                <input
                  type="email"
                  required
                  value={leaderForm.email}
                  onChange={(e) => setLeaderForm({ ...leaderForm, email: e.target.value })}
                  placeholder="leader@example.org"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Age (21+) *</label>
                  <input
                    type="number"
                    min={21}
                    required
                    value={leaderForm.age}
                    onChange={(e) => setLeaderForm({ ...leaderForm, age: parseInt(e.target.value) || 21 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Sex *</label>
                  <select
                    value={leaderForm.sex}
                    onChange={(e) => setLeaderForm({ ...leaderForm, sex: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">House Number *</label>
                  <input
                    type="text"
                    required
                    value={leaderForm.houseNumber}
                    onChange={(e) => setLeaderForm({ ...leaderForm, houseNumber: e.target.value })}
                    placeholder="e.g. 104"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Party / Slate Name</label>
                <input
                  type="text"
                  value={leaderForm.partyOrSlate}
                  onChange={(e) => setLeaderForm({ ...leaderForm, partyOrSlate: e.target.value })}
                  placeholder="e.g. Civic Green Coalition"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Campaign Bio & Manifesto</label>
                <textarea
                  rows={2}
                  value={leaderForm.manifesto}
                  onChange={(e) => setLeaderForm({ ...leaderForm, manifesto: e.target.value, bio: e.target.value })}
                  placeholder="Key civic priorities and manifesto goals..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateLeader(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-600/30 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Leader & Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Export Reports Modal */}
      <ExportReportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        dashboard={dashboard}
        auditLogs={auditLogs}
        defaultTab={exportDefaultTab}
      />
    </div>
  );
};
