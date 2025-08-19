import { Elysia, t } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { pdus, outlets, outletStateHistory, NewPDU } from '../db/schema';
import { encrypt } from '../utils/crypto';
import { logger } from '../utils/logger';

// Validate SNMP credentials based on security level
function validateSNMPCredentials(data: any): { valid: boolean; error?: string } {
  const securityLevel = data.snmpSecurityLevel || 'noAuthNoPriv';
  
  // Always require username for SNMPv3
  if (data.snmpVersion === 'v3' && !data.snmpUser) {
    return { valid: false, error: 'SNMP username is required for SNMPv3' };
  }
  
  // Check auth requirements
  if ((securityLevel === 'authNoPriv' || securityLevel === 'authPriv') && !data.snmpAuthPassphrase) {
    return { valid: false, error: `Authentication passphrase is required for security level: ${securityLevel}` };
  }
  
  // Check priv requirements
  if (securityLevel === 'authPriv' && !data.snmpPrivPassphrase) {
    return { valid: false, error: 'Privacy passphrase is required for security level: authPriv' };
  }
  
  return { valid: true };
}

export const pduRoutes = new Elysia({ prefix: '/pdus' })
  .get('/', async ({ db }) => {
    const allPdus = await db.select().from(pdus);
    return allPdus;
  })
  
  .get('/:pduId', async ({ params, db, set }) => {
    const [pdu] = await db
      .select()
      .from(pdus)
      .where(eq(pdus.id, params.pduId))
      .limit(1);
    
    if (!pdu) {
      set.status = 404;
      return { error: 'PDU not found' };
    }
    
    return pdu;
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' })
    })
  })
  
  .post('/', async ({ body, db, set }) => {
    try {
      // Validate SNMP credentials based on security level
      const validation = validateSNMPCredentials(body);
      if (!validation.valid) {
        set.status = 400;
        return { error: validation.error };
      }
      
      // Set default security level if not provided
      const dataWithDefaults = {
        ...body,
        snmpVersion: body.snmpVersion || 'v3',
        snmpSecurityLevel: body.snmpSecurityLevel || 'noAuthNoPriv',
      };
      
      // Encrypt sensitive data only if provided
      const encryptedData = {
        ...dataWithDefaults,
        snmpAuthPassphrase: dataWithDefaults.snmpAuthPassphrase ? encrypt(dataWithDefaults.snmpAuthPassphrase) : null,
        snmpPrivPassphrase: dataWithDefaults.snmpPrivPassphrase ? encrypt(dataWithDefaults.snmpPrivPassphrase) : null,
      };
      
      const [newPdu] = await db
        .insert(pdus)
        .values(encryptedData as NewPDU)
        .returning();
      
      logger.info({ pdu: newPdu.name }, 'PDU created');
      return newPdu;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to create PDU');
      throw error;
    }
  }, {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      ipAddress: t.String({ format: 'ipv4' }),
      model: t.Optional(t.String()),
      snmpVersion: t.Optional(t.String()),
      snmpUser: t.Optional(t.String()),
      snmpAuthProtocol: t.Optional(t.String()),
      snmpAuthPassphrase: t.Optional(t.String()),
      snmpPrivProtocol: t.Optional(t.String()),
      snmpPrivPassphrase: t.Optional(t.String()),
      snmpSecurityLevel: t.Optional(t.String()),
    })
  })
  
  .put('/:pduId', async ({ params, body, db, set }) => {
    const [existing] = await db
      .select()
      .from(pdus)
      .where(eq(pdus.id, params.pduId))
      .limit(1);
    
    if (!existing) {
      set.status = 404;
      return { error: 'PDU not found' };
    }
    
    // Merge with existing data for validation
    const mergedData = { ...existing, ...body };
    
    // Validate SNMP credentials based on security level
    const validation = validateSNMPCredentials(mergedData);
    if (!validation.valid) {
      set.status = 400;
      return { error: validation.error };
    }
    
    // Encrypt passwords if provided
    const updates = { ...body };
    if (body.snmpAuthPassphrase) {
      updates.snmpAuthPassphrase = encrypt(body.snmpAuthPassphrase);
    }
    if (body.snmpPrivPassphrase) {
      updates.snmpPrivPassphrase = encrypt(body.snmpPrivPassphrase);
    }
    
    const [updated] = await db
      .update(pdus)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pdus.id, params.pduId))
      .returning();
    
    logger.info({ pdu: updated.name }, 'PDU updated');
    return updated;
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' })
    }),
    body: t.Partial(t.Object({
      name: t.String(),
      ipAddress: t.String({ format: 'ipv4' }),
      model: t.String(),
      isActive: t.Boolean(),
      snmpUser: t.String(),
      snmpAuthProtocol: t.String(),
      snmpAuthPassphrase: t.String(),
      snmpPrivProtocol: t.String(),
      snmpPrivPassphrase: t.String(),
      snmpSecurityLevel: t.String(),
    }))
  })
  
  .delete('/:pduId', async ({ params, db, set }) => {
    const [deleted] = await db
      .delete(pdus)
      .where(eq(pdus.id, params.pduId))
      .returning();
    
    if (!deleted) {
      set.status = 404;
      return { error: 'PDU not found' };
    }
    
    logger.info({ pdu: deleted.name }, 'PDU deleted');
    return { success: true, deleted };
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' })
    })
  })
  
  .post('/:pduId/test', async ({ params, db, snmpService, set }) => {
    const [pdu] = await db
      .select()
      .from(pdus)
      .where(eq(pdus.id, params.pduId))
      .limit(1);
    
    if (!pdu) {
      set.status = 404;
      return { error: 'PDU not found' };
    }
    
    const result = await snmpService.testConnection(pdu);
    return result;
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' })
    })
  })
  
  .post('/:pduId/reconcile', async ({ params, db, stateManager, set }) => {
    const [pdu] = await db
      .select()
      .from(pdus)
      .where(eq(pdus.id, params.pduId))
      .limit(1);
    
    if (!pdu) {
      set.status = 404;
      return { error: 'PDU not found' };
    }
    
    const result = await stateManager.reconcileStates(pdu);
    return {
      success: true,
      ...result
    };
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' })
    })
  })
  
  .post('/:pduId/recover', async ({ params, db, stateManager, set }) => {
    const [pdu] = await db
      .select()
      .from(pdus)
      .where(eq(pdus.id, params.pduId))
      .limit(1);
    
    if (!pdu) {
      set.status = 404;
      return { error: 'PDU not found' };
    }
    
    const result = await stateManager.recoverFromReboot(pdu);
    return {
      success: true,
      ...result
    };
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' })
    })
  });