import crypto from 'crypto';

// Secret key for AES-256 encryption (in production loaded from process.env.ENCRYPTION_KEY)
const AES_KEY = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'election-secure-aes-master-key-2026').digest();
const JWT_SECRET = process.env.JWT_SECRET || 'election-secure-jwt-signing-secret-key-2026';

// -----------------------------------------------------------------------------
// Aadhaar Masking & Validation
// -----------------------------------------------------------------------------
export function validateAadhaar(aadhaar: string): { valid: boolean; normalized: string; error?: string } {
  const cleaned = aadhaar.replace(/\s+/g, '');
  if (!/^\d{12}$/.test(cleaned)) {
    return { valid: false, normalized: '', error: 'Aadhaar number must be exactly 12 digits' };
  }
  // Check for invalid sequential or all-same digits (e.g. 000000000000, 111111111111)
  if (/^(\d)\1{11}$/.test(cleaned)) {
    return { valid: false, normalized: '', error: 'Invalid Aadhaar number pattern' };
  }
  return { valid: true, normalized: cleaned };
}

export function maskAadhaar(aadhaar12Digits: string): string {
  const cleaned = aadhaar12Digits.replace(/\s+/g, '');
  if (cleaned.length !== 12) return 'XXXX XXXX XXXX';
  const last4 = cleaned.slice(8);
  return `XXXX XXXX ${last4}`;
}

export function hashAadhaarForLookup(aadhaar12Digits: string): string {
  const cleaned = aadhaar12Digits.replace(/\s+/g, '');
  return crypto.createHmac('sha256', AES_KEY).update(cleaned).digest('hex');
}

// -----------------------------------------------------------------------------
// AES-256-GCM Encryption / Decryption for PII
// -----------------------------------------------------------------------------
export function encryptAadhaar(aadhaar12Digits: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  let encrypted = cipher.update(aadhaar12Digits, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptAadhaar(encryptedString: string): string {
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) return 'XXXX XXXX 0000';
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const ciphertext = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return 'XXXX XXXX 0000';
  }
}

// -----------------------------------------------------------------------------
// Secure Password Hashing with Salt (PBKDF2-SHA512)
// -----------------------------------------------------------------------------
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 100000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const iterations = 100000;
    const computedHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    const hashBuffer = Buffer.from(storedHash, 'hex');
    const computedBuffer = Buffer.from(computedHash, 'hex');
    if (hashBuffer.length !== computedBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, computedBuffer);
  } catch {
    return false;
  }
}

export function generateTemporaryPassword(): string {
  // Generate random 10-char password with uppercase, lowercase, numbers, and symbol
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pwd = '';
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    pwd += chars[bytes[i] % chars.length];
  }
  return pwd;
}

// -----------------------------------------------------------------------------
// JWT Token Management (Self-contained, RFC 7519 compliant)
// -----------------------------------------------------------------------------
export interface JWTPayload {
  userId: string;
  role: 'ADMIN' | 'LEADER' | 'VOTER';
  email: string;
  name: string;
  voterId?: string;
  mustChangePassword?: boolean;
  exp: number; // unix timestamp in seconds
}

export function signJWT(payload: Omit<JWTPayload, 'exp'>, expiresInSeconds = 86400): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload: JWTPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');
  return `${b64Header}.${b64Payload}.${signature}`;
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const [b64Header, b64Payload, signature] = token.split('.');
    if (!b64Header || !b64Payload || !signature) return null;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${b64Header}.${b64Payload}`)
      .digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8')) as JWTPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Configurable Voter ID Generation
// -----------------------------------------------------------------------------
export function generateVoterId(
  pattern: string, // e.g. "HOUSE-{houseNumber}-{seq}"
  houseNumber: string,
  sequenceNumber: number
): string {
  const cleanHouse = houseNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'NA';
  const seqPadded = String(sequenceNumber).padStart(3, '0');
  
  if (!pattern || pattern.trim() === '') {
    pattern = 'HOUSE-{houseNumber}-{seq}';
  }

  return pattern
    .replace('{houseNumber}', cleanHouse)
    .replace('{seq}', seqPadded);
}

// -----------------------------------------------------------------------------
// Cryptographic Vote Transaction Receipt Generator
// -----------------------------------------------------------------------------
export function generateVoteTransactionReference(electionId: string): string {
  const randBytes = crypto.randomBytes(3).toString('hex').toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  return `VOTE-REF-${randBytes}-${timestamp}`;
}

export function calculateVoteIntegrityHash(
  electionId: string,
  voterId: string,
  candidateId: string,
  votedAt: string,
  ref: string
): string {
  return crypto
    .createHmac('sha256', AES_KEY)
    .update(`${electionId}:${voterId}:${candidateId}:${votedAt}:${ref}`)
    .digest('hex');
}

export function createAuditSignature(action: string, userId: string, timestamp: string): string {
  return crypto
    .createHmac('sha256', AES_KEY)
    .update(`${action}:${userId}:${timestamp}`)
    .digest('hex');
}
