import { Router, Request, Response } from "express";
import { query } from "../db/client";
import { createAuditLog } from "../lib/audit";
import { verifyJWT } from "../middleware/auth";
import { AuthenticatedRequest, User, Event, ChatSession } from "../types";

const router = Router();

router.use(verifyJWT);

const getClientIp = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

const rowToEvent = (row: any): Event => ({
  id: row.id,
  user_id: row.user_id,
  event_name: row.event_name,
  subheading: row.subheading,
  description: row.description,
  banner_image_url: row.banner_image_url,
  timezone: row.timezone,
  status: row.status,
  start_date: row.start_date ? new Date(row.start_date) : null,
  end_date: row.end_date ? new Date(row.end_date) : null,
  vanish_date: row.vanish_date ? new Date(row.vanish_date) : null,
  roles: row.roles || [],
  created_at: new Date(row.created_at),
  updated_at: new Date(row.updated_at),
  deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
});

const rowToChatSession = (row: any): ChatSession => ({
  id: row.id,
  user_id: row.user_id,
  event_id: row.event_id,
  messages: Array.isArray(row.messages) ? row.messages : [],
  state: row.state || {},
  created_at: new Date(row.created_at),
  updated_at: new Date(row.updated_at),
});

router.get(
  "/export",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ipAddress = getClientIp(req);

      const userResult = await query(
        `SELECT id, email, consent_given_at, created_at, deleted_at
         FROM users
         WHERE id = $1`,
        [req.userId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const user = userResult.rows[0];

      const eventsResult = await query(
        `SELECT * FROM events WHERE user_id = $1`,
        [req.userId]
      );

      const events = eventsResult.rows.map(rowToEvent);

      const chatSessionsResult = await query(
        `SELECT * FROM chat_sessions WHERE user_id = $1`,
        [req.userId]
      );

      const chatSessions = chatSessionsResult.rows.map(rowToChatSession);

      await createAuditLog(
        req.userId!,
        "DATA_EXPORTED",
        "user",
        req.userId,
        {
          events_count: events.length,
          chat_sessions_count: chatSessions.length,
        },
        ipAddress
      );

      const exportData = {
        user: {
          id: user.id,
          email: user.email,
          consent_given_at: user.consent_given_at,
          created_at: user.created_at,
          deleted_at: user.deleted_at,
        },
        events,
        chat_sessions: chatSessions,
        exported_at: new Date().toISOString(),
      };

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="user-data-${req.userId}.json"`
      );
      res.setHeader("Content-Type", "application/json");
      res.json(exportData);
    } catch (err) {
      console.error('[GDPR ERROR]:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }
);

router.delete(
  "/me",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ipAddress = getClientIp(req);

      await query(
        `UPDATE users SET deleted_at = NOW() WHERE id = $1`,
        [req.userId]
      );

      await query(
        `UPDATE events SET deleted_at = NOW()
         WHERE user_id = $1`,
        [req.userId]
      );

      await createAuditLog(
        req.userId!,
        "ACCOUNT_DELETED",
        "user",
        req.userId,
        { reason: "user_initiated" },
        ipAddress
      );

      res.clearCookie("refreshToken");
      res.status(200).json({ message: "Account deleted successfully" });
    } catch (err) {
      console.error('[GDPR ERROR]:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }
);

export default router;
