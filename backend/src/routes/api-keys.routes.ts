import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { apiKeys } from '../db/schema';
import { encrypt, generateApiKey } from '../utils/crypto';
import { logger } from '../utils/logger';

export const apiKeysRoutes = new Elysia({ prefix: '/api-keys' })
  // List all API keys (without exposing the actual keys)
  .get('/', async ({ db }) => {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPreview: apiKeys.keyHash, // First 8 chars only
        isActive: apiKeys.isActive,
        lastUsed: apiKeys.lastUsed,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .orderBy(apiKeys.createdAt);

    return keys;
  })

  // Create a new API key
  .post('/', async ({ body, db }) => {
    const rawKey = generateApiKey();
    const keyHash = rawKey.substring(0, 8); // First 8 chars for lookup
    const encryptedKey = encrypt(rawKey);

    const [newKey] = await db
      .insert(apiKeys)
      .values({
        name: body.name,
        keyHash,
        encryptedKey,
      })
      .returning();

    logger.info({ name: body.name }, 'API key created');

    // Return the raw key only on creation (never again)
    return {
      id: newKey.id,
      name: newKey.name,
      key: rawKey, // Only time the full key is returned
      keyPreview: keyHash,
      isActive: newKey.isActive,
      createdAt: newKey.createdAt,
    };
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 100 })
    })
  })

  // Update API key (name, isActive)
  .put('/:id', async ({ params, body, db, set }) => {
    const [updated] = await db
      .update(apiKeys)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, params.id))
      .returning();

    if (!updated) {
      set.status = 404;
      return { error: 'API key not found' };
    }

    logger.info({ id: params.id, name: updated.name }, 'API key updated');

    return {
      id: updated.id,
      name: updated.name,
      keyPreview: updated.keyHash,
      isActive: updated.isActive,
      lastUsed: updated.lastUsed,
      createdAt: updated.createdAt,
    };
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' })
    }),
    body: t.Object({
      name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      isActive: t.Optional(t.Boolean())
    })
  })

  // Delete API key
  .delete('/:id', async ({ params, db, set }) => {
    const [deleted] = await db
      .delete(apiKeys)
      .where(eq(apiKeys.id, params.id))
      .returning();

    if (!deleted) {
      set.status = 404;
      return { error: 'API key not found' };
    }

    logger.info({ id: params.id, name: deleted.name }, 'API key deleted');

    return { success: true };
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' })
    })
  });
