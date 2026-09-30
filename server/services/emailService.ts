import crypto from 'crypto';

export interface EmailRecord {
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

// In-memory persistent outbox for demo/live review
const outbox: EmailRecord[] = [];

export const emailService = {
  getOutbox(): EmailRecord[] {
    return [...outbox].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  },

  getOutboxForUser(email: string): EmailRecord[] {
    return outbox
      .filter((e) => e.recipientEmail.toLowerCase() === email.toLowerCase())
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  },

  /**
   * Dispatches Welcome email with Login ID, Temporary Password, and Activation link
   */
  async sendAccountCreationEmail(params: {
    recipientEmail: string;
    recipientName: string;
    role: 'LEADER' | 'VOTER';
    voterId: string;
    tempPassword: string;
    electionName?: string;
  }): Promise<EmailRecord> {
    const activationToken = crypto.randomBytes(24).toString('hex');
    const activationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/activate?token=${activationToken}&id=${encodeURIComponent(params.voterId)}`;

    const subject = `Official Welcome to Election Portal: Your ${params.role === 'LEADER' ? 'Leader' : 'Voter'} Access Credentials`;

    const bodyText = `
Dear ${params.recipientName},

Welcome to the Secure Election Management System. Your account as a ${params.role} has been provisioned.

--- ACCOUNT CREDENTIALS ---
Full Name: ${params.recipientName}
User Role: ${params.role}
Official Login ID (Voter ID): ${params.voterId}
Temporary Password: ${params.tempPassword}

Secure Activation Link: ${activationUrl}

--- IMPORTANT SECURITY INSTRUCTIONS ---
1. You are required to change your temporary password upon your first login.
2. Never share your temporary password or login credentials with anyone.
3. Ensure you keep your Voter ID confidential.
${params.electionName ? `4. You are registered for: ${params.electionName}` : ''}

To cast your vote, download the mobile application (Android/iOS) or log in to the secure voter terminal.
    `.trim();

    const bodyHtml = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #6366f1; margin: 0; font-size: 22px;">Secure Election Management System</h1>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Official Democratic Balloting & Civic Portal</p>
        </div>
        <p style="font-size: 15px;">Dear <strong>${params.recipientName}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Your registration as an official <strong>${params.role}</strong> has been successfully approved by the Election Administration.
        </p>
        <div style="background: #1e293b; padding: 20px; border-radius: 8px; border-left: 4px solid #6366f1; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #e2e8f0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Your Access Credentials</h3>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Voter ID / Login ID:</strong> <code style="background: #0f172a; padding: 2px 8px; border-radius: 4px; color: #38bdf8; font-family: monospace;">${params.voterId}</code></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Temporary Password:</strong> <code style="background: #0f172a; padding: 2px 8px; border-radius: 4px; color: #fbbf24; font-family: monospace;">${params.tempPassword}</code></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Registered Mobile:</strong> Registered on record</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${activationUrl}" style="background: #4f46e5; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">Activate Account & Set Password</a>
        </div>
        <div style="background: #182234; padding: 14px; border-radius: 6px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
          <strong>Security Notice:</strong> As a security measure, you must change this temporary password immediately after your first sign-in. Election officials will never ask for your password.
        </div>
      </div>
    `.trim();

    const record: EmailRecord = {
      id: `EMAIL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      subject,
      templateType: 'ACCOUNT_CREATION',
      bodyText,
      bodyHtml,
      payload: {
        role: params.role,
        voterId: params.voterId,
        activationUrl,
      },
      status: 'SENT',
      sentAt: new Date().toISOString(),
    };

    outbox.unshift(record);
    return record;
  },

  /**
   * Dispatches Vote Confirmation Receipt
   * NOTE: As per Election Security Rule 19: "Do not send the actual vote choice through email."
   */
  async sendVoteConfirmationEmail(params: {
    recipientEmail: string;
    recipientName: string;
    voterId: string;
    electionName: string;
    transactionReference: string;
    votedAt: string;
  }): Promise<EmailRecord> {
    const subject = `Official Vote Confirmation: Receipt #${params.transactionReference}`;

    const bodyText = `
Dear ${params.recipientName},

Your vote has been officially and cryptographically recorded for "${params.electionName}".

--- TRANSACTION RECEIPT ---
Receipt Number: ${params.transactionReference}
Timestamp: ${params.votedAt}
Election: ${params.electionName}
Voter ID: ${params.voterId}

BALLOT PRIVACY NOTICE:
In compliance with secret-ballot privacy standards, your individual candidate selection is anonymized and never transmitted or retained in email communications.

Thank you for exercising your constitutional right to vote.
    `.trim();

    const bodyHtml = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #10b981; margin: 0; font-size: 22px;">Vote Successfully Cast</h2>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Cryptographic Proof of Balloting</p>
        </div>
        <p style="font-size: 14px;">Dear <strong>${params.recipientName}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Your ballot has been securely registered in the central audit ledger for <strong>${params.electionName}</strong>.
        </p>
        <div style="background: #1e293b; padding: 18px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
          <p style="margin: 6px 0; font-size: 14px;"><strong>Transaction Reference:</strong> <code style="background: #0f172a; padding: 2px 8px; border-radius: 4px; color: #34d399; font-family: monospace;">${params.transactionReference}</code></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Recorded Timestamp:</strong> ${new Date(params.votedAt).toUTCString()}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Voter ID:</strong> ${params.voterId}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Status:</strong> Sealed & Encrypted</p>
        </div>
        <div style="background: #1e293b; padding: 12px; border-radius: 6px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
          <strong>Ballot Secrecy Guarantee:</strong> Your vote choice remains fully anonymous and is not included in this notification or stored alongside your voter identity.
        </div>
      </div>
    `.trim();

    const record: EmailRecord = {
      id: `EMAIL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      subject,
      templateType: 'VOTE_CONFIRMATION',
      bodyText,
      bodyHtml,
      payload: {
        voterId: params.voterId,
        electionName: params.electionName,
        transactionReference: params.transactionReference,
        votedAt: params.votedAt,
      },
      status: 'SENT',
      sentAt: new Date().toISOString(),
    };

    outbox.unshift(record);
    return record;
  },

  async sendPasswordResetEmail(params: {
    recipientEmail: string;
    recipientName: string;
    resetToken: string;
  }): Promise<EmailRecord> {
    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${params.resetToken}`;
    const subject = 'Secure Password Reset Request - Election Management System';

    const bodyText = `
Dear ${params.recipientName},

A password reset request was initiated for your Election Management account.

To reset your password, visit the following link:
${resetUrl}

This link is valid for 15 minutes. If you did not initiate this request, contact your Election Officer immediately.
    `.trim();

    const bodyHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px;">
        <h2 style="color: #6366f1;">Password Reset Authorization</h2>
        <p>Dear <strong>${params.recipientName}</strong>,</p>
        <p>A request was received to reset your password. Click the button below to proceed:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a>
        </div>
        <p style="font-size: 12px; color: #94a3b8;">Link expires in 15 minutes.</p>
      </div>
    `.trim();

    const record: EmailRecord = {
      id: `EMAIL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      subject,
      templateType: 'PASSWORD_RESET',
      bodyText,
      bodyHtml,
      payload: { resetUrl },
      status: 'SENT',
      sentAt: new Date().toISOString(),
    };

    outbox.unshift(record);
    return record;
  },
};
