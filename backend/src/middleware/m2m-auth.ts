import { Elysia } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { apiKeys } from '../db/schema';
import { decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';

export const m2mAuth = new Elysia({ name: 'm2m-auth' })
  .derive(async ({ request, set, db }) => {
    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
      set.status = 401;
      throw new Error('API key required');
    }

    // Use first 8 chars for efficient lookup
    const keyHash = apiKey.substring(0, 8);

    // Find active keys matching the hash prefix
    const matchingKeys = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyHash, keyHash),
          eq(apiKeys.isActive, true)
        )
      );

    // Verify full key matches (decrypt and compare)
    let validKey = null;
    for (const key of matchingKeys) {
      try {
        const decryptedKey = decrypt(key.encryptedKey);
        if (decryptedKey === apiKey) {
          validKey = key;
          break;
        }
      } catch (error) {
        // Decryption failed, continue to next key
        logger.warn({ keyId: key.id }, 'Failed to decrypt API key');
      }
    }

    if (!validKey) {
      set.status = 401;
      throw new Error('Invalid API key');
    }

    // Update last used timestamp (fire and forget)
    db.update(apiKeys)
      .set({ lastUsed: new Date() })
      .where(eq(apiKeys.id, validKey.id))
      .then(() => {})
      .catch((err) => logger.error({ error: err.message }, 'Failed to update API key lastUsed'));

    return {
      m2mAuthenticated: true,
      apiKeyId: validKey.id,
      apiKeyName: validKey.name,
    };
  });
