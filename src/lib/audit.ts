import { query } from "../db/client";
import { AuditLog } from "../types";

export const createAuditLog = async (
  userId: string | null,
  action: string,
  entityType: string | null = null,
  entityId: string | null = null,
  metadata: Record<string, any> | null = null,
  ipAddress: string | null = null,
): Promise<AuditLog> => {
  const result = await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      action,
      entityType,
      entityId,
      metadata ? JSON.stringify(metadata) : null,
      ipAddress,
    ],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    user_id: row.user_id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: row.metadata ?? null,
    ip_address: row.ip_address,
    created_at: new Date(row.created_at),
  };
};

export const getAuditLogs = async (
  userId: string,
  limit: number = 100,
  offset: number = 0,
): Promise<AuditLog[]> => {
  const result = await query(
    `SELECT * FROM audit_logs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  return result.rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: row.metadata ?? null,
    ip_address: row.ip_address,
    created_at: new Date(row.created_at),
  }));
};
