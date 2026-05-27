import { Router, Request, Response } from "express";
import { z } from "zod";
import validator from "validator";
import { query } from "../db/client";
import { sendChatMessage } from "../lib/gemini";
// import { sendChatMessage } from "../lib/openai";

import { createAuditLog } from "../lib/audit";
import { validateRequest } from "../middleware/validate";
import { verifyJWT } from "../middleware/auth";
import { chatLimiter } from "../middleware/rateLimiter";
import {
  AuthenticatedRequest,
  ChatMessage,
  ChatSession,
  ChatResponse,
} from "../types";

const router = Router();

router.use(verifyJWT);
router.use(chatLimiter);

const chatMessageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  userMessage: z
    .string()
    .min(1)
    .max(5000)
    .transform((val) => validator.escape(val)),
});

const getClientIp = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

const rowToChatSession = (row: any): ChatSession => ({
  id: row.id,
  user_id: row.user_id,
  event_id: row.event_id,
  messages: Array.isArray(row.messages) ? row.messages : [],
  state: row.state || {},
  created_at: new Date(row.created_at),
  updated_at: new Date(row.updated_at),
});

router.post(
  "/message",
  validateRequest(chatMessageSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId, userMessage } = req.body;
      const ipAddress = getClientIp(req);

      let session: ChatSession;
      let isNewSession = false;

      if (sessionId) {
        const result = await query(
          `SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2`,
          [sessionId, req.userId],
        );

        if (result.rows.length === 0) {
          res.status(404).json({ error: "Chat session not found" });
          return;
        }
        session = rowToChatSession(result.rows[0]);
      } else {
        const result = await query(
          `INSERT INTO chat_sessions (user_id, messages, state)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [req.userId, JSON.stringify([]), JSON.stringify({})],
        );

        session = rowToChatSession(result.rows[0]);
        isNewSession = true;
      }

      const conversationHistory: ChatMessage[] = Array.isArray(session.messages)
        ? session.messages
        : [];

      const geminiResponse = await sendChatMessage(
        userMessage,
        conversationHistory,
        session.state,
      );

      const updatedMessages: ChatMessage[] = [
        ...conversationHistory,
        {
          role: "user",
          content: userMessage,
          timestamp: new Date().toISOString(),
        },
        {
          role: "assistant",
          content: geminiResponse.reply,
          timestamp: new Date().toISOString(),
        },
      ];

      const updatedState = {
        ...session.state,
        ...(geminiResponse.collectedState || {}),
      };

      let eventId: string | undefined;

      if (geminiResponse.eventData) {
        const eventResult = await query(
          `INSERT INTO events (
             user_id, event_name, subheading, description, banner_image_url,
             timezone, status, start_date, end_date, vanish_date, roles
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            req.userId,
            geminiResponse.eventData.event_name,
            geminiResponse.eventData.subheading || null,
            geminiResponse.eventData.description,
            geminiResponse.eventData.banner_image || null,
            geminiResponse.eventData.timezone,
            geminiResponse.eventData.status,
            geminiResponse.eventData.start_date || null,
            geminiResponse.eventData.end_date || null,
            geminiResponse.eventData.vanish_date || null,
            JSON.stringify(geminiResponse.eventData.roles || []),
          ],
        );

        eventId = eventResult.rows[0].id;

        await query(`UPDATE chat_sessions SET event_id = $1 WHERE id = $2`, [
          eventId,
          session.id,
        ]);

        await createAuditLog(
          req.userId!,
          "EVENT_CREATED",
          "event",
          eventId,
          { source: "chat_session", chat_session_id: session.id },
          ipAddress,
        );
      }

      await query(
        `UPDATE chat_sessions SET messages = $1, state = $2, updated_at = NOW() WHERE id = $3`,
        [
          JSON.stringify(updatedMessages),
          JSON.stringify(updatedState),
          session.id,
        ],
      );

      const response: ChatResponse = {
        reply: geminiResponse.reply,
        suggestions: geminiResponse.suggestions,
        eventCreated: !!eventId,
        eventId,
      };

      res.json({
        sessionId: session.id,
        ...response,
      });
    } catch (err) {
      console.error("[CHAT ERROR]:", err);

      const isQuotaError =
        err instanceof Error &&
        (err.message.includes("429") || /quota/i.test(err.message));
      res.status(isQuotaError ? 429 : 500).json({
        error: isQuotaError
          ? "Rate limit exceeded. Please wait a few seconds before typing again."
          : err instanceof Error
            ? err.message
            : "Internal server error",
      });
    }
  },
);

router.get("/sessions", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM chat_sessions
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
      [req.userId],
    );

    const sessions = result.rows.map(rowToChatSession);
    res.json(sessions);
  } catch (err) {
    console.error("[CHAT ERROR]:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Internal server error",
    });
  }
});

router.get(
  "/sessions/:sessionId",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;

      const result = await query(
        `SELECT * FROM chat_sessions
         WHERE id = $1 AND user_id = $2`,
        [sessionId, req.userId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Chat session not found" });
        return;
      }

      const session = rowToChatSession(result.rows[0]);
      res.json(session);
    } catch (err) {
      console.error("[CHAT ERROR]:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    }
  },
);

export default router;
