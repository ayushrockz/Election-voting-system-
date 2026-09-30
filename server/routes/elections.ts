import { Router, Response } from 'express';
import { db } from '../db/store.ts';
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from './auth.ts';
import { emailService } from '../services/emailService.ts';

export const electionsRouter = Router();

// -----------------------------------------------------------------------------
// GET /api/elections/active
// Returns active or primary configured election
// -----------------------------------------------------------------------------
electionsRouter.get('/active', (req: AuthenticatedRequest, res: Response) => {
  const election = Array.from(db.elections.values())[0];
  if (!election) {
    return res.status(404).json({ error: 'No election configured.' });
  }

  const computedStatus = db.computeElectionStatus(election);

  return res.json({
    election: {
      id: election.id,
      electionName: election.election_name,
      electionDate: election.election_date,
      startTime: election.start_time,
      endTime: election.end_time,
      startDatetime: election.start_datetime,
      endDatetime: election.end_datetime,
      status: computedStatus,
      description: election.description,
      timeOverrideMode: db.config.time_override_mode,
      allowLiveResultsForLeaders: election.allow_live_results_for_leaders,
    },
  });
});

// -----------------------------------------------------------------------------
// GET /api/elections/:id/status
// -----------------------------------------------------------------------------
electionsRouter.get('/:id/status', (req: AuthenticatedRequest, res: Response) => {
  const election = db.elections.get(req.params.id);
  if (!election) {
    return res.status(404).json({ error: 'Election not found.' });
  }

  const computedStatus = db.computeElectionStatus(election);

  return res.json({
    id: election.id,
    electionName: election.election_name,
    electionDate: election.election_date,
    startTime: election.start_time,
    endTime: election.end_time,
    startDatetime: election.start_datetime,
    endDatetime: election.end_datetime,
    status: computedStatus,
  });
});

// -----------------------------------------------------------------------------
// GET /api/elections/:id/candidates
// Returns candidate ballot list
// -----------------------------------------------------------------------------
electionsRouter.get('/:id/candidates', (req: AuthenticatedRequest, res: Response) => {
  const candidates = Array.from(db.candidates.values())
    .filter((c) => c.election_id === req.params.id && c.status === 'APPROVED')
    .sort((a, b) => a.ballot_number - b.ballot_number)
    .map((c) => {
      const leader = db.leaders.get(c.leader_id);
      return {
        id: c.id,
        leaderId: c.leader_id,
        candidateName: c.candidate_name,
        partyOrSlate: c.party_or_slate,
        photo: c.photo,
        manifesto: c.manifesto,
        ballotNumber: c.ballot_number,
        houseNumber: leader?.house_number || 'N/A',
        ward: leader?.ward || 'Ward 1',
      };
    });

  return res.json({ candidates });
});

// -----------------------------------------------------------------------------
// POST /api/elections/:id/vote
// Critical Endpoint: Authenticated Voters Only, Enforces UNIQUE(election_id, voter_id)
// -----------------------------------------------------------------------------
electionsRouter.post('/:id/vote', authenticateToken, requireRole('VOTER'), async (req: AuthenticatedRequest, res: Response) => {
  const electionId = req.params.id;
  const { candidateId } = req.body;

  if (!candidateId) {
    return res.status(400).json({ error: 'Please select a candidate to cast your vote.' });
  }

  // Look up voter record by authenticated user ID
  let voterRecord = null;
  for (const v of db.voters.values()) {
    if (v.user_id === req.user!.userId) {
      voterRecord = v;
      break;
    }
  }

  if (!voterRecord) {
    return res.status(403).json({ error: 'Unauthorized: Voter credentials required.' });
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  try {
    const { transactionRef, votedAt } = db.castVote({
      electionId,
      voterId: voterRecord.id,
      candidateId,
      ipAddress: clientIp,
    });

    const election = db.elections.get(electionId);

    // Send confirmation email asynchronously (never leaks vote choice!)
    await emailService.sendVoteConfirmationEmail({
      recipientEmail: voterRecord.email,
      recipientName: voterRecord.full_name,
      voterId: voterRecord.voter_id,
      electionName: election?.election_name || 'Community Election',
      transactionReference: transactionRef,
      votedAt,
    });

    return res.json({
      success: true,
      message: 'Vote Successfully Submitted.',
      transactionReference: transactionRef,
      votedAt,
      electionName: election?.election_name,
      voterId: voterRecord.voter_id,
    });
  } catch (error: any) {
    return res.status(409).json({
      error: error.message || 'Unable to record vote.',
    });
  }
});

// -----------------------------------------------------------------------------
// GET /api/voters/me/voting-status
// Checks if current voter has voted in the active election
// -----------------------------------------------------------------------------
electionsRouter.get('/voters/me/voting-status', authenticateToken, requireRole('VOTER'), (req: AuthenticatedRequest, res: Response) => {
  let voterRecord = null;
  for (const v of db.voters.values()) {
    if (v.user_id === req.user!.userId) {
      voterRecord = v;
      break;
    }
  }

  if (!voterRecord) {
    return res.status(404).json({ error: 'Voter record not found.' });
  }

  const election = Array.from(db.elections.values())[0];
  if (!election) {
    return res.json({ hasVoted: false });
  }

  const vote = Array.from(db.votes.values()).find(
    (v) => v.election_id === election.id && v.voter_id === voterRecord.id
  );

  return res.json({
    hasVoted: Boolean(vote),
    transactionReference: vote?.transaction_reference,
    votedAt: vote?.voted_at,
    electionName: election.election_name,
    voterId: voterRecord.voter_id,
  });
});

// -----------------------------------------------------------------------------
// GET /api/leaders/me/campaign
// Leader dashboard endpoint
// -----------------------------------------------------------------------------
electionsRouter.get('/leaders/me/campaign', authenticateToken, requireRole('LEADER'), (req: AuthenticatedRequest, res: Response) => {
  let leaderRecord = null;
  for (const l of db.leaders.values()) {
    if (l.user_id === req.user!.userId) {
      leaderRecord = l;
      break;
    }
  }

  if (!leaderRecord) {
    return res.status(404).json({ error: 'Leader profile not found.' });
  }

  const election = Array.from(db.elections.values())[0];
  const candidate = election
    ? Array.from(db.candidates.values()).find(
        (c) => c.election_id === election.id && c.leader_id === leaderRecord.id
      )
    : null;

  // Calculate vote count only if election permits or if user is authorized
  let voteCount = null;
  if (election && election.allow_live_results_for_leaders && candidate) {
    voteCount = Array.from(db.votes.values()).filter((v) => v.candidate_id === candidate.id).length;
  }

  const computedStatus = election ? db.computeElectionStatus(election) : 'NOT_STARTED';

  return res.json({
    leader: {
      id: leaderRecord.id,
      fullName: leaderRecord.full_name,
      voterId: leaderRecord.voter_id,
      aadhaarMasked: leaderRecord.aadhaar_masked,
      houseNumber: leaderRecord.house_number,
      ward: leaderRecord.ward,
      bio: leaderRecord.bio,
      photoUrl: leaderRecord.photo_url,
    },
    election: election ? {
      id: election.id,
      name: election.election_name,
      date: election.election_date,
      startTime: election.start_time,
      endTime: election.end_time,
      status: computedStatus,
      allowLiveResults: election.allow_live_results_for_leaders,
    } : null,
    candidate: candidate ? {
      id: candidate.id,
      partyOrSlate: candidate.party_or_slate,
      manifesto: candidate.manifesto,
      ballotNumber: candidate.ballot_number,
      votesReceived: voteCount,
    } : null,
  });
});
