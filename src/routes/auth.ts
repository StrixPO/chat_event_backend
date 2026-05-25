import { Router, Request, Response } from "express";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import validator from "validator";
import { query } from "../db/client";
import { createAuditLog } from "../lib/audit";
import { validateRequest } from "../middleware/validate";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyJWT,
  verifyRefreshToken,
} from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimiter";
import { AuthenticatedRequest, User } from "../types";

const router = Router();

const registerSchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .transform((val) => validator.escape(val)),
});

const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .transform((val) => val.toLowerCase()),
  password: z.string(),
});

const getClientIp = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

router.post(
  "/register",
  authLimiter,
  validateRequest(registerSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, password } = req.body;
      const ipAddress = getClientIp(req);

      const existingUser = await query(
        "SELECT id FROM users WHERE email = $1",
        [email],
      );

      if (existingUser.rows.length > 0) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }

      const hashedPassword = await bcryptjs.hash(password, 12);

      const result = await query(
        `INSERT INTO users (email, password_hash, consent_given_at)
         VALUES ($1, $2, NOW())
         RETURNING id, email, consent_given_at, created_at`,
        [email, hashedPassword],
      );

      const user = result.rows[0];

      await createAuditLog(
        user.id,
        "USER_REGISTERED",
        "user",
        user.id,
        { email },
        ipAddress,
      );

      const accessToken = generateAccessToken(user.id, email);
      const refreshToken = generateRefreshToken(user.id, email);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
        },
        accessToken,
      });
    } catch (err) {
      console.error('[AUTH ERROR]:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  },
);

router.post(
  "/login",
  authLimiter,
  validateRequest(loginSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, password } = req.body;
      const ipAddress = getClientIp(req);

      const result = await query(
        `SELECT id, email, password_hash FROM users
         WHERE email = $1 AND deleted_at IS NULL`,
        [email],
      );

      if (result.rows.length === 0) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const user: User = result.rows[0];

      const passwordMatch = await bcryptjs.compare(
        password,
        user.password_hash,
      );

      if (!passwordMatch) {
        await createAuditLog(
          user.id,
          "USER_LOGIN_FAILED",
          "user",
          user.id,
          { reason: "invalid_password" },
          ipAddress,
        );

        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      await createAuditLog(
        user.id,
        "USER_LOGIN",
        "user",
        user.id,
        {},
        ipAddress,
      );

      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id, user.email);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
        },
        accessToken,
      });
    } catch (err) {
      console.error('[AUTH ERROR]:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  },
);

router.post("/refresh", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token not found" });
      return;
    }

    const decoded = verifyRefreshToken(refreshToken);

    const result = await query(
      "SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL",
      [decoded.userId],
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    const newAccessToken = generateAccessToken(decoded.userId, decoded.email);

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error('[AUTH ERROR]:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
});

router.post(
  "/logout",
  verifyJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ipAddress = getClientIp(req);

      await createAuditLog(
        req.userId!,
        "USER_LOGOUT",
        "user",
        req.userId,
        {},
        ipAddress,
      );

      res.clearCookie("refreshToken");
      res.json({ message: "Logged out successfully" });
    } catch (err) {
      console.error('[AUTH ERROR]:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  },
);

export default router;
