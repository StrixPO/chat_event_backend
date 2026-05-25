import { Router, Request, Response } from "express";
import { z } from "zod";
import validator from "validator";
import { query } from "../db/client";
import { createAuditLog } from "../lib/audit";
import { validateRequest } from "../middleware/validate";
import { verifyJWT } from "../middleware/auth";
import { AuthenticatedRequest, Event } from "../types";

const router = Router();

router.use(verifyJWT);

const eventSchema = z.object({
  event_name: z.string().min(1).transform((val) => validator.escape(val)),
  subheading: z
    .string()
    .optional()
    .transform((val) => (val ? validator.escape(val) : undefined)),
  description: z
    .string()
    .min(20)
    .transform((val) => validator.escape(val)),
  banner_image_url: z.string().url().optional(),
  timezone: z.string().default("UTC"),
  status: z
    .enum(["DRAFT", "PUBLISHED", "CANCELLED"])
    .default("DRAFT"),
  start_date: z.string().datetime().nullable().optional(),
  end_date: z.string().datetime().nullable().optional(),
  vanish_date: z.string().datetime().nullable().optional(),
  roles: z.array(z.string()).default([]),
});

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

router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM events
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [req.userId]
    );

    const events = result.rows.map(rowToEvent);
    res.json(events);
  } catch (error) {
    console.error('[EVENTS ERROR]:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM events
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const event = rowToEvent(result.rows[0]);
    res.json(event);
  } catch (error) {
    console.error('[EVENTS ERROR]:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

router.post(
  "/",
  validateRequest(eventSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        event_name,
        subheading,
        description,
        banner_image_url,
        timezone,
        status,
        start_date,
        end_date,
        vanish_date,
        roles,
      } = req.body;

      const result = await query(
        `INSERT INTO events (
          user_id, event_name, subheading, description, banner_image_url,
          timezone, status, start_date, end_date, vanish_date, roles
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          req.userId,
          event_name,
          subheading || null,
          description,
          banner_image_url || null,
          timezone,
          status,
          start_date || null,
          end_date || null,
          vanish_date || null,
          JSON.stringify(roles),
        ]
      );

      const event = rowToEvent(result.rows[0]);

      const ipAddress = getClientIp(req);
      await createAuditLog(
        req.userId!,
        "EVENT_CREATED",
        "event",
        event.id,
        { event_name },
        ipAddress
      );

      res.status(201).json(event);
    } catch (error) {
        console.error('[EVENTS ERROR]:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }
);

router.put(
  "/:id",
  validateRequest(eventSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const {
        event_name,
        subheading,
        description,
        banner_image_url,
        timezone,
        status,
        start_date,
        end_date,
        vanish_date,
        roles,
      } = req.body;

      const checkResult = await query(
        `SELECT id FROM events
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [id, req.userId]
      );

      if (checkResult.rows.length === 0) {
        res.status(404).json({ error: "Event not found" });
        return;
      }

      const result = await query(
        `UPDATE events SET
          event_name = $1, subheading = $2, description = $3,
          banner_image_url = $4, timezone = $5, status = $6,
          start_date = $7, end_date = $8, vanish_date = $9, roles = $10,
          updated_at = NOW()
        WHERE id = $11 AND user_id = $12
        RETURNING *`,
        [
          event_name,
          subheading || null,
          description,
          banner_image_url || null,
          timezone,
          status,
          start_date || null,
          end_date || null,
          vanish_date || null,
          JSON.stringify(roles),
          id,
          req.userId,
        ]
      );

      const event = rowToEvent(result.rows[0]);

      const ipAddress = getClientIp(req);
      await createAuditLog(
        req.userId!,
        "EVENT_UPDATED",
        "event",
        event.id,
        { event_name },
        ipAddress
      );

      res.json(event);
    } catch (error) {
        console.error('[EVENTS ERROR]:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }
);

router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const checkResult = await query(
      `SELECT id FROM events
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, req.userId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    await query(
      `UPDATE events SET deleted_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );

    const ipAddress = getClientIp(req);
    await createAuditLog(
      req.userId!,
      "EVENT_DELETED",
      "event",
      id,
      {},
      ipAddress
    );

    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('[EVENTS ERROR]:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

export default router;
