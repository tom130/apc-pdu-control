import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const algorithm = 'aes-256-gcm';
const salt = 'salt';

// Get encryption key from environment or generate one
const getKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
  }
  return scryptSync(key, salt, 32);
};

export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedData: string): string {
  const key = getKey();
  const parts = encryptedData.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function generateApiKey(): string {
  // Generate 32 random bytes = 64 hex characters
  return randomBytes(32).toString('hex');
}

export function hashPassword(password: string): string {
  return Bun.password.hashSync(password);
}

export function verifyPassword(password: string, hash: string): boolean {
  return Bun.password.verifySync(password, hash);
}