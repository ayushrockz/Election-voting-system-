import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  MapPin,
  Calendar,
  Lock,
  Vote,
  Shield,
  BarChart3,
  Award,
  KeyRound,
  CheckCircle,
  Clock,
  Sparkles,
  Phone,
  Mail,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';

export const LeaderApp: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchCampaign = async () => {
    try {
      const res = await api.leaders.getCampaign();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load leader campaign data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setStatusMsg('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMsg('Passwords do not match.');
      return;
    }

    try {
      await api.auth.changePassword('', newPassword);
      setStatusMsg('Password successfully updated.');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setStatusMsg(err.message || 'Error updating password.');
    }
  };

  const leader = data?.leader || user?.leaderRecord;
  const candidate = data?.candidate;
  const election = data?.election;

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 min-h-full">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Community Leader Console</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            </div>
            <div className="text-[10px] text-slate-400">
              Voter ID: <span className="font-mono text-indigo-300 font-semibold">{leader?.voterId || user?.voterId}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowPasswordModal(true)}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 flex items-center gap-1 text-[11px]"
          title="Security & Password"
        >
          <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
          <span>Security</span>
        </button>
      </header>

      {/* Body Content */}
      <div className="flex-1 p-4 space-y-4 pb-20 overflow-y-auto">
        {/* Leader Profile Card */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-start gap-3.5">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-700 border border-slate-600 shrink-0">
              <img
                src={leader?.photoUrl || '/src/assets/images/candidate_ananya_sharma_1790730516942.jpg'}
                alt={leader?.fullName || user?.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white truncate">{leader?.fullName || user?.name}</h2>
              <div className="text-xs text-amber-300 font-medium">Elected Civic Representative</div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  House {leader?.houseNumber || '102'} · {leader?.ward || 'Ward 1'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Masked Aadhaar</span>
              <span className="font-mono text-slate-300 text-[11px]">
                {leader?.aadhaarMasked || 'XXXX XXXX 2345'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Registered Mobile</span>
              <span className="font-mono text-slate-300 text-[11px]">{user?.mobile}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Official Email</span>
              <span className="text-slate-300 truncate text-[11px] block">{user?.email}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Role Clearance</span>
              <span className="text-emerald-400 text-[11px] font-semibold">LEADER (Tier-2)</span>
            </div>
          </div>
        </div>

        {/* Election Campaign Info */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              Active Election Nomination
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              election?.status === 'ACTIVE'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}>
              {election?.status || 'ACTIVE'}
            </span>
          </div>

          <div className="text-sm font-semibold text-white">{election?.name || 'Community Council Election 2026'}</div>

          {candidate ? (
            <div className="space-y-2 border-t border-slate-700/80 pt-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Slate / Party:</span>
                <span className="font-semibold text-indigo-300">{candidate.partyOrSlate}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Ballot Position:</span>
                <span className="font-mono text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Position #{candidate.ballotNumber}
                </span>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-2.5 text-xs text-slate-300 border border-slate-800">
                <span className="font-semibold text-slate-400 block text-[10px] uppercase mb-0.5">Campaign Manifesto</span>
                {candidate.manifesto}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Not currently nominated as a ballot candidate for this election cycle.</p>
          )}
        </div>

        {/* Vote Statistics (Conditional on Election Configuration) */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              Candidate Tally Statistics
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Real-time Stream</span>
          </div>

          {election?.allowLiveResults && candidate?.votesReceived !== null ? (
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-center space-y-1">
              <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                {candidate?.votesReceived ?? 0}
              </span>
              <div className="text-xs font-medium text-slate-300">Verified Secret Ballots Recorded</div>
              <p className="text-[10px] text-slate-500 pt-1">
                Authorized by Election Commission configuration: Live ballot metrics enabled for nominated leaders.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
              <Lock className="w-4 h-4 shrink-0 text-slate-500 mt-0.5" />
              <span>
                <strong>Confidentiality Policy:</strong> Live vote counts are concealed until the conclusion of the polling window in accordance with Election Rule 8.
              </span>
            </div>
          )}
        </div>

        {/* Prohibited Actions Reminder */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="font-semibold text-slate-300 flex items-center gap-1">
            <Shield className="w-3 h-3 text-indigo-400" />
            Civic Code of Conduct
          </div>
          <p>
            Leaders do not have administrative clearance to create voters, view secret individual ballot choices, or modify system configurations.
          </p>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Update Leader Password</h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">New Password (min 8 chars)</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              {statusMsg && <p className="text-xs text-indigo-300">{statusMsg}</p>}

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
              >
                Save New Password
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
