import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/store.ts';
import {
  verifyPassword,
  hashPassword,
  signJWT,
  verifyJWT,
  JWTPayload,
} from '../security/crypto.ts';
import { emailService } from '../services/emailService.ts';

export const authRouter = Router();

// -----------------------------------------------------------------------------
// Middleware: Authentication & Role Authorization
// -----------------------------------------------------------------------------
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const payload = verifyJWT(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  req.user = payload;
  next();
}

export function requireRole(...allowedRoles: Array<'ADMIN' | 'LEADER' | 'VOTER'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(430).json({ error: 'Access forbidden: Insufficient administrative privileges.' });
    }
    next();
  };
}

// -----------------------------------------------------------------------------
// POST /api/auth/login
// Supports login via: Email, Mobile, or Voter ID
// -----------------------------------------------------------------------------
authRouter.post('/login', (req: Request, res: Response) => {
  const { identifier, password, roleHint } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please provide your Login ID (Voter ID / Email / Mobile) and Password.' });
  }

  const cleanIdentifier = String(identifier).trim();
  let matchedUser = null;
  let associatedVoter = null;
  let associatedLeader = null;

  // 1. Check by Voter ID in voters
  for (const v of db.voters.values()) {
    if (v.voter_id.toUpperCase() === cleanIdentifier.toUpperCase()) {
      matchedUser = db.users.get(v.user_id);
      associatedVoter = v;
      break;
    }
  }

  // 2. Check by Voter ID in leaders
  if (!matchedUser) {
    for (const l of db.leaders.values()) {
      if (l.voter_id.toUpperCase() === cleanIdentifier.toUpperCase()) {
        matchedUser = db.users.get(l.user_id);
        associatedLeader = l;
        break;
      }
    }
  }

  // 3. Check by Email or Mobile in users table
  if (!matchedUser) {
    for (const u of db.users.values()) {
      if (
        u.email.toLowerCase() === cleanIdentifier.toLowerCase() ||
        u.mobile === cleanIdentifier
      ) {
        matchedUser = u;
        break;
      }
    }
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  if (!matchedUser) {
    db.logAudit({
      userRole: roleHint || 'UNKNOWN',
      action: 'LOGIN_FAILED_USER_NOT_FOUND',
      details: { identifier: cleanIdentifier },
      ipAddress: clientIp,
      status: 'FAILED',
    });
    return res.status(401).json({ error: 'Invalid login credentials. User account does not exist.' });
  }

  // Verify password using PBKDF2 with stored salt
  const isMatch = verifyPassword(password, matchedUser.password_hash, matchedUser.password_salt);
  if (!isMatch) {
    db.logAudit({
      userId: matchedUser.id,
      userRole: matchedUser.role,
      action: 'LOGIN_FAILED_INCORRECT_PASSWORD',
      details: { email: matchedUser.email },
      ipAddress: clientIp,
      status: 'FAILED',
    });
    return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
  }

  // Find associated record for voter or leader
  if (matchedUser.role === 'VOTER' && !associatedVoter) {
    for (const v of db.voters.values()) {
      if (v.user_id === matchedUser.id) {
        associatedVoter = v;
        break;
      }
    }
  }
  if (matchedUser.role === 'LEADER' && !associatedLeader) {
    for (const l of db.leaders.values()) {
      if (l.user_id === matchedUser.id) {
        associatedLeader = l;
        break;
      }
    }
  }

  const voterId = associatedVoter?.voter_id || associatedLeader?.voter_id;

  // Generate JWT token
  const token = signJWT({
    userId: matchedUser.id,
    role: matchedUser.role,
    email: matchedUser.email,
    name: matchedUser.name,
    voterId,
    mustChangePassword: matchedUser.must_change_password,
  });

  matchedUser.last_login_at = new Date().toISOString();

  db.logAudit({
    userId: matchedUser.id,
    userRole: matchedUser.role,
    action: 'LOGIN_SUCCESS',
    details: {
      email: matchedUser.email,
      role: matchedUser.role,
      mustChangePassword: matchedUser.must_change_password,
    },
    ipAddress: clientIp,
    status: 'SUCCESS',
  });

  return res.json({
    token,
    user: {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      mobile: matchedUser.mobile,
      role: matchedUser.role,
      status: matchedUser.status,
      mustChangePassword: matchedUser.must_change_password,
      voterId,
      voterRecord: associatedVoter ? {
        id: associatedVoter.id,
        voter_id: associatedVoter.voter_id,
        house_number: associatedVoter.house_number,
        ward: associatedVoter.ward,
        aadhaar_masked: associatedVoter.aadhaar_masked,
      } : undefined,
      leaderRecord: associatedLeader ? {
        id: associatedLeader.id,
        voter_id: associatedLeader.voter_id,
        house_number: associatedLeader.house_number,
        ward: associatedLeader.ward,
        aadhaar_masked: associatedLeader.aadhaar_masked,
        bio: associatedLeader.bio,
      } : undefined,
    },
  });
});

// -----------------------------------------------------------------------------
// POST /api/auth/change-password
// Mandatory for first-time login or self-service password update
// -----------------------------------------------------------------------------
authRouter.post('/change-password', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  const userId = req.user!.userId;
  const user = db.users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // If current password provided, verify it (unless forcing initial reset)
  if (currentPassword) {
    const isCurrentValid = verifyPassword(currentPassword, user.password_hash, user.password_salt);
    if (!isCurrentValid) {
      return res.status(400).json({ error: 'Current password provided is incorrect.' });
    }
  }

  const { hash, salt } = hashPassword(newPassword);
  user.password_hash = hash;
  user.password_salt = salt;
  user.must_change_password = false;
  user.status = 'ACTIVE';
  user.updated_at = new Date().toISOString();

  // Create refreshed token with mustChangePassword = false
  const newToken = signJWT({
    userId: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    voterId: req.user!.voterId,
    mustChangePassword: false,
  });

  db.logAudit({
    userId: user.id,
    userRole: user.role,
    action: 'PASSWORD_CHANGED',
    details: { email: user.email },
    ipAddress: (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
    status: 'SUCCESS',
  });

  return res.json({
    message: 'Password successfully updated. You may now continue using all voting features.',
    token: newToken,
  });
});

// -----------------------------------------------------------------------------
// POST /api/auth/forgot-password
// -----------------------------------------------------------------------------
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  let foundUser = null;
  for (const u of db.users.values()) {
    if (u.email.toLowerCase() === email.trim().toLowerCase()) {
      foundUser = u;
      break;
    }
  }

  // Always return success message to prevent user enumeration attacks
  if (foundUser) {
    const resetToken = signJWT({
      userId: foundUser.id,
      role: foundUser.role,
      email: foundUser.email,
      name: foundUser.name,
    }, 900); // 15 min expiry

    await emailService.sendPasswordResetEmail({
      recipientEmail: foundUser.email,
      recipientName: foundUser.name,
      resetToken,
    });

    db.logAudit({
      userId: foundUser.id,
      userRole: foundUser.role,
      action: 'PASSWORD_RESET_DISPATCHED',
      details: { email: foundUser.email },
      status: 'SUCCESS',
    });
  }

  return res.json({
    message: 'If an account is associated with this email, password reset instructions have been sent.',
  });
});

// -----------------------------------------------------------------------------
// POST /api/auth/logout
// -----------------------------------------------------------------------------
authRouter.post('/logout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  db.logAudit({
    userId: req.user?.userId,
    userRole: req.user?.role || 'USER',
    action: 'USER_LOGOUT',
    details: { email: req.user?.email },
    status: 'SUCCESS',
  });
  return res.json({ message: 'Successfully logged out.' });
});

// -----------------------------------------------------------------------------
// GET /api/auth/me
// -----------------------------------------------------------------------------
authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = db.users.get(req.user!.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  let voter = null;
  let leader = null;
  if (user.role === 'VOTER') {
    for (const v of db.voters.values()) {
      if (v.user_id === user.id) {
        voter = v;
        break;
      }
    }
  } else if (user.role === 'LEADER') {
    for (const l of db.leaders.values()) {
      if (l.user_id === user.id) {
        leader = l;
        break;
      }
    }
  }

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      status: user.status,
      mustChangePassword: user.must_change_password,
      voterId: voter?.voter_id || leader?.voter_id,
      voter,
      leader,
    },
  });
});
